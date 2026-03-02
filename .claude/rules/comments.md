---
globs: "**/*.ts,**/*.tsx"
description: "모든 TypeScript/TSX 파일 주석 언어 규칙"
---

# 주석 언어 규칙

## 필수: 헤더 및 설명 주석은 한글

모든 `.ts` / `.tsx` 파일의 주석 텍스트는 **반드시 한글**로 작성한다.

```typescript
// ✅ 올바른 예시
// 정책 판정 엔진 — PolicyDecision을 생성하고 위험도를 계산한다
export function evaluatePolicy(input: PolicyInput): PolicyDecision { ... }

/** 에이전트 메시지 버스 — 에이전트 간 구조화된 메시지를 라우팅한다 */
export class AgentMessageBus { ... }

// ❌ 잘못된 예시 (영문 주석 금지)
// Evaluate policy and calculate risk score
export function evaluatePolicy(input: PolicyInput): PolicyDecision { ... }
```

## 적용 범위

| 항목 | 언어 |
|------|------|
| 파일 상단 헤더 주석 | **한글** 필수 |
| 함수/클래스 JSDoc | **한글** 필수 |
| 인라인 설명 주석 (`//`) | **한글** 필수 |
| 변수명 / 함수명 / 타입명 | 영문 유지 (식별자는 영문) |
| 문자열 리터럴 / 에러 메시지 | 영문 허용 (API 호환성) |
| TODO / FIXME 태그 | `// TODO: 한글 설명` 형식 |

## 이유

이 프로젝트는 한국어 우선 팀 환경이다.
한글 주석은 코드 의도를 팀 전체가 명확하게 이해하도록 돕는다.
