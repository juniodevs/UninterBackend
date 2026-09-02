import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { autenticarJwt } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/cadastro', authController.cadastrar);
router.post('/login', authController.login);
router.get('/perfil', autenticarJwt, authController.perfil);

export default router;
