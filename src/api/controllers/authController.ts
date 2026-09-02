import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../../application/auth/authService.js';
import { PerfilUsuario } from '../../domain/enums.js';

const cadastroSchema = z.object({
  nome: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Formato de e-mail inválido'),
  senha: z.string().min(6, 'A senha deve possuir no mínimo 6 caracteres'),
  perfil: z.nativeEnum(PerfilUsuario).optional(),
  consentimentoLgpd: z.boolean({
    required_error: 'O consentimento LGPD é obrigatório',
  }),
});

const loginSchema = z.object({
  email: z.string().email('Formato de e-mail inválido'),
  senha: z.string().min(1, 'A senha é obrigatória'),
});

export const authController = {
  async cadastrar(req: Request, res: Response, next: NextFunction) {
    try {
      const body = cadastroSchema.parse(req.body);
      const sessao = await authService.cadastrar({ ...body, ip: req.ip });
      return res.status(201).json(sessao);
    } catch (err) {
      return next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const credenciais = loginSchema.parse(req.body);
      const sessao = await authService.login({ ...credenciais, ip: req.ip });
      return res.status(200).json(sessao);
    } catch (err) {
      return next(err);
    }
  },

  async perfil(req: Request, res: Response, next: NextFunction) {
    try {
      const perfil = await authService.obterPerfil(req.user!.id);
      return res.status(200).json(perfil);
    } catch (err) {
      return next(err);
    }
  },
};
