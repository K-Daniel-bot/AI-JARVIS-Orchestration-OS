---
name: policy-check
description: "정책 판정 수행. 작업 요청의 위험도 평가, 계약 위반 검사, 게이트 요구사항 결정에 사용."
user-invocable: true
---

# 정책 판정

## 사용 시점
- 새로운 작업 요청의 허용/거부 판정
- OS 조작 전 위험도 평가
- Capability Token 발급 전 정책 검증
- Gate 필요 여부 결정
- 패키지 설치/네트워크 접근 승인 전 검사

## 절차

1. 요청 분석
   - 작업 내용 파악 (어떤 리소스에 어떤 작업을 하는지)
   - 영향 범위 식별 (파일, 프로세스, 네트워크, 앱)
   - `.claude/contract.md` 절대 금지사항 대조

2. 5차원 위험도 평가
   - **가역성** (0-20): 되돌릴 수 있는가? (삭제=높음, 읽기=낮음)
   - **범위** (0-20): 영향 범위가 얼마나 넓은가? (시스템 전체=높음, 단일 파일=낮음)
   - **민감도** (0-20): 민감 데이터 접근이 있는가? (자격증명=높음, 공개 데이터=낮음)
   - **외부성** (0-20): 외부 시스템에 영향을 주는가? (네트워크 요청=높음, 로컬=낮음)
   - **권한** (0-20): 높은 권한이 필요한가? (관리자=높음, 일반 사용자=낮음)
   - **총점**: 0-100 (Risk Score)

3. 판정 결정
   ```
   Risk Score 0-25   → ALLOW (자동 허용)
   Risk Score 26-50  → CONSTRAINED_ALLOW (제약 조건 부여)
   Risk Score 51-75  → APPROVAL_REQUIRED (사용자 승인 필요)
   Risk Score 76-100 → DENY (자동 거부)
   ```

4. 게이트 요구사항 결정
   - GATE_PLAN (L1): 계획 변경이 있는 경우
   - GATE_APPLY_CHANGES (L2): 코드 변경 적용 시
   - GATE_DEPLOY (L3): 배포/실행 시
   - GATE_WEB_PRECHECK: URL 접근 시
   - GATE_DOWNLOAD: 파일 다운로드 시
   - GATE_DESTRUCTIVE: 파괴적 작업 (삭제, 포맷 등)
   - GATE_SAFETY_HOLD: 안전 보류 (비정상 패턴 감지)

5. 제약 조건 명세 (CONSTRAINED_ALLOW인 경우)
   ```
   fs:      { read_allow: [...], write_allow: [...], write_deny: [...] }
   exec:    { allow: [...], deny: [...] }
   network: { allow_domains: [...], deny_domains: [...] }
   ttl:     초 단위 유효시간
   ```

6. 판정 결과 출력
   - PolicyDecision 구조:
     - decision_id, outcome, risk_score
     - requires_gates 목록
     - constraints (해당 시)
     - 판정 근거 (한글 설명)
   - `.claude/schemas/policy-decision.json` 스키마 준수
   - 감사 로그 기록 (who, what, policy_ref, result)
