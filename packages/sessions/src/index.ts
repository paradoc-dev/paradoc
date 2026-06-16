// ─── Engine ──────────────────────────────────────────────────────────────
export type {
	ArtifactRuntime,
	Command,
	CommandErrorCode,
	CommandResult,
	ExecuteOptions,
	FieldValidation,
	FillStateSnapshot,
	FormSession,
} from "./engine/types";
export { execute } from "./engine/execute";
export { deriveView } from "./engine/derive";
export type {
	FieldTarget,
	Phase,
	ProgressSummary,
	SessionView,
} from "./engine/derive";
export { createParadocRuntime } from "./engine/paradoc-runtime";

// ─── Event log ───────────────────────────────────────────────────────────
export type {
	Actor,
	AnsweredParty,
	AnsweredValue,
	Issue,
	Presentation,
	PresentationRecord,
	ProjectedSession,
	SessionEvent,
	SessionEventType,
	Source,
} from "./event-log/types";
export { project } from "./event-log/projector";

// ─── State (v2) ──────────────────────────────────────────────────────────
export type {
	PlaygroundWorkflowStateV2,
	WorkflowStateAdapterV2,
} from "./state/types";
export { createEmptyWorkflowStateV2 } from "./state/types";
export type {
	WorkflowModelUsage,
	WorkflowUsageState,
	WorkflowUsageTurn,
} from "./state/usage";

// ─── Session-spine adapter (web-ai chat over the Postgres ai_session log) ──
export {
	createSpineStateAdapter,
	spineEventToAgentEvent,
	agentEventToSpineAppend,
	SpineConflictError,
	type SessionSpinePort,
	type SpineEvent,
	type SpineAppend,
	type SpineAppendResult,
} from "./spine-adapter";
