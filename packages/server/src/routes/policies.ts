// 정책 API 라우트 — GET /api/policies
import { Router, type IRouter } from "express";
import { successResponse } from "./types.js";

export const policiesRouter: IRouter = Router();

// GET /api/policies
policiesRouter.get("/", (_req, res) => {
  res.json(successResponse({
    active: [
      { policyId: "pol_001", name: "파괴적 작업 금지", description: "main 브랜치에서 삭제/덮어쓰기 금지", priority: 1, isActive: true, createdAt: new Date().toISOString() },
      { policyId: "pol_002", name: "Scope 제한", description: "/src 디렉토리 이외 파일 접근 금지", priority: 2, isActive: true, createdAt: new Date().toISOString() },
      { policyId: "pol_003", name: "네트워크 차단", description: "승인 없이 외부 네트워크 접근 금지", priority: 3, isActive: true, createdAt: new Date().toISOString() },
    ],
    proposed: [],
  }));
});
