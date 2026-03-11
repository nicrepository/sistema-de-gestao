import { dbFindAll, dbFindById, dbInsert, dbUpdate, dbDelete } from '../database/index.js';

// Colunas existentes na view v_projetos:
// id, nome, cliente_id, status, torre, complexidade, manager, startDate, estimatedDelivery, valor_total_rs, ativo
const PROJECT_SELECT = [
    'id',
    '"ID_Projeto"',
    'nome',
    '"NomeProjeto"',
    'cliente_id',
    '"ID_Cliente"',
    'status',
    'ativo',
    'complexidade',
    'manager',
    '"startDate"',
    '"estimatedDelivery"',
    'valor_total_rs',
    'torre',
    'partner_id'
].join(', ');

export const projectRepository = {
    async findAll({ clientIds, projectIds, includeInactive = false, status } = {}) {
        const query = {
            select: PROJECT_SELECT,
            order: { column: 'nome' },
            filters: {},
            in: {}
        };

        if (!includeInactive) {
            query.filters.ativo = true;
        }

        if (status) {
            query.filters.status = status;
        }

        if (clientIds) {
            const ids = typeof clientIds === 'string' ? clientIds.split(',').map(Number) : clientIds;
            query.in.cliente_id = ids;
        }

        if (projectIds) {
            query.in.id = projectIds;
        }

        return await dbFindAll('v_projetos', query);
    },

    async findById(id) {
        return await dbFindById('v_projetos', { id }, { select: PROJECT_SELECT });
    },

    async create(data) {
        return await dbInsert('dim_projetos', data);
    },

    async update(id, data) {
        return await dbUpdate('dim_projetos', { ID_Projeto: id }, data);
    },

    async delete(id) {
        await dbDelete('dim_projetos', { ID_Projeto: id });
        return true;
    }
};
