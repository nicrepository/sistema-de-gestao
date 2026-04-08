import { collaboratorRepository } from '../repositories/collaboratorRepository.js';

export const collaboratorService = {
    async getAllCollaborators(includeInactive = false) {
        return await collaboratorRepository.findAll(includeInactive);
    },

    async createCollaborator(data) {
        return await collaboratorRepository.create(data);
    },

    async deleteCollaborator(id) {
        return await collaboratorRepository.delete(id);
    },

    async updateCollaborator(id, data) {
        return await collaboratorRepository.update(id, data);
    }
};
