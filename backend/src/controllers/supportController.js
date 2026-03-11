import { dbFindAll, dbDeletePermanent, dbUpsert } from '../database/index.js';
import { sendSuccess, handleRouteError } from '../utils/responseHelper.js';

export const supportController = {
    async listProjectMembers(req, res) {
        try {
            const data = await dbFindAll('project_members');
            return sendSuccess(res, data);
        } catch (e) {
            return handleRouteError(res, e, 'SupportController.listProjectMembers');
        }
    },

    async addProjectMember(req, res) {
        try {
            const { id_projeto, id_colaborador, allocation_percentage } = req.body;
            // Use upsert to avoid duplicate key errors
            const data = await dbUpsert('project_members', {
                id_projeto: Number(id_projeto),
                id_colaborador: Number(id_colaborador),
                allocation_percentage: allocation_percentage ?? 100
            }, {
                onConflict: 'id_projeto,id_colaborador',
                ignoreDuplicates: false,
                select: '*'
            });
            return sendSuccess(res, data, 201);
        } catch (e) {
            return handleRouteError(res, e, 'SupportController.addProjectMember');
        }
    },

    async removeProjectMember(req, res) {
        try {
            const { projectId, userId } = req.params;
            await dbDeletePermanent('project_members', {
                id_projeto: projectId,
                id_colaborador: userId
            });
            return sendSuccess(res, { message: 'Membro removido' });
        } catch (e) {
            return handleRouteError(res, e, 'SupportController.removeProjectMember');
        }
    },

    async listAbsences(req, res) {
        try {
            const data = await dbFindAll('colaborador_ausencias');
            return sendSuccess(res, data);
        } catch (e) {
            return handleRouteError(res, e, 'SupportController.listAbsences');
        }
    },

    async listHolidays(req, res) {
        try {
            const data = await dbFindAll('feriados');
            return sendSuccess(res, data);
        } catch (e) {
            return handleRouteError(res, e, 'SupportController.listHolidays');
        }
    },

    async listTaskCollaborators(req, res) {
        try {
            // tarefa_colaboradores é a tabela de junção
            const data = await dbFindAll('tarefa_colaboradores');
            return sendSuccess(res, data);
        } catch (e) {
            return handleRouteError(res, e, 'SupportController.listTaskCollaborators');
        }
    }
};

