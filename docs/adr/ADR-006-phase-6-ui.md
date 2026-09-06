# ADR-006: Phase 6 UI 전환 설계

## Status
Accepted

## Context

Phase 1–5 완료: Domain, Judge, Grader(+FakeExecutor), TypeScriptCompiler, WebWorkerExecutor, CE/RE/Timeout 안정화.

Phase 6 목표(PRD §31·§34, FR-001):

```text
문제 목록 → 상세 → 코드 작성 → Run/Submit → 결과 표시
```

실제 `WebWorkerExecutor`로 `Grader.grade`를 연결한다. 백엔드·인증·서버 저장은 Non-Goal.

제약:

- 클라이언트 전용. Next.js 16 App Router(`src/app/`) + React 19 + Tailwind 4.
- 기존 `page.tsx`는 create-next-app 기본 화면 → 교체.
- Monaco/CodeMirror 미설치.
- `Grader` / `Judge` / `Executor` 책임·Hybrid(CE만 조기 중단)는 ADR-003 유지.
- Worker URL은 ADR-004 기본값: `new URL("./solution-worker.ts", import.meta.url)`.
- 디렉터리·design system·`application/` 레이어를 미리 고정하지 않음.
- 본 ADR은 **설계만**. 프로덕션 구현·git commit은 별도 작업.

핵심 기존 API:

- `Grader.grade(code, testCases) → SubmissionResult`
- `WebWorkerExecutor(compiler, { timeoutMs?, createWorker? })`
- `Problem` / `TestCase` / `SubmissionStatus` 존재. 정적 문제 데이터 없음.

---

## Decision

### 1. 최소 라우트 / 컴포넌트 구조

과도한 design system·카드 그리드·랜딩 금지. PRD §34 작업면(좌: 문제, 우: 에디터, 하: Run/Submit·결과)을 그대로 따른다.

```text
src/
├── app/
│   ├── layout.tsx                 # metadata, 기존 폰트 유지(Inter 교체 금지)
│   ├── page.tsx                   # 문제 목록 (RSC 가능)
│   └── problems/
│       └── [id]/
│           └── page.tsx           # RSC: 문제 조회 → Client Workspace에 props
├── problems/                      # 정적 문제 데이터 (도메인 인스턴스)
│   ├── catalog.ts                 # PROBLEMS, getProblem(id)
│   ├── two-sum.ts
│   ├── reverse-string.ts
│   ├── sum-of-array.ts
│   └── valid-parentheses.ts       # (선택 5번째)
├── grading/
│   └── create-browser-grader.ts   # "use client" — Grader 조립 팩토리만
└── components/                    # UI만. 채점 로직 금지
    ├── problem-list.tsx
    ├── problem-workspace.tsx      # "use client" — 상태·Run/Submit
    ├── code-editor.tsx            # "use client" + dynamic(ssr:false)
    ├── action-bar.tsx             # Run / Submit / busy
    └── test-results.tsx           # SubmissionResult 표시
```

라우트:

| 경로 | 역할 |
|---|---|
| `/` | 문제 목록(제목 링크). 히어로/마케팅 없음 |
| `/problems/[id]` | 상세 + 에디터 + 결과. 없는 id → notFound |

대안과 트레이드오프:

| 안 | 내용 | 얻는 것 | 버리는 것 |
|---|---|---|---|
| **A (권장)** | `/` 목록 + `/problems/[id]` 작업면 | URL 공유·새로고침 가능, RSC로 문제 로드 | 파일 2개 |
| B | 단일 페이지에서 목록/상세 토글 | 라우트 최소 | 북마크·뒤로가기 어색 |
| C | PRD 예시대로 `ui/`·`application/` 풀 트리 | “완성 구조” | Phase 6에 조기 고정, 이동만 증가 |

**권장: A.** 컴포넌트는 위 5개면 충분. Button/Card 디자인 시스템·공통 레이아웃 프레임워크 금지.

UI 톤(코딩 도구):

- 단정한 작업면. 가독성·대비 우선(중립 회색 계열 + 명확한 구분선).
- 카드 남발·보라 그라데이션·Inter 기본 스택·랜딩 히어로 금지.
- 기존 Geist 폰트 유지 가능. 에디터 영역은 mono.

---

### 2. 에디터 선택

| 안 | 얻는 것 | 버리는 것 |
|---|---|---|
| **A CodeMirror 6 (권장)** | 번들 작음, 모듈식, Next 클라이언트 동적 로드와 충돌 적음 | Monaco보다 “IDE” 감 약함, TS 하이라이트 설정 약간 필요 |
| B Monaco (`@monaco-editor/react`) | 코딩테스트 UX 익숙, TS 모드 즉시 | 무거움, SSR/번들러 이슈 빈번, 학습 초점 아님 |
| C `<textarea>` | 의존성 0, 채점 연결 최우선 | 문법 하이라이트 없음(PRD 후보 밖) |

**권장: A CodeMirror 6** (`@codemirror/lang-javascript`의 typescript 지원).

- 에디터는 핵심 학습 대상이 아님(PRD §23) → 구현 편의·번들·Next 경계를 우선.
- 반드시 `next/dynamic(..., { ssr: false })` 또는 클라이언트 전용 자식으로만 마운트.
- 초기값: `functionSignature` 기반 스텁(또는 문제별 `starterCode` 문자열). 자동완성·타입체크 UI는 미구현(transpile-only CE 기대 관리: ADR-005).

Monaco는 “반드시 IDE 감”이 요구될 때만 재검토. textarea는 스파이크용으로만 허용(머지 전 CodeMirror로 교체).

---

### 3. Run vs Submit (ADR-003 Hybrid 정합)

Grader 정책은 **변경하지 않는다**.

- CE → 즉시 중단(Hybrid).
- RE / TLE / WA → 나머지 케이스 계속.
- `failFast` 플래그·Grader API 분기 **넣지 않음**.

Run/Submit 차이는 **넘기는 `testCases` 부분집합**으로만 둔다.

| 버튼 | 케이스 | UI 기대 |
|---|---|---|
| **Run** | `hidden !== true` 인 케이스만(샘플) | 빠른 피드백, 통과 수/케이스별 결과 |
| **Submit** | 전체 `problem.testCases` | 최종 `SubmissionStatus` (AC/WA/CE/RE/TLE) |

Domain 최소 확장:

```ts
// TestCase에 optional 필드만 추가 (기존 테스트 무파손)
interface TestCase<TInput, TOutput> {
  id: string;
  input: TInput;
  expected: TOutput;
  hidden?: boolean; // true면 Submit 전용
}
```

대안:

| 안 | 내용 | 평가 |
|---|---|---|
| **A (권장)** | `hidden?` + 동일 `grade()` | ADR-003 Hybrid 유지, DIP 유지, UI만 필터 |
| B | Run/Submit 모두 전체 케이스(라벨만 다름) | 구현 최소, PRD Scenario 1·2 차별 약함 |
| C | Grader에 `failFast` / mode 인자 | Phase 3 재개방, UI가 채점 정책 침투 |

**권장: A.** 초기 문제는 샘플 1–2 + hidden 2–3 정도로 구성. CE 조기 중단 시 `testResults.length < totalCount` → UI는 “미실행”으로 표시(ADR-003 부채 해소).

둘 다 성공 시에도 status 문구만 구분 가능(Run: “샘플 통과”, Submit: “Accepted”) — 채점 엔진 변경 없음.

---

### 4. 클라이언트에서만 Executor / Grader 조립 (RSC · Worker)

원칙: **Server Component는 채점 파이프라인을 import하지 않는다.**

```text
RSC page (problems/[id])
  └── getProblem(id)          // 정적 데이터만
  └── <ProblemWorkspace problem={...} />   // Client

ProblemWorkspace ("use client")
  └── useRef/useState로 Grader 1회 생성
  └── createBrowserGrader()
        └── new Grader(
              new WebWorkerExecutor(new TypeScriptCompiler()),
              new Judge(new ExactComparator())
            )
```

| 이슈 | 결정 |
|---|---|
| RSC 경계 | `create-browser-grader.ts`에 `"use client"`. page는 문제 props만 전달 |
| Worker URL | 기존 기본 `createWorker` 유지. 팩토리가 **클라이언트 번들**에 포함되면 `import.meta.url` 해석은 ADR-004와 동일 |
| `createWorker` 오버라이드 | 프로덕션 UI에서는 불필요. 테스트용으로만 유지 |
| 인스턴스 수명 | `useRef`로 workspace 마운트당 Grader 1개. 매 클릭마다 `new Grader` 해도 동작하나 Worker/Compiler 재생성 비용만 증가 |
| SSR | CodeMirror·Worker·`crypto`/브라우저 API는 클라이언트 전용. `dynamic(..., { ssr: false })` |
| 서버 Route Handler | **만들지 않음** (채점을 API로 옮기면 Non-Goal 위반) |

대안 B(전역 싱글톤 모듈)는 테스트·HMR에서 상태 꼬임 → 거부.

---

### 5. 정적 문제 데이터

위치: `src/problems/` (ADR-004 flat 톤. `data/`·CMS·JSON fetch 불필요).

초기 개수: **4문제** (PRD 3~5 범위).

| id | 제목 | 비고 |
|---|---|---|
| `two-sum` | Two Sum | 배열+목표, 대표 |
| `reverse-string` | Reverse String | 문자열 |
| `sum-of-array` | Sum of Array | 최소 난이도 스모크 |
| `valid-parentheses` | Valid Parentheses | 스택 |

5번째(Binary Search)는 여유분 — MVP DoD에 필수 아님.

문제 필드:

- Domain `Problem` 유지: `id`, `title`, `description`, `functionSignature`, `testCases`.
- 입력/출력/제한/예제 문구는 **`description` 마크다운(또는 plain)에 포함** → Domain 확장 최소화.
- `starterCode`가 필요하면 `problems/*.ts`에서 export하는 **뷰 보조 필드**로 두거나, UI가 `functionSignature`로 스텁 생성. Domain `Problem` 필수 필드 추가는 피한다.
- `input`은 Executor 계약대로 **단일 인자**(복수 값은 튜플/객체로 묶음 — ADR-004).

`catalog.ts`:

```ts
export const PROBLEMS: Problem[];
export function getProblem(id: string): Problem | undefined;
export function listProblems(): Pick<Problem, "id" | "title">[];
```

---

### 6. 상태 관리

**`useState` (+ `useRef`)면 충분.**

`ProblemWorkspace` 로컬 상태 예:

- `code: string`
- `phase: "idle" | "running" | "done"`
- `mode: "run" | "submit" | null` (마지막 동작)
- `result: SubmissionResult | null`
- `errorBanner?: string` (예외적 UI 실패; 채점 status와 혼동 금지)

전역 스토어(Zustand/Redux/Context 전역) **금지**. 문제 id는 URL. 코드 임시저장·localStorage는 Phase 6 필수 아님(후속).

동시 클릭: `phase === "running"`이면 Run/Submit 비활성. 취소용 Worker 풀은 만들지 않음(ADR-004·005).

---

### 7. 테스트 전략

| 층 | Phase 6 방침 |
|---|---|
| 기존 Unit (Judge/Grader/Executor/Compiler) | **회귀 게이트 필수** (`pnpm test`). UI가 깨뜨리면 안 됨 |
| Domain `hidden?` | 타입 optional이면 기존 테스트 수정 최소. 필터 헬퍼가 있으면 그 헬퍼만 unit |
| UI (RTL) | **최소**. `TestResults`가 fixture `SubmissionResult`로 status·passedCount·케이스 행을 그리는 스모크 1–2면 충분 |
| Monaco/CM 자체 | 테스트하지 않음 |
| E2E(실 Worker+브라우저) | MVP 비필수. 수동 스모크: CE/RE/TLE/WA/AC 각 1회 |
| Grader를 UI에서 Fake로 | 불필요. 조립만 실 Executor; 채점 로직은 이미 Fake로 검증됨 |

PRD의 “핵심 실행 흐름 Integration”은 Phase 4–5 범위로 이미 충족에 가깝다. Phase 6에서 새 Integration 스위트를 키우지 않는다.

---

### 8. 하지 말 것

- 로그인·회원가입·인증·세션
- 서버 API·서버 실행·제출 기록 DB·랭킹·리더보드·관리자
- 화려한 랜딩 히어로·마케팅 카피·대시보드/통계 스트립
- 카드 그리드 남발·보라/인디고 그라데이션 AI 슬롭·Inter 강제
- Design system / 컴포넌트 라이브러리 도입
- `application/`·`infrastructure/` 조기 고정, DDD 레이어 추가
- Grader/Judge/Executor 책임 혼합, `failFast` 정책 플래그
- Worker 풀·문제별 timeout UI·스택 트레이스 패널
- 다중 언어·Docker 샌드박스
- 본 ADR 범위의 프로덕션 구현을 이 문서 작성 작업에 섞기

---

### 9. 구현 순서 (후속 작업용)

1. **정적 문제** `src/problems/` 4문제 + `hidden` 샘플 구성. (필요 시 `TestCase.hidden?` 타입만 추가)
2. **라우트 골격**: `/` 목록, `/problems/[id]` + notFound. create-next-app 페이지 제거.
3. **`createBrowserGrader`** 클라이언트 팩토리. Workspace에서 Submit → 전체 케이스 `grade` → `TestResults`.
4. **Action bar + busy/미실행 표현** (CE early stop).
5. **Run** = visible 케이스 필터만 연결 (Grader 변경 없음).
6. **CodeMirror** dynamic import + starter 코드.
7. **시각 톤**: 분할 레이아웃, 대비·타이포만. 랜딩/카드 금지.
8. **`pnpm test` 회귀** + (선택) `TestResults` RTL 스모크.
9. 수동 스모크: AC / WA / CE / RE / TLE.

완료 조건(Phase 6 DoD):

- 목록→상세→편집→Run/Submit→결과 end-to-end가 브라우저에서 동작.
- 실 `WebWorkerExecutor`로 채점. status 5종이 UI에 구분 표시.
- 기존 Unit 회귀 녹색. 백엔드·인증 없음.

---

## Consequences

쉬워지는 것:

- Phase 1–5 파이프라인을 UI가 **조립만** 하므로 DIP·Hybrid가 그대로 증명됨.
- Run/Submit이 케이스 필터로만 갈라져 Grader 재개방이 없음.
- RSC는 데이터, Client는 실행 — Worker URL 이슈 범위가 명확.
- 문제 추가 = `problems/` 파일 추가 수준.

어려워지는 것 / 의식적 부채:

- transpile-only라 타입 오류는 CE가 아님 → 문제 설명/UI 힌트로 기대 관리.
- CodeMirror는 Monaco보다 IDE 감 약함.
- 코드/결과 localStorage·제출 이력 없음.
- 실 Worker E2E 자동화 없음 — 수동 스모크 의존.
- `hidden` 케이스 내용은 클라이언트에 노출(브라우저 채점 한계). “숨김”은 UX 구분일 뿐 보안 아님 — 문서화.
