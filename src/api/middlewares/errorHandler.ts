import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface ErrorDetail {
  field: string;
  issue: string;
}

export class AppError extends Error {
  statusCode: number;
  errorName: string;
  details: ErrorDetail[];

  constructor(
    message: string,
    statusCode = 400,
    errorName = 'ERRO_REQUISICAO',
    details: ErrorDetail[] = []
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorName = errorName;
    this.details = details;
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): Response {
  const timestamp = new Date().toISOString();
  const path = req.originalUrl || req.url;

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.errorName,
      message: err.message,
      details: err.details,
      timestamp,
      path,
    });
  }

  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      issue: e.message,
    }));

    return res.status(422).json({
      error: 'DADOS_INVALIDOS',
      message: 'Os dados enviados na requisição não atendem aos critérios de validação.',
      details,
      timestamp,
      path,
    });
  }

  console.error('[ERRO INTERNO]', err);

  return res.status(500).json({
    error: 'ERRO_INTERNO_SERVIDOR',
    message: 'Ocorreu um erro interno inesperado no servidor.',
    details: [],
    timestamp,
    path,
  });
}
