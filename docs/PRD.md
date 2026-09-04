# PRD — Browser Coding Test Judge

## 1. 프로젝트 개요

### 1.1 프로젝트명

**Browser Coding Test Judge**

### 1.2 한 줄 소개

브라우저에서 사용자가 TypeScript 코드를 작성하고, 테스트 케이스를 실행하여 코드의 정답 여부를 판정하는 클라이언트 기반 코딩 테스트 채점 시스템.

### 1.3 프로젝트 목적

이 프로젝트의 최우선 목적은 코딩 테스트 플랫폼을 만드는 것이 아니다.

다음 개발 역량을 실제 프로젝트를 통해 학습하는 것을 목적으로 한다.

- Clean Code
- 객체와 함수의 책임 분리
- 의존성 역전
- 테스트 가능한 코드 설계
- Unit Test
- Integration Test
- 예외 처리
- 비동기 코드 설계
- Web Worker 기반 코드 실행
- 리팩터링

따라서 서비스의 규모와 기능을 의도적으로 제한한다.

---

# 2. 문제 정의

일반적인 코딩 테스트 시스템은 서버에서 사용자 코드를 실행하고 채점한다.

```text
Browser
   ↓
Backend
   ↓
Code Execution Server
   ↓
Sandbox
   ↓
Judge
```

하지만 이 프로젝트에서는 백엔드를 사용하지 않는다.

```text
Browser
   │
   ├── Code Editor
   ├── TypeScript Compiler
   ├── Web Worker
   ├── Test Runner
   └── Judge
```

모든 코드 실행과 채점은 브라우저에서 수행한다.

이를 통해 서버 구축이나 데이터베이스 등의 부가적인 작업을 배제하고 **코드 실행 엔진과 채점 엔진의 설계 자체에 집중한다.**

---

# 3. 목표

## 3.1 핵심 목표

### Goal 1. 사용자 코드를 브라우저에서 실행한다.

사용자가 작성한 TypeScript 코드를 JavaScript로 변환한 후 Web Worker에서 실행한다.

### Goal 2. 실행과 채점을 분리한다.

코드 실행은 `Executor`가 담당하고, 정답 여부 판단은 `Judge`가 담당한다.

```text
User Code
    ↓
Executor
    ↓
ExecutionResult
    ↓
Judge
    ↓
JudgeResult
```

### Goal 3. 각 책임을 독립적으로 테스트할 수 있도록 설계한다.

예를 들어 `Grader` 테스트에서 실제 Web Worker를 사용하지 않아도 되도록 설계한다.

```text
Grader
   ↓
Executor interface
   ↓
FakeExecutor
```

### Goal 4. 실행 실패와 채점 실패를 구분한다.

다음 상태를 명확하게 구분한다.

- Compile Error
- Runtime Error
- Timeout
- Wrong Answer
- Accepted

---

# 4. 비목표 (Non-Goals)

프로젝트의 학습 범위를 제한하기 위해 다음 기능은 구현하지 않는다.

### Backend

- Backend API
- 서버 기반 코드 실행
- 사용자 인증
- 회원가입 / 로그인
- 서버 데이터베이스

### 코딩 테스트 플랫폼 기능

- 사용자 계정
- 문제 제출 기록 서버 저장
- 랭킹
- 리더보드
- 소셜 기능
- 문제 출제자 시스템
- 관리자 페이지

### 실행 환경

- Docker 기반 Sandbox
- 서버 CPU 제한
- 서버 메모리 제한
- 서버 프로세스 격리
- 다중 언어 실행 환경

---

# 5. 사용자

## Primary User

프로그래밍 학습을 위해 코딩 테스트 문제를 풀어보는 개발자.

특히 다음을 목적으로 사용하는 사용자를 대상으로 한다.

- TypeScript 학습
- 알고리즘 학습
- 코드 실행 결과 확인
- 테스트 기반 개발 연습

---

# 6. 핵심 사용자 시나리오

## Scenario 1 — 문제 풀이

1. 사용자가 문제를 선택한다.
2. 문제 설명을 확인한다.
3. 코드 에디터에 TypeScript 코드를 작성한다.
4. `Run` 버튼을 클릭한다.
5. 코드가 실행된다.
6. 테스트 케이스가 실행된다.
7. 각 테스트 케이스 결과가 표시된다.

---

## Scenario 2 — 정답 제출

1. 사용자가 코드를 작성한다.
2. `Submit` 버튼을 클릭한다.
3. 모든 테스트 케이스가 실행된다.
4. 각 결과를 채점한다.
5. 모든 테스트를 통과하면 `Accepted`를 표시한다.
6. 하나라도 실패하면 `Wrong Answer`를 표시한다.

---

## Scenario 3 — 컴파일 오류

사용자가 잘못된 TypeScript 코드를 작성한다.

```ts
function solution(numbers: number[] {
  return numbers.length;
}
```

실행 전에 컴파일 오류가 발생한다.

결과:

```text
Compile Error
```

테스트 케이스 실행은 진행하지 않는다.

---

## Scenario 4 — 런타임 오류

```ts
function solution(numbers: number[]) {
  return numbers[100].toString();
}
```

실행 중 오류가 발생한다.

결과:

```text
Runtime Error
```

---

## Scenario 5 — 무한 루프

```ts
function solution() {
  while (true) {}
}
```

설정된 실행 시간이 초과되면 Worker를 종료한다.

결과:

```text
Time Limit Exceeded
```

---

# 7. 기능 요구사항

## FR-001 문제 목록

사용자는 제공된 문제 목록을 확인할 수 있다.

문제는 애플리케이션 내부의 정적 데이터로 관리한다.

예:

```ts
interface Problem {
  id: string;
  title: string;
  description: string;
  functionSignature: string;
  testCases: TestCase[];
}
```

초기에는 3~5개의 문제만 제공한다.

예:

- Two Sum
- Reverse String
- Sum of Array
- Valid Parentheses
- Binary Search

---

# 8. 문제 상세

사용자는 문제 상세 화면에서 다음 정보를 확인할 수 있다.

- 문제 제목
- 문제 설명
- 입력 설명
- 출력 설명
- 제한사항
- 함수 시그니처
- 예제
- 테스트 케이스

---

# 9. 코드 에디터

사용자는 TypeScript 코드를 작성할 수 있다.

초기 코드:

```ts
function solution(input: number[]): number {
  // Write your code here
}
```

코드 에디터는 다음 기능을 제공한다.

- TypeScript 문법 지원
- 코드 작성
- 코드 수정
- 코드 실행

에디터 구현 자체는 프로젝트 핵심이 아니므로 적절한 기존 에디터 라이브러리를 사용할 수 있다.

---

# 10. 테스트 케이스

테스트 케이스는 다음 구조를 가진다.

```ts
interface TestCase<TInput, TOutput> {
  id: string;
  input: TInput;
  expected: TOutput;
}
```

예:

```ts
const testCase = {
  id: "1",
  input: [1, 2, 3],
  expected: 6,
};
```

테스트 케이스는 문제 데이터에 포함한다.

초기 버전에서는 서버에서 가져오지 않는다.

---

# 11. 실행 엔진

## 11.1 책임

Execution Engine의 책임은 **사용자 코드를 실행하는 것**이다.

Execution Engine은 다음을 판단하지 않는다.

- 정답인지
- 오답인지
- 점수
- 테스트 통과 여부

오직 코드 실행 결과만 반환한다.

---

## 11.2 Executor Interface

```ts
interface Executor {
  execute<TInput, TOutput>(
    code: string,
    input: TInput
  ): Promise<ExecutionResult<TOutput>>;
}
```

---

## 11.3 ExecutionResult

```ts
type ExecutionStatus =
  | "success"
  | "compile-error"
  | "runtime-error"
  | "timeout";

interface ExecutionResult<T> {
  status: ExecutionStatus;
  output?: T;
  error?: string;
  executionTime?: number;
}
```

---

# 12. TypeScript Compiler

사용자가 작성한 TypeScript 코드는 브라우저에서 JavaScript로 변환한다.

```text
TypeScript
    ↓
Compiler
    ↓
JavaScript
```

컴파일 오류가 발생하면 실행하지 않는다.

```text
TypeScript
    ↓
Compile Error
    ↓
Execution 종료
```

---

# 13. Web Worker

사용자 코드는 Main Thread에서 직접 실행하지 않는다.

```text
Main Thread
     │
     │ code + input
     ▼
Web Worker
     │
     │ execute
     ▼
ExecutionResult
     │
     ▼
Main Thread
```

목적:

- UI Thread 보호
- 무한 루프 대응
- 실행 환경 분리

---

# 14. Timeout

사용자 코드가 일정 시간 이상 실행되면 Timeout으로 처리한다.

초기 제한:

```text
1초
```

동작:

```text
Worker 실행
    ↓
Timer 시작
    ↓
1초 이내 완료
    → Success

1초 초과
    → worker.terminate()
    → Timeout
```

Timeout 값은 이후 설정 가능하도록 설계한다.

---

# 15. 채점 엔진

## 15.1 책임

Judge는 실행 결과와 기대 결과를 비교하여 정답 여부를 판단한다.

```text
actual
expected
   ↓
Judge
   ↓
pass / fail
```

---

# 16. Comparator

결과 비교 로직은 별도의 `Comparator`로 분리한다.

```ts
interface Comparator<T> {
  compare(
    actual: T,
    expected: T
  ): boolean;
}
```

이를 통해 다양한 채점 정책을 사용할 수 있다.

예:

```text
ExactComparator
NumberComparator
ArrayComparator
UnorderedArrayComparator
```

초기 버전에서는 Exact Comparator를 우선 구현한다.

---

# 17. Judge

```ts
interface JudgeResult {
  passed: boolean;
  actual?: unknown;
  expected?: unknown;
  error?: string;
}
```

Judge는 Comparator를 이용하여 결과를 판정한다.

```text
ExecutionResult
       ↓
      Judge
       ↓
   Comparator
       ↓
 JudgeResult
```

---

# 18. Grader

여러 테스트 케이스를 실행하고 결과를 종합하는 역할을 `Grader`가 담당한다.

```text
Problem
   ↓
Test Cases
   ↓
Grader
   │
   ├── Executor
   │
   └── Judge
   ↓
SubmissionResult
```

---

# 19. SubmissionResult

최종 제출 결과는 다음 상태를 가진다.

```ts
type SubmissionStatus =
  | "accepted"
  | "wrong-answer"
  | "compile-error"
  | "runtime-error"
  | "time-limit-exceeded";
```

예:

```ts
interface SubmissionResult {
  status: SubmissionStatus;
  passedCount: number;
  totalCount: number;
  testResults: TestResult[];
}
```

---

# 20. 테스트 실행 결과

각 테스트 케이스에 대한 결과를 확인할 수 있어야 한다.

```ts
interface TestResult {
  testCaseId: string;
  status: "passed" | "failed";
  actual?: unknown;
  expected?: unknown;
  executionTime?: number;
  error?: string;
}
```

UI 예시:

```text
─────────────────────────────
Test Results

✓ Test Case 1       2ms
✓ Test Case 2       1ms
✕ Test Case 3       3ms

2 / 3 Tests Passed

Expected: 10
Received: 8

Status: Wrong Answer
─────────────────────────────
```

---

# 21. 전체 실행 흐름

```text
User
 │
 │ Write TypeScript
 ▼
Code Editor
 │
 │ Run / Submit
 ▼
TypeScript Compiler
 │
 ├── Compile Error
 │       ↓
 │   Compile Error
 │
 ▼
Web Worker
 │
 ├── Runtime Error
 │       ↓
 │   Runtime Error
 │
 ├── Timeout
 │       ↓
 │   Time Limit Exceeded
 │
 ▼
ExecutionResult
 │
 ▼
Grader
 │
 ├── Executor
 │
 └── Judge
       │
       └── Comparator
 │
 ▼
SubmissionResult
 │
 ▼
UI
```

---

# 22. 아키텍처

초기 프로젝트는 다음과 같은 구조를 권장한다.

```text
src/
├── domain/
│   ├── problem/
│   │   ├── Problem.ts
│   │   └── TestCase.ts
│   │
│   ├── execution/
│   │   ├── ExecutionResult.ts
│   │   └── ExecutionStatus.ts
│   │
│   └── submission/
│       ├── SubmissionResult.ts
│       └── SubmissionStatus.ts
│
├── application/
│   ├── GradeSubmission.ts
│   └── RunTestCases.ts
│
├── infrastructure/
│   ├── compiler/
│   │   └── TypeScriptCompiler.ts
│   │
│   └── executor/
│       ├── Executor.ts
│       ├── WebWorkerExecutor.ts
│       └── FakeExecutor.ts
│
├── judge/
│   ├── Judge.ts
│   ├── Comparator.ts
│   └── ExactComparator.ts
│
├── problems/
│   ├── two-sum.ts
│   ├── reverse-string.ts
│   └── ...
│
└── ui/
    ├── ProblemList.tsx
    ├── ProblemDetail.tsx
    ├── CodeEditor.tsx
    └── TestResult.tsx
```

실제 구현 과정에서 구조가 더 적절하게 변경되는 것을 허용한다.

**디렉터리 구조를 처음부터 완성된 형태로 고정하지 않는다.**

---

# 23. 기술 스택

## 필수

- TypeScript
- React
- Next.js
- Web Worker

## 테스트

- Vitest
- React Testing Library

## Code Editor

다음 중 하나를 선택한다.

- Monaco Editor
- CodeMirror

에디터 선택은 핵심 학습 대상이 아니므로 구현 편의성을 우선한다.

---

# 24. 테스트 전략

이 프로젝트에서 테스트는 기능 구현 이후 추가하는 것이 아니라 **설계의 기준**으로 사용한다.

## Unit Test

다음 영역을 우선적으로 테스트한다.

### Comparator

```text
같은 값 → true
다른 값 → false
배열 비교
객체 비교
```

### Judge

```text
Execution 성공 + 정답 → Passed
Execution 성공 + 오답 → Failed
Execution 실패 → Failed
```

### Grader

```text
모든 테스트 통과 → Accepted
하나의 테스트 실패 → Wrong Answer
컴파일 오류 → Compile Error
Runtime Error → Runtime Error
Timeout → Time Limit Exceeded
```

---

# 25. Fake 객체

실제 Web Worker를 사용하는 테스트는 느리고 복잡해질 수 있다.

따라서 `Executor` 인터페이스를 이용해 Fake Executor를 만든다.

```ts
class FakeExecutor implements Executor {
  async execute() {
    return {
      status: "success",
      output: 6,
      executionTime: 1,
    };
  }
}
```

이를 통해 `Grader`를 실제 코드 실행 환경과 독립적으로 테스트한다.

---

# 26. 테스트 피라미드

```text
             E2E
            /   \
           /     \
      Integration
        /       \
       /         \
    Unit Tests
```

대부분의 비즈니스 로직은 Unit Test로 검증한다.

실제 Web Worker와 브라우저 동작은 Integration Test 또는 최소한의 E2E Test로 검증한다.

---

# 27. Clean Code 학습 목표

이 프로젝트에서는 다음 원칙을 의도적으로 적용한다.

### Single Responsibility

각 객체는 하나의 책임만 가진다.

```text
Compiler → 컴파일
Executor → 실행
Comparator → 비교
Judge → 채점
Grader → 전체 채점 흐름
```

---

### Dependency Inversion

상위 계층은 구체적인 구현이 아니라 인터페이스에 의존한다.

```text
Grader
   ↓
Executor
   ↑
 ┌───────────────┐
 │               │
FakeExecutor   WebWorkerExecutor
```

---

### Dependency Injection

구체적인 구현을 내부에서 직접 생성하지 않는다.

```ts
new Grader(executor, judge);
```

테스트에서는:

```ts
new Grader(fakeExecutor, fakeJudge);
```

실제 애플리케이션에서는:

```ts
new Grader(webWorkerExecutor, judge);
```

---

# 28. 오류 처리 정책

| 상황 | 결과 |
|---|---|
| TypeScript 컴파일 실패 | Compile Error |
| 실행 중 예외 | Runtime Error |
| 제한 시간 초과 | Time Limit Exceeded |
| 실행 성공 + 결과 불일치 | Wrong Answer |
| 모든 테스트 통과 | Accepted |

---

# 29. MVP 범위

첫 번째 버전에서는 다음만 구현한다.

### 반드시 구현

- 문제 목록
- 문제 상세
- TypeScript 코드 작성
- TypeScript 컴파일
- Web Worker 실행
- 테스트 케이스 실행
- Expected / Actual 비교
- Passed / Failed 표시
- Compile Error
- Runtime Error
- Timeout
- Accepted
- Wrong Answer
- Unit Test

### 구현하지 않음

- 로그인
- 서버
- DB
- 문제 저장 API
- 랭킹
- 사용자별 제출 기록
- 다중 언어
- Docker
- 온라인 Judge 서버

---

# 30. 개발 Phase

## Phase 1 — Domain

목표:

```text
Problem
TestCase
ExecutionResult
SubmissionResult
```

을 정의한다.

---

## Phase 2 — Judge

목표:

```text
Comparator
    ↓
Judge
    ↓
JudgeResult
```

를 구현한다.

테스트를 먼저 작성한다.

---

## Phase 3 — Grader

목표:

```text
TestCases
    ↓
Grader
    ↓
SubmissionResult
```

를 구현한다.

FakeExecutor를 이용하여 테스트한다.

---

## Phase 4 — Executor

목표:

```text
TypeScript
    ↓
Compiler
    ↓
JavaScript
    ↓
Web Worker
    ↓
ExecutionResult
```

를 구현한다.

---

## Phase 5 — Error Handling

다음 상황을 추가한다.

```text
Compile Error
Runtime Error
Timeout
```

---

## Phase 6 — UI

마지막으로 UI를 연결한다.

```text
Problem
Code Editor
Run
Submit
Test Results
```

---

# 31. Definition of Done

## 기본 실행

- [ ] TypeScript 코드를 입력할 수 있다.
- [ ] TypeScript 코드를 JavaScript로 변환할 수 있다.
- [ ] Web Worker에서 코드를 실행할 수 있다.
- [ ] 실행 결과를 Main Thread로 전달할 수 있다.

## 채점

- [ ] 테스트 케이스를 실행할 수 있다.
- [ ] Expected / Actual을 비교할 수 있다.
- [ ] 개별 테스트 결과를 표시할 수 있다.
- [ ] 전체 테스트 결과를 계산할 수 있다.

## 오류

- [ ] Compile Error를 처리한다.
- [ ] Runtime Error를 처리한다.
- [ ] Timeout을 처리한다.

## 테스트

- [ ] Comparator Unit Test
- [ ] Judge Unit Test
- [ ] Grader Unit Test
- [ ] Executor 테스트
- [ ] 핵심 실행 흐름 Integration Test

---

# 32. 성공 기준

이 프로젝트는 다음 질문에 "Yes"라고 답할 수 있으면 성공으로 판단한다.

### 실행

> 브라우저에서 사용자가 작성한 TypeScript 코드를 안전한 별도 실행 환경에서 실행할 수 있는가?

### 채점

> 실행 결과와 기대 결과를 독립적으로 비교할 수 있는가?

### 설계

> Executor를 WebWorkerExecutor에서 FakeExecutor로 교체해도 Grader의 코드를 수정할 필요가 없는가?

### 테스트

> 실제 브라우저나 Worker 없이도 대부분의 채점 로직을 테스트할 수 있는가?

### 유지보수

> 새로운 Comparator나 Executor를 추가할 때 기존 코드를 크게 수정하지 않아도 되는가?

---

# 33. 핵심 설계 원칙

이 프로젝트에서는 **기능을 많이 만드는 것보다 변경하기 쉬운 구조를 만드는 것을 우선한다.**

특히 다음 구조를 핵심으로 한다.

```text
                ┌──────────────────┐
                │     Compiler     │
                └────────┬─────────┘
                         ↓
                ┌──────────────────┐
                │     Executor     │
                └────────┬─────────┘
                         ↓
                ExecutionResult
                         ↓
                ┌──────────────────┐
                │      Judge       │
                └────────┬─────────┘
                         ↓
                ┌──────────────────┐
                │    Comparator    │
                └────────┬─────────┘
                         ↓
                  JudgeResult
```

각 컴포넌트는 자신의 책임만 알고 있어야 한다.

---

# 34. 최종 제품 형태

```text
┌──────────────────────────────────────────────────┐
│                  Coding Test                     │
├───────────────────────┬──────────────────────────┤
│                       │                          │
│   Problem             │      Code Editor         │
│                       │                          │
│   Two Sum             │  function solution(...)  │
│                       │  {                       │
│   Given an array...   │    ...                   │
│                       │  }                       │
│                       │                          │
│                       │                          │
├───────────────────────┴──────────────────────────┤
│                                                  │
│   [ Run ]                         [ Submit ]      │
│                                                  │
├──────────────────────────────────────────────────┤
│ Test Results                                     │
│                                                  │
│ ✓ Test Case 1                         2ms        │
│ ✓ Test Case 2                         1ms        │
│ ✕ Test Case 3                         3ms        │
│                                                  │
│ 2 / 3 Passed                                     │
│                                                  │
│ Status: Wrong Answer                             │
└──────────────────────────────────────────────────┘
```

---

# 35. 프로젝트의 궁극적인 학습 목표

이 프로젝트의 최종 목적은 코딩 테스트 사이트를 완성하는 것이 아니다.

다음과 같은 개발 사이클을 경험하는 것이 핵심이다.

```text
요구사항
   ↓
작은 설계
   ↓
테스트 작성
   ↓
구현
   ↓
실패
   ↓
리팩터링
   ↓
새로운 요구사항
   ↓
설계 변경
   ↓
테스트
   ↓
리팩터링
```

따라서 개발 과정에서 **"처음부터 완벽한 아키텍처를 만드는 것"을 목표로 하지 않는다.**

실제 요구사항과 테스트가 증가하면서 코드의 책임이 어떻게 분리되어야 하는지를 관찰하고, 필요한 시점에 리팩터링한다.