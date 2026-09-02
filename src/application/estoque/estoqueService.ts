import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../api/middlewares/errorHandler.js';
import { registrarLog } from '../../infrastructure/logging/auditLogger.js';

interface MovimentoEstoqueInput {
  unidadeId: number;
  produtoId: number;
  quantidade: number;
  tipo: 'ENTRADA' | 'SAIDA';
  usuarioId?: number;
  ip?: string;
}

export const estoqueService = {
  async consultarPorUnidade(unidadeId: number) {
    const unidade = await prisma.unidade.findUnique({
      where: { id: unidadeId },
    });

    if (!unidade) {
      throw new AppError('Unidade não encontrada.', 404, 'UNIDADE_NAO_ENCONTRADA');
    }

    const estoques = await prisma.estoque.findMany({
      where: { unidadeId },
      include: { produto: true },
    });

    return estoques.map((e) => ({
      produtoId: e.produtoId,
      nomeProduto: e.produto.nome,
      categoria: e.produto.categoria,
      preco: e.produto.preco,
      saldoDisponivel: e.quantidade,
      atualizadoEm: e.atualizadoEm,
    }));
  },

  async movimentar(data: MovimentoEstoqueInput) {
    if (data.quantidade <= 0) {
      throw new AppError(
        'A quantidade de movimentação deve ser maior que zero.',
        422,
        'QUANTIDADE_INVALIDA',
        [{ field: 'quantidade', issue: 'Deve ser um número positivo' }]
      );
    }

    const [unidade, produto] = await Promise.all([
      prisma.unidade.findUnique({ where: { id: data.unidadeId } }),
      prisma.produto.findUnique({ where: { id: data.produtoId } }),
    ]);

    if (!unidade) {
      throw new AppError('Unidade não encontrada.', 404, 'UNIDADE_NAO_ENCONTRADA');
    }
    if (!produto) {
      throw new AppError('Produto não encontrado.', 404, 'PRODUTO_NAO_ENCONTRADO');
    }

    let estoque = await prisma.estoque.findUnique({
      where: {
        unidadeId_produtoId: {
          unidadeId: data.unidadeId,
          produtoId: data.produtoId,
        },
      },
    });

    if (!estoque) {
      estoque = await prisma.estoque.create({
        data: {
          unidadeId: data.unidadeId,
          produtoId: data.produtoId,
          quantidade: 0,
        },
      });
    }

    let saldo = estoque.quantidade;
    if (data.tipo === 'ENTRADA') {
      saldo += data.quantidade;
    } else {
      if (estoque.quantidade < data.quantidade) {
        throw new AppError(
          'Saldo em estoque insuficiente para saída.',
          409,
          'ESTOQUE_INSUFICIENTE',
          [
            {
              field: 'quantidade',
              issue: `Saldo atual: ${estoque.quantidade}, tentativa de retirada: ${data.quantidade}`,
            },
          ]
        );
      }
      saldo -= data.quantidade;
    }

    const atualizado = await prisma.estoque.update({
      where: { id: estoque.id },
      data: { quantidade: saldo },
      include: { produto: true, unidade: true },
    });

    await registrarLog({
      usuarioId: data.usuarioId,
      acao: 'MOVIMENTACAO_ESTOQUE',
      detalhe: `Movimentação ${data.tipo} de ${data.quantidade}x ${produto.nome} na unidade ${unidade.nome}. Saldo final: ${saldo}`,
      ip: data.ip,
    });

    return {
      unidadeId: atualizado.unidadeId,
      unidadeNome: atualizado.unidade.nome,
      produtoId: atualizado.produtoId,
      produtoNome: atualizado.produto.nome,
      tipoMovimentacao: data.tipo,
      quantidadeMovimentada: data.quantidade,
      saldoAtual: atualizado.quantidade,
      atualizadoEm: atualizado.atualizadoEm,
    };
  },
};
