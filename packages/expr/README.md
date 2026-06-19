<p align="center">
  <a href="https://paradoc.dev?utm_source=github&utm_medium=expr" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets.paradoc.dev/logo-400x400.png" type="image/png">
      <img src="https://assets.paradoc.dev/logo-400x400.png" height="64" alt="Paradoc logo">
    </picture>
  </a>
  <br />
</p>

<h1 align="center">@paradoc/expr</h1>

<div align="center">

[![Paradoc documentation](https://img.shields.io/badge/Documentation-Paradoc-red.svg)](https://docs.paradoc.dev?utm_source=github&utm_medium=expr)
[![Follow on Twitter](https://img.shields.io/twitter/follow/paradochq?style=social)](https://twitter.com/intent/follow?screen_name=paradochq)

</div>

[Paradoc](https://paradoc.dev?utm_source=github&utm_medium=expr) is **documents as code**. It lets developers and AI agents define, validate, and render business documents using typed, composable schemas. This eliminates template drift, broken mappings, and brittle glue code, while giving AI systems a reliable document layer they can safely read, reason over, and generate against in production workflows.

## Package overview

The purpose-built expression language for Paradoc artifacts. One typed AST is shared by an evaluator and an artifact-aware checker, so authoring-time type checking and runtime evaluation can never disagree. Its scope is logic inside a single artifact: field and section visibility, required, computed defs, validation rules, and payment amounts.

- 🧮 **Exact decimal arithmetic** - money math with no floating-point drift
- 📅 **Temporal types** - date, datetime, time, and duration, with a host-injected `today()` / `now()` clock
- 🔎 **Authoring-time checker** - catches unknown references, type mismatches, and non-boolean gates before a form ever runs
- 🧩 **One registry, two consumers** - the evaluator and the checker share a single function registry, so they never drift apart
- 🛡️ **Null-safe** - missing values read as `null` instead of throwing, and `null` is first-class

## Installation

```bash
npm install @paradoc/expr
```

The same surface is re-exported through `@paradoc/sdk` under an `expr` namespace, so SDK users reach it without a separate dependency:

```typescript
// Direct import.
import { check, parse, evaluateExpression, Decimal } from "@paradoc/expr";

// Or via the SDK namespace.
import { expr } from "@paradoc/sdk";
expr.check(/* ... */);
```

## Usage

Evaluate a source string against a context. It returns a result and never throws on a bad expression; values are tagged (`{ kind, value }`):

```typescript
import { evaluateExpression, createContext } from "@paradoc/expr";

const ctx = createContext({ fields: { age: 25 } });

const result = evaluateExpression("fields.age >= 18", ctx);
// { success: true, value: { kind: "boolean", value: true } }
```

Type-check an expression at authoring time. This is what an editor lints with as an author edits a `visible` or computed expression:

```typescript
import { check, createTypeEnv, T } from "@paradoc/expr";

const env = createTypeEnv({
  "fields.age": T.number,
  "fields.country": T.string,
});

check("fields.age >= 18", env);
// { type: { kind: "boolean" }, diagnostics: [] }

// An unknown reference is caught before the form ever runs.
check("fields.age + fields.unknownField", env);
// diagnostics: [{ severity: "error", code: "unknown-identifier",
//   message: "Unknown reference: fields.unknownField", span: { ... } }]
```

Money math is exact, never floating point:

```typescript
import { Decimal } from "@paradoc/expr";

Decimal.fromString("0.1").add(Decimal.fromString("0.2")).toString();
// "0.3"  (not 0.30000000000000004)

Decimal.fromString("19.95").mul(Decimal.fromInt(3)).toString();
// "59.85"
```

The expression language itself (operators, functions, temporal types) is documented at [docs.paradoc.dev](https://docs.paradoc.dev/concepts/logic). `@paradoc/expr` is a boolean and value expression language, not a flow, routing, or form-selection language.

## Changelog

View the [Changelog](https://github.com/paradoc-dev/paradoc/blob/main/packages/expr/CHANGELOG.md) for updates.

## Related packages

- [`@paradoc/core`](../core) - Runtime and builders; consumes this engine for artifact logic
- [`@paradoc/sdk`](../sdk) - Complete framework; re-exports this as the `expr` namespace
- [`@paradoc/types`](../types) - TypeScript utilities and types

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [contribution guidelines](https://github.com/paradoc-dev/paradoc/blob/main/CONTRIBUTING.md) and [code of conduct](https://github.com/paradoc-dev/paradoc/blob/main/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT license.

See [LICENSE](https://github.com/paradoc-dev/paradoc/blob/main/LICENSE) for more information.
