import { collaboratorService } from '../services/collaboratorService.js';
import { sendSuccess, handleRouteError } from '../utils/responseHelper.js';

export const collaboratorController = {
    async getCollaborators(req, res) {
        try {
            const { includeInactive } = req.query;
            const collaborators = await collaboratorService.getAllCollaborators(includeInactive === 'true');
            return sendSuccess(res, collaborators);
        } catch (e) {
            return handleRouteError(res, e, 'CollaboratorController.getCollaborators');
        }
    },

    async createCollaborator(req, res) {
        try {
            const created = await collaboratorService.createCollaborator(req.body);
            return sendSuccess(res, created, 201);
        } catch (e) {
            return handleRouteError(res, e, 'CollaboratorController.createCollaborator');
        }
    },

    async deleteCollaborator(req, res) {
        try {
            const { id } = req.params;
            await collaboratorService.deleteCollaborator(Number(id));
            return sendSuccess(res, null, 204);
        } catch (e) {
            return handleRouteError(res, e, 'CollaboratorController.deleteCollaborator');
        }
    },

    async updateCollaborator(req, res) {
        try {
            const { id } = req.params;
            const body = req.body;
            const updated = await collaboratorService.updateCollaborator(Number(id), body);
            return sendSuccess(res, updated);
        } catch (e) {
            return handleRouteError(res, e, 'CollaboratorController.updateCollaborator');
        }
    }
};
