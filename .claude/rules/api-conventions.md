---
globs: "packages/core/**,packages/policy-engine/**,packages/agents/**,packages/executor/**,packages/audit/**"
description: "백엔드 패키지 API 및 모듈 규약"
---

# API Conventions

## 모듈 구조
- 각 패키지에 index.ts barrel export 필수
- Named export만 사용 (default export 금지)
- Export 순서: types → functions → classes

## 함수 시그니처
- 모든 public 함수에 명시적 return type 필수
- 실패 가능 작업은 Result<T, E> 패턴 사용
- 비즈니스 로직에서 throw 금지 — error result 반환
- async 함수는 Promise<Result<T, E>> 반환

## 에이전트 통신
- 에이전트 간 메시지는 .claude/design/architecture-deep.md 7.2절 스키마 준수
- 메시지 페이로드는 Zod로 처리 전 검증
- 모든 에이전트 작업은 .claude/schemas/audit-log.json에 따른 AuditEntry 생성

## 상태 머신
- XState v5 머신 정의는 packages/core/에 배치
- 상태 전이 이벤트는 .claude/schemas/state-machine.json 준수
- Guard에서 PolicyDecision 검증 후 상태 전이
- 모든 상태에 timeout 처리 (무한 대기 금지)

## 에러 처리
- 도메인 특화 에러 타입 정의 (범용 Error 금지)
- 에러 코드 포함: AGENT_TIMEOUT | VALIDATION_FAILED | RESOURCE_EXHAUSTED | INTERNAL_ERROR
- 에러 전파 전 감사 로그에 기록
- 에러 무시 금지 (silent swallow 금지)
