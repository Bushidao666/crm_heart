export class HttpError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.details = details
  }
}

export const parseError = (error: unknown) => {
  if (error instanceof HttpError) return error
  if (error instanceof Error) return new HttpError(error.message, 500)
  return new HttpError('Erro inesperado.', 500, error)
}
