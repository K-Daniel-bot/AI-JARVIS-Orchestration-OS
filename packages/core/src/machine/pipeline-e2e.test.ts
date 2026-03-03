// 파이프라인 E2E 통합 테스트 — 전체 상태 전이 시나리오 10종 검증
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createActor } from "xstate";
import { jarvisMachine } from "./jarvis-machine.js";
import {
  MACHINE_STATES,
  AGENT_TYPES,
  LOOP_LIMITS,
  type PolicyDecision,
  type PolicyStatus,
  type JarvisError,
  type AgentType,
} from "@jarvis/shared";
import type { GateApproval } from "./context.js";
import type {
  SpecRef,
  PlanRef,
  ChangeSetRef,
  ReviewRef,
  TestResultRef,
} from "../types/environment.js";

// ─── 테스트 픽스처 헬퍼 ───────────────────────────────────────────────────────

/** 스펙 참조 mock 생성 */
function mockSpecRef(): SpecRef {
  return {
    specId: "spec_test_001",
    rawInput: "테스트 파일 생성",
    interpretation: "새 TypeScript 유틸 함수 구현 요청",
    clarifications: [],
  };
}

/** 정책 판정 mock 생성 */
function mockPolicyDecision(status: PolicyStatus): PolicyDecision {
  return {
    decisionId: "pd_test_001",
    timestamp: new Date().toISOString(),
    subject: {
      userId: "user-001",
      role: "Owner",
      device: "desktop",
      sessionId: "sess-test-001",
    },
    request: {
      rawInput: "테스트 파일 생성",
      intent: "CODE_IMPLEMENTATION",
      targets: ["src/utils/test.ts"],
      requiresWebAccess: false,
      requiresLogin: false,
    },
    outcome: {
      status,
      riskScore: 15,
      riskLevel: "LOW",
      requiresGates: [],
      reasonCodes: [],
      humanExplanation: "통합 테스트용 판정 결과",
    },
    constraints: {
      fs: { readAllow: ["src/**"], writeAllow: ["src/**"], writeDeny: [] },
      exec: { allow: [], deny: [] },
      network: { allowDomains: [], denyDomains: [], default: "DENY" },
    },
    requiredCapabilities: [],
  };
}

/** 실행 계획 mock 생성 */
function mockPlanRef(): PlanRef {
  return {
    planId: "plan_test_001",
    steps: [
      {
        stepId: "step_001",
        description: "유틸 함수 구현",
        agent: "codegen" as AgentType,
        dependsOn: [],
        status: "pending",
      },
    ],
    estimatedDurationMs: 5000,
  };
}

/** 코드 변경 세트 mock 생성 */
function mockChangeSetRef(): ChangeSetRef {
  return {
    changeSetId: "cs_test_001",
    files: [
      {
        filePath: "src/utils/test.ts",
        operation: "create",
        diff: "+export function testUtil(): string { return 'ok'; }",
      },
    ],
    summary: "테스트 유틸 파일 생성",
  };
}

/** 리뷰 결과 mock 생성 — passed 여부에 따라 블로커 포함 */
function mockReviewRef(passed: boolean): ReviewRef {
  return {
    reviewId: "rev_test_001",
    passed,
    blockers: passed
      ? []
      : [
          {
            id: "block_001",
            severity: "critical",
            category: "security",
            description: "입력값 검증 누락으로 보안 이슈 발생 가능",
            filePath: "src/utils/test.ts",
            suggestion: "Zod 스키마로 입력 검증 추가 필요",
          },
        ],
    warnings: [],
  };
}

/** 테스트 결과 mock 생성 */
function mockTestResultRef(passed: boolean): TestResultRef {
  return {
    testRunId: "tr_test_001",
    passed,
    totalTests: 10,
    failedTests: passed ? 0 : 3,
    coveragePercent: 85,
  };
}

/** 게이트 승인 mock 생성 */
function mockGateApproval(gateLevel: "L1" | "L2" | "L3" = "L2"): GateApproval {
  return {
    gateId: `gate_test_${gateLevel}`,
    gateLevel,
    approvedBy: "user-001",
    approvedAt: new Date().toISOString(),
    scopeModifications: [],
  };
}

/** JarvisError mock 생성 */
function mockError(message = "테스트 에러 발생"): JarvisError {
  return {
    code: "INTERNAL_ERROR",
    message,
    timestamp: new Date().toISOString(),
  };
}

// ─── 액터 생성 헬퍼 ───────────────────────────────────────────────────────────

/** 테스트용 머신 액터 생성 */
function makeActor(runId = "run-e2e-001", sessionId = "sess-e2e-001") {
  return createActor(jarvisMachine, {
    input: { runId, sessionId },
  });
}

// ─── E2E 파이프라인 통합 테스트 ───────────────────────────────────────────────

describe("E2E 파이프라인 통합 테스트", () => {
  // 각 테스트에서 공유하는 액터 인스턴스
  let actor: ReturnType<typeof makeActor>;

  beforeEach(() => {
    actor = makeActor();
    actor.start();
  });

  afterEach(() => {
    actor.stop();
  });

  // ─── 시나리오 1: Happy Path 전체 파이프라인 ─────────────────────────────────

  describe("시나리오 1: Happy Path — 전체 파이프라인 정상 완료", () => {
    it("IDLE → SPEC → POLICY(ALLOW) → PLAN → CODE → REVIEW(PASS) → GATE_L2(APPROVED) → APPLY → TEST(PASS) → GATE_DEPLOY(SKIPPED) → COMPLETED 순서로 전이되어야 한다", () => {
      // Arrange — 초기 상태 확인
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.IDLE);

      // Act & Assert — 각 전이 단계별 상태 및 에이전트 검증

      // 1단계: IDLE → SPEC_ANALYSIS
      actor.send({ type: "USER_REQUEST", input: "테스트 파일 생성해줘" });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.SPEC_ANALYSIS);
      expect(actor.getSnapshot().context.currentAgent).toBe(AGENT_TYPES.SPEC_AGENT);

      // 2단계: SPEC_ANALYSIS → POLICY_CHECK
      actor.send({ type: "SPEC_COMPLETE", spec: mockSpecRef() });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.POLICY_CHECK);
      expect(actor.getSnapshot().context.currentAgent).toBe(AGENT_TYPES.POLICY_RISK);

      // 3단계: POLICY_CHECK → PLANNING (ALLOW)
      actor.send({ type: "ALLOW", decision: mockPolicyDecision("ALLOW") });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.PLANNING);
      expect(actor.getSnapshot().context.currentAgent).toBe(AGENT_TYPES.PLANNER);
      // 정책 판정 결과가 컨텍스트에 저장되었는지 확인
      expect(actor.getSnapshot().context.policyDecision?.outcome.status).toBe("ALLOW");

      // 4단계: PLANNING → CODE_GENERATION
      actor.send({ type: "PLAN_COMPLETE", plan: mockPlanRef() });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.CODE_GENERATION);
      expect(actor.getSnapshot().context.currentAgent).toBe(AGENT_TYPES.CODEGEN);

      // 5단계: CODE_GENERATION → CODE_REVIEW
      actor.send({ type: "CODE_COMPLETE", changeSet: mockChangeSetRef() });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.CODE_REVIEW);
      expect(actor.getSnapshot().context.currentAgent).toBe(AGENT_TYPES.REVIEW);

      // 6단계: CODE_REVIEW → GATE_APPLY_CHANGES (REVIEW_PASS)
      actor.send({ type: "REVIEW_PASS", review: mockReviewRef(true) });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.GATE_APPLY_CHANGES);
      expect(actor.getSnapshot().context.currentAgent).toBeNull();

      // 7단계: GATE_APPLY_CHANGES → APPLY_CHANGES (APPROVED)
      actor.send({ type: "APPROVED", approval: mockGateApproval("L2") });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.APPLY_CHANGES);
      expect(actor.getSnapshot().context.currentAgent).toBe(AGENT_TYPES.EXECUTOR);
      // 게이트 승인이 컨텍스트에 누적되었는지 확인
      expect(actor.getSnapshot().context.gateApprovals).toHaveLength(1);

      // 8단계: APPLY_CHANGES → TESTING
      actor.send({ type: "APPLY_SUCCESS" });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.TESTING);
      expect(actor.getSnapshot().context.currentAgent).toBe(AGENT_TYPES.TEST_BUILD);

      // 9단계: TESTING → GATE_DEPLOY (TEST_PASS)
      actor.send({ type: "TEST_PASS", result: mockTestResultRef(true) });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.GATE_DEPLOY);
      expect(actor.getSnapshot().context.currentAgent).toBeNull();

      // 10단계: GATE_DEPLOY → COMPLETED (SKIPPED)
      actor.send({ type: "SKIPPED" });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.COMPLETED);
      expect(actor.getSnapshot().status).toBe("done");
    });
  });

  // ─── 시나리오 2: POLICY DENY 즉시 거부 ─────────────────────────────────────

  describe("시나리오 2: 정책 거부 — POLICY(DENY) → DENIED", () => {
    it("정책 거부(DENY) 시 DENIED 최종 상태로 즉시 전이되어야 한다", () => {
      // Arrange
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.IDLE);

      // Act — SPEC까지 진행 후 DENY 이벤트 전송
      actor.send({ type: "USER_REQUEST", input: "시스템 파일 삭제해줘" });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.SPEC_ANALYSIS);

      actor.send({ type: "SPEC_COMPLETE", spec: mockSpecRef() });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.POLICY_CHECK);

      // Assert — DENY 수신 시 DENIED로 즉시 전이
      actor.send({ type: "DENY", decision: mockPolicyDecision("DENY") });
      const snapshot = actor.getSnapshot();

      expect(snapshot.value).toBe(MACHINE_STATES.DENIED);
      expect(snapshot.status).toBe("done");
      // 정책 판정 결과가 컨텍스트에 저장되었는지 확인
      expect(snapshot.context.policyDecision?.outcome.status).toBe("DENY");
      // 에러 이력 없음 — 거부는 에러가 아닌 정상 판정임
      expect(snapshot.context.errorHistory).toHaveLength(0);
    });
  });

  // ─── 시나리오 3: APPROVAL_REQUIRED → GATE → 승인 후 계속 ─────────────────

  describe("시나리오 3: 게이트 승인 필요 → GATE_L1 승인 → 파이프라인 계속", () => {
    it("APPROVAL_REQUIRED 후 GATE_PLAN_APPROVAL에서 APPROVED 시 PLANNING으로 전이되어야 한다", () => {
      // Arrange — POLICY_CHECK까지 진행
      actor.send({ type: "USER_REQUEST", input: "패키지 설치해줘" });
      actor.send({ type: "SPEC_COMPLETE", spec: mockSpecRef() });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.POLICY_CHECK);

      // Act — APPROVAL_REQUIRED 수신
      actor.send({
        type: "APPROVAL_REQUIRED",
        decision: mockPolicyDecision("APPROVAL_REQUIRED"),
      });

      // Assert — 게이트 대기 상태로 전이
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.GATE_PLAN_APPROVAL);
      expect(actor.getSnapshot().context.currentAgent).toBeNull();
      expect(actor.getSnapshot().context.policyDecision?.outcome.status).toBe("APPROVAL_REQUIRED");

      // Act — 사용자 게이트 승인
      actor.send({ type: "APPROVED", approval: mockGateApproval("L1") });

      // Assert — 승인 후 PLANNING으로 전이 및 에이전트 할당
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.PLANNING);
      expect(actor.getSnapshot().context.currentAgent).toBe(AGENT_TYPES.PLANNER);
      // 게이트 승인 이력이 누적되었는지 확인
      expect(actor.getSnapshot().context.gateApprovals).toHaveLength(1);
      expect(actor.getSnapshot().context.gateApprovals[0].gateLevel).toBe("L1");
    });
  });

  // ─── 시나리오 4: GATE_L1 거부 → DENIED ─────────────────────────────────────

  describe("시나리오 4: 게이트 거부 — GATE_L1 REJECTED → DENIED", () => {
    it("GATE_PLAN_APPROVAL에서 REJECTED 시 DENIED 최종 상태로 전이되어야 한다", () => {
      // Arrange — GATE_PLAN_APPROVAL까지 진행
      actor.send({ type: "USER_REQUEST", input: "위험한 작업 수행" });
      actor.send({ type: "SPEC_COMPLETE", spec: mockSpecRef() });
      actor.send({
        type: "APPROVAL_REQUIRED",
        decision: mockPolicyDecision("APPROVAL_REQUIRED"),
      });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.GATE_PLAN_APPROVAL);

      // Act — 사용자 게이트 거부
      actor.send({ type: "REJECTED", reason: "위험도가 높아 작업을 거부합니다" });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe(MACHINE_STATES.DENIED);
      expect(snapshot.status).toBe("done");
      // 게이트 승인 이력 없음 — 거부되었으므로
      expect(snapshot.context.gateApprovals).toHaveLength(0);
    });
  });

  // ─── 시나리오 5: REVIEW_BLOCKERS → 재시도 → REVIEW_PASS ─────────────────

  describe("시나리오 5: 리뷰 블로커 → canRetry 재시도 → 리뷰 통과", () => {
    it("REVIEW_BLOCKERS 발생 후 canRetry 조건에서 PLANNING으로 돌아가 재시도해야 한다", () => {
      // Arrange — CODE_REVIEW까지 진행
      actor.send({ type: "USER_REQUEST", input: "파일 생성" });
      actor.send({ type: "SPEC_COMPLETE", spec: mockSpecRef() });
      actor.send({ type: "ALLOW", decision: mockPolicyDecision("ALLOW") });
      actor.send({ type: "PLAN_COMPLETE", plan: mockPlanRef() });
      actor.send({ type: "CODE_COMPLETE", changeSet: mockChangeSetRef() });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.CODE_REVIEW);

      // Act — 리뷰 블로커 발생 (retryCount=0 < MAX=3, canRetry=true)
      actor.send({ type: "REVIEW_BLOCKERS", review: mockReviewRef(false) });

      // Assert — PLANNING으로 돌아가서 재시도
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.PLANNING);
      expect(actor.getSnapshot().context.currentAgent).toBe(AGENT_TYPES.PLANNER);
      expect(actor.getSnapshot().context.retryCount).toBe(1);
      expect(actor.getSnapshot().context.errorHistory).toHaveLength(1);

      // Act — 재시도: PLAN → CODE → REVIEW(PASS)
      actor.send({ type: "PLAN_COMPLETE", plan: mockPlanRef() });
      actor.send({ type: "CODE_COMPLETE", changeSet: mockChangeSetRef() });
      actor.send({ type: "REVIEW_PASS", review: mockReviewRef(true) });

      // Assert — 이번엔 리뷰 통과 후 게이트로 진행
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.GATE_APPLY_CHANGES);
      expect(actor.getSnapshot().context.retryCount).toBe(1);
    });
  });

  // ─── 시나리오 6: REVIEW_BLOCKERS canRetry 한계 초과 → ERROR_RECOVERY ──────

  describe("시나리오 6: 리뷰 블로커 반복 → 재시도 한계 초과 → ERROR_RECOVERY", () => {
    it(`REVIEW_BLOCKERS가 ${LOOP_LIMITS.MAX_CONSECUTIVE_ERRORS}회 누적되면 ERROR_RECOVERY로 전이되어야 한다`, () => {
      // Arrange — CODE_REVIEW까지 진행하는 헬퍼 함수
      function advanceToCodeReview() {
        actor.send({ type: "PLAN_COMPLETE", plan: mockPlanRef() });
        actor.send({ type: "CODE_COMPLETE", changeSet: mockChangeSetRef() });
      }

      // 초기 진입
      actor.send({ type: "USER_REQUEST", input: "파일 생성" });
      actor.send({ type: "SPEC_COMPLETE", spec: mockSpecRef() });
      actor.send({ type: "ALLOW", decision: mockPolicyDecision("ALLOW") });

      // 1회차: retryCount=0 → 재시도 가능 → PLANNING으로
      advanceToCodeReview();
      actor.send({ type: "REVIEW_BLOCKERS", review: mockReviewRef(false) });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.PLANNING);
      expect(actor.getSnapshot().context.retryCount).toBe(1);

      // 2회차: retryCount=1 → 재시도 가능 → PLANNING으로
      advanceToCodeReview();
      actor.send({ type: "REVIEW_BLOCKERS", review: mockReviewRef(false) });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.PLANNING);
      expect(actor.getSnapshot().context.retryCount).toBe(2);

      // 3회차: retryCount=2 → 재시도 가능 → PLANNING으로
      advanceToCodeReview();
      actor.send({ type: "REVIEW_BLOCKERS", review: mockReviewRef(false) });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.PLANNING);
      expect(actor.getSnapshot().context.retryCount).toBe(3);

      // 4회차: retryCount=3 → canRetry 실패 (3 < 3 = false) → ERROR_RECOVERY
      advanceToCodeReview();
      actor.send({ type: "REVIEW_BLOCKERS", review: mockReviewRef(false) });

      // Assert — 한계 초과 시 ERROR_RECOVERY로 전이
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe(MACHINE_STATES.ERROR_RECOVERY);
      expect(snapshot.context.currentAgent).toBe(AGENT_TYPES.ROLLBACK);
      expect(snapshot.context.retryCount).toBe(4);
      expect(snapshot.context.errorHistory).toHaveLength(4);
    });
  });

  // ─── 시나리오 7: TEST_FAIL → 재시도 → TEST_PASS ─────────────────────────

  describe("시나리오 7: 테스트 실패 → PLANNING 재시도 → 테스트 통과", () => {
    it("TEST_FAIL 발생 시 PLANNING으로 돌아가 재시도하고 최종 TEST_PASS로 완료해야 한다", () => {
      // Arrange — TESTING까지 진행
      actor.send({ type: "USER_REQUEST", input: "파일 생성" });
      actor.send({ type: "SPEC_COMPLETE", spec: mockSpecRef() });
      actor.send({ type: "ALLOW", decision: mockPolicyDecision("ALLOW") });
      actor.send({ type: "PLAN_COMPLETE", plan: mockPlanRef() });
      actor.send({ type: "CODE_COMPLETE", changeSet: mockChangeSetRef() });
      actor.send({ type: "REVIEW_PASS", review: mockReviewRef(true) });
      actor.send({ type: "APPROVED", approval: mockGateApproval("L2") });
      actor.send({ type: "APPLY_SUCCESS" });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.TESTING);
      expect(actor.getSnapshot().context.currentAgent).toBe(AGENT_TYPES.TEST_BUILD);

      // Act — 테스트 실패 (retryCount=0 < MAX=3, canRetry=true)
      actor.send({ type: "TEST_FAIL", result: mockTestResultRef(false) });

      // Assert — PLANNING으로 돌아가서 재시도
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.PLANNING);
      expect(actor.getSnapshot().context.currentAgent).toBe(AGENT_TYPES.PLANNER);
      expect(actor.getSnapshot().context.retryCount).toBe(1);
      expect(actor.getSnapshot().context.errorHistory).toHaveLength(1);

      // Act — 재시도: PLAN → CODE → REVIEW → GATE → APPLY → TEST(PASS)
      actor.send({ type: "PLAN_COMPLETE", plan: mockPlanRef() });
      actor.send({ type: "CODE_COMPLETE", changeSet: mockChangeSetRef() });
      actor.send({ type: "REVIEW_PASS", review: mockReviewRef(true) });
      actor.send({ type: "APPROVED", approval: mockGateApproval("L2") });
      actor.send({ type: "APPLY_SUCCESS" });
      actor.send({ type: "TEST_PASS", result: mockTestResultRef(true) });

      // Assert — 테스트 통과 후 GATE_DEPLOY 진행
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.GATE_DEPLOY);
      expect(actor.getSnapshot().context.retryCount).toBe(1);
    });
  });

  // ─── 시나리오 8: ERROR_RECOVERY → RECOVERY_SUCCESS → COMPLETED ──────────

  describe("시나리오 8: 에러 복구 성공 → COMPLETED", () => {
    it("ERROR_RECOVERY 진입 후 RECOVERY_SUCCESS 시 COMPLETED 최종 상태로 전이되어야 한다", () => {
      // Arrange — 스펙 분석 단계에서 에러 강제 발생으로 ERROR_RECOVERY 진입
      actor.send({ type: "USER_REQUEST", input: "파일 생성" });
      actor.send({ type: "SPEC_COMPLETE", spec: mockSpecRef() });
      actor.send({ type: "ALLOW", decision: mockPolicyDecision("ALLOW") });
      actor.send({ type: "PLAN_COMPLETE", plan: mockPlanRef() });
      actor.send({ type: "CODE_COMPLETE", changeSet: mockChangeSetRef() });
      actor.send({ type: "REVIEW_PASS", review: mockReviewRef(true) });
      actor.send({ type: "APPROVED", approval: mockGateApproval("L2") });
      // 변경 적용 단계에서 에러 발생
      actor.send({ type: "APPLY_FAILED", error: mockError("패치 적용 실패") });

      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.ERROR_RECOVERY);
      expect(actor.getSnapshot().context.currentAgent).toBe(AGENT_TYPES.ROLLBACK);
      expect(actor.getSnapshot().context.errorHistory).toHaveLength(1);

      // Act — 복구 성공
      actor.send({ type: "RECOVERY_SUCCESS" });

      // Assert — COMPLETED 최종 상태
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe(MACHINE_STATES.COMPLETED);
      expect(snapshot.status).toBe("done");
      // 에이전트 해제 확인
      expect(snapshot.context.currentAgent).toBeNull();
    });
  });

  // ─── 시나리오 9: ERROR_RECOVERY → RECOVERY_FAILED → EMERGENCY_STOP ──────

  describe("시나리오 9: 에러 복구 실패 → EMERGENCY_STOP", () => {
    it("ERROR_RECOVERY 진입 후 RECOVERY_FAILED 시 EMERGENCY_STOP 최종 상태로 전이되어야 한다", () => {
      // Arrange — APPLY_CHANGES 단계에서 에러로 ERROR_RECOVERY 진입
      actor.send({ type: "USER_REQUEST", input: "위험한 작업" });
      actor.send({ type: "SPEC_COMPLETE", spec: mockSpecRef() });
      actor.send({ type: "ALLOW", decision: mockPolicyDecision("ALLOW") });
      actor.send({ type: "PLAN_COMPLETE", plan: mockPlanRef() });
      actor.send({ type: "CODE_COMPLETE", changeSet: mockChangeSetRef() });
      actor.send({ type: "REVIEW_PASS", review: mockReviewRef(true) });
      actor.send({ type: "APPROVED", approval: mockGateApproval("L2") });
      actor.send({ type: "APPLY_FAILED", error: mockError("치명적 오류 — 파일시스템 손상") });

      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.ERROR_RECOVERY);
      expect(actor.getSnapshot().context.currentAgent).toBe(AGENT_TYPES.ROLLBACK);

      // Act — 복구 실패 (롤백도 불가능한 상황)
      actor.send({
        type: "RECOVERY_FAILED",
        error: mockError("롤백 스냅샷 손상으로 복구 불가"),
      });

      // Assert — EMERGENCY_STOP 비상 중단 상태
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe(MACHINE_STATES.EMERGENCY_STOP);
      expect(snapshot.status).toBe("done");
      // 에이전트 해제 확인 (clearAgent 액션 실행)
      expect(snapshot.context.currentAgent).toBeNull();
      // 에러 이력 확인 — APPLY_FAILED 1건 기록
      expect(snapshot.context.errorHistory).toHaveLength(1);
    });
  });

  // ─── 시나리오 10: SPEC_NEED_CLARIFICATION → USER_RESPONSE → SPEC_ANALYSIS ─

  describe("시나리오 10: 스펙 명확화 요청 → 사용자 응답 → SPEC_ANALYSIS 재진입", () => {
    it("SPEC_NEED_CLARIFICATION 후 USER_RESPONSE로 SPEC_ANALYSIS로 복귀해야 한다", () => {
      // Arrange
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.IDLE);

      // Act — 사용자 요청 시작
      actor.send({ type: "USER_REQUEST", input: "뭔가 해줘" });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.SPEC_ANALYSIS);
      expect(actor.getSnapshot().context.currentAgent).toBe(AGENT_TYPES.SPEC_AGENT);

      // Act — 스펙 에이전트가 명확화 질문 발생
      actor.send({
        type: "SPEC_NEED_CLARIFICATION",
        question: "어떤 종류의 파일을 생성하길 원하시나요?",
      });

      // Assert — 사용자 입력 대기 상태로 전이
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.AWAITING_USER_INPUT);
      expect(actor.getSnapshot().context.currentAgent).toBeNull();

      // Act — 사용자 추가 입력 제공
      actor.send({
        type: "USER_RESPONSE",
        response: "TypeScript 유틸 함수 파일을 생성해줘",
      });

      // Assert — SPEC_ANALYSIS로 복귀하여 에이전트 재할당
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.SPEC_ANALYSIS);
      expect(actor.getSnapshot().context.currentAgent).toBe(AGENT_TYPES.SPEC_AGENT);

      // Act — 이번엔 스펙 완료로 파이프라인 계속
      actor.send({ type: "SPEC_COMPLETE", spec: mockSpecRef() });

      // Assert — 정책 판정 단계로 정상 전이
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.POLICY_CHECK);
      expect(actor.getSnapshot().context.currentAgent).toBe(AGENT_TYPES.POLICY_RISK);
    });

    it("AWAITING_USER_INPUT에서 CANCEL 시 DENIED로 전이되어야 한다", () => {
      // Arrange — AWAITING_USER_INPUT까지 진행
      actor.send({ type: "USER_REQUEST", input: "뭔가 해줘" });
      actor.send({
        type: "SPEC_NEED_CLARIFICATION",
        question: "어떤 파일인가요?",
      });
      expect(actor.getSnapshot().value).toBe(MACHINE_STATES.AWAITING_USER_INPUT);

      // Act — 사용자가 작업 취소
      actor.send({ type: "CANCEL" });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe(MACHINE_STATES.DENIED);
      expect(snapshot.status).toBe("done");
    });
  });

  // ─── 공통 컨텍스트 불변성 검증 ──────────────────────────────────────────────

  describe("컨텍스트 불변성 및 누적 검증", () => {
    it("runId와 sessionId는 전체 파이프라인을 거쳐도 변경되지 않아야 한다", () => {
      // Arrange
      const expectedRunId = "run-e2e-001";
      const expectedSessionId = "sess-e2e-001";

      // Act — 여러 단계를 거침
      actor.send({ type: "USER_REQUEST", input: "파일 생성" });
      actor.send({ type: "SPEC_COMPLETE", spec: mockSpecRef() });
      actor.send({ type: "ALLOW", decision: mockPolicyDecision("ALLOW") });
      actor.send({ type: "PLAN_COMPLETE", plan: mockPlanRef() });

      // Assert
      const { context } = actor.getSnapshot();
      expect(context.runId).toBe(expectedRunId);
      expect(context.sessionId).toBe(expectedSessionId);
    });

    it("게이트 승인이 여러 건 발생할 경우 gateApprovals에 모두 누적되어야 한다", () => {
      // Arrange & Act — L1, L2 게이트 승인
      actor.send({ type: "USER_REQUEST", input: "패키지 설치" });
      actor.send({ type: "SPEC_COMPLETE", spec: mockSpecRef() });
      actor.send({
        type: "APPROVAL_REQUIRED",
        decision: mockPolicyDecision("APPROVAL_REQUIRED"),
      });
      // L1 게이트 승인
      actor.send({ type: "APPROVED", approval: mockGateApproval("L1") });
      expect(actor.getSnapshot().context.gateApprovals).toHaveLength(1);

      actor.send({ type: "PLAN_COMPLETE", plan: mockPlanRef() });
      actor.send({ type: "CODE_COMPLETE", changeSet: mockChangeSetRef() });
      actor.send({ type: "REVIEW_PASS", review: mockReviewRef(true) });
      // L2 게이트 승인
      actor.send({ type: "APPROVED", approval: mockGateApproval("L2") });

      // Assert — 두 게이트 승인이 모두 누적
      expect(actor.getSnapshot().context.gateApprovals).toHaveLength(2);
      expect(actor.getSnapshot().context.gateApprovals[0].gateLevel).toBe("L1");
      expect(actor.getSnapshot().context.gateApprovals[1].gateLevel).toBe("L2");
    });

    it("에러 발생 시 errorHistory에 누적되고 retryCount가 증가해야 한다", () => {
      // Arrange — CODE_REVIEW까지 진행
      actor.send({ type: "USER_REQUEST", input: "파일 생성" });
      actor.send({ type: "SPEC_COMPLETE", spec: mockSpecRef() });
      actor.send({ type: "ALLOW", decision: mockPolicyDecision("ALLOW") });
      actor.send({ type: "PLAN_COMPLETE", plan: mockPlanRef() });
      actor.send({ type: "CODE_COMPLETE", changeSet: mockChangeSetRef() });

      // Act — 리뷰 블로커로 에러 1회 누적
      actor.send({ type: "REVIEW_BLOCKERS", review: mockReviewRef(false) });

      // Assert
      expect(actor.getSnapshot().context.retryCount).toBe(1);
      expect(actor.getSnapshot().context.errorHistory).toHaveLength(1);

      // Act — 다시 코드 생성 후 리뷰 블로커로 에러 2회 누적
      actor.send({ type: "PLAN_COMPLETE", plan: mockPlanRef() });
      actor.send({ type: "CODE_COMPLETE", changeSet: mockChangeSetRef() });
      actor.send({ type: "REVIEW_BLOCKERS", review: mockReviewRef(false) });

      // Assert
      expect(actor.getSnapshot().context.retryCount).toBe(2);
      expect(actor.getSnapshot().context.errorHistory).toHaveLength(2);
    });
  });
});
