## Initial Task Assignment
Task ID: 2
Worker: worker-2
Subject: packages/executor — Action API 및 OS 추상화 레이어 구현

packages/executor 패키지를 완전히 구현하라. 이미 @jarvis/shared, @jarvis/policy-engine, @jarvis/audit가 빌드되어 있다.

## 필수 파일 구조
```
packages/executor/
  package.json          # name: @jarvis/executor, deps: zod 3.24.1, minimatch 10.0.1, @jarvis/shared (workspace:*), @jarvis/policy-engine (workspace:*), @jarvis/audit (workspace:*)
  tsconfig.json         # extends ../../tsconfig.base.json
  src/
    index.ts            # barrel export
    action-api/
      action-types.ts   # Action 타입 정의 (FS_READ, FS_WRITE, EXEC_RUN, APP_LAUNCH, BROWSER_NAVIGATE 등)
      action-executor.ts # ActionExecutor 클래스 — 액션 실행 + Capability Token 검증/소비
      action-result.ts  # 액션 실행 결과 타입
    os-abstraction/
      os-layer.ts       # OS 추상화 인터페이스 (readFile, writeFile, exec, launch 등)
      windows-adapter.ts # Windows OS 어댑터
      safe-executor.ts  # 안전한 명령 실행 (금지 명령 차단)
    enforcement/
      enforcement-hook.ts # Enforcement Hook — 액션 전/후 검증
      scope-checker.ts    # Capability scope 검증 (minimatch 기반)
```

## ActionExecutor 핵심 로직
1. 액션 요청 수신
2. Enforcement Hook (pre-execution): Capability Token 유효성 검증
3. scope 검증 (minimatch): 액션 대상이 토큰 scope에 포함되는지
4. Token 소비 (consumeToken)
5. OS 어댑터를 통한 실행
6. Enforcement Hook (post-execution): 결과 검증 + 감사 로그
7. ActionResult 반환

## Action 타입 목록
FS_READ, FS_WRITE, FS_DELETE, EXEC_RUN, APP_LAUNCH, APP_CLOSE, BROWSER_NAVIGATE, BROWSER_DOWNLOAD, CLIPBOARD_READ, CLIPBOARD_WRITE, PROCESS_KILL, MOBILE_CONTACT_READ, MOBILE_CALL_DIAL, MOBILE_SMS_SEND, MOBILE_SMS_READ, MOBILE_MESSENGER_SEND, MOBILE_MESSENGER_READ, MOBILE_APP_CONTROL, MOBILE_NOTIFICATION_READ

## 핵심 규칙
- 주석은 반드시 한글로 작성 (영문 주석 금지)
- Named export만 사용 (default export 금지)
- 모든 public 함수에 명시적 return type
- 2-space indentation, any 금지
- Result<T, E> 패턴 사용 (throw 금지)
- eval(), Function() 사용 금지
- 사용자 입력 파일 경로는 정규화 후 허용 범위 검증
- devDependencies에 @types/node 20.17.0, typescript 5.7.3, vitest 2.1.8

## OS 추상화 레이어
- OsLayer 인터페이스: readFile, writeFile, deleteFile, exec, launchApp, closeApp
- 모든 메서드는 Result<T, JarvisError> 반환
- WindowsAdapter: Node.js child_process, fs 기반 구현
- SafeExecutor: 금지 명령어 차단 (sudo, rm -rf /, regedit, format 등)

## 빌드 확인
구현 완료 후 반드시 `npx tsc --project packages/executor/tsconfig.json --noEmit` 실행하여 타입 체크 통과 확인

When complete, write done signal to .omc/state/team/jarvis-layer2/workers/worker-2/done.json:
{"taskId":"2","status":"completed","summary":"<brief summary>","completedAt":"<ISO timestamp>"}

IMPORTANT: Execute ONLY the task assigned to you in this inbox. After writing done.json, exit immediately. Do not read from the task directory or claim other tasks.