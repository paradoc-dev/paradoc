/**
 * Error thrown when loading an artifact fails
 */
export class LoadError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message)
    this.name = 'LoadError'
  }
}
