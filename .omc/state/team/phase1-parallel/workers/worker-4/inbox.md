## Initial Task Assignment
Task ID: 4
Worker: worker-4
Subject: CLI 파이프라인 연결 — jarvis run 실제 동작

packages/cli/의 run 커맨드를 실제 에이전트 파이프라인과 연결하세요.

## 프로젝트 규칙
- TypeScript strict mode
- 주석은 반드시 한글
- Named export only
- Result<T,E> 패턴 사용
- any 타입 금지

## 구현 대상

### 1. commands/run.ts — 에이전트 파이프라인 연결
현재는 요청 검증 후 PENDING 반환만 합니다. 이를 실제 파이프라인으로 변경:
- XState 머신 인스턴스 생성 (packages/core의 jarvisMachine)
- 에이전트 순차 호출: orchestrator → spec-agent → policy-risk → planner → codegen → review → test-build
- 각 단계 결과를 다음 에이전트 입력으로 전달
- Gate 포인트에서 사용자 승인 처리 (Phase 1은 자동 승인 모드 지원)
- 전체 실행 결과를 RunResult로 반환

### 2. commands/status.ts — 실행 상태 추적
- 진행 중인 세션의 현재 상태 조회
- XState 머신의 현재 상태값 반환

### 3. commands/audit.ts — AuditStore 연동
- packages/audit의 AuditStore와 연결
- runId/sessionId로 감사 로그 조회

### 4. commands/stop.ts — 세션 중단
- 실행 중인 세션의 XState 머신에 CANCEL 이벤트 전송

### 5. 세션 관리자 (새 파일: session-manager.ts)
- 활성 세션 추적 (Map<sessionId, { actor, startedAt, status }>)
- 세션 생성, 조회, 종료 메서드

중요: 먼저 기존 CLI 소스 파일, core 패키지의 jarvis-machine.ts, agents 패키지의 에이전트들을 읽고 인터페이스를 파악하세요.
에이전트 인스턴스 생성에 필요한 deps(AuditLogger, PolicyEvaluator 등)를 적절히 구성하세요.

When complete, write done signal to .omc/state/team/phase1-parallel/workers/worker-4/done.json:
{"taskId":"4","status":"completed","summary":"<brief summary>","completedAt":"<ISO timestamp>"}

IMPORTANT: Execute ONLY the task assigned to you in this inbox. After writing done.json, exit immediately. Do not read from the task directory or claim other tasks.