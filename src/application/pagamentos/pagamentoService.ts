import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../api/middlewares/errorHandler.js';
import { registrarLog } from '../../infrastructure/logging/auditLogger.js';
import { StatusPedido, StatusPagamento } from '../../domain/enums.js';

interface ProcessarPagamentoInput {
  pedidoId: number;
  metodo?: string;
  simulacaoStatus?: 'APROVADO' | 'RECUSADO';
  usuarioId?: number;
  ip?: string;
}

export const pagamentoService = {
  async processarPagamentoMock(data: ProcessarPagamentoInput) {
    const pedido = await prisma.pedido.findUnique({
      where: { id: data.pedidoId },
      include: { cliente: true },
    });

    if (!pedido) {
      throw new AppError('Pedido não encontrado.', 404, 'PEDIDO_NAO_ENCONTRADO');
    }

    if (pedido.status === StatusPedido.ENTREGUE || pedido.status === StatusPedido.CANCELADO) {
      throw new AppError(
        `Não é possível processar pagamento para pedido com status ${pedido.status}.`,
        409,
        'STATUS_PEDIDO_INCOMPATIVEL',
        [{ field: 'status', issue: 'Pedido já finalizado ou cancelado' }]
      );
    }

    const metodo = data.metodo || 'PIX';
    const simulacao = data.simulacaoStatus || StatusPagamento.APROVADO;

    const payloadEnvio = JSON.stringify({
      pedidoId: pedido.id,
      valor: pedido.valorTotal,
      metodo,
      cliente: { id: pedido.cliente.id, nome: pedido.cliente.nome },
      timestamp: new Date().toISOString(),
    });

    if (simulacao === StatusPagamento.RECUSADO) {
      const payloadRetorno = JSON.stringify({
        transacaoId: `mock-tx-recusada-${Date.now()}`,
        status: 'RECUSADO',
        codigoRetorno: 'SALDO_INSUFICIENTE_OU_TRANSACAO_NEGADA',
        mensagem: 'Transação não autorizada pela instituição financeira emissora.',
        timestamp: new Date().toISOString(),
      });

      await prisma.pagamentoMock.create({
        data: {
          pedidoId: pedido.id,
          status: StatusPagamento.RECUSADO,
          metodo,
          payloadEnvio,
          payloadRetorno,
        },
      });

      await registrarLog({
        usuarioId: data.usuarioId || pedido.clienteId,
        acao: 'PAGAMENTO_MOCK_RECUSADO',
        detalhe: `Tentativa de pagamento recusada para o Pedido #${pedido.id} no valor de R$ ${pedido.valorTotal.toFixed(2)}`,
        ip: data.ip,
      });

      throw new AppError(
        'O pagamento simulado foi recusado pelo emissor do pagamento (Mock Gateway).',
        402,
        'PAGAMENTO_RECUSADO',
        [
          {
            field: 'pagamento',
            issue: 'Transação negada pelo gateway de pagamento mock',
          },
        ]
      );
    }

    const payloadRetorno = JSON.stringify({
      transacaoId: `mock-tx-aprovada-${Date.now()}`,
      status: 'APROVADO',
      codigoAutorizacao: `AUTH-${Math.floor(100000 + Math.random() * 900000)}`,
      mensagem: 'Pagamento processado e compensado com sucesso.',
      timestamp: new Date().toISOString(),
    });

    const [pagamento, ped] = await prisma.$transaction([
      prisma.pagamentoMock.create({
        data: {
          pedidoId: pedido.id,
          status: StatusPagamento.APROVADO,
          metodo,
          payloadEnvio,
          payloadRetorno,
        },
      }),
      prisma.pedido.update({
        where: { id: pedido.id },
        data: { status: StatusPedido.PREPARANDO },
      }),
    ]);

    await registrarLog({
      usuarioId: data.usuarioId || pedido.clienteId,
      acao: 'PAGAMENTO_MOCK_APROVADO',
      detalhe: `Pagamento aprovado para o Pedido #${pedido.id}. Pedido encaminhado para a cozinha (status: PREPARANDO)`,
      ip: data.ip,
    });

    return {
      sucesso: true,
      pagamentoId: pagamento.id,
      pedidoId: ped.id,
      statusPagamento: pagamento.status,
      novoStatusPedido: ped.status,
      metodo: pagamento.metodo,
      valorPago: ped.valorTotal,
      retornoGateway: JSON.parse(payloadRetorno),
    };
  },
};
