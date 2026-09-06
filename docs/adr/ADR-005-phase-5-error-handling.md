# ADR-005: Phase 5 Error Handling 전환 설계

## Status
Accepted

## Context

Phase 1–4 완료: Domain `ExecutionResult`(success | compile-error | runtime-error | timeout), Judge, Grader, `TypeScriptCompiler`, `runSolution`, `WebWorkerExecutor`, `solution-worker`.

PRD Phase 5는 Compile Error / Runtime Error / Timeout “추가”로 적혀 있으나, Phase 4에서 **discriminant 골격은 이미 존재**한다. ADR-004가 Phase 5로 미룬 것은:

- CE/RE **메시지 품질**(진단 포맷, 스택 trim, 문구 일관성)
- Timeout·postMessage **레이스 harden**, 중복 settle 방지 강화
- Worker 재사용 풀(선택·여전히 미룸 가능)
- 풀 타입체크 CE(여전히 비목표일 수 있음)

현재 구현 요약:

| 위치 | 이미 있는 것 | 약한 점 |
|---|---|---|
| Domain | 네 status 모두 정의 | 변경 불필요 |
| Compiler | 구문 CE → `ok:false` + diagnostic 문자열 | 메시지 정규화·빈 진단 정책 미정 |
| `WebWorkerExecutor` | CE short-circuit, `settled` 플래그, timeout→terminate, Fake Worker DI | `error`/`messageerror` 미구독, 늦은 메시지·동시 settle 테스트 부족 |
| Worker | try/catch → RE postMessage | `Error` 외 throw·스택 정책 없음 |
| Judge | 실패 → `passed:false` + error; timeout → `"Time limit exceeded"` | 유지 |
| Grader | CE 조기중단, status→SubmissionStatus 매핑 | 유지 |

제약: 클라이언트 전용, UI/문제은행/백엔드 금지, Judge↔Executor 책임 분리, 테스트 먼저(Vitest, Fake 위주).

---

## Decision

### 1. Phase 4에 이미 있는 것 vs Phase 5에서 보강할 것

**Phase 4 (골격 — 유지·변경 최소화)**

- `ExecutionResult` discriminant 및 필드 형태
- Main Thread 컴파일 → CE면 Worker 미생성
- Worker는 success / runtime-error만 postMessage
- Timeout은 Main이 `terminate` 후 `status: "timeout"`
- `requestId` 상관 + 1회 `settled`로 Promise resolve
- Judge/Grader의 status 기반 매핑·CE early stop

**Phase 5 (오류 경로 harden — 본 ADR 범위)**

1. **메시지 정규화 정책** (CE/RE/Timeout 문구·포맷 일관)
2. **Worker `error` / `messageerror` → runtime-error** (hang→timeout 대신)
3. **레이스·중복 settle**: timeout vs 늦은 result, 잘못된 requestId, terminate 이후 이벤트 무시 — 테스트로 고정
4. **정리 보장**: listener 제거, timer clear, terminate는 한 번만(이미 골격 있음 → 경계 케이스 보강)

Phase 5는 **새 status를 만들지 않는다**. 이미 있는 세 오류 경로를 견고·일관되게 만든다.

---

### 2. 최소 변경 파일 목록

```text
src/executor/
├── error-message.ts              # NEW — 메시지 정규화 헬퍼(+ unit test)
├── error-message.test.ts         # NEW
├── web-worker-executor.ts        # error 이벤트·레이스 harden·정규화 적용
├── web-worker-executor.test.ts   # 레이스·error 이벤트 케이스 추가
├── solution-worker.ts            # RE 메시지 정규화 사용(얇게)
├── run-solution.ts               # 필요 시 throw 메시지 안정화만
└── run-solution.test.ts          # 기존 + 메시지 관련 보강(최소)

src/compiler/
├── typescript-compiler.ts        # CE 포맷을 정책에 맞춤(최소)
└── typescript-compiler.test.ts   # 정규화·비어 있지 않음 등
```

**의도적으로 안 건드림:** `domain/`, `judge/`, `grader/`, `executor.ts`(인터페이스), `fake-executor.ts`, UI, Worker 풀, 프로토콜 status 확장.

`worker-protocol.ts`는 메시지 스키마 변경 없음이 원칙. 필요하면 주석만.

대안과 트레이드오프:

| 안 | 내용 | 얻는 것 | 버리는 것 |
|---|---|---|---|
| **A (권장)** | Executor(+작은 헬퍼) 중심, Compiler CE만 살짝 | 변경 국소, Judge/Grader 무변경 | 메시지 정책이 두 곳(CE vs RE)에 나뉨 |
| B | Domain에 `normalizeExecutionError` | 단일 진입점 | Domain이 포맷 정책 소유 → 과도 |
| C | Judge에서 메시지 재작성 | UI 친화 문구 한곳 | Executor 출력과 Judge 표시 이중 진실 |

**권장: A.**

---

### 3. 메시지 정규화 정책 — 어디에 둘지

#### 정책 (문구)

| status | `ExecutionResult` | 사용자/Judge가 보는 문자열 | 규칙 |
|---|---|---|---|
| compile-error | `error: string` (필수) | Compiler가 만든 문자열 그대로(정규화 후) | 비어 있으면 안 됨. 기본 fallback: `"Compile error"` |
| runtime-error | `error: string` | Worker/헬퍼가 만든 문자열 | `Error.message` 우선. 비-Error는 `String(x)`. 빈 문자열이면 `"Runtime error"`. **스택은 넣지 않음**(Phase 5) |
| timeout | **error 필드 없음**(Domain 유지) | Judge가 `"Time limit exceeded"` | Executor는 status만. 메시지 중복 생성 금지 |

언어: Phase 4와 같이 **영문 짧은 문구**. 한글 UI 문구는 Phase 6.

타입체크 CE: **비목표 유지**. transpile diagnostic(구문/emit)만 CE. 타입 오류는 여전히 CE가 아님.

#### 배치 — 옵션

| 안 | 배치 | 얻는 것 | 버리는 것 |
|---|---|---|---|
| **A (권장)** | `executor/error-message.ts`에 `formatRuntimeError(unknown): string` (+ 선택 `ensureNonEmpty(msg, fallback)`). CE 포맷은 Compiler 내부 유지, fallback만 공유 가능 | RE는 실행 경계, CE는 컴파일 경계 — SRP 유지. Worker·Executor가 같은 RE 헬퍼 사용 | 헬퍼 파일 하나 추가 |
| B | Compiler에 전부 | 한 모듈 | Compiler가 Runtime 모름 — 책임 오염 |
| C | Executor만 정규화, Worker는 raw | Main에서 통일 | Worker가 보낸 긴/빈 문자열·프로토콜 불일치 비용 |

**권장: A.**

- **Compiler**: diagnostic → 사람이 읽을 문자열. 파일명`(line,col):` 형태 유지 가능. 결과가 비면 `"Compile error"`.
- **Worker (`solution-worker`)**: catch 시 `formatRuntimeError(error)` 후 postMessage.
- **Executor**: Worker `error` 이벤트·malformed payload 시에도 동일 헬퍼로 RE. CE는 Compiler 문자열을 재작성하지 않음(비어 있을 때만 fallback).
- **Timeout**: Executor가 error 문자열을 만들지 않음. Judge 기존 매핑 유지.

---

### 4. Worker error 이벤트, 늦은 메시지, terminate 레이스

#### 현재

- `message`만 구독. `settled`면 무시.
- timeout 시 `finish(timeout)` → clearTimeout·removeListener·terminate.
- Worker `error` 미처리 → 스크립트/치명적 실패 시 **timeout까지 대기**할 수 있음(오분류).

#### Phase 5 규칙

```text
execute()
  settled = false
  finish(result) = once {
    settled=true
    clear timer
    remove message + error(+messageerror) listeners
    terminate()
    resolve(result)
  }

  on message:
    requestId 불일치 | type≠result → ignore
    settled → ignore          // 늦은 메시지
    success | runtime-error → finish(...)

  on error / messageerror:
    settled → ignore
    finish({ status: "runtime-error", error: formatRuntimeError(...) })

  on timer:
    settled → ignore
    finish({ status: "timeout", executionTime: timeoutMs })
```

결정 포인트:

1. **First settle wins.** timeout과 result가 동시에 와도 한 번만 resolve. 이미 `settled`로 가능 — 테스트로 고정.
2. **Terminate 이후 메시지**: listener 제거 + settled로 이중 방어. FakeWorker는 terminate 후 emit해도 Executor가 무시해야 함.
3. **Worker `error` → RE (권장), timeout 아님.** 이유: 원인 분류가 정확하고, 사용자는 “시간 초과”가 아닌 실행 실패를 봄.
4. **`messageerror`**: 역직렬화 실패 등 → 동일하게 RE(또는 ignore 후 timeout). 권장: RE + 짧은 fallback `"Worker message error"`.
5. **WorkerLike 확장**: `addEventListener`/`removeEventListener`에 `"error"` (및 필요 시 `"messageerror"`) 허용. FakeWorker 테스트 더블도 동일 API.
6. **Worker 풀**: Phase 5에서도 **하지 않음**. 실행마다 생성·terminate 유지.

대안:

| 안 | error 이벤트 | 트레이드오프 |
|---|---|---|
| **RE로 매핑 (권장)** | 분류 정확 | timeout과 구분 테스트 필요 |
| 무시하고 timeout만 | 구현 단순 | 오분류, 학습 시나리오 왜곡 |
| 새 status `worker-crash` | 정밀 | Domain·Grader·Judge 연쇄 변경 — 과함 |

---

### 5. 테스트 목록 (Fake 위주)

테스트 먼저. 실 Worker Integration은 선택 1건 이하.

| # | 파일 | 시나리오 | Worker? |
|---|---|---|---|
| 1 | `error-message.test.ts` | Error → message; 비-Error → String; 빈 문자열 → fallback | 없음 |
| 2 | `typescript-compiler.test.ts` | 구문 CE 메시지 non-empty; (선택) fallback 경로 | 없음 |
| 3 | `run-solution.test.ts` | 기존 유지 + throw 메시지 안정성 | 없음 |
| 4 | `web-worker-executor.test.ts` | **timeout 후 늦은 success** → 결과는 timeout, resolve 1회 | Fake |
| 5 | 동상 | **success 직후 늦은 중복 message** → success 유지, 두 번 resolve 안 함 | Fake |
| 6 | 동상 | **requestId 불일치** 무시 후 올바른 응답으로 success | Fake |
| 7 | 동상 | **Worker `error` 이벤트** → runtime-error, terminate, timer 정리 | Fake |
| 8 | 동상 | timeout 경로에서 terminate 호출·listener 정리(기존 보강) | Fake |
| 9 | 동상 | CE 시 createWorker 미호출(기존 회귀) | Fake |
| 10 | (선택) Integration | 무한 루프 + 짧은 timeoutMs | 실 Worker |

**재실행만(수정 없음):** `grader.test.ts`, `judge.test.ts` — 회귀 녹색.

의도적으로 넣지 않음: UI E2E, 풀 타입체크 CE, 메모리/재귀 한도, Worker 풀 성능.

---

### 6. Grader / Judge 변경이 필요한지

**원칙: 변경하지 않는다.**

- status discriminant·매핑·CE early stop·timeout → `"Time limit exceeded"`는 이미 ADR-003/구현으로 충족.
- Phase 5는 Executor/Compiler/Worker 경계의 **생산 품질** 문제이지 채점 종합 문제가 아님.
- `SubmissionStatus` / `JudgeResult` API 확장 금지.
- error 문자열을 파싱해 status를 추론하는 로직 금지(ADR-003 유지).

허용 예외(최소화):

- import 경로 수준의 기계적 변경만.
- 회귀 테스트 실패 시에만 Judge/Grader를 고친다(설계상 기대하지 않음).

---

### 7. 하지 말 것

- UI (에디터, Run/Submit, 결과 패널, 오류 배너) — Phase 6
- 문제 은행·정적 `problems/`·인증·백엔드·랭킹
- Worker 재사용 풀 / 워밍
- 풀 타입체크 Compiler (`ts.Program` diagnostics) — 증거 없이 도입 금지
- Domain에 timeout `error` 필드 추가, 새 ExecutionStatus
- Judge/Grader/Comparator 리팩터 또는 API 확장
- Docker·iframe·CSP·메모리/CPU 샌드박스 흉내
- 문제별 `timeoutMs` UI 노출
- 한글 메시지 정책·스택 트레이스 UI
- `application/`·`infrastructure/` 조기 레이어 고정
- 본 ADR 범위 밖 프로덕션 기능 코드(설계만)

---

### 8. 구현 순서 (테스트 → 구현)

1. **`error-message.test.ts` 먼저** → `formatRuntimeError` / `ensureNonEmpty` 구현.
2. **`web-worker-executor.test.ts`에 레이스·error 이벤트 케이스 추가**(Red).
3. `WorkerLike`에 error 리스너 시그니처 확장 + FakeWorker 지원.
4. `WebWorkerExecutor` harden: error/`messageerror` 구독, finish once 보장, 늦은 메시지 ignore 테스트 녹색.
5. `solution-worker`에 `formatRuntimeError` 적용(+ 필요 시 `run-solution` 메시지 안정화).
6. Compiler CE: 빈 diagnostic fallback만 최소 보강 + 테스트.
7. 기존 Judge/Grader/Compiler/run-solution 테스트 회귀.
8. (선택) 실 Worker timeout Integration 1건.

Phase 5 DoD:

- CE/RE/Timeout이 **오분류 없이** 안정적으로 반환(특히 Worker error ≠ timeout).
- 메시지 비어 있지 않음·RE에 스택 미포함·timeout 문구는 Judge 단일 출처.
- timeout↔늦은 postMessage·중복 settle이 Fake 테스트로 고정.
- Judge/Grader/Domain/UI/Worker 풀/타입체크 CE 변경 없음.

---

## Consequences

쉬워지는 것:

- Phase 6 UI가 신뢰할 수 있는 오류 discriminant·문구에 의존 가능.
- 레이스·Worker crash가 테스트로 문서화되어 이후 리팩터 안전.
- 채점 파이프라인(Judge/Grader)을 건드리지 않아 DIP·회귀 비용 낮음.

어려워지는 것 / 의식적 부채:

- transpile-only라 타입 오류는 계속 CE가 아님 — 문서/Phase 6에서 사용자 기대 관리.
- Worker 풀 없음 — 매 실행 create/terminate 비용(실사용 전 무시).
- 스택 미표시 — 디버깅 UX는 Phase 6 이후 선택.
- `error` vs `messageerror` 브라우저 차이 — Fake로 계약 고정, 실환경 스모크는 선택.
