/**
 * @paradoc/expr: the Paradoc expression language, with its parser, evaluator,
 * and artifact-aware type checker.
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
	RegistryOptions,
} from './registry/registry'

// Parser
export { parse, parseOrThrow, MAX_EXPRESSION_DEPTH, MAX_EXPRESSION_LENGTH } from './parser/parser'
export type { ParseResult } from './parser/parser'
export { tokenize, LexError } from './parser/lexer'
export type { Token, TokenType } from './parser/lexer'

// Static analysis
export { staticPath } from './ast/paths'
export { extractReferences } from './analyze/references'
export type { References } from './analyze/references'
export { missingReferences } from './analyze/missing'

// Decimal
export { Decimal, DivisionByZeroError, MAX_DECIMAL_DIGITS, MAX_DECIMAL_SCALE } from './decimal/decimal'
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
	AGGREGATE_NAMES,
	isAggregateName,
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
	RowVisibility,
	Impl,
	EvalResult,
	AggregateName,
} from './eval/index'

// Checker
export { check, checkAst, checkBooleanGate, createTypeEnv } from './check/checker'
export type { TypeEnv, CheckResult } from './check/checker'
