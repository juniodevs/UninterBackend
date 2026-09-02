import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

export const unidadeController = {
  async listar(_req: Request, res: Response, next: NextFunction) {
    try {
      const unidades = await prisma.unidade.findMany({
        where: { ativo: true },
        select: {
          id: true,
          nome: true,
          endereco: true,
          cidade: true,
          estado: true,
          tipoCozinha: true,
        },
      });
      return res.status(200).json(unidades);
    } catch (err) {
      return next(err);
    }
  },

  async cardapio(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId = Number(req.params.id);
      if (isNaN(unidadeId)) {
        throw new AppError('Identificador da unidade inválido.', 422, 'PARAMETRO_INVALIDO', [
          { field: 'id', issue: 'Deve ser um número inteiro' },
        ]);
      }

      const unidade = await prisma.unidade.findUnique({
        where: { id: unidadeId },
      });
      if (!unidade) {
        throw new AppError('Unidade não encontrada.', 404, 'UNIDADE_NAO_ENCONTRADA');
      }

      const produtos = await prisma.produto.findMany({
        where: { ativo: true },
        include: {
          estoques: {
            where: { unidadeId },
          },
        },
      });

      const cardapio = produtos.map((p) => {
        const saldo = p.estoques[0]?.quantidade || 0;
        return {
          id: p.id,
          nome: p.nome,
          descricao: p.descricao,
          categoria: p.categoria,
          preco: p.preco,
          sazonalJunino: p.sazonalJunino,
          disponivel: saldo > 0,
          estoqueDisponivel: saldo,
        };
      });

      return res.status(200).json({
        unidade: {
          id: unidade.id,
          nome: unidade.nome,
          cidade: unidade.cidade,
          tipoCozinha: unidade.tipoCozinha,
        },
        cardapio,
      });
    } catch (err) {
      return next(err);
    }
  },
};
