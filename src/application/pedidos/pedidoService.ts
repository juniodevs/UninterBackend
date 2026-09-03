import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../api/middlewares/errorHandler.js';
import { registrarLog } from '../../infrastructure/logging/auditLogger.js';
import { CanalPedido, StatusPedido } from '../../domain/enums.js';

interface ItemPedidoInput {
  produtoId: number;
  quantidade: number;
}

interface CriarPedidoInput {
  unidadeId: number;
  clienteId: number;
  canalPedido: string;
  itens: ItemPedidoInput[];
  ip?: string;
}

interface ListarPedidosFiltro {
  canalPedido?: string;
  status?: string;
  unidadeId?: number;
  clienteId?: number;
  page?: number;
  limit?: number;
}

export const pedidoService = {
  async criarPedido(data: CriarPedidoInput) {
    if (!data.canalPedido) {
      throw new AppError(
        'O campo canalPedido é obrigatório.',
        422,
        'CANAL_PEDIDO_OBRIGATORIO',
        [{ field: 'canalPedido', issue: 'Campo obrigatório ausente' }]
      );
    }

    const canais = Object.values(CanalPedido) as string[];
    const canal = data.canalPedido.toUpperCase();
    if (!canais.includes(canal)) {
      throw new AppError(
        `Canal de pedido '${data.canalPedido}' é inválido.`,
        422,
        'CANAL_PEDIDO_INVALIDO',
        [{ field: 'canalPedido', issue: `Valores permitidos: ${canais.join(', ')}` }]
      );
    }

    const unidade = await prisma.unidade.findUnique({
      where: { id: data.unidadeId },
    });
    if (!unidade || !unidade.ativo) {
      throw new AppError('Unidade não encontrada ou inativa.', 404, 'UNIDADE_NAO_ENCONTRADA');
    }

    const cliente = await prisma.usuario.findUnique({
      where: { id: data.clienteId },
    });
    if (!cliente) {
      throw new AppError('Cliente não encontrado.', 404, 'CLIENTE_NAO_ENCONTRADO');
    }

    if (!data.itens?.length) {
      throw new AppError(
        'O pedido deve conter pelo menos um item.',
        422,
        'ITENS_OBRIGATORIOS',
        [{ field: 'itens', issue: 'Lista de itens vazia' }]
      );
    }

    let valorTotal = 0;
    const itensProcessados: Array<{
      produtoId: number;
      quantidade: number;
      precoUnitario: number;
      nomeProduto: string;
      estoqueId: number;
      saldoAtual: number;
    }> = [];

    for (let i = 0; i < data.itens.length; i++) {
      const item = data.itens[i];
      if (!item.quantidade || item.quantidade <= 0) {
        throw new AppError(
          `Quantidade inválida para o item no índice ${i}.`,
          422,
          'QUANTIDADE_INVALIDA',
          [{ field: `itens[${i}].quantidade`, issue: 'Deve ser maior que 0' }]
        );
      }

      const produto = await prisma.produto.findUnique({
        where: { id: item.produtoId },
      });
      if (!produto || !produto.ativo) {
        throw new AppError(
          `Produto com ID ${item.produtoId} não foi encontrado ou está inativo.`,
          404,
          'PRODUTO_NAO_ENCONTRADO',
          [{ field: `itens[${i}].produtoId`, issue: 'Produto inexistente' }]
        );
      }

      const estoque = await prisma.estoque.findUnique({
        where: {
          unidadeId_produtoId: {
            unidadeId: data.unidadeId,
            produtoId: item.produtoId,
          },
        },
      });

      const saldo = estoque ? estoque.quantidade : 0;
      if (saldo < item.quantidade) {
        throw new AppError(
          `Não há estoque suficiente para o produto '${produto.nome}' na unidade selecionada.`,
          409,
          'ESTOQUE_INSUFICIENTE',
          [
            {
              field: `itens[${i}].quantidade`,
              issue: `Disponível: ${saldo}, Solicitado: ${item.quantidade}`,
            },
          ]
        );
      }

      valorTotal += produto.preco * item.quantidade;

      itensProcessados.push({
        produtoId: produto.id,
        quantidade: item.quantidade,
        precoUnitario: produto.preco,
        nomeProduto: produto.nome,
        estoqueId: estoque!.id,
        saldoAtual: saldo,
      });
    }

    const pedido = await prisma.$transaction(async (tx) => {
      for (const it of itensProcessados) {
        await tx.estoque.update({
          where: { id: it.estoqueId },
          data: { quantidade: it.saldoAtual - it.quantidade },
        });
      }

      return tx.pedido.create({
        data: {
          unidadeId: data.unidadeId,
          clienteId: data.clienteId,
          canalPedido: canal,
          status: StatusPedido.AGUARDANDO_PAGAMENTO,
          valorTotal: parseFloat(valorTotal.toFixed(2)),
          itens: {
            create: itensProcessados.map((it) => ({
              produtoId: it.produtoId,
              quantidade: it.quantidade,
              precoUnitario: it.precoUnitario,
            })),
          },
        },
        include: {
          itens: {
            include: { produto: true },
          },
        },
      });
    });

    await registrarLog({
      usuarioId: data.clienteId,
      acao: 'CRIACAO_PEDIDO',
      detalhe: `Pedido #${pedido.id} criado via canal ${canal} no valor de R$ ${pedido.valorTotal.toFixed(2)}`,
      ip: data.ip,
    });

    return {
      pedidoId: pedido.id,
      canalPedido: pedido.canalPedido,
      unidadeId: pedido.unidadeId,
      clienteId: pedido.clienteId,
      status: pedido.status,
      valorTotal: pedido.valorTotal,
      itens: pedido.itens.map((i) => ({
        produtoId: i.produtoId,
        nome: i.produto.nome,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
        subtotal: parseFloat((i.precoUnitario * i.quantidade).toFixed(2)),
      })),
      createdAt: pedido.criadoEm,
    };
  },

  async listarPedidos(filtro: ListarPedidosFiltro) {
    const page = Number(filtro.page) || 1;
    const limit = Number(filtro.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filtro.canalPedido) where.canalPedido = filtro.canalPedido.toUpperCase();
    if (filtro.status) where.status = filtro.status.toUpperCase();
    if (filtro.unidadeId) where.unidadeId = Number(filtro.unidadeId);
    if (filtro.clienteId) where.clienteId = Number(filtro.clienteId);

    const [total, pedidos] = await Promise.all([
      prisma.pedido.count({ where }),
      prisma.pedido.findMany({
        where,
        skip,
        take: limit,
        orderBy: { criadoEm: 'desc' },
        include: {
          unidade: { select: { id: true, nome: true } },
          cliente: { select: { id: true, nome: true, email: true } },
          itens: {
            include: { produto: { select: { id: true, nome: true } } },
          },
        },
      }),
    ]);

    return {
      data: pedidos.map((p) => ({
        pedidoId: p.id,
        canalPedido: p.canalPedido,
        status: p.status,
        valorTotal: p.valorTotal,
        unidade: p.unidade,
        cliente: p.cliente,
        itens: p.itens.map((it) => ({
          produtoId: it.produtoId,
          nome: it.produto.nome,
          quantidade: it.quantidade,
          precoUnitario: it.precoUnitario,
        })),
        createdAt: p.criadoEm,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async buscarPorId(id: number) {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        unidade: true,
        cliente: { select: { id: true, nome: true, email: true } },
        itens: { include: { produto: true } },
        pagamentos: true,
      },
    });

    if (!pedido) {
      throw new AppError('Pedido não encontrado.', 404, 'PEDIDO_NAO_ENCONTRADO');
    }

    return {
      pedidoId: pedido.id,
      canalPedido: pedido.canalPedido,
      status: pedido.status,
      valorTotal: pedido.valorTotal,
      unidade: {
        id: pedido.unidade.id,
        nome: pedido.unidade.nome,
        cidade: pedido.unidade.cidade,
      },
      cliente: pedido.cliente,
      itens: pedido.itens.map((it) => ({
        produtoId: it.produtoId,
        nome: it.produto.nome,
        quantidade: it.quantidade,
        precoUnitario: it.precoUnitario,
        subtotal: parseFloat((it.precoUnitario * it.quantidade).toFixed(2)),
      })),
      pagamentos: pedido.pagamentos,
      createdAt: pedido.criadoEm,
      updatedAt: pedido.atualizadoEm,
    };
  },

  async atualizarStatus(id: number, novoStatus: string, usuarioId?: number, ip?: string) {
    const permitidos = Object.values(StatusPedido) as string[];
    const status = novoStatus.toUpperCase();

    if (!permitidos.includes(status)) {
      throw new AppError(
        `Status '${novoStatus}' inválido.`,
        422,
        'STATUS_INVALIDO',
        [{ field: 'status', issue: `Permitidos: ${permitidos.join(', ')}` }]
      );
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id },
    });

    if (!pedido) {
      throw new AppError('Pedido não encontrado.', 404, 'PEDIDO_NAO_ENCONTRADO');
    }

    const atualizado = await prisma.pedido.update({
      where: { id },
      data: { status },
    });

    await registrarLog({
      usuarioId,
      acao: 'ALTERACAO_STATUS_PEDIDO',
      detalhe: `Status do Pedido #${id} alterado de ${pedido.status} para ${status}`,
      ip,
    });

    return {
      pedidoId: atualizado.id,
      statusAnterior: pedido.status,
      novoStatus: atualizado.status,
      updatedAt: atualizado.atualizadoEm,
    };
  },
};
