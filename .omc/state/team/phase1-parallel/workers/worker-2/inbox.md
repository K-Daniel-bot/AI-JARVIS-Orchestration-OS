## Initial Task Assignment
Task ID: 2
Worker: worker-2
Subject: policy-engine + audit 패키지 테스트 작성

packages/policy-engine/와 packages/audit/의 Vitest 단위 테스트를 작성하세요.

## 프로젝트 규칙
- 테스트 파일: 소스와 같은 디렉토리에 *.test.ts로 배치
- Arrange-Act-Assert 패턴
- 주석은 반드시 한글
- Named export only
- ESM 모듈 (.js 확장자 import)
- 외부 서비스 mock 필수

## policy-engine 테스트 대상
1. engine/policy-evaluator.ts — evaluate() 전체 파이프라인 (ALLOW/DENY/GATE_REQUIRED 결과별), 빈 입력 에러
2. engine/risk-scorer.ts — 5차원 가중 Risk Score 계산 검증, 경계값 (0, 50, 76, 100)
3. engine/rule-matcher.ts — glob 패턴 매칭, 우선순위 (DENY>GATE_REQUIRED>ALLOW)
4. capability/token-manager.ts — issueToken, validateToken, consumeToken, revokeToken, cleanupExpired
5. capability/token-store.ts — CRUD + listBySession, listByStatus
6. rules/default-rules.ts — 11개 기본 규칙 구조 검증

## audit 테스트 대상
1. store/audit-store.ts — append(), 조회 메서드 5개, verifyIntegrity() (better-sqlite3 mock 또는 :memory: 사용)
2. integrity/hash-chain.ts — computeNextHash(), validateEntryHash(), getGenesisHash()
3. integrity/verifier.ts — 정상 체인 검증 통과, 변조된 체인 검증 실패
4. redaction/redactor.ts — 4개 카테고리 패턴 감지 및 치환, redactDeep() 재귀 탐색
5. query/audit-query.ts — 각 조회 메서드별 필터링 정확성

중요: 먼저 소스 파일을 읽고 실제 인터페이스에 맞는 테스트를 작성하세요.
SQLite 테스트는 better-sqlite3의 :memory: DB를 사용하거나 vi.mock()으로 모킹하세요.

When complete, write done signal to .omc/state/team/phase1-parallel/workers/worker-2/done.json:
{"taskId":"2","status":"completed","summary":"<brief summary>","completedAt":"<ISO timestamp>"}

IMPORTANT: Execute ONLY the task assigned to you in this inbox. After writing done.json, exit immediately. Do not read from the task directory or claim other tasks.