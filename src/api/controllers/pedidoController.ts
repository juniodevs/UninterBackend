import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pedidoService } from '../../application/pedidos/pedidoService.js';
import { CanalPedido, StatusPedido } from '../../domain/enums.js';
import { AppError } from '../middlewares/errorHandler.js';

const itemSchema = z.object({
  produtoId: z.number({ required_error: 'produtoId é obrigatório' }).int().positive(),
  quantidade: z.number({ required_error: 'quantidade é obrigatória' }).int().positive(),
});

const criarPedidoSchema = z.object({
  unidadeId: z.number({ required_error: 'unidadeId é obrigatório' }).int().positive(),
  clienteId: z.number().int().positive().optional(),
  canalPedido: z.nativeEnum(CanalPedido, {
    errorMap: () => ({
      message: `canalPedido inválido. Valores aceitos: ${Object.values(CanalPedido).join(', ')}`,
    }),
  }),
  itens: z.array(itemSchema).min(1, 'O pedido deve conter ao menos um item'),
});

const statusSchema = z.object({
  status: z.nativeEnum(StatusPedido, {
    errorMap: () => ({
      message: `Status inválido. Valores aceitos: ${Object.values(StatusPedido).join(', ')}`,
    }),
  }),
});

export const pedidoController = {
  async criar(req: Request, res: Response, next: NextFunction) {
    try {
      const body = criarPedidoSchema.parse(req.body);
      const clienteId = req.user?.id || body.clienteId;

      if (!clienteId) {
        return res.status(422).json({
          error: 'CLIENTE_OBRIGATORIO',
          message: 'É necessário informar o clienteId ou estar autenticado.',
          details: [{ field: 'clienteId', issue: 'Identificação do cliente ausente' }],
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
      }

      const pedido = await pedidoService.criarPedido({
        unidadeId: body.unidadeId,
        clienteId,
        canalPedido: body.canalPedido,
        itens: body.itens,
        ip: req.ip,
      });

      return res.status(201).json(pedido);
    } catch (err) {
      return next(err);
    }
  },

  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const { canalPedido, status, unidadeId, clienteId, page, limit } = req.query;

      const pedidos = await pedidoService.listarPedidos({
        canalPedido: canalPedido ? String(canalPedido) : undefined,
        status: status ? String(status) : undefined,
        unidadeId: unidadeId ? Number(unidadeId) : undefined,
        clienteId: clienteId ? Number(clienteId) : undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
      });

      return res.status(200).json(pedidos);
    } catch (err) {
      return next(err);
    }
  },

  async buscarPorId(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new AppError('Identificador do pedido inválido.', 422, 'PARAMETRO_INVALIDO', [
          { field: 'id', issue: 'Deve ser um número inteiro' },
        ]);
      }

      const pedido = await pedidoService.buscarPorId(id);
      return res.status(200).json(pedido);
    } catch (err) {
      return next(err);
    }
  },

  async atualizarStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new AppError('Identificador do pedido inválido.', 422, 'PARAMETRO_INVALIDO', [
          { field: 'id', issue: 'Deve ser um número inteiro' },
        ]);
      }

      const body = statusSchema.parse(req.body);

      const pedido = await pedidoService.atualizarStatus(
        id,
        body.status,
        req.user?.id,
        req.ip
      );

      return res.status(200).json(pedido);
    } catch (err) {
      return next(err);
    }
  },
};
