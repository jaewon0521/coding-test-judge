<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Browser Coding Test Judge

제품 요구사항의 원본은 `docs/PRD.md`이다. 구현·설계·범위 판단이 필요하면 이 문서를 따른다.

## 목적

코딩 테스트 플랫폼을 만드는 것이 아니라, Clean Code·책임 분리·의존성 역전·테스트 가능한 설계를 학습하는 것이 목적이다. 기능을 많이 만드는 것보다 변경하기 쉬운 구조를 우선한다. 처음부터 완벽한 아키텍처를 고정하지 않는다.

## Non-Goals

다음을 구현하지 않는다.

- Backend API, 서버 코드 실행, 인증, 회원가입/로그인, 서버 DB
- 랭킹, 리더보드, 제출 기록 서버 저장, 관리자 페이지
- Docker 샌드박스, 다중 언어

모든 코드 실행과 채점은 브라우저에서 수행한다.

## 설계 제약

- `Executor`는 실행만 담당하고, `Judge`는 정답 여부만 판단한다. 두 책임을 한 객체에 섞지 않는다.
- `Grader`는 구체 구현이 아니라 `Executor` 인터페이스에 의존한다. `FakeExecutor`로 교체해도 `Grader`를 수정하지 않아야 한다.
- Compile Error, Runtime Error, Timeout, Wrong Answer, Accepted를 명확히 구분한다.
- 디렉터리 구조를 처음부터 완성된 형태로 고정하지 않는다. 책임이 드러날 때 리팩터링한다.

## 개발 순서

Phase를 건너뛰지 않는다. UI를 먼저 구현하지 않는다.

1. Domain (`Problem`, `TestCase`, `ExecutionResult`, `SubmissionResult`)
2. Judge (`Comparator` → `Judge` → `JudgeResult`) — 테스트 먼저
3. Grader — `FakeExecutor`로 테스트
4. Executor (`TypeScript` → Compiler → Web Worker)
5. Error Handling (Compile Error, Runtime Error, Timeout)
6. UI (문제, 에디터, Run/Submit, 결과)

## 테스트

테스트는 기능 구현 이후 추가가 아니라 설계의 기준이다.

- Judge/Grader는 테스트를 먼저 작성한다.
- 대부분의 채점 로직은 실제 Web Worker 없이 Unit Test로 검증한다.
- 테스트 러너는 Vitest를 사용한다.

## 서브에이전트

상주 에이전트는 `.cursor/agents/`의 아래 넷뿐이다. Agency Agents 전체를 설치하지 않는다.

| 에이전트 | 언제 쓰는가 |
|---|---|
| `clean-code-reviewer` | 구현·리팩터링 직후. SRP, DIP, 오류 상태 구분, Non-Goal |
| `software-architect` | Phase 전환, 경계 설계, 트레이드오프. 백엔드/UI 선행 설계 금지 |
| `minimal-change-engineer` | 구현·버그 수정 시 범위 확장 방지 |
| `code-reviewer` | 동작·보안·유지보수 일반 리뷰. SRP/DIP는 `clean-code-reviewer` |

Frontend Developer, Application Security Engineer, Reality Checker 등은 Phase 4 또는 Phase 6에 필요할 때만 추가한다. 지금은 설치하지 않는다.
