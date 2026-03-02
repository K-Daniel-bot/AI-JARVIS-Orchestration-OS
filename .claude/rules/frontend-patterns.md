---
globs: "packages/web/**"
description: "React 대시보드 프론트엔드 패턴"
---

# Frontend Patterns

## 컴포넌트 구조
- Functional components만 사용 (class components 금지)
- 비용이 큰 렌더에 React.memo 적용
- 스타일, 테스트, 컴포넌트를 같은 디렉토리에 배치
- 컴포넌트 파일: PascalCase.tsx

## 상태 관리
- XState v5로 전역 오케스트레이션 상태 관리
- React Context로 테마/사용자 설정 관리
- UI 전용 상태에 useState 사용
- React 상태에 민감 데이터 저장 금지

## 디자인 시스템
- Tailwind CSS utility 클래스 우선 (커스텀 CSS는 필요시만)
- 디자인 토큰: .claude/design/ui-ux.md 참조
- 3-panel 레이아웃: 왼쪽(네비게이션), 중앙(워크스페이스), 오른쪽(감사 로그)
- Framer Motion으로 게이트 승인 애니메이션
- 접근성: ARIA 레이블, 키보드 네비게이션, 스크린 리더 지원

## Gate UI 컴포넌트
- GateApprovalCard: what/why/risk 표시하여 사용자 승인
- TimelineView: 실행 트레이스와 undo 포인트 표시
- AuditLogPanel: 실시간 append-only 로그 뷰어
- AgentStatusBar: 9개 에이전트 건강 상태 인디케이터

## 프론트엔드 보안
- 렌더되는 사용자 콘텐츠 모두 sanitize (XSS 방지)
- UI에 raw secrets/토큰 표시 금지
- 민감 필드 기본 마스킹 (사용자 명시 액션으로만 공개)
- 프로덕션 빌드에 CSP 헤더 설정
