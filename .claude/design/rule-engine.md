# JARVIS OS — 정책 규칙 엔진 아키텍처

> 이 문서는 Policy Engine의 규칙 엔진 아키텍처를 정의합니다.
> Policy & Risk Agent가 `ALLOW/DENY/APPROVAL_REQUIRED/CONSTRAINED_ALLOW` 판정을
> 내리는 데 사용하는 JSON 기반 규칙 집합 구조와 평가 알고리즘을 기술합니다.
> 모든 규칙은 contract.md의 절대 원칙을 우선하며, 런타임에 Zod로 검증됩니다.

---

## 1. 아키텍처 개요

### 1.1 설계 원칙

```
규칙 정의 방식:
  - JSON 배열 기반의 단순 규칙 집합 (복잡한 DSL 불사용)
  - 각 규칙은 독립적으로 평가됨 (규칙 간 상태 공유 금지)
  - 규칙 파일은 packages/policy-engine/src/rules/ 디렉토리에 배치
  - 런타임에 Zod 스키마로 검증 후 로드 (손상된 규칙 자동 거부)

우선순위 계층:
  1순위: contract.md 규칙 (source: 'CONTRACT') — 절대 불변, 사용자 재정의 불가
  2순위: 사용자 정책 규칙 (source: 'USER') — 관리자 권한으로 추가/수정 가능
  3순위: 기본 정책 규칙 (source: 'DEFAULT') — 시스템 기본값, 사용자 정책으로 덮어쓰기 가능

판정 우선순위:
  DENY > APPROVAL_REQUIRED > CONSTRAINED_ALLOW > ALLOW

  - DENY가 하나라도 매칭되면 최종 판정은 DENY (다른 결과 무시)
  - GATE가 있고 DENY가 없으면 최종 판정은 APPROVAL_REQUIRED
  - CONSTRAINED만 있으면 제약 조건 병합 후 CONSTRAINED_ALLOW
  - 아무것도 매칭 안 되면 기본 정책(DEFAULT_POLICY) 적용
```

### 1.2 규칙 평가 파이프라인

```
PolicyEvaluationRequest 수신
  ↓
[1] 입력 Zod 스키마 검증 (VALIDATION_FAILED → 즉시 에러 반환)
  ↓
[2] 규칙 로드 & 정렬 (priority ASC, 같은 priority는 source 우선순위 적용)
  ↓
[3] 규칙 평가 루프 (모든 규칙 순회 — 조기 종료 없음, 전체 수집)
  │   ├─ matchCondition() 호출
  │   └─ 매칭 시 action.decision 분류별 버킷에 수집
  ↓
[4] 판정 합성 (DENY 버킷 → GATE 버킷 → CONSTRAINED 버킷 → ALLOW 버킷)
  ↓
[5] 제약 조건 병합 (CONSTRAINED_ALLOW 시 다중 constraints 교집합 적용)
  ↓
[6] PolicyDecision 생성 (schemas/policy-decision.json 준수)
  ↓
[7] 감사 로그 기록 (appendAuditEntry 호출)
  ↓
PolicyDecision 반환
```

---

## 2. 규칙 스키마

### 2.1 TypeScript 인터페이스 정의

```typescript
// packages/policy-engine/src/types/rule.ts

/** 정책 규칙 — 단일 판정 단위 */
interface PolicyRule {
  /** 규칙 식별자: rule_{카테고리}_{시퀀스} (예: rule_financial_001) */
  ruleId: string;
  /** 우선순위: 낮을수록 먼저 평가됨 (1 = 최우선, 최대 9999) */
  priority: number;
  /** 규칙 출처: CONTRACT(계약서) > USER(사용자) > DEFAULT(기본값) */
  source: 'CONTRACT' | 'USER' | 'DEFAULT';
  /** 규칙 활성화 여부 (false면 평가에서 제외) */
  enabled: boolean;
  /** 매칭 조건 */
  condition: RuleCondition;
  /** 매칭 시 수행할 판정 액션 */
  action: RuleAction;
  /** 한글 설명 (감사 로그 및 UI 표시용) */
  description: string;
  /** 규칙 생성 시각 (ISO 8601) */
  createdAt: string;
  /** 규칙 마지막 수정 시각 (ISO 8601) */
  updatedAt: string;
}

/** 규칙 매칭 조건 */
interface RuleCondition {
  /** 조건 유형: 패턴/임계값/복합 */
  type: 'PATTERN' | 'THRESHOLD' | 'COMPOSITE';

  /**
   * PATTERN: 문자열 필드 패턴 매칭
   * field 값: 'intent' | 'targets' | 'actionType' | 'rawInput' | 'role'
   */
  pattern?: {
    /** 검사할 요청 객체의 필드 경로 (점 표기법 허용: 'request.targets') */
    field: string;
    /** 매칭에 사용할 패턴 문자열 */
    match: string;
    /** 매칭 방식 */
    matchType: 'regex' | 'glob' | 'exact';
  };

  /**
   * THRESHOLD: 수치 필드 비교
   * field 값: 'riskScore' | 'tokenBudgetUsed' | 'fileCount'
   */
  threshold?: {
    /** 비교할 요청 또는 컨텍스트 수치 필드 경로 */
    field: string;
    /** 비교 연산자 */
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
    /** 비교 기준값 */
    value: number;
  };

  /**
   * COMPOSITE: 복합 조건 (AND/OR/NOT 조합)
   * 재귀적으로 RuleCondition을 포함할 수 있음
   */
  composite?: {
    operator: 'AND' | 'OR' | 'NOT';
    /** NOT 연산자는 반드시 conditions 배열에 정확히 1개 요소 */
    conditions: RuleCondition[];
  };
}

/** 규칙 매칭 시 수행할 판정 액션 */
interface RuleAction {
  /** 판정 결과 */
  decision: 'ALLOW' | 'DENY' | 'APPROVAL_REQUIRED' | 'CONSTRAINED_ALLOW';
  /** 판정 이유 코드 (감사 로그 reason_codes에 포함됨) */
  reasonCode: string;
  /**
   * CONSTRAINED_ALLOW 시 적용할 제약 조건
   * 여러 규칙이 매칭될 경우 constraints는 교집합(가장 엄격한 값)으로 병합됨
   */
  constraints?: {
    fs?: {
      readAllow?: string[];
      writeAllow?: string[];
      writeDeny?: string[];
    };
    exec?: {
      allow?: string[];
      deny?: string[];
    };
    network?: {
      allowDomains?: string[];
      denyDomains?: string[];
      default?: 'ALLOW' | 'DENY';
    };
  };
  /**
   * APPROVAL_REQUIRED 시 필요한 Gate 목록
   * 여러 규칙이 매칭될 경우 requiredGates는 합집합으로 병합됨
   */
  requiredGates?: string[];
}

/** 복합 조건 타입 별칭 (가독성용) */
type CompositeCondition = NonNullable<RuleCondition['composite']>;
```

### 2.2 규칙 파일 형식 (JSON)

```json
{
  "version": "1.0.0",
  "source": "CONTRACT",
  "lastUpdated": "2026-03-02",
  "rules": [
    {
      "ruleId": "rule_financial_001",
      "priority": 1,
      "source": "CONTRACT",
      "enabled": true,
      "condition": {
        "type": "PATTERN",
        "pattern": {
          "field": "request.rawInput",
          "match": "billing|payment|bank|계좌|결제|은행|송금|입금|출금",
          "matchType": "regex"
        }
      },
      "action": {
        "decision": "DENY",
        "reasonCode": "CONTRACT_FINANCIAL_DOMAIN"
      },
      "description": "금융/결제/은행 영역 자동화 차단 — contract.md §1",
      "createdAt": "2026-03-02T00:00:00+09:00",
      "updatedAt": "2026-03-02T00:00:00+09:00"
    }
  ]
}
```

---

## 3. 기본 규칙 집합 (contract.md 기반)

### 3.1 DENY 규칙 — 절대 차단 (source: CONTRACT, priority 1~10)

```json
[
  {
    "ruleId": "rule_financial_001",
    "priority": 1,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "request.rawInput",
        "match": "billing|payment|bank|뱅킹|간편결제|카카오페이|네이버페이|삼성페이|토스|페이코|키움|미래에셋|증권|OTP|공인인증",
        "matchType": "regex"
      }
    },
    "action": {
      "decision": "DENY",
      "reasonCode": "CONTRACT_FINANCIAL_DOMAIN"
    },
    "description": "금융/결제/은행/증권/간편결제 영역 자동화 차단 — contract.md §1, §9"
  },
  {
    "ruleId": "rule_sysfile_002",
    "priority": 2,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "request.targets",
        "match": "^(Windows|System|AppData|/etc/|/usr/|/bin/|/sbin/).*",
        "matchType": "regex"
      }
    },
    "action": {
      "decision": "DENY",
      "reasonCode": "CONTRACT_SYSTEM_FILE_ACCESS"
    },
    "description": "OS 시스템 파일 접근 차단 — contract.md §1 (Windows/**, System/**, AppData/**)"
  },
  {
    "ruleId": "rule_admin_003",
    "priority": 3,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "request.rawInput",
        "match": "sudo|regedit|powershell_admin|runas|UAC|관리자 권한",
        "matchType": "regex"
      }
    },
    "action": {
      "decision": "DENY",
      "reasonCode": "CONTRACT_ADMIN_AUTO_EXEC"
    },
    "description": "관리자 권한 자동 실행 차단 — contract.md §1 (sudo, regedit, powershell_admin)"
  },
  {
    "ruleId": "rule_plainlog_004",
    "priority": 4,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "COMPOSITE",
      "composite": {
        "operator": "AND",
        "conditions": [
          {
            "type": "PATTERN",
            "pattern": {
              "field": "request.intent",
              "match": "LOG|WRITE|SAVE|STORE|RECORD",
              "matchType": "regex"
            }
          },
          {
            "type": "PATTERN",
            "pattern": {
              "field": "request.rawInput",
              "match": "password|비밀번호|passwd|secret|token|api_key|apikey|credential",
              "matchType": "regex"
            }
          }
        ]
      }
    },
    "action": {
      "decision": "DENY",
      "reasonCode": "CONTRACT_PLAINTEXT_SECRET_LOG"
    },
    "description": "비밀번호/토큰 평문 로깅 시도 차단 — contract.md §1, §6"
  },
  {
    "ruleId": "rule_mobile_call_005",
    "priority": 5,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "request.intent",
        "match": "PHONE_CALL|SEND_SMS|MAKE_CALL|DIAL",
        "matchType": "regex"
      }
    },
    "action": {
      "decision": "DENY",
      "reasonCode": "CONTRACT_MOBILE_CALL_WITHOUT_APPROVAL"
    },
    "description": "사용자 승인 없는 전화/문자 전송 차단 — contract.md §1"
  },
  {
    "ruleId": "rule_mobile_recording_006",
    "priority": 6,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "request.intent",
        "match": "RECORD_CALL|AUDIO_RECORD|CALL_RECORDING",
        "matchType": "regex"
      }
    },
    "action": {
      "decision": "DENY",
      "reasonCode": "CONTRACT_CALL_RECORDING_FORBIDDEN"
    },
    "description": "통화 녹음 기능 사용 차단 — contract.md §1"
  },
  {
    "ruleId": "rule_data_exfil_007",
    "priority": 7,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "COMPOSITE",
      "composite": {
        "operator": "AND",
        "conditions": [
          {
            "type": "PATTERN",
            "pattern": {
              "field": "request.intent",
              "match": "SEND|UPLOAD|TRANSMIT|EXPORT",
              "matchType": "regex"
            }
          },
          {
            "type": "PATTERN",
            "pattern": {
              "field": "request.targets",
              "match": "contacts|messages|chat|messenger|카카오톡|라인",
              "matchType": "regex"
            }
          }
        ]
      }
    },
    "action": {
      "decision": "DENY",
      "reasonCode": "CONTRACT_MESSENGER_EXFIL"
    },
    "description": "메신저 대화 내용 외부 서버 전송 차단 — contract.md §1"
  },
  {
    "ruleId": "rule_single_agent_008",
    "priority": 8,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "request.intent",
        "match": "BYPASS_ORCHESTRATOR|DIRECT_EXECUTE|SKIP_GATE",
        "matchType": "regex"
      }
    },
    "action": {
      "decision": "DENY",
      "reasonCode": "CONTRACT_ROLE_SEPARATION"
    },
    "description": "단일 에이전트 전권 실행 시도 차단 — contract.md §1 (역할 분리 필수)"
  }
]
```

### 3.2 APPROVAL_REQUIRED 규칙 — Gate 필요 (source: CONTRACT, priority 11~30)

```json
[
  {
    "ruleId": "rule_network_011",
    "priority": 11,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "COMPOSITE",
      "composite": {
        "operator": "OR",
        "conditions": [
          {
            "type": "PATTERN",
            "pattern": {
              "field": "request.requiresWebAccess",
              "match": "true",
              "matchType": "exact"
            }
          },
          {
            "type": "PATTERN",
            "pattern": {
              "field": "request.intent",
              "match": "HTTP_REQUEST|API_CALL|DOWNLOAD|FETCH|SCRAPE",
              "matchType": "regex"
            }
          }
        ]
      }
    },
    "action": {
      "decision": "APPROVAL_REQUIRED",
      "reasonCode": "NETWORK_ACCESS_REQUIRES_GATE",
      "requiredGates": ["GATE_PLAN", "GATE_WEB_PRECHECK"]
    },
    "description": "외부 네트워크 접근 시 사용자 승인 필요 — contract.md §1"
  },
  {
    "ruleId": "rule_pkg_install_012",
    "priority": 12,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "request.intent",
        "match": "PACKAGE_INSTALL|PKG_ADD|NPM_INSTALL|PIP_INSTALL|BREW_INSTALL",
        "matchType": "regex"
      }
    },
    "action": {
      "decision": "APPROVAL_REQUIRED",
      "reasonCode": "PACKAGE_INSTALL_REQUIRES_GATE",
      "requiredGates": ["GATE_PLAN", "GATE_TOOL_INSTALL"]
    },
    "description": "패키지 설치 시 라이선스/유지관리 상태 표시 후 승인 필요 — contract.md §1, policy-risk.md §3.5"
  },
  {
    "ruleId": "rule_proc_exec_013",
    "priority": 13,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "request.intent",
        "match": "PROCESS_EXEC|RUN_SCRIPT|SHELL_CMD|SPAWN_PROCESS",
        "matchType": "regex"
      }
    },
    "action": {
      "decision": "APPROVAL_REQUIRED",
      "reasonCode": "PROCESS_EXEC_REQUIRES_GATE",
      "requiredGates": ["GATE_PLAN", "GATE_EXECUTION"]
    },
    "description": "프로세스/스크립트 실행 시 사용자 승인 필요 — contract.md §1"
  },
  {
    "ruleId": "rule_file_delete_014",
    "priority": 14,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "request.intent",
        "match": "FILE_DELETE|DIR_DELETE|RMDIR|UNLINK|BULK_DELETE|RM_RF",
        "matchType": "regex"
      }
    },
    "action": {
      "decision": "APPROVAL_REQUIRED",
      "reasonCode": "FILE_DELETE_REQUIRES_GATE",
      "requiredGates": ["GATE_DESTRUCTIVE"]
    },
    "description": "파일/디렉토리 삭제 시 파괴적 작업 게이트 필요 — contract.md §1"
  },
  {
    "ruleId": "rule_svc_restart_015",
    "priority": 15,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "request.intent",
        "match": "SERVICE_RESTART|SERVICE_STOP|DAEMON_RESTART|KILL_PROCESS",
        "matchType": "regex"
      }
    },
    "action": {
      "decision": "APPROVAL_REQUIRED",
      "reasonCode": "SERVICE_RESTART_REQUIRES_GATE",
      "requiredGates": ["GATE_DESTRUCTIVE"]
    },
    "description": "서비스/프로세스 재시작/종료 시 사용자 승인 필요 — contract.md §1"
  },
  {
    "ruleId": "rule_mobile_action_016",
    "priority": 16,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "request.intent",
        "match": "MOBILE_.*|PHONE_.*|APP_LAUNCH",
        "matchType": "regex"
      }
    },
    "action": {
      "decision": "APPROVAL_REQUIRED",
      "reasonCode": "MOBILE_ACTION_REQUIRES_GATE",
      "requiredGates": ["GATE_MOBILE_ACTION"]
    },
    "description": "모든 모바일 액션은 Gate 필수 — contract.md §4 (모바일 제안모드 강제)"
  },
  {
    "ruleId": "rule_login_required_017",
    "priority": 17,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "request.requiresLogin",
        "match": "true",
        "matchType": "exact"
      }
    },
    "action": {
      "decision": "APPROVAL_REQUIRED",
      "reasonCode": "LOGIN_REQUIRED_GATE",
      "requiredGates": ["GATE_PLAN", "GATE_WEB_PRECHECK"]
    },
    "description": "로그인이 필요한 웹 접근 시 승인 필요 — policy-risk.md §3.3"
  }
]
```

### 3.3 CONSTRAINED_ALLOW 규칙 — 제약 조건부 허용 (source: CONTRACT/DEFAULT, priority 31~60)

```json
[
  {
    "ruleId": "rule_fs_write_031",
    "priority": 31,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "request.intent",
        "match": "FILE_WRITE|FILE_CREATE|FILE_MODIFY|CODE_GENERATE",
        "matchType": "regex"
      }
    },
    "action": {
      "decision": "CONSTRAINED_ALLOW",
      "reasonCode": "FS_WRITE_SCOPE_CONSTRAINED",
      "constraints": {
        "fs": {
          "writeAllow": ["/project/**", "/workspace/**"],
          "writeDeny": ["/Windows/**", "/System/**", "/Users/**/AppData/**", "/**/.env", "/**/secrets/**"]
        }
      }
    },
    "description": "파일 쓰기는 프로젝트/워크스페이스 범위로 제한, 시스템 경로 차단"
  },
  {
    "ruleId": "rule_exec_constrained_032",
    "priority": 32,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "request.intent",
        "match": "BUILD|TEST|LINT|TYPECHECK|FORMAT",
        "matchType": "regex"
      }
    },
    "action": {
      "decision": "CONSTRAINED_ALLOW",
      "reasonCode": "EXEC_SAFE_COMMANDS_ONLY",
      "constraints": {
        "exec": {
          "allow": ["node", "python", "git", "pnpm", "npm", "npx", "tsc", "vitest", "eslint"],
          "deny": ["sudo", "powershell_admin", "regedit", "format", "del /f", "rm -rf /"]
        }
      }
    },
    "description": "빌드/테스트/린트 실행은 안전한 명령어만 허용"
  },
  {
    "ruleId": "rule_network_constrained_033",
    "priority": 33,
    "source": "DEFAULT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "request.intent",
        "match": "NPM_REGISTRY|PIP_INDEX|PACKAGE_DOWNLOAD",
        "matchType": "regex"
      }
    },
    "action": {
      "decision": "CONSTRAINED_ALLOW",
      "reasonCode": "PACKAGE_REGISTRY_ONLY",
      "constraints": {
        "network": {
          "allowDomains": ["registry.npmjs.org", "pypi.org", "registry.yarnpkg.com"],
          "denyDomains": ["banking.*", "payment.*"],
          "default": "DENY"
        }
      }
    },
    "description": "패키지 레지스트리 접근은 공식 레지스트리 도메인만 허용"
  },
  {
    "ruleId": "rule_guest_readonly_034",
    "priority": 34,
    "source": "DEFAULT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "subject.role",
        "match": "Guest",
        "matchType": "exact"
      }
    },
    "action": {
      "decision": "CONSTRAINED_ALLOW",
      "reasonCode": "GUEST_READONLY_ONLY",
      "constraints": {
        "fs": {
          "readAllow": ["/project/docs/**", "/project/README*"],
          "writeAllow": [],
          "writeDeny": ["/**"]
        },
        "exec": {
          "allow": [],
          "deny": ["*"]
        },
        "network": {
          "allowDomains": [],
          "denyDomains": ["*"],
          "default": "DENY"
        }
      }
    },
    "description": "Guest 권한은 문서 읽기 전용으로 제한 — policy-risk.md §3.4"
  },
  {
    "ruleId": "rule_contact_masking_035",
    "priority": 35,
    "source": "CONTRACT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "request.intent",
        "match": "CONTACT_READ|CONTACT_SEARCH|ADDRESS_BOOK",
        "matchType": "regex"
      }
    },
    "action": {
      "decision": "CONSTRAINED_ALLOW",
      "reasonCode": "CONTACT_MASKING_REQUIRED",
      "constraints": {
        "fs": {
          "readAllow": ["/contacts/**"],
          "writeDeny": ["/contacts/**"]
        }
      }
    },
    "description": "연락처 읽기 허용 단, 전화번호/이름은 마스킹 필수 — contract.md §9 데이터 보호"
  }
]
```

### 3.4 ALLOW 규칙 — 명시적 허용 (source: DEFAULT, priority 61~100)

```json
[
  {
    "ruleId": "rule_code_read_061",
    "priority": 61,
    "source": "DEFAULT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "request.intent",
        "match": "CODE_READ|FILE_READ|SPEC_ANALYSIS|PLAN_REVIEW",
        "matchType": "regex"
      }
    },
    "action": {
      "decision": "ALLOW",
      "reasonCode": "READ_ONLY_SAFE"
    },
    "description": "코드/파일 읽기 및 분석 요청은 기본 허용 (쓰기 없음)"
  },
  {
    "ruleId": "rule_observe_mode_062",
    "priority": 62,
    "source": "DEFAULT",
    "enabled": true,
    "condition": {
      "type": "PATTERN",
      "pattern": {
        "field": "trustMode",
        "match": "observe",
        "matchType": "exact"
      }
    },
    "action": {
      "decision": "ALLOW",
      "reasonCode": "OBSERVE_MODE_PLAN_ONLY"
    },
    "description": "관찰 모드에서는 계획/설명만 허용 (OS 액션 없음) — contract.md §4"
  }
]
```

---

## 4. 규칙 평가 알고리즘 (의사코드)

```
// 전체 규칙 평가 함수
function evaluateRules(
  request: PolicyEvaluationRequest,
  rules: PolicyRule[]
): PolicyDecisionOutcome:

  // 1단계: 활성화된 규칙만 필터링 후 priority ASC 정렬
  //        같은 priority는 source 우선순위 적용 (CONTRACT < USER < DEFAULT)
  sortedRules = rules
    .filter(r => r.enabled)
    .sort(by priority ASC, then by sourceWeight ASC)

  // 2단계: 판정별 버킷 초기화
  denyBucket       = []   // 차단 규칙 매칭 결과
  gateBucket       = []   // 승인 필요 규칙 매칭 결과
  constrainedBucket = []  // 제약 허용 규칙 매칭 결과
  allowBucket      = []   // 명시적 허용 규칙 매칭 결과

  // 3단계: 모든 규칙 순회 (조기 종료 없음 — 전체 수집으로 우선순위 충돌 방지)
  for rule in sortedRules:
    if matchCondition(request, rule.condition):
      switch rule.action.decision:
        case 'DENY':
          denyBucket.push(rule)
        case 'APPROVAL_REQUIRED':
          gateBucket.push(rule)
        case 'CONSTRAINED_ALLOW':
          constrainedBucket.push(rule)
        case 'ALLOW':
          allowBucket.push(rule)

  // 4단계: 판정 합성 (우선순위: DENY > GATE > CONSTRAINED > ALLOW)
  if denyBucket.length > 0:
    // DENY가 하나라도 있으면 최종 DENY (CONTRACT 위반은 재시도 불가)
    return {
      status: 'DENY',
      reasonCodes: denyBucket.map(r => r.action.reasonCode),
      matchedRules: denyBucket.map(r => r.ruleId),
      retryable: false
    }

  if gateBucket.length > 0:
    // Gate 규칙 합산 (requiredGates 합집합)
    allRequiredGates = gateBucket
      .flatMap(r => r.action.requiredGates ?? [])
      .unique()
    return {
      status: 'APPROVAL_REQUIRED',
      reasonCodes: gateBucket.map(r => r.action.reasonCode),
      requiredGates: allRequiredGates,
      matchedRules: gateBucket.map(r => r.ruleId)
    }

  if constrainedBucket.length > 0:
    // 제약 조건 병합 (교집합 — 가장 엄격한 값 적용)
    mergedConstraints = mergeConstraints(constrainedBucket.map(r => r.action.constraints))
    return {
      status: 'CONSTRAINED_ALLOW',
      reasonCodes: constrainedBucket.map(r => r.action.reasonCode),
      constraints: mergedConstraints,
      matchedRules: constrainedBucket.map(r => r.ruleId)
    }

  if allowBucket.length > 0:
    return {
      status: 'ALLOW',
      reasonCodes: allowBucket.map(r => r.action.reasonCode),
      matchedRules: allowBucket.map(r => r.ruleId)
    }

  // 5단계: 아무 규칙도 매칭 안 된 경우 — 기본 정책 적용
  return applyDefaultPolicy(request)


// 기본 정책 — 명시적 규칙 없는 경우 신뢰 모드에 따라 결정
function applyDefaultPolicy(request: PolicyEvaluationRequest): PolicyDecisionOutcome:
  switch request.trustMode:
    case 'observe':
      return { status: 'ALLOW', reasonCodes: ['DEFAULT_OBSERVE_MODE'] }
    case 'suggest':
      return { status: 'APPROVAL_REQUIRED', reasonCodes: ['DEFAULT_SUGGEST_MODE'],
               requiredGates: ['GATE_PLAN'] }
    case 'semi-auto':
      return { status: 'CONSTRAINED_ALLOW', reasonCodes: ['DEFAULT_SEMI_AUTO'],
               constraints: DEFAULT_SEMI_AUTO_CONSTRAINTS }
    case 'full-auto':
      return { status: 'CONSTRAINED_ALLOW', reasonCodes: ['DEFAULT_FULL_AUTO'],
               constraints: DEFAULT_FULL_AUTO_CONSTRAINTS }
    default:
      // 알 수 없는 신뢰 모드는 안전 우선 — 승인 필요
      return { status: 'APPROVAL_REQUIRED', reasonCodes: ['UNKNOWN_TRUST_MODE'],
               requiredGates: ['GATE_PLAN'] }


// 제약 조건 병합 — 교집합 원칙 (가장 엄격한 값 선택)
function mergeConstraints(constraintsList: RuleAction['constraints'][]): MergedConstraints:

  // writeAllow: 교집합 (모든 규칙이 허용한 경로만 최종 허용)
  writeAllow = intersect(constraintsList.map(c => c.fs?.writeAllow ?? []))

  // writeDeny: 합집합 (어느 규칙이든 차단하면 차단)
  writeDeny  = union(constraintsList.map(c => c.fs?.writeDeny ?? []))

  // exec.allow: 교집합
  execAllow  = intersect(constraintsList.map(c => c.exec?.allow ?? []))

  // exec.deny: 합집합
  execDeny   = union(constraintsList.map(c => c.exec?.deny ?? []))

  // network.default: 가장 엄격한 값 (DENY > ALLOW)
  networkDefault = constraintsList.some(c => c.network?.default === 'DENY') ? 'DENY' : 'ALLOW'

  return { fs: { writeAllow, writeDeny }, exec: { allow: execAllow, deny: execDeny },
           network: { default: networkDefault } }
```

---

## 5. 패턴 매칭 함수 시그니처

```typescript
// packages/policy-engine/src/matcher.ts

/**
 * 단일 규칙 조건이 요청과 매칭되는지 검사한다.
 * type에 따라 matchPattern, matchThreshold, matchComposite를 내부에서 분기 호출한다.
 */
function matchCondition(
  request: PolicyEvaluationRequest,
  condition: RuleCondition
): boolean;

/**
 * 문자열 필드에 패턴이 매칭되는지 검사한다.
 * field는 점 표기법으로 중첩 접근 허용 (예: 'request.targets').
 * targets 필드가 배열인 경우 요소 중 하나라도 매칭되면 true를 반환한다.
 */
function matchPattern(
  value: string | string[],
  pattern: string,
  matchType: 'regex' | 'glob' | 'exact'
): boolean;

/**
 * 수치 필드와 임계값을 비교한다.
 * 필드 경로가 존재하지 않으면 false를 반환한다 (안전 기본값).
 */
function matchThreshold(
  value: number,
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq',
  threshold: number
): boolean;

/**
 * AND/OR/NOT 복합 조건을 재귀적으로 평가한다.
 * NOT은 정확히 1개의 하위 조건을 가져야 하며, 위반 시 false를 반환한다.
 */
function matchComposite(
  request: PolicyEvaluationRequest,
  composite: CompositeCondition
): boolean;

/**
 * 요청 객체에서 점 표기법 경로로 필드 값을 추출한다.
 * 존재하지 않는 경로는 undefined를 반환한다.
 * 보안: 경로 문자열에 __proto__, constructor, prototype 포함 시 undefined 반환.
 */
function extractField(
  request: PolicyEvaluationRequest,
  fieldPath: string
): string | string[] | number | boolean | undefined;

/**
 * glob 패턴을 정규식으로 변환한다.
 * ** 는 경로 세그먼트를 포함한 모든 문자 매칭.
 * * 는 단일 경로 세그먼트 내 모든 문자 매칭.
 */
function globToRegex(glob: string): RegExp;

/**
 * 여러 제약 조건 배열을 교집합/합집합 원칙으로 병합한다.
 * writeAllow/execAllow는 교집합, writeDeny/execDeny는 합집합으로 처리한다.
 */
function mergeConstraints(
  constraintsList: Array<NonNullable<RuleAction['constraints']>>
): NonNullable<RuleAction['constraints']>;
```

---

## 6. 규칙 로드 및 검증

### 6.1 규칙 파일 로드 흐름

```
packages/policy-engine/src/rules/ 디렉토리 스캔
  ├─ contract-rules.json   (source: CONTRACT, 런타임 수정 불가)
  ├─ user-rules.json       (source: USER, 관리자 추가/수정 가능)
  └─ default-rules.json    (source: DEFAULT, 기본값)

로드 순서:
  1. 각 JSON 파일을 읽어 PolicyRule[] 배열로 파싱
  2. Zod 스키마로 각 규칙 검증 (VALIDATION_FAILED → 해당 파일 전체 거부)
  3. source 별 우선순위 병합:
     CONTRACT 규칙은 USER/DEFAULT 규칙으로 덮어쓰기 불가
     USER 규칙의 ruleId가 DEFAULT와 충돌하면 USER 규칙 적용
  4. priority 중복 시 source 우선순위 적용
     (CONTRACT 규칙이 같은 priority를 가지면 항상 우선)
  5. 검증 통과한 전체 규칙을 메모리 캐시에 로드
  6. 규칙 로드 완료를 감사 로그에 기록
```

### 6.2 Zod 검증 스키마 (요약)

```typescript
// packages/policy-engine/src/schemas/rule-schema.ts

/** Zod 스키마 — PolicyRule 런타임 검증 */
const PolicyRuleSchema = z.object({
  ruleId: z.string().regex(/^rule_[a-z0-9_]+_[0-9]{3}$/),
  priority: z.number().int().min(1).max(9999),
  source: z.enum(['CONTRACT', 'USER', 'DEFAULT']),
  enabled: z.boolean(),
  condition: RuleConditionSchema,  // 재귀 Zod 스키마
  action: RuleActionSchema,
  description: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** 조건 스키마 — 재귀 구조 */
const RuleConditionSchema: z.ZodType<RuleCondition> = z.lazy(() =>
  z.object({
    type: z.enum(['PATTERN', 'THRESHOLD', 'COMPOSITE']),
    pattern: z.object({
      field: z.string().min(1),
      match: z.string().min(1),
      matchType: z.enum(['regex', 'glob', 'exact']),
    }).optional(),
    threshold: z.object({
      field: z.string().min(1),
      operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq']),
      value: z.number(),
    }).optional(),
    composite: z.object({
      operator: z.enum(['AND', 'OR', 'NOT']),
      conditions: z.array(RuleConditionSchema).min(1),
    }).optional(),
  }).refine(c => {
    // type과 대응하는 필드가 존재하는지 검증
    if (c.type === 'PATTERN') return c.pattern !== undefined;
    if (c.type === 'THRESHOLD') return c.threshold !== undefined;
    if (c.type === 'COMPOSITE') return c.composite !== undefined;
    return false;
  }, { message: "condition.type과 대응하는 필드가 존재해야 합니다" })
);
```

---

## 7. 규칙 엔진 통합 위치

### 7.1 packages/policy-engine 구조

```
packages/policy-engine/src/
  ├─ index.ts              — barrel export (evaluatePolicy, issueCapabilityToken)
  ├─ engine.ts             — 규칙 평가 핵심 로직 (evaluateRules, mergeConstraints)
  ├─ matcher.ts            — 패턴 매칭 함수 (matchCondition, matchPattern, ...)
  ├─ loader.ts             — 규칙 파일 로드 & Zod 검증
  ├─ risk-score.ts         — 5차원 Risk Score 계산 (policy-risk.md §3.1 기반)
  ├─ token.ts              — Capability Token 발급 & 검증
  ├─ types/
  │   ├─ rule.ts           — PolicyRule, RuleCondition, RuleAction 인터페이스
  │   └─ evaluation.ts     — PolicyEvaluationRequest, PolicyDecisionOutcome
  ├─ schemas/
  │   └─ rule-schema.ts    — Zod 검증 스키마
  └─ rules/
      ├─ contract-rules.json  — CONTRACT 규칙 (절대 불변)
      ├─ user-rules.json      — USER 규칙 (관리자 수정 가능)
      └─ default-rules.json   — DEFAULT 규칙 (시스템 기본값)
```

### 7.2 호출 체인

```
Policy & Risk Agent (packages/agents/src/policy-risk.ts)
  ↓ evaluatePolicy(request) 호출 (api-endpoints.md §3.1)
packages/policy-engine/src/index.ts
  ↓
loader.ts: loadAndValidateRules()          — 규칙 파일 로드
  ↓
risk-score.ts: calculateRiskScore(request) — 5차원 점수 계산
  ↓
engine.ts: evaluateRules(request, rules)   — 규칙 평가 & 판정 합성
  ↓
engine.ts: buildPolicyDecision(outcome)    — PolicyDecision 객체 생성
  ↓
PolicyDecision 반환 → Policy & Risk Agent → 감사 로그 기록
```

---

## 8. 보안 고려사항

```
규칙 파일 보호:
  - contract-rules.json은 파일시스템 권한으로 읽기 전용 설정 (chmod 444)
  - 규칙 파일 변경 시 해시 검증 (SHA-256, 부트 시 검증)
  - USER 규칙 변경은 관리자 권한 필요 + 변경 내역 감사 로그 기록

패턴 매칭 보안:
  - regex 패턴에 ReDoS(정규식 서비스 거부) 방어:
    최대 실행 시간 100ms 제한, 시간 초과 시 false 반환
  - 사용자 입력 기반 동적 regex 컴파일 금지
  - glob 패턴은 globToRegex()를 통해 안전하게 변환

경로 추출 보안 (extractField):
  - __proto__, constructor, prototype 키 접근 차단
  - 최대 중첩 깊이 10단계 제한
  - 알 수 없는 필드 경로는 undefined 반환 (예외 발생 금지)

규칙 평가 격리:
  - 규칙 평가 중 부수 효과(side effect) 금지 (파일 쓰기, 네트워크 접근 불가)
  - 각 규칙 평가는 독립 스코프에서 실행 (전역 상태 변경 금지)
```

---

## 참조 문서

- `.claude/agents/policy-risk.md` §3.2 자동 차단 규칙, §3.3 게이트 분류, §3.4 권한 등급
- `.claude/contract.md` 전체 (§1 절대 금지사항, §4 신뢰 모드, §9 모바일 보안)
- `.claude/design/api-endpoints.md` §3.1 정책 판정 요청 인터페이스
- `.claude/schemas/policy-decision.json` PolicyDecision 출력 스키마
- `.claude/schemas/capability-token.json` Capability Token 스키마

---

> version: 1.0.0
> last_updated: 2026-03-02
> 담당 패키지: `packages/policy-engine/`
> 관련 에이전트: Policy & Risk Agent (Opus 4.6)
