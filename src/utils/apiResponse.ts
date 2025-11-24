export class ApiError extends Error {
  statusCode: number;
  details?: unknown;
  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function ok<T>(data: T, message = 'ok') {
  return { success: true, message, data };
}
