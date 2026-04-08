import { Router } from 'express';
import { collaboratorController } from '../controllers/collaboratorController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', collaboratorController.getCollaborators);
router.post('/', collaboratorController.createCollaborator);
router.put('/:id', collaboratorController.updateCollaborator);

export default router;
