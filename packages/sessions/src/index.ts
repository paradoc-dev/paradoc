// ─── Engine ──────────────────────────────────────────────────────────────
export type {
	ArtifactRuntime,
	Command,
	CommandErrorCode,
	CommandResult,
	AnnexValidation,
	ExecuteOptions,
	FieldValidation,
	FillStateSnapshot,
	FormSession,
	PartyValidation,
} from "./engine/types";
export { execute } from "./engine/execute";
export { fillStateOf, sessionPayload } from "./engine/payload";
export type { SessionPayload } from "./engine/payload";
export { deriveView } from "./engine/derive";
export type {
	AnnexIndexEntry,
	AnnexTarget,
	FieldIndexEntry,
	FieldTarget,
	PartyIndexEntry,
	PartyTarget,
	Phase,
	ProgressSummary,
	SessionView,
} from "./engine/derive";
export { createParadocRuntime } from "./engine/paradoc-runtime";
export type { CoercionOptions } from "./engine/coerce";

// ─── Event log ───────────────────────────────────────────────────────────
export type {
	Actor,
	AnsweredAnnex,
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
export {
	createEmptyWorkflowStateV2,
	WorkflowStateConflictError,
} from "./state/types";
export type {
	WorkflowModelUsage,
	WorkflowUsageState,
	WorkflowUsageTurn,
} from "./state/usage";
