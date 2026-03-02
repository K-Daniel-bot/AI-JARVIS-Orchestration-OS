---
globs: "**/*.ts"
description: "모든 TypeScript 파일에 적용되는 보안 규칙"
---

# Security Rules

## 필수 검사
- secrets 하드코딩 금지 (API 키, 비밀번호, 토큰, 연결 문자열)
- 환경변수 또는 Credential Vault으로 민감값 관리
- 모든 사용자 입력은 Zod 스키마로 검증 후 처리
- SQL 쿼리는 반드시 파라미터화 (문자열 연결 금지)
- 사용자 입력의 파일 경로는 정규화 후 허용 범위 검증
- eval(), Function(), 사용자 입력 기반 동적 import() 사용 금지
- 에러 메시지에 스택 트레이스/시스템 경로 노출 금지
- 모든 HTTP 엔드포인트에 인증/인가 검사 필수
- ID 생성에 crypto.randomUUID() 사용 (Math.random() 금지)
- 민감 데이터 로깅 금지 (토큰, 비밀번호, PII) — redaction 패턴 사용

## TypeScript 보안
- `any` 타입 사용 금지 — `unknown` + type narrowing 사용
- 모든 tsconfig.json에 strict mode 활성화
- 값 변경 불가 시 readonly 속성 사용
- type assertion보다 `as const` assertion 선호
- Promise rejection 반드시 처리 (floating promises 금지)

## Import 보안
- workspace package.json에 등록된 패키지만 import
- 패키지명 정확히 확인 (typosquatting 방지)
- package.json에 정확한 버전 고정 (^ 또는 ~ 금지)
- CDN URL에서 import 금지
