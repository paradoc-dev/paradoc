/**
 * @paradoc/expr — a purpose-built expression language for Paradoc artifacts.
 *
 * Public surface grows by phase:
 *   Phase 1 (this): shared types, the typed AST, grammar config, function registry.
 *   Phase 2: parser (`parse`).
 *   Phase 3: evaluator (`evaluate`).
 *   Phase 4: artifact-aware checker (`check`).
 */

// Shared types
export type {
	Position,
	Span,
	PrimitiveTypeKind,
	ExprType,
	Severity,
	DiagnosticCode,
	Diagnostic,
} from './types'
export { T, formatType, typesEqual } from './types'

// AST
export type {
	Expr,
	ExprKind,
	NumberLiteral,
	StringLiteral,
	BooleanLiteral,
	NullLiteral,
	ArrayLiteral,
	Identifier,
	Member,
	Index,
	Unary,
	UnaryOp,
	Binary,
	BinaryOp,
	ArithmeticOp,
	ComparisonOp,
	Logical,
	LogicalOp,
	Membership,
	Conditional,
	Call,
} from './ast/nodes'

// Grammar config
export {
	KEYWORDS,
	KEYWORD_SET,
	BINARY_OPERATORS,
	BINARY_OPERATOR_TOKENS,
	UNARY_OPERATORS,
	FORBIDDEN_OPERATORS,
} from './grammar/grammar'
export type { Keyword, Associativity, OperatorInfo } from './grammar/grammar'

// Function registry
export {
	DEFAULT_SIGNATURES,
	buildRegistry,
} from './registry/registry'
export type {
	FnSignature,
	FnCategory,
	ParamSpec,
	ReturnSpec,
	Registry,
} from './registry/registry'

// Parser
export { parse, parseOrThrow } from './parser/parser'
export type { ParseResult } from './parser/parser'
export { tokenize, LexError } from './parser/lexer'
export type { Token, TokenType } from './parser/lexer'

// Static analysis
export { extractReferences } from './analyze/references'
export type { References } from './analyze/references'

// Decimal
export { Decimal, DivisionByZeroError } from './decimal/decimal'
export type { RoundingMode } from './decimal/decimal'

// Evaluator
export type { Value } from './eval/index'
export {
	Values,
	toValue,
	truthy,
	valueToString,
	valueEquals,
	NULL,
	EvaluationError,
	createContext,
	BUILTIN_IMPLS,
	evaluate,
	evaluateExpression,
	evaluateBoolean,
} from './eval/index'
export type {
	EvalErrorCode,
	EvaluationContext,
	AsOf,
	HostFunction,
	ContextOptions,
	Impl,
	EvalResult,
} from './eval/index'

// Checker
export { check, checkAst, checkBooleanGate, createTypeEnv } from './check/checker'
export type { TypeEnv, CheckResult } from './check/checker'
