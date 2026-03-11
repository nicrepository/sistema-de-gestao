import { Router } from 'express';
import { supportController } from '../controllers/supportController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/project-members', supportController.listProjectMembers);
router.post('/project-members', supportController.addProjectMember);
router.delete('/project-members/:projectId/:userId', supportController.removeProjectMember);

router.get('/absences', supportController.listAbsences);
router.get('/holidays', supportController.listHolidays);
router.get('/task-collaborators', supportController.listTaskCollaborators);


export default router;
