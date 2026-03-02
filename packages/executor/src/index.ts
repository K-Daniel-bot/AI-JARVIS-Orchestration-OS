/**
 * @jarvis/executor 패키지 배럴 익스포트
 * Executor 에이전트가 OS 조작에 사용하는 Action API, OS 추상화, 강제 검증 훅을 제공한다.
 * contract.md §1: Executor 에이전트가 OS를 조작하는 유일한 주체.
 * export 순서: types → action-api → os-abstraction → enforcement-hook
 */

// ─────────────────────────────────────────
// 1. 액션 API — 38가지 ActionType 생성/검증
// ─────────────────────────────────────────

export type { ActionCategory, CreateActionParams } from './action-api.js';
export {
  ACTION_CATEGORIES,
  inferRiskTags,
  createAction,
  validateAction,
  getActionCategory,
  isMobileAction,
  requiresGate,
} from './action-api.js';

// ─────────────────────────────────────────
// 2. OS 추상화 레이어 — 플랫폼 독립적 OS 작업
// ─────────────────────────────────────────

export type {
  OsPlatform,
  ProcessResult,
  AppLaunchResult,
  OsOperations,
} from './os-abstraction.js';
export {
  detectPlatform,
  createOsOperations,
  isValidWindowsPath,
  isValidPosixPath,
  isDeniedCommand,
  createOsError,
} from './os-abstraction.js';

// ─────────────────────────────────────────
// 3. 강제 검증 훅 — Capability Token 기반 실행 전/후 검증
// ─────────────────────────────────────────

export type {
  EnforcementResult,
  PreEnforceParams,
  PostEnforceParams,
  PostEnforceResult,
} from './enforcement-hook.js';
export {
  checkConstraints,
  preEnforce,
  postEnforce,
} from './enforcement-hook.js';
