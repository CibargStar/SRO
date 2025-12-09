/**
 * HttpError — прикладная ошибка с HTTP статусом и кодом.
 * Совместима с AppError (statusCode) из middleware/errorHandler.
 */
export class HttpError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode = 400, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const createHttpError = (statusCode: number, message: string, code?: string): HttpError =>
  new HttpError(message, statusCode, code);


