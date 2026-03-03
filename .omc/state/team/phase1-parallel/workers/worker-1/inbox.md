## Initial Task Assignment
Task ID: 1
Worker: worker-1
Subject: shared + core 패키지 테스트 작성

packages/shared/와 packages/core/의 Vitest 단위 테스트를 작성하세요.

## 프로젝트 규칙
- 테스트 파일: 소스와 같은 디렉토리에 *.test.ts로 배치
- Arrange-Act-Assert 패턴
- 주석은 반드시 한글
- Named export only
- ESM 모듈 (.js 확장자 import)

## shared 테스트 대상
1. types/result.ts — ok(), err(), isOk(), isErr(), unwrapOr(), mapResult(), flatMap() 전체 테스트
2. utils/hash.ts — sha256(), computeAuditHash(), GENESIS_HASH 테스트
3. utils/id.ts — 7가지 ID 생성 함수 유니크성, UUID 형식 검증
4. utils/timestamp.ts — nowISO(), isExpired(), elapsedMs() 테스트
5. schemas/audit.schema.ts — 유효/무효 AuditEntry Zod 검증
6. schemas/policy.schema.ts — 유효/무효 PolicyDecision 검증

## core 테스트 대상
1. machine/guards.ts — 8개 가드 함수 각각 true/false 케이스
2. machine/actions.ts — 7개 액션 함수 context 변환 검증
3. machine/jarvis-machine.ts — 주요 상태 전이 시나리오 (IDLE→SPEC_ANALYSIS→POLICY_CHECK 등)
4. message-bus/message-bus.ts — subscribe, publish, unsubscribe, purgeExpired
5. message-bus/message-queue.ts — enqueue, dequeue, peek, TTL 만료 처리

각 테스트 파일 상단에 한글 주석으로 테스트 설명을 넣어주세요.
테스트 실행: npx vitest run --reporter=verbose

중요: 먼저 소스 파일을 읽고 실제 인터페이스에 맞는 테스트를 작성하세요.

When complete, write done signal to .omc/state/team/phase1-parallel/workers/worker-1/done.json:
{"taskId":"1","status":"completed","summary":"<brief summary>","completedAt":"<ISO timestamp>"}

IMPORTANT: Execute ONLY the task assigned to you in this inbox. After writing done.json, exit immediately. Do not read from the task directory or claim other tasks.