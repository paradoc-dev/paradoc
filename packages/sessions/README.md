<p align="center">
  <a href="https://paradoc.dev?utm_source=github&utm_medium=sessions" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets.paradoc.dev/logo-400x400.png" type="image/png">
      <img src="https://assets.paradoc.dev/logo-400x400.png" height="64" alt="Paradoc logo">
    </picture>
  </a>
  <br />
</p>

<h1 align="center">@paradoc/sessions</h1>

<div align="center">

[![Paradoc documentation](https://img.shields.io/badge/Documentation-Paradoc-red.svg)](https://docs.paradoc.dev?utm_source=github&utm_medium=sessions)
[![Follow on Twitter](https://img.shields.io/twitter/follow/paradochq?style=social)](https://twitter.com/intent/follow?screen_name=paradochq)

</div>

[Paradoc](https://paradoc.dev?utm_source=github&utm_medium=sessions) is **documents as code**. It lets developers and AI agents define, validate, and render business documents using typed, composable schemas. This eliminates template drift, broken mappings, and brittle glue code, while giving AI systems a reliable document layer they can safely read, reason over, and generate against in production workflows.

## Package overview

The deterministic form-completion session engine for Paradoc artifacts. An event-sourced command/view core drives a session from an artifact definition: issue a command, append events, project the current view. Its only Paradoc dependency is `@paradoc/core`, which keeps it browser-safe by construction.

- 📝 **Event-sourced** - every answer is an appended event; a session rebuilds from its log
- 🔁 **Command and view** - one `Command` mutates, `deriveView` projects the current state for rendering
- 🗄️ **Storage-agnostic** - the persistence port is injected, so in-memory, Redis, and Postgres are all the caller's choice
- 🧭 **Fill-state aware** - reads visibility and required cascades straight from `@paradoc/core`, so they resolve the same way everywhere
- 🪶 **No LLM, no UI** - the agent layer that drives this engine lives in `@paradoc/ai`

## Installation

```bash
npm install @paradoc/sessions
```

The engine is also re-exported through `@paradoc/sdk`, so SDK users can import it from there directly.

## Usage

There are three moving parts: a **runtime** that knows the artifact, a **session** that holds the event log, and the **command/view** pair that mutates and reads it.

Build a runtime from an artifact definition. It is the read-only interface the engine uses to look up fields, validate values, and compute fill-state:

```typescript
import { createParadocRuntime } from "@paradoc/sessions";

const runtime = createParadocRuntime(artifact);
```

A `Command` is the only way to mutate a session. `execute` decides which events to append and returns a new session plus the events it emitted; it never mutates in place:

```typescript
import { execute } from "@paradoc/sessions";

const result = execute(
  { kind: "answer", fieldPath: "age", value: 25, source: "user" },
  session,
  runtime,
);

if (result.ok) {
  session = result.session; // new session with the appended event
}
```

Project the log into the current view for rendering:

```typescript
import { deriveView } from "@paradoc/sessions";

const view = deriveView(session, runtime);

view.phase; // where the session is in its lifecycle
view.target; // the field to ask about next, if any
view.progress; // answered vs. remaining
```

Because storage is not baked in, you persist and rehydrate the event log yourself:

```typescript
// Persist the new event log after each command.
await store.save(session.formSessionId, result.session.events);

// Rehydrate later from the stored events.
const session = { ...rest, events: await store.load(id) };
```

For the full API and the persistence port, visit [docs.paradoc.dev](https://docs.paradoc.dev/sdk/sessions).

## Changelog

View the [Changelog](https://github.com/paradoc-dev/paradoc/blob/main/packages/sessions/CHANGELOG.md) for updates.

## Related packages

- [`@paradoc/core`](../core) - Runtime, builders, and fill-state; the engine's only Paradoc dependency
- [`@paradoc/sdk`](../sdk) - Complete framework; re-exports this engine
- [`@paradoc/expr`](../expr) - The expression engine behind artifact logic

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [contribution guidelines](https://github.com/paradoc-dev/paradoc/blob/main/CONTRIBUTING.md) and [code of conduct](https://github.com/paradoc-dev/paradoc/blob/main/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT license.

See [LICENSE](https://github.com/paradoc-dev/paradoc/blob/main/LICENSE) for more information.
