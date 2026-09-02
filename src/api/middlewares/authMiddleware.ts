import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';
import { PerfilUsuario } from '../../domain/enums.js';

export interface UserPayload {
  id: number;
  email: string;
  perfil: string;
  nome: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

const jwtSecret = process.env.JWT_SECRET || 'raizes_do_nordeste_jwt_super_secret_key_2026';

export function autenticarJwt(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header) {
    throw new AppError(
      'Token de autenticação não fornecido no cabeçalho Authorization.',
      401,
      'NAO_AUTENTICADO'
    );
  }

  const [tipo, token] = header.split(' ');
  if (tipo !== 'Bearer' || !token) {
    throw new AppError(
      'Formato de cabeçalho de autenticação inválido. Utilize: Bearer <token>.',
      401,
      'TOKEN_FORMATO_INVALIDO'
    );
  }

  try {
    req.user = jwt.verify(token, jwtSecret) as UserPayload;
    next();
  } catch {
    throw new AppError(
      'Token de autenticação inválido ou expirado.',
      401,
      'TOKEN_INVALIDO'
    );
  }
}

export function autorizarPerfis(...perfis: PerfilUsuario[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Usuário não autenticado.', 401, 'NAO_AUTENTICADO');
    }

    const perfil = req.user.perfil as PerfilUsuario;
    if (!perfis.includes(perfil)) {
      throw new AppError(
        `Acesso negado. O perfil ${req.user.perfil} não possui permissão para executar esta ação.`,
        403,
        'ACESSO_NEGADO',
        [{ field: 'perfil', issue: `Permissões aceitas: ${perfis.join(', ')}` }]
      );
    }

    next();
  };
}

export function autenticarOpcional(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header) {
    const [tipo, token] = header.split(' ');
    if (tipo === 'Bearer' && token) {
      try {
        req.user = jwt.verify(token, jwtSecret) as UserPayload;
      } catch {}
    }
  }
  next();
}
