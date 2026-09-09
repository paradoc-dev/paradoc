import type { FormSession } from "../engine/types";
import type {
	WorkflowModelUsage,
	WorkflowUsageState,
	WorkflowUsageTurn,
} from "./usage";

/**
 * v2 workflow state — sessions are keyed by formSessionId and carry an
 * append-only event log instead of a denormalized state blob.
 *
 * Hard break from v1: stale v1 blobs are discarded on load (handled by the
 * Redis adapter), and the version discriminator becomes 2.
 */
export type PlaygroundWorkflowStateV2 = {
  version: 2;
  chatId: string;
  /** Monotonic persisted revision used for cross-request optimistic saves. */
  revision: number;
  activeFormSessionId?: string;
	sessions: Record<string, FormSession>;
	usage: WorkflowUsageState;
	createdAt: string;
	updatedAt: string;
};

export type { WorkflowModelUsage, WorkflowUsageState, WorkflowUsageTurn };

export interface WorkflowStateAdapterV2 {
  load(chatId: string): Promise<PlaygroundWorkflowStateV2>;
  save(state: PlaygroundWorkflowStateV2): Promise<void>;
}

/** Raised when another writer persisted a newer workflow snapshot first. */
export class WorkflowStateConflictError extends Error {
	constructor(public readonly currentRevision?: number) {
		super("Workflow state changed while this operation was in flight.");
		this.name = "WorkflowStateConflictError";
	}
}

export function createEmptyWorkflowStateV2(
	chatId: string,
): PlaygroundWorkflowStateV2 {
	const now = new Date().toISOString();
	return {
		version: 2,
		chatId,
		revision: 0,
		sessions: {},
		usage: {
			totalRequests: 0,
			totalInputTokens: 0,
			totalOutputTokens: 0,
			byModel: {},
			turns: [],
		},
		createdAt: now,
		updatedAt: now,
	};
}
