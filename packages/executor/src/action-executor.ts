// 액션 실행기 (레거시 진입점) — executor/action-executor.ts로 위임
// 하위 호환성을 위해 유지되며 새 구현체를 re-export함
export {
  executeAction,
  executeActions,
} from "./executor/action-executor.js";
