import { prisma } from '../database/prisma.js';

interface LogParams {
  usuarioId?: number;
  acao: string;
  detalhe: string;
  ip?: string;
}

export async function registrarLog(params: LogParams): Promise<void> {
  try {
    await prisma.logAuditoria.create({
      data: {
        usuarioId: params.usuarioId,
        acao: params.acao,
        detalhe: params.detalhe,
        ip: params.ip || '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Erro ao gravar auditoria:', err);
  }
}
