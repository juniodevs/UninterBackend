import { Router } from 'express';
import { unidadeController } from '../controllers/unidadeController.js';

const router = Router();

router.get('/', unidadeController.listar);
router.get('/:id/cardapio', unidadeController.cardapio);

export default router;
