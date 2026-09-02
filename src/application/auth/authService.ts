import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../api/middlewares/errorHandler.js';
import { registrarLog } from '../../infrastructure/logging/auditLogger.js';
import { PerfilUsuario } from '../../domain/enums.js';

const secret = process.env.JWT_SECRET || 'raizes_do_nordeste_jwt_super_secret_key_2026';

function criarSessao(user: { id: number; email: string; perfil: string; nome: string }) {
  const token = jwt.sign(
    { id: user.id, email: user.email, perfil: user.perfil, nome: user.nome },
    secret,
    { expiresIn: '1d' }
  );

  return {
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn: 86400,
    user: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil,
    },
  };
}

export const authService = {
  async cadastrar(data: {
    nome: string;
    email: string;
    senha: string;
    perfil?: PerfilUsuario;
    consentimentoLgpd: boolean;
    ip?: string;
  }) {
    if (!data.consentimentoLgpd) {
      throw new AppError(
        'O consentimento com os termos de privacidade e LGPD é obrigatório para cadastro.',
        422,
        'CONSENTIMENTO_LGPD_OBRIGATORIO',
        [{ field: 'consentimentoLgpd', issue: 'Deve ser true' }]
      );
    }

    const existe = await prisma.usuario.findUnique({
      where: { email: data.email },
    });

    if (existe) {
      throw new AppError(
        'Já existe um usuário cadastrado com este e-mail.',
        409,
        'EMAIL_JA_CADASTRADO',
        [{ field: 'email', issue: 'E-mail já em uso na base' }]
      );
    }

    const hash = await bcrypt.hash(data.senha, 10);

    const user = await prisma.usuario.create({
      data: {
        nome: data.nome,
        email: data.email,
        senhaHash: hash,
        perfil: data.perfil || PerfilUsuario.CLIENTE,
        consentimentoLgpd: data.consentimentoLgpd,
      },
    });

    await registrarLog({
      usuarioId: user.id,
      acao: 'CADASTRO_USUARIO',
      detalhe: `Novo usuário registrado: ${user.email} com perfil ${user.perfil}`,
      ip: data.ip,
    });

    return criarSessao(user);
  },

  async login(data: { email: string; senha: string; ip?: string }) {
    const user = await prisma.usuario.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new AppError('E-mail ou senha inválidos.', 401, 'CREDENCIAIS_INVALIDAS');
    }

    const match = await bcrypt.compare(data.senha, user.senhaHash);
    if (!match) {
      throw new AppError('E-mail ou senha inválidos.', 401, 'CREDENCIAIS_INVALIDAS');
    }

    await registrarLog({
      usuarioId: user.id,
      acao: 'LOGIN_SUCESSO',
      detalhe: `Usuário ${user.email} realizou autenticação com sucesso`,
      ip: data.ip,
    });

    return criarSessao(user);
  },

  async obterPerfil(usuarioId: number) {
    const user = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        consentimentoLgpd: true,
        criadoEm: true,
      },
    });

    if (!user) {
      throw new AppError('Usuário não encontrado.', 404, 'USUARIO_NAO_ENCONTRADO');
    }

    return user;
  },
};
