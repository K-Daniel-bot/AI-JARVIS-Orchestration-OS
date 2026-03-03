// Review 에이전트 — 보안 검토, 코드 품질 검사
import { randomUUID } from "node:crypto";
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err } from "@jarvis/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentExecutionContext } from "../types/agent-config.js";
import {
  ReviewInputSchema,
  type ReviewInput,
  type ReviewOutput,
} from "../types/agent-io.js";

// Review 에이전트 — ChangeSet의 보안과 코드 품질을 검토하고 승인 여부 결정
export class ReviewAgent extends BaseAgent {
  // 입력 검증 → 보안 체크리스트 실행 → 검토 결과 생성 → 감사 로그 기록
  override async execute(
    input: unknown,
    context: AgentExecutionContext,
    _capabilityToken?: CapabilityToken,
  ): Promise<Result<ReviewOutput, JarvisError>> {
    // 1. 입력 검증
    const validationResult = this.validateInput<ReviewInput>(
      input,
      ReviewInputSchema,
    );
    if (!validationResult.ok) {
      return err(validationResult.error);
    }

    const { changeSet } = validationResult.value;

    // 2. Phase 0 스텁 — 보안 자가 검사 결과 기반 리뷰
    const blockers: ReviewOutput["blockers"] = [];

    // ChangeSet의 보안 자가 검사 결과 확인
    if (changeSet.securitySelfCheck.secretsFound) {
      blockers.push({
        file: "unknown",
        issue: "시크릿/토큰이 코드에 하드코딩되어 있습니다",
        severity: "critical",
      });
    }
    if (changeSet.securitySelfCheck.injectionRisk) {
      blockers.push({
        file: "unknown",
        issue: "SQL/커맨드 인젝션 위험이 감지되었습니다",
        severity: "high",
      });
    }
    if (changeSet.securitySelfCheck.pathTraversalRisk) {
      blockers.push({
        file: "unknown",
        issue: "경로 순회(Path Traversal) 위험이 감지되었습니다",
        severity: "high",
      });
    }

    const passed = blockers.length === 0;
    const reviewId = `rev_${randomUUID().slice(0, 8)}`;

    const output: ReviewOutput = {
      reviewId,
      passed,
      blockers,
      warnings: [],
      securityFindings: [],
      approvedChangeSetId: passed ? changeSet.changeSetId : undefined,
    };

    // 3. 감사 로그 기록
    const auditResult = await this.logAudit(
      context,
      `Review 실행: changeSet=${changeSet.changeSetId}, 통과=${passed}`,
      passed ? "COMPLETED" : "FAILED",
      { reviewId, blockersCount: blockers.length },
    );
    if (!auditResult.ok) {
      console.warn(`[ReviewAgent] 감사 로그 기록 실패: ${auditResult.error.message}`);
    }

    return ok(output);
  }
}
