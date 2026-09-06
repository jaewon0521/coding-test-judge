# ADR-003: Phase 3 Grader 전환 설계

## Status
Accepted

## Context

Phase 1(Domain)·Phase 2(Judge) 완료. Phase 3 목표는 `TestCases → Grader(Executor + Judge) → SubmissionResult`이며, `FakeExecutor`로만 검증한다. 실제 Web Worker/Compiler·UI는 금지.

제약:

- `Executor`는 실행만, `Judge`는 단건 정답 여부만. `Grader`가 종합.
- `Grader`는 구체 Executor가 아니라 `Executor` 인터페이스에만 의존.
- `SubmissionStatus` 매핑은 `ExecutionResult.status` discriminant로만. error 문자열 파싱 금지.
- Judge는 `SubmissionStatus`를 만들지 않음(현재 API 유지).
- 디렉터리·레이어를 미리 완성하지 않음. 지금은 필요한 경계만.

---

## Decision

### 1. 최소 디렉터리/파일 배치

지금 필요한 것만 추가한다. PRD의 `application/`·`infrastructure/`·`problems/`·`ui/`는 만들지 않는다.

```text
src/
├── domain/          # Phase 1 (변경 최소화)
├── judge/           # Phase 2 (변경 없음 원칙)
├── executor/
│   ├── executor.ts          # Executor 인터페이스만
│   └── fake-executor.ts     # Phase 3 테스트용 Fake
└── grader/
    ├── grader.ts
    └── grader.test.ts
```

대안과 트레이드오프:

| 안 | 내용 | 얻는 것 | 버리는 것 |
|---|---|---|---|
| A (권장) | `executor/` + `grader/` flat | Phase 2와 동일 톤, DIP 경계 명확, 이동 쉬움 | PRD 예시 트리와 불일치 |
| B | PRD대로 `application/` + `infrastructure/executor/` | 장기 레이어 정렬 | Phase 3에 과한 추상화, 조기 고정 |

**권장: A.** 책임이 드러난 뒤에만 옮긴다.

---

### 2. Executor 인터페이스 시그니처 (PRD 정렬)

```ts
// src/executor/executor.ts
import type { ExecutionResult } from "@/domain/execution";

export interface Executor {
  execute<TInput, TOutput>(
    code: string,
    input: TInput,
  ): Promise<ExecutionResult<TOutput>>;
}
```

- 정답/오답/점수를 모름. `ExecutionResult`만 반환.
- Phase 4의 `WebWorkerExecutor`가 동일 계약을 구현하면 `Grader` 수정 없음(DIP).
- Phase 3에서는 인터페이스 + Fake만. Compiler/Worker 금지.

---

### 3. FakeExecutor 설계

테스트에서 시나리오별 결과를 **호출 순서 큐**로 제어한다.

```ts
class FakeExecutor implements Executor {
  constructor(private readonly results: ExecutionResult[]) {}

  async execute<TInput, TOutput>(
    _code: string,
    _input: TInput,
  ): Promise<ExecutionResult<TOutput>> {
    const next = this.results.shift();
    if (!next) throw new Error("FakeExecutor: no more scripted results");
    return next as ExecutionResult<TOutput>;
  }
}
```

대안:

| 안 | 얻는 것 | 버리는 것 |
|---|---|---|
| 호출 순서 큐 (권장) | CE/RE/TLE/WA/AC 시나리오를 테스트가 직접 스크립트 | input별 분기 없음(Phase 3 불필요) |
| input → result 맵 | 케이스 id/입력 기반 재현 | 큐보다 복잡, 순서·중단 테스트가 어려움 |
| 항상 동일 결과 | 구현 최소 | 다건·중단·혼합 실패 검증 불가 |

규칙:

- `code`/`input`은 무시해도 됨(의도적). Grader가 넘기는지만 나중에 스파이용 필드로 확장 가능.
- 성공 결과는 `status: "success"` + `output` + `executionTime`.
- 실패는 Domain discriminant 그대로(`compile-error`/`runtime-error`/`timeout`).
- Fake는 프로덕션 경로에 넣지 않음. 테스트(및 Phase 3 검증) 전용.

---

### 4. Grader API와 status 매핑

```ts
class Grader {
  constructor(
    private readonly executor: Executor,
    private readonly judge: Judge,
  ) {}

  grade(
    code: string,
    testCases: TestCase[],
  ): Promise<SubmissionResult>;
}
```

흐름 (테스트 케이스당):

```text
testCase
  → executor.execute(code, input) → ExecutionResult
  → judge.judge(execution, expected) → JudgeResult
  → TestResult 조립
→ SubmissionResult 집계
```

#### ExecutionResult.status → SubmissionStatus (문자열 파싱 금지)

| ExecutionResult.status | Judge 결과 | TestResult.status | 집계에 기여하는 SubmissionStatus |
|---|---|---|---|
| `success` | passed | `passed` | (통과) |
| `success` | !passed | `failed` | `wrong-answer` |
| `compile-error` | passed:false | `failed` | `compile-error` |
| `runtime-error` | passed:false | `failed` | `runtime-error` |
| `timeout` | passed:false | `failed` | `time-limit-exceeded` |

매핑은 **항상 `execution.status` switch/discriminant**. `JudgeResult.error`·`execution.error` 문구로 CE/RE/TLE를 구분하지 않는다. error 필드는 UI/디버그용 전달만.

#### SubmissionResult.status 집계 우선순위

실행을 마친(또는 CE로 중단한) 뒤:

1. 하나라도 `compile-error` → `compile-error`
2. else 하나라도 `runtime-error` → `runtime-error`
3. else 하나라도 `timeout` → `time-limit-exceeded`
4. else 하나라도 WA(`success` + !passed) → `wrong-answer`
5. else → `accepted`

`passedCount` / `totalCount`: 실행에 포함된 테스트 기준. `totalCount = testCases.length`(CE 조기 중단 시에도 문제의 전체 개수 유지 — UI의 N/M과 학습 목적에 유리).

#### TestResult 필드

- 통과: `actual`, `expected`, `executionTime` (가능 시)
- WA: `actual`, `expected`, `executionTime`
- CE/RE: `expected`, `error`(execution.error 또는 JudgeResult.error 전달), 가능 시 `executionTime`
- TLE: `expected`, `error`는 Judge가 넣은 메시지 전달 가능하나 **상태 판정에는 미사용**; `executionTime` 전달

빈 `testCases`: `accepted`, `passedCount=0`, `totalCount=0`, `testResults=[]` (경계 케이스로 테스트).

---

### 5. 첫 실패 중단 vs 모든 테스트 실행

| 안 | 얻는 것 | 버리는 것 |
|---|---|---|
| 항상 fail-fast | 구현·OJ 관례 단순 | PRD UI의 “2/3 Passed”·학습 피드백과 충돌 |
| 항상 run-all | 피드백 최대 | CE를 매 케이스 반복하는 무의미한 호출 |
| **Hybrid (권장)** | CE만 즉시 중단, 그 외는 전부 실행 | fail-fast보다 약간 긴 루프 |

**권장: Hybrid**

- `compile-error` 최초 발생 시 **즉시 중단** (코드 단위 실패, PRD Scenario 3).
- `runtime-error` / `timeout` / WA는 **나머지 테스트 계속** (PRD Submit·결과 UI·학습 목적).
- 최종 `SubmissionStatus`는 위 우선순위로 집계.

Phase 3에서 정책 플래그(`failFast`)는 넣지 않는다. 필요해지면 Phase 6 Run vs Submit 분기 때 재검토.

---

### 6. 테스트 케이스 목록 (Vitest, FakeExecutor)

`grader.test.ts` — Judge는 실제 `Judge` + `ExactComparator` 사용 가능(이미 Phase 2 검증됨). Executor만 Fake.

1. 모든 테스트 success+정답 → `accepted`, passedCount === totalCount
2. 일부 success+오답, 나머지 통과 → `wrong-answer`, testResults에 passed/failed 혼재, passedCount 정확
3. 첫 실행 `compile-error` → `compile-error`, 이후 테스트 **미실행**(Fake 큐에 남은 결과 존재로 검증), totalCount는 전체
4. 중간 케이스 `runtime-error`, 이후 케이스 계속 → `runtime-error`, 이후 TestResult도 채워짐
5. 중간 케이스 `timeout` → `time-limit-exceeded` (status 필드로만 판정)
6. RE와 WA 동시 존재 → 집계는 `runtime-error` (우선순위)
7. TLE와 WA 동시 존재 → `time-limit-exceeded`
8. 빈 testCases → `accepted`, 0/0
9. DIP 스모크: Fake 교체만으로 Grader 소스 변경 없이 시나리오 전환 가능(구성으로 증명)

의도적으로 넣지 않음: Web Worker, Compiler, 실제 TS 코드 실행, UI, error 문자열 내용 assert로 상태 구분.

---

### 7. Phase 4에서 하지 말 것 / Phase 2와 경계

#### Phase 3에서 하지 말 것 (Phase 4+로 미룸)

- `WebWorkerExecutor`, TypeScript Compiler, Worker 메시지 프로토콜
- Timeout 타이머·`worker.terminate()` 실구현 (Fake의 `timeout` status면 충분)
- UI (Run/Submit, 에디터, 결과 패널)
- `application/` 유스케이스 레이어, 문제 정적 데이터, 백엔드
- Judge API 변경으로 SubmissionStatus 생성시키기

#### Phase 2(Judge)와의 경계

| | Judge | Grader |
|---|---|---|
| 입력 | 단건 `ExecutionResult` + expected | `code` + `TestCase[]` |
| 출력 | `JudgeResult` (passed) | `SubmissionResult` |
| 비교 | Comparator 위임 | Judge에 위임 (직접 Comparator 호출 금지) |
| CE/RE/TLE | passed:false + error 메시지 정도 | **status discriminant로 SubmissionStatus 매핑** |
| Executor 앎 | 모름 | 인터페이스만 의존 |

Phase 2 코드는 원칙적으로 수정하지 않는다. Grader가 Judge를 호출하는 쪽에서 적응한다.

#### Phase 4로 넘길 것

- `Executor` 실구현이 동일 인터페이스를 지키면 Grader 테스트·구현 재사용.
- Compile을 Executor 앞단/내부에 둘지는 Phase 4 ADR에서 결정. Phase 3 Grader는 “execute가 CE를 돌려줄 수 있다”만 가정.

---

### 8. 구현 순서 (테스트 → 구현)

1. `Executor` 인터페이스 추가 (`executor.ts`) — 테스트 컴파일에 필요, 구현체 없음.
2. `FakeExecutor` 추가 — 큐 기반.
3. **`grader.test.ts` 먼저** — 위 시나리오 목록으로 실패하는 테스트 작성.
4. `Grader` 구현 — 루프, Hybrid 중단, status 매핑, `SubmissionResult` 조립.
5. 테스트 녹색 확인 (Vitest).
6. (선택) 매핑 헬퍼가 커지면 `grader` 내부 private 함수로만 추출. 새 패키지/레이어 금지.

완료 조건(Phase 3 DoD):

- FakeExecutor로 Grader Unit Test 통과.
- Executor를 Fake로 바꿔도 Grader 수정 불필요.
- CE/RE/TLE/WA/AC가 `ExecutionResult.status`로만 구분됨.
- Worker/Compiler/UI 코드 없음.

---

## Consequences

쉬워지는 것:

- Phase 4에서 실 Executor 교체만으로 통합 가능.
- 채점 종합 로직을 Worker 없이 회귀 테스트.
- Judge/Grader 책임 분리 유지.

어려워지는 것 / 의식적 부채:

- Hybrid 중단 정책이 Run/Submit 차이와 다를 수 있음 → Phase 6에서 재검토.
- PRD 디렉터리 예시와 일시적 불일치 → 이후 이동 가능.
- CE 조기 중단 시 `testResults.length < totalCount` — UI는 Phase 6에서 “미실행” 표현을 고려.
