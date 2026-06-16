// ---------------------------------------------------------------------------
// Usage accounting (kept in PlaygroundWorkflowStateV2)
// ---------------------------------------------------------------------------

export type WorkflowUsageTurn = {
	requestId: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	finishReason?: string;
	formSessionId?: string;
	at: string;
};

export type WorkflowModelUsage = {
	requests: number;
	inputTokens: number;
	outputTokens: number;
};

export type WorkflowUsageState = {
	totalRequests: number;
	totalInputTokens: number;
	totalOutputTokens: number;
	byModel: Record<string, WorkflowModelUsage>;
	turns: WorkflowUsageTurn[];
};
