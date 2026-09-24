/** Error codes shared by every built-in resolver. */
export type ResolverErrorCode =
  | 'ERR_RESOLVER_INVALID_OPTIONS'
  | 'ERR_RESOLVER_INVALID_PATH'
  | 'ERR_RESOLVER_OUTSIDE_ROOT'
  | 'ERR_RESOLVER_NOT_FOUND'
  | 'ERR_RESOLVER_FETCH_FAILED'

export function resolverError(
  code: ResolverErrorCode,
  message: string,
  ErrorType: ErrorConstructor | TypeErrorConstructor = Error,
): Error & { code: ResolverErrorCode } {
  return Object.assign(new ErrorType(message), { code })
}

export function invalidOptions(message: string): Error {
  return resolverError('ERR_RESOLVER_INVALID_OPTIONS', message, TypeError)
}

export function invalidPath(message: string): Error {
  return resolverError('ERR_RESOLVER_INVALID_PATH', message, TypeError)
}

export function outsideRoot(path: string): Error {
  return resolverError('ERR_RESOLVER_OUTSIDE_ROOT', `Resolver path "${path}" resolves outside the configured root`)
}

export function notFound(path: string): Error {
  return resolverError('ERR_RESOLVER_NOT_FOUND', `Resolver content not found: "${path}"`)
}
