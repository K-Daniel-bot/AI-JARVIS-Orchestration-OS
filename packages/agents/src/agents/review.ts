// Review 에이전트 — 보안 검토, 코드 품질 검사
import { randomUUID } from "node:crypto";
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err } from "@jarvis/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentExecutionContext } from "../types/agent-config.js";
import {
  ReviewInputSchema,
  ReviewOutputSchema,
  type ReviewInput,
  type ReviewOutput,
} from "../types/agent-io.js";

// Review 에이전트 시스템 프롬프트 — 보안/품질 검토 역할 정의 (15개 체크리스트)
const REVIEW_SYSTEM_PROMPT = `당신은 JARVIS Orchestration OS의 Review 에이전트입니다.
ChangeSet의 보안과 코드 품질을 검토합니다.

## 15개 보안 체크리스트 (하나라도 위반 시 blocker)
1. 시크릿 노출 (API key, 토큰, 비밀번호)
2. 경로 순회 (Path Traversal)
3. 원격 코드 실행 (RCE)
4. SQL/NoSQL injection
5. XSS (Cross-Site Scripting)
6. 권한 상승 (Privilege Escalation)
7. 외부 전송/수집 (telemetry)
8. 라이선스/서플라이체인
9. 인증/인가 누락
10. 에러 정보 노출
11. SSRF (Server-Side Request Forgery)
12. 안전하지 않은 역직렬화 (Deserialization)
13. 로깅에 민감 데이터 포함
14. 의존성 취약점 (known CVE)
15. 암호화 약점 (약한 해시, 하드코딩 salt)

## 응답 형식
반드시 다음 JSON 형식으로만 응답:
\`\`\`json
{
  "reviewId": "rev_<8자리UUID>",
  "passed": true,
  "blockers": [{ "file": "...", "issue": "...", "severity": "critical" }],
  "warnings": [],
  "securityFindings": [],
  "approvedChangeSetId": "cs_xxx",
  "qualityMetrics": {
    "complexityScore": 50,
    "maintainabilityScore": 70,
    "testabilityScore": 60
  }
}
\`\`\``;

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

    // 2. Claude API 호출 또는 스텁 폴백
    let output: ReviewOutput;

    if (this.deps.claudeClient) {
      // Phase 2: Claude API로 실제 보안/품질 검토 수행
      const filesSummary = [
        ...changeSet.filesAdded.map(f => `[추가] ${f.path}\n${f.content.slice(0, 300)}`),
        ...changeSet.filesModified.map(f => `[수정] ${f.path}\n${f.diff.slice(0, 300)}`),
      ].join("\n\n") || "변경된 파일 없음";

      const userMessage = `changeSetId: ${changeSet.changeSetId}\n보안 자가검사: ${JSON.stringify(changeSet.securitySelfCheck)}\n\n파일 요약:\n${filesSummary}`;

      const claudeResult = await this.callClaudeWithJson(
        REVIEW_SYSTEM_PROMPT,
        userMessage,
        ReviewOutputSchema,
      );

      if (!claudeResult.ok) {
        // Claude 실패 시 스텁 폴백
    // eslint-disable-next-line no-console
        console.warn(`[ReviewAgent] Claude API 실패, 스텁 폴백: ${claudeResult.error.message}`);
        output = this.buildStubOutput(changeSet);
      } else {
        output = claudeResult.value;
      }
    } else {
      // claudeClient 미주입 — 스텁 폴백
      output = this.buildStubOutput(changeSet);
    }

    // 3. 감사 로그 기록
    const auditResult = await this.logAudit(
      context,
      `Review 실행: changeSet=${changeSet.changeSetId}, 통과=${output.passed}`,
      output.passed ? "COMPLETED" : "FAILED",
      { reviewId: output.reviewId, blockersCount: output.blockers.length, usedClaude: !!this.deps.claudeClient },
    );
    if (!auditResult.ok) {
    // eslint-disable-next-line no-console
      console.warn(`[ReviewAgent] 감사 로그 기록 실패: ${auditResult.error.message}`);
    }

    return ok(output);
  }

  // 스텁 출력 생성 — Claude 미사용 시 보안 자가 검사 결과 기반 리뷰
  private buildStubOutput(changeSet: ReviewInput["changeSet"]): ReviewOutput {
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
    return {
      reviewId: `rev_${randomUUID().slice(0, 8)}`,
      passed,
      blockers,
      warnings: [],
      securityFindings: [],
      approvedChangeSetId: passed ? changeSet.changeSetId : undefined,
      // 스텁 기본값 — Claude 미사용 시 중립적 품질 지표 반환
      qualityMetrics: {
        complexityScore: 50,
        maintainabilityScore: 70,
        testabilityScore: 80,
      },
    };
  }
}
