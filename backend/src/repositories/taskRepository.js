import { dbFindAll, dbFindById, dbInsert, dbUpdate, dbDelete } from '../database/index.js';

// Colunas existentes na view v_tarefas:
// id, projeto_id, cliente_id, colaborador_id, status, prioridade, impacto, description,
// tarefa, inicio_previsto, inicio_real, entrega_estimada, entrega_real,
// estimated_hours, allocated_hours, dias_atraso
const TASK_SELECT = [
    'id',
    'projeto_id',
    '"ID_Projeto"',
    'cliente_id',
    '"ID_Cliente"',
    'colaborador_id',
    '"ID_Colaborador"',
    'status',
    '"StatusTarefa"',
    'prioridade',
    'impacto',
    'description',
    'tarefa',
    'inicio_previsto',
    'inicio_real',
    'entrega_estimada',
    'entrega_real',
    'estimated_hours',
    'allocated_hours',
    'dias_atraso',
].join(', ');

export const taskRepository = {
    async findAll({ projectId, projectIds, clientId, clientIds, status, idColaborador } = {}) {
        const query = {
            select: TASK_SELECT,
            order: { column: 'inicio_previsto', ascending: false },
            filters: {},
            in: {}
        };

        if (projectId) query.filters.projeto_id = projectId;

        // Se houver projectIds ou idColaborador, montamos o filtro OR se necessário
        // Ou se projectIds for passado como filtro comum (sem idColaborador)
        if (projectIds && !idColaborador) {
            const ids = typeof projectIds === 'string' ? projectIds.split(',').map(Number) : projectIds;
            query.in.projeto_id = ids;
        }

        if (idColaborador) {
            // Se tiver idColaborador, queremos: (colaborador_id = idColaborador) OR (projeto_id IN projectIds)
            const pIds = Array.isArray(projectIds) ? projectIds : (projectIds ? [projectIds] : []);
            let orQuery = `colaborador_id.eq.${idColaborador}`;
            if (pIds.length > 0) {
                orQuery += `,projeto_id.in.(${pIds.join(',')})`;
            }
            query.or = orQuery;
        }

        if (clientId) query.filters.cliente_id = clientId;
        if (clientIds) {
            const ids = typeof clientIds === 'string' ? clientIds.split(',').map(Number) : clientIds;
            query.in.cliente_id = ids;
        }

        if (status) query.filters.status = status;

        return await dbFindAll('v_tarefas', query);
    },

    async findById(id) {
        return await dbFindById('v_tarefas', { id }, { select: TASK_SELECT });
    },

    async create(data) {
        return await dbInsert('fato_tarefas', data, { select: 'id_tarefa_novo, *' });
    },

    async update(id, data) {
        return await dbUpdate('fato_tarefas', { id_tarefa_novo: id }, data, { select: 'id_tarefa_novo, *' });
    },

    async delete(id) {
        await dbDelete('fato_tarefas', { id_tarefa_novo: id });
        return true;
    },

    async softDelete(id, deletedAt) {
        return await dbUpdate('fato_tarefas', { id_tarefa_novo: id }, { deleted_at: deletedAt }, { select: false });
    },

    async softDeleteHours(taskId, deletedAt) {
        return await dbUpdate('horas_trabalhadas', { id_tarefa_novo: taskId }, { deleted_at: deletedAt }, { select: false });
    },

    async getCollaboratorIdByName(name) {
        const data = await dbFindAll('v_colaboradores', {
            select: 'id',
            filters: { nome: name },
            maybeSingle: true
        });
        return data?.id || null;
    },

    async updateCollaborators(taskId, collaboratorIds) {
        // Hard delete — tarefa_colaboradores não tem deleted_at
        await dbDelete('tarefa_colaboradores', { id_tarefa: taskId });

        if (collaboratorIds && collaboratorIds.length > 0) {
            const inserts = collaboratorIds.map(id => ({
                id_tarefa: taskId,
                id_colaborador: Number(id)
            }));
            await dbInsert('tarefa_colaboradores', inserts, { select: false });
        }
    }
};
