import { Router } from 'express';
import { estoqueController } from '../controllers/estoqueController.js';
import { autenticarJwt, autorizarPerfis } from '../middlewares/authMiddleware.js';
import { PerfilUsuario } from '../../domain/enums.js';

const router = Router();

router.get('/:unidadeId', estoqueController.consultarPorUnidade);
router.post(
  '/movimentar',
  autenticarJwt,
  autorizarPerfis(PerfilUsuario.GERENTE, PerfilUsuario.ADMIN),
  estoqueController.movimentar
);

export default router;
