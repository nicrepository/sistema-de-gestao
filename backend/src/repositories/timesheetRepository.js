import { dbFindAll, dbFindById, dbInsert, dbUpdate, dbDelete } from '../database/index.js';

export const timesheetRepository = {
    async findAll(filters = {}) {
        const query = {
            select: `
                *,
                colaborador:dim_colaboradores(NomeColaborador:nome_colaborador)
            `,
            is: { deleted_at: null },
            order: { column: 'Data', ascending: false },
            filters: {},
            gte: {},
            lte: {}
        };

        if (filters.userId) query.filters.ID_Colaborador = filters.userId;
        if (filters.projectId) query.filters.ID_Projeto = filters.projectId;
        if (filters.taskId) query.filters.id_tarefa_novo = filters.taskId;
        if (filters.startDate) query.gte.Data = filters.startDate;
        if (filters.endDate) query.lte.Data = filters.endDate;

        if (filters.limit) {
            query.limit = Math.min(Number(filters.limit), 1000);
        } else {
            query.limit = 500;
        }

        if (filters.offset !== undefined) {
            query.offset = Number(filters.offset);
        }

        return await dbFindAll('timesheets', query);
    },

    async findById(id) {
        return await dbFindById('timesheets', { ID_Horas_Trabalhadas: id }, {
            select: `
                *,
                colaborador:dim_colaboradores(NomeColaborador:nome_colaborador)
            `,
            is: { deleted_at: null }
        });
    },

    async create(data) {
        return await dbInsert('horas_trabalhadas', data);
    },

    async update(id, data) {
        return await dbUpdate('horas_trabalhadas', { ID_Horas_Trabalhadas: id }, data);
    },

    async delete(id) {
        await dbDelete('horas_trabalhadas', { ID_Horas_Trabalhadas: id });
        return true;
    }
};
