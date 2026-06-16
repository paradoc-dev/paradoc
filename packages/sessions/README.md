# @paradoc/sessions

> **In development; not yet published.** This package is currently `private: true` and lives in the Paradoc workspace for internal consumers (e.g. `@paradoc/ai`'s form-completion agent and the landing playground). It will graduate to public npm publishing in a future release.

The deterministic **form-completion session engine** for Paradoc artifacts. An event-sourced command/view core that drives a session from an artifact definition: issue a command, project the event log, derive the current view.

Its only Paradoc dependency is `@paradoc/core`, which keeps it browser-safe by construction. Storage is **not** baked in: the persistence port (`SessionSpinePort`) is injected, so in-memory, Redis, and Postgres are all callers' choices.

## What it does

```ts
import {
  createParadocRuntime,
  execute,
  deriveView,
} from "@paradoc/sessions";

// Build a runtime from an artifact definition (uses @paradoc/core).
const runtime = createParadocRuntime(artifactDefinition);

// Issue a command against the append-only event log.
const result = execute({ session, command, runtime });

// Project the log into the current view for rendering.
const view = deriveView(result.session, runtime);
```

## Surface

- **Engine** — `execute` (command handling), `deriveView` (projection → view), `createParadocRuntime` (artifact-backed runtime), plus the `FormSession`, `Command`, `CommandResult`, `ArtifactRuntime`, and view types.
- **Event log** — `project` and the `SessionEvent` / `ProjectedSession` shapes.
- **State (v2)** — `PlaygroundWorkflowStateV2`, `createEmptyWorkflowStateV2`, the `WorkflowStateAdapterV2` port, and usage-accounting types.
- **Spine adapter** — `createSpineStateAdapter` and the `SessionSpinePort` interface for translating between persisted spine events and engine events.

It ships **no LLM, no AI, and no UI** — the agent layer that drives this engine lives in `@paradoc/ai`.
