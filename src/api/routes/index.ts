import { Router } from 'express';
import authRoutes from './authRoutes.js';
import unidadeRoutes from './unidadeRoutes.js';
import pedidoRoutes from './pedidoRoutes.js';
import pagamentoRoutes from './pagamentoRoutes.js';
import estoqueRoutes from './estoqueRoutes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'UP',
    servico: 'API Raízes do Nordeste',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/unidades', unidadeRoutes);
router.use('/pedidos', pedidoRoutes);
router.use('/pagamentos', pagamentoRoutes);
router.use('/estoque', estoqueRoutes);

export default router;
