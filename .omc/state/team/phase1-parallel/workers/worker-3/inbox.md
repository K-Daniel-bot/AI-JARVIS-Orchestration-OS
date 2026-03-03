## Initial Task Assignment
Task ID: 3
Worker: worker-3
Subject: executor OS 추상화 레이어 실제 구현

packages/executor/src/os-abstraction/의 스텁을 실제 Node.js API로 구현하세요.

## 프로젝트 규칙
- TypeScript strict mode
- 주석은 반드시 한글
- Named export only
- Result<T,E> 패턴 사용 (throw 금지)
- 보안: path traversal 방어, allowlist 명령어만 실행
- any 타입 금지

## 구현 대상

### 1. fs-handler.ts — 파일시스템 핸들러
- `read(path)` → node:fs/promises의 readFile 사용, Result 반환
- `write(path, content)` → writeFile 사용, 디렉토리 자동 생성(mkdir recursive)
- `list(path)` → readdir 사용, 파일 목록 반환
- `move(src, dst)` → rename 사용
- `delete(path)` → unlink 사용
- 모든 메서드에 path traversal 검증 포함 (.. 차단, 절대경로 강제)
- 에러는 JarvisError로 변환하여 Result.err() 반환

### 2. exec-handler.ts — 프로세스 실행 핸들러
- `run(command, args, options)` → node:child_process의 spawn/execFile 사용
- `kill(pid)` → process.kill 사용
- stdout/stderr 캡처, timeout 지원
- 허용된 명령어만 실행 (allowlist 패턴)
- 에러는 JarvisError로 변환

### 3. os-abstraction.ts — StubOsAbstraction을 NodeOsAbstraction으로 교체
- FsHandler, ExecHandler를 실제로 사용하는 구현체 작성
- detectPlatform()은 이미 구현됨, 유지
- StubOsAbstraction은 테스트용으로 유지하되 NodeOsAbstraction 추가

중요: 먼저 기존 소스 파일들을 모두 읽고, 인터페이스와 타입에 맞게 구현하세요.
packages/shared/src/types/errors.ts의 JarvisError, createError() 사용법도 확인하세요.
packages/executor/src/types/action-types.ts의 ActionResult 타입도 확인하세요.

When complete, write done signal to .omc/state/team/phase1-parallel/workers/worker-3/done.json:
{"taskId":"3","status":"completed","summary":"<brief summary>","completedAt":"<ISO timestamp>"}

IMPORTANT: Execute ONLY the task assigned to you in this inbox. After writing done.json, exit immediately. Do not read from the task directory or claim other tasks.