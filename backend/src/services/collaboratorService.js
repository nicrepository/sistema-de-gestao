import { collaboratorRepository } from '../repositories/collaboratorRepository.js';

export const collaboratorService = {
    async getAllCollaborators(includeInactive = false) {
        return await collaboratorRepository.findAll(includeInactive);
    },

    async updateCollaborator(id, data) {
        return await collaboratorRepository.update(id, data);
    }
};
