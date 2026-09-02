import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { estoqueService } from '../../application/estoque/estoqueService.js';
import { AppError } from '../middlewares/errorHandler.js';

const movimentoSchema = z.object({
  unidadeId: z.number({ required_error: 'unidadeId é obrigatório' }).int().positive(),
  produtoId: z.number({ required_error: 'produtoId é obrigatório' }).int().positive(),
  quantidade: z.number({ required_error: 'quantidade é obrigatória' }).int().positive(),
  tipo: z.enum(['ENTRADA', 'SAIDA'], {
    errorMap: () => ({ message: "O tipo deve ser 'ENTRADA' ou 'SAIDA'" }),
  }),
});

export const estoqueController = {
  async consultarPorUnidade(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId = Number(req.params.unidadeId);
      if (isNaN(unidadeId)) {
        throw new AppError('Identificador da unidade inválido.', 422, 'PARAMETRO_INVALIDO');
      }

      const saldo = await estoqueService.consultarPorUnidade(unidadeId);
      return res.status(200).json(saldo);
    } catch (err) {
      return next(err);
    }
  },

  async movimentar(req: Request, res: Response, next: NextFunction) {
    try {
      const body = movimentoSchema.parse(req.body);

      const resultado = await estoqueService.movimentar({
        ...body,
        usuarioId: req.user?.id,
        ip: req.ip,
      });

      return res.status(200).json(resultado);
    } catch (err) {
      return next(err);
    }
  },
};
