export enum CanalPedido {
  APP = 'APP',
  TOTEM = 'TOTEM',
  BALCAO = 'BALCAO',
  PICKUP = 'PICKUP',
  WEB = 'WEB',
}

export enum PerfilUsuario {
  ADMIN = 'ADMIN',
  GERENTE = 'GERENTE',
  CLIENTE = 'CLIENTE',
}

export enum StatusPedido {
  AGUARDANDO_PAGAMENTO = 'AGUARDANDO_PAGAMENTO',
  PREPARANDO = 'PREPARANDO',
  PRONTO = 'PRONTO',
  ENTREGUE = 'ENTREGUE',
  CANCELADO = 'CANCELADO',
}

export enum StatusPagamento {
  APROVADO = 'APROVADO',
  RECUSADO = 'RECUSADO',
}
