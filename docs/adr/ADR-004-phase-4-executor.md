# ADR-004: Phase 4 Executor 전환 설계

## Status
Accepted

## Context

Phase 1–3 완료: Domain(`ExecutionResult`), Judge, Grader(`Executor` DI + `FakeExecutor`). Phase 4 목표는

```text
TypeScript → Compiler → JavaScript → Web Worker → ExecutionResult
```

이며, `Grader`는 수정 없이 `WebWorkerExecutor`로 교체 가능해야 한다.

제약:

- 클라이언트 전용. 백엔드·샌드박스·다중 언어·UI 금지.
- `Executor` 인터페이스 변경 최소화(가능하면 무변경).
- Compiler / Executor / Judge / Grader 책임 분리 유지.
- 대부분의 로직은 Worker 없이 Unit Test. Vitest.
- 디렉터리·`application/`·`infrastructure/`를 미리 고정하지 않음.
- PRD Phase 5는 Error Handling(CE/RE/Timeout) 추가. Phase 4에 넣을 최소 골격과 Phase 5 범위를 잘라야 함.

---

## Decision

### 1. 최소 디렉터리/파일

ADR-003과 같이 flat 배치. PRD의 `infrastructure/`·`application/`·`ui/`는 만들지 않는다.

```text
src/
├── domain/                 # 변경 없음
├── judge/                  # 변경 없음
├── grader/                 # 변경 없음
├── compiler/
│   ├── compiler.ts                 # Compiler 인터페이스 + CompileResult
│   ├── typescript-compiler.ts      # transpileModule 구현
│   └── typescript-compiler.test.ts
└── executor/
    ├── executor.ts                 # 기존 유지
    ├── fake-executor.ts            # 기존 유지
    ├── worker-protocol.ts          # Main↔Worker 메시지 타입
    ├── run-solution.ts             # JS 문자열 + input → 호출 (Worker/Node 공용)
    ├── run-solution.test.ts
    ├── solution-worker.ts          # Worker 엔트리 (얇은 래퍼)
    ├── web-worker-executor.ts      # Executor 실구현
    └── web-worker-executor.test.ts
```

대안과 트레이드오프:

| 안 | 내용 | 얻는 것 | 버리는 것 |
|---|---|---|---|
| A (권장) | `compiler/` + `executor/` flat | Phase 3 톤 유지, Compiler 단독 테스트, 이동 쉬움 | PRD 예시 트리와 불일치 |
| B | PRD대로 `infrastructure/compiler` + `infrastructure/executor` | 장기 레이어 정렬 | Phase 4에 조기 고정, 이동 비용만 증가 |

**권장: A.**

---

### 2. Compiler 책임·API

#### 책임

- **한다**: TS 소스 → JS 문자열. 실패 시 사람 읽기 가능한 `error` 문자열.
- **하지 않는다**: Worker 생성, `solution` 호출, 정답 비교, Timeout.

#### API

```ts
type CompileResult =
  | { ok: true; js: string }
  | { ok: false; error: string };

interface Compiler {
  compile(source: string): CompileResult;
}
```

동기 API로 둔다. `transpileModule`은 동기이고, Executor의 `async`는 Worker I/O 때문이다.

#### 배치: 컴파일은 Main Thread

```text
WebWorkerExecutor.execute(code, input)
  → compiler.compile(code)
      ├── ok:false → { status: "compile-error", error }
      └── ok:true  → Worker에 js + input 전달 → ExecutionResult
```

| 안 | 얻는 것 | 버리는 것 |
|---|---|---|
| Main에서 컴파일 후 JS만 Worker (권장) | CE에 Worker 불필요, Compiler Unit 단순, PRD 화살표와 일치 | Main이 TS lib를 로드 |
| Worker 안에서 컴파일 | Main 번들에서 TS 분리 가능 | Worker 시작·CE 경로 복잡, 테스트 어려움 |

#### TS→JS 방법 선택

| 안 | 얻는 것 | 버리는 것 |
|---|---|---|
| **A. `typescript.transpileModule` (권장)** | 이미 devDep, API 단순, 학습 목표와 이름 일치, 문법 변환 충분 | 풀 타입체크 없음, 브라우저 번들 큼 |
| B. Sucrase / esbuild-wasm | 작고 빠름 | 의존 추가, TS 진단·호환 차이, “Compiler” 학습 초점 희석 |
| C. `ts.Program` + `getPreEmitDiagnostics` | 실제 CE 메시지 | Phase 4에 과함, 설정·호스트 복잡 |

**권장: A.** `compilerOptions` 초안: `module: None`(또는 ESNext + IIFE로 감싸지 않음), `target: ES2020`, `strict`는 transpile에 거의 영향 없음. **타입 오류는 Phase 4에서 CE로 취급하지 않는다**(transpile만). 구문 오류·emit 실패만 `ok:false`.

`typescript`를 runtime dependency로 승격하는 것은 구현 시 처리(설계만).

---

### 3. Web Worker 프로토콜

상관 ID로 요청/응답을 묶는다. Timeout terminate 후 늦은 메시지를 무시하기 위함.

```ts
// Main → Worker
type WorkerRequest = {
  type: "execute";
  requestId: string;
  js: string;       // 이미 컴파일된 JS
  input: unknown;
};

// Worker → Main
type WorkerResponse =
  | {
      type: "result";
      requestId: string;
      status: "success";
      output: unknown;
      executionTime: number;
    }
  | {
      type: "result";
      requestId: string;
      status: "runtime-error";
      error: string;
      executionTime?: number;
    };
```

규칙:

- Worker는 **compile-error / timeout을 보내지 않는다**. CE는 Main(Compiler), Timeout은 Main(`terminate`).
- `requestId` 불일치·terminate 이후 도착 메시지는 Executor가 무시.
- 한 요청 = 한 Worker 실행 사이클을 Phase 4 기본으로 한다(재사용 최적화는 미룸).

---

### 4. 사용자 코드 호출 규약

PRD 초기 코드·시그니처와 정렬:

```ts
function solution(input: /* TInput */): /* TOutput */ { ... }
```

- **단일 인자 `input`**. 복수 인자는 문제 데이터에서 튜플/객체로 묶어 전달(Phase 6 문제 설계 몫).
- 전역/모듈 export 변형(`export default`, 클래스)은 Phase 4 범위 밖.
- `solution`이 없거나 함수가 아니면 `runtime-error`.

실행 방식 (Worker 내부, `run-solution.ts`로 추출):

| 안 | 얻는 것 | 버리는 것 |
|---|---|---|
| **`new Function`으로 user JS + `return solution` (권장)** | 스코프 통제, Node Unit 가능, bare `eval`보다 명확 | CSP 환경에선 제한(이 프로젝트 Non-Issue) |
| bare `eval` + 전역 `solution` | 구현 짧음 | 스코프 오염, 테스트·디버그 어려움 |
| Blob URL + `import()` 동적 모듈 | ESM 자연스러움 | 비동기·번들/경로 이슈, Phase 4 과함 |

권장 골격:

```ts
const runner = new Function(
  "input",
  `${js}\n; if (typeof solution !== "function") throw new Error("solution is not defined");\nreturn solution(input);`,
);
const output = runner(input);
```

`eval`/`new Function`은 **Worker(또는 `run-solution`)에만**. Main·Grader·Judge에 두지 않는다.

---

### 5. Timeout — Phase 4에 최소 구현

PRD: 기본 **1초**, 초과 시 `worker.terminate()` → `ExecutionResult.status: "timeout"`.

| 안 | 얻는 것 | 버리는 것 |
|---|---|---|
| Phase 5로 전부 이연 | Phase 4 표면적 축소 | 무한 루프 시 Worker 영구 점유, 학습 시나리오 5 불가, Executor 계약 불완전 |
| **Phase 4에 기본 Timeout (권장)** | Worker 존재 이유(UI 보호·무한 루프) 충족, Domain `timeout` 실제 생산 | terminate/재생성·레이스 세부 정교화 필요 |
| Phase 4는 성공만 | 구현 최소 | Fake만 알던 `timeout` 경로가 실구현과 단절 |

**권장: Phase 4에 넣는다.**

Phase 4 최소:

- 기본 `timeoutMs = 1000` (생성자 옵션으로 주입 가능 → 테스트에서 짧게).
- 타이머 만료 → `worker.terminate()` → `{ status: "timeout", executionTime }` (측정값 또는 limit).
- 다음 `execute`는 **새 Worker** 생성.

Phase 5로 미룸:

- CE/RE **메시지 품질**(진단 포맷, 스택 trim, 한글/영문 정책).
- Timeout·postMessage **레이스** hardened 처리, Worker 재사용 풀.
- 타입체크 기반 CE, 메모리/재귀 한도 등 샌드박스 흉내.
- `timeoutMs`를 문제별·UI 설정으로 노출.

정리: Phase 4 = **성공 경로 + CE/RE/Timeout이 ExecutionResult discriminant로 나오는 골격**. Phase 5 = **오류 경로의 견고함·메시지·경계 케이스**.

---

### 6. 테스트 전략

| 계층 | 대상 | Worker? |
|---|---|---|
| Unit | `TypeScriptCompiler` — 유효 TS→JS 키워드 존재, 구문 오류→`ok:false` | 없음 |
| Unit | `runSolution` — 정답 반환, throw→에러, `solution` 없음 | 없음 (`new Function`만) |
| Unit | `WebWorkerExecutor` — Fake `Compiler` + Fake `Worker`(또는 Worker factory 주입): CE short-circuit, success 매핑, RE 매핑, timeout 시 terminate 호출 | 가짜 |
| Integration (최소 1~2) | 실제 Worker 스크립트 + 짧은 timeout (환경이 허락할 때만) | 실제 |
| 유지 | Grader/Judge 기존 Unit — **재실행만**, 수정 없음 | FakeExecutor |

의도적으로 넣지 않음: E2E UI, 풀 타입체크 CE, 브라우저 보안 샌드박스 검증.

`WebWorkerExecutor`에 `Worker` 생성 함수·`Compiler`를 주입하면 Vitest(Node)에서 대부분 Unit으로 닫힌다.

---

### 7. Grader / Judge 변경 여부

**변경하지 않는다.**

- `Executor` 시그니처 유지 → `new Grader(webWorkerExecutor, judge)`만으로 DIP 충족.
- Domain `ExecutionResult` 이미 CE/RE/timeout/success 보유.
- Judge는 단건 비교만, Grader Hybrid·status 매핑은 ADR-003 그대로.

허용되는 예외(최소화):

- import 경로/배럴 정리 수준의 기계적 변경만. 동작·API 변경 금지.
- `Executor`에 메서드 추가 금지. Timeout 설정은 `WebWorkerExecutor` 생성자 옵션.

---

### 8. 구현 순서 (테스트 → 구현)

1. `Compiler` 타입 + **`typescript-compiler.test.ts` 먼저** → `TypeScriptCompiler` 구현.
2. **`run-solution.test.ts` 먼저** → `runSolution(js, input)` 구현.
3. `worker-protocol.ts` 메시지 타입 고정.
4. `solution-worker.ts` — 프로토콜 파싱 + `runSolution` 호출 + `postMessage` (얇게).
5. **`web-worker-executor.test.ts` 먼저** (Fake Compiler + Fake Worker):
   - compile 실패 → `compile-error`, Worker 미호출
   - 성공 → `success` + output + executionTime
   - Worker RE → `runtime-error`
   - 시간 초과 → terminate + `timeout`
6. `WebWorkerExecutor` 구현 — compile → postMessage → 대기/타임아웃.
7. (선택) 실제 Worker 스모크 Integration 1건.
8. 기존 `grader.test.ts` / `judge` 테스트 회귀(녹색 유지).

Phase 4 DoD:

- `WebWorkerExecutor`가 `Executor`를 구현하고 Grader 소스 수정 없이 교체 가능.
- 성공 경로: TS → JS → Worker → `success`.
- 최소 골격: `compile-error` / `runtime-error` / `timeout`이 discriminant로 반환.
- UI·백엔드·Judge/Grader 로직 변경 없음.

---

### 9. 하지 말 것

- UI (에디터, Run/Submit, 결과 패널) — Phase 6.
- Judge / Grader / Comparator / Domain 리팩터 또는 API 확장.
- `application/` 유스케이스 레이어, `problems/` 정적 데이터, 인증·API.
- 풀 타입체크 Compiler, Sucrase/esbuild 도입(필요 증거 없이).
- Docker·iframe 이중 샌드박스·CSP·메모리 제한.
- Worker 풀링, 멀티 언어, `solution` 외 엔트리포인트.
- Phase 5 과다 선행: 진단 메시지 폴리시, 레이스 harden, 문제별 timeout UI.
- ADR/설계 범위를 넘는 프로덕션 코드 작성(본 ADR은 설계 산출물).

---

## Consequences

쉬워지는 것:

- Phase 3 DIP가 Phase 4에서 실제로 증명됨(Fake ↔ WebWorker 교체).
- Compiler와 실행(`runSolution`)을 Worker 없이 단위 검증.
- Timeout 골격이 Domain·Grader 매핑과 처음부터 연결됨.

어려워지는 것 / 의식적 부채:

- `typescript` 브라우저 번들 비용 — 허용. 나중에 교체 가능하도록 `Compiler` 인터페이스로 격리.
- transpile-only라 타입 오류는 CE가 아님 — Phase 5/문서에서 명시.
- Worker terminate 후 재생성 단순 전략 — 성능은 Phase 6 실사용 전까지 무시.
- Vitest에서 실 Worker Integration은 환경 의존 — Fake Worker Unit을 주력으로 둠.
