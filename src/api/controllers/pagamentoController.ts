import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pagamentoService } from '../../application/pagamentos/pagamentoService.js';
import { StatusPagamento } from '../../domain/enums.js';

const pagamentoSchema = z.object({
  pedidoId: z.number({ required_error: 'pedidoId é obrigatório' }).int().positive(),
  metodo: z.string().optional(),
  simulacaoStatus: z.nativeEnum(StatusPagamento).optional(),
});

export const pagamentoController = {
  async processarMock(req: Request, res: Response, next: NextFunction) {
    try {
      const body = pagamentoSchema.parse(req.body);

      const resPagamento = await pagamentoService.processarPagamentoMock({
        pedidoId: body.pedidoId,
        metodo: body.metodo,
        simulacaoStatus: body.simulacaoStatus,
        usuarioId: req.user?.id,
        ip: req.ip,
      });

      return res.status(200).json(resPagamento);
    } catch (err) {
      return next(err);
    }
  },
};
