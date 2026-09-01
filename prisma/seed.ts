import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Populando banco...');

  await prisma.pagamentoMock.deleteMany();
  await prisma.itemPedido.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.estoque.deleteMany();
  await prisma.produto.deleteMany();
  await prisma.unidade.deleteMany();
  await prisma.logAuditoria.deleteMany();
  await prisma.usuario.deleteMany();

  try {
    await prisma.$executeRawUnsafe('DELETE FROM sqlite_sequence;');
  } catch {}

  const hashPadrao = await bcrypt.hash('Senha@123', 10);

  const [admin, gerente, cliente] = await Promise.all([
    prisma.usuario.create({
      data: {
        nome: 'Dona Francisca (Matriz)',
        email: 'francisca@raizesdonordeste.com.br',
        senhaHash: hashPadrao,
        perfil: 'ADMIN',
        consentimentoLgpd: true,
      },
    }),
    prisma.usuario.create({
      data: {
        nome: 'João Gerente (Recife)',
        email: 'joao.gerente@raizesdonordeste.com.br',
        senhaHash: hashPadrao,
        perfil: 'GERENTE',
        consentimentoLgpd: true,
      },
    }),
    prisma.usuario.create({
      data: {
        nome: 'Maria Silva (Cliente)',
        email: 'maria.cliente@exemplo.com',
        senhaHash: hashPadrao,
        perfil: 'CLIENTE',
        consentimentoLgpd: true,
      },
    }),
  ]);

  const [recife, sp] = await Promise.all([
    prisma.unidade.create({
      data: {
        nome: 'Unidade Matriz - Recife',
        endereco: 'Av. Boa Viagem, 1500',
        cidade: 'Recife',
        estado: 'PE',
        tipoCozinha: 'COMPLETA',
        ativo: true,
      },
    }),
    prisma.unidade.create({
      data: {
        nome: 'Unidade Filial - São Paulo',
        endereco: 'Rua Oscar Freire, 800',
        cidade: 'São Paulo',
        estado: 'SP',
        tipoCozinha: 'REDUZIDA',
        ativo: true,
      },
    }),
  ]);

  const produtos = await Promise.all([
    prisma.produto.create({
      data: {
        nome: 'Cuscuz Completo com Carne de Sol',
        descricao: 'Cuscuz de milho temperado, queijo coalho assado e carne de sol desfiada na manteiga de garrafa.',
        preco: 28.9,
        categoria: 'Comidas',
        sazonalJunino: false,
      },
    }),
    prisma.produto.create({
      data: {
        nome: 'Tapioca de Queijo Coalho e Mel de Engenho',
        descricao: 'Goma fresca hidratada recheada com fatias generosas de queijo coalho e toque de mel de engenho.',
        preco: 19.5,
        categoria: 'Comidas',
        sazonalJunino: false,
      },
    }),
    prisma.produto.create({
      data: {
        nome: 'Bolo de Macaxeira Tradicional',
        descricao: 'Fatia de bolo cremoso de macaxeira com coco fresco ralado.',
        preco: 14.0,
        categoria: 'Sobremesas',
        sazonalJunino: false,
      },
    }),
    prisma.produto.create({
      data: {
        nome: 'Manteiga de Garrafa Artesanal (250ml)',
        descricao: 'Garrafa de manteiga clarificada artesanal do sertão pernambucano.',
        preco: 25.0,
        categoria: 'Mercearia',
        sazonalJunino: false,
      },
    }),
    prisma.produto.create({
      data: {
        nome: 'Suco de Caju Natural (500ml)',
        descricao: 'Suco fresco da fruta feito na hora, servido gelado.',
        preco: 12.0,
        categoria: 'Bebidas',
        sazonalJunino: false,
      },
    }),
    prisma.produto.create({
      data: {
        nome: 'Canjica Junina Especial com Canela',
        descricao: 'Prato especial à base de milho verde e leite de coco, típico dos festejos de São João.',
        preco: 16.5,
        categoria: 'Sazonal Junino',
        sazonalJunino: true,
      },
    }),
  ]);

  for (const prod of produtos) {
    await prisma.estoque.create({
      data: {
        unidadeId: recife.id,
        produtoId: prod.id,
        quantidade: 50,
      },
    });

    await prisma.estoque.create({
      data: {
        unidadeId: sp.id,
        produtoId: prod.id,
        quantidade: prod.sazonalJunino ? 10 : 25,
      },
    });
  }

  console.log(`Seed finalizado: ${produtos.length} produtos, 2 unidades e 3 usuarios cadastrados.`);
}

main()
  .catch((err) => {
    console.error('Falha no seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
