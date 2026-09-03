import { Router } from 'express';
import { pagamentoController } from '../controllers/pagamentoController.js';
import { autenticarOpcional } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/mock/processar', autenticarOpcional, pagamentoController.processarMock);

export default router;
