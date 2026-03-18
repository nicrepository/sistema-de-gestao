import express from 'express';
import { organizationController } from '../controllers/organizationController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Rotas de Organização e Temas.
 */

// Retorna dados da organização do usuário logado
router.get('/me', authMiddleware, organizationController.getMyOrganization);

// Gera tema a partir da logo
router.post('/:id/theme/generate', authMiddleware, organizationController.generateTheme);

// Atualiza o tema manualmente
router.patch('/:id/theme', authMiddleware, organizationController.updateTheme);

export default router;
