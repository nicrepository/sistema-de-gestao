import express from 'express';
import { taskController } from '../controllers/taskController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', roleMiddleware(['ADMIN', 'MANAGER', 'USER']), taskController.getTasks);
router.get('/:id', roleMiddleware(['ADMIN', 'MANAGER', 'USER']), taskController.getTaskById);
router.post('/', roleMiddleware(['ADMIN', 'MANAGER']), taskController.createTask);
router.put('/:id', roleMiddleware(['ADMIN', 'MANAGER', 'USER']), taskController.updateTask);
router.delete('/:id', roleMiddleware(['ADMIN', 'MANAGER']), taskController.deleteTask);

export default router;
