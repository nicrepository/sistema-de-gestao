import { dbFindAll, dbFindById, dbInsert, dbUpdate, dbDelete } from '../database/index.js';

export const timesheetRepository = {
    async findAll(filters = {}) {
        const query = {
            select: `
                *,
                colaborador:dim_colaboradores(NomeColaborador:nome_colaborador)
            `,
            is: { deleted_at: null },
            order: [
                { column: 'Data', ascending: false },
                { column: 'ID_Horas_Trabalhadas', ascending: false }
            ],
            filters: {},
            gte: {},
            lte: {},
            in: {}
        };

        if (filters.userId) query.filters.ID_Colaborador = filters.userId;
        if (filters.projectId) query.filters.ID_Projeto = filters.projectId;
        if (filters.taskId) query.filters.id_tarefa_novo = filters.taskId;
        if (filters.startDate) query.gte.Data = filters.startDate;
        if (filters.endDate) query.lte.Data = filters.endDate;

        // RBAC: (ID_Colaborador = idColaborador) OR (ID_Projeto IN projectIds)
        if (filters.idColaborador && filters.projectIds) {
            const pIds = Array.isArray(filters.projectIds) ? filters.projectIds : [filters.projectIds];
            let orQuery = `ID_Colaborador.eq.${filters.idColaborador}`;
            if (pIds.length > 0) {
                orQuery += `,ID_Projeto.in.(${pIds.join(',')})`;
            }
            query.or = orQuery;
        } else if (filters.projectIds) {
            const pIds = Array.isArray(filters.projectIds) ? filters.projectIds : [filters.projectIds];
            query.in.ID_Projeto = pIds;
        } else if (filters.idColaborador) {
            query.filters.ID_Colaborador = filters.idColaborador;
        }

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
