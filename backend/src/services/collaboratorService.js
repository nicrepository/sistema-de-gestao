import { collaboratorRepository } from '../repositories/collaboratorRepository.js';

export const collaboratorService = {
    async getAllCollaborators(includeInactive = false) {
        return await collaboratorRepository.findAll(includeInactive);
    },

    async createCollaborator(data) {
        return await collaboratorRepository.create(data);
    },

    async updateCollaborator(id, data) {
        return await collaboratorRepository.update(id, data);
    }
};
