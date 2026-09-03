import { Router } from 'express';
import { pedidoController } from '../controllers/pedidoController.js';
import { autenticarJwt, autorizarPerfis, autenticarOpcional } from '../middlewares/authMiddleware.js';
import { PerfilUsuario } from '../../domain/enums.js';

const router = Router();

router.post('/', autenticarOpcional, pedidoController.criar);
router.get('/', pedidoController.listar);
router.get('/:id', pedidoController.buscarPorId);
router.patch(
  '/:id/status',
  autenticarJwt,
  autorizarPerfis(PerfilUsuario.GERENTE, PerfilUsuario.ADMIN),
  pedidoController.atualizarStatus
);

export default router;
