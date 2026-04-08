import { dbFindAll, dbUpdate, dbInsert } from '../database/index.js';

// Colunas existentes na view v_colaboradores:
// id, nome, cargo, nivel, torre, role, email, avatar_url, ativo
const COLAB_SELECT = [
    'id',
    '"ID_Colaborador"',
    'nome',
    '"NomeColaborador"',
    'cargo',
    'nivel',
    'torre',
    'role',
    'email',
    '"avatarUrl"',
    'ativo',
    'custo_hora',
    'horas_disponiveis_dia',
    'horas_disponiveis_mes',
    'atrasado',
].join(', ');

export const collaboratorRepository = {
    async findAll(includeInactive = false) {
        const query = {
            select: COLAB_SELECT,
            order: { column: 'nome' },
            filters: {}
        };

        if (!includeInactive) {
            query.filters.ativo = true;
        }

        return await dbFindAll('v_colaboradores', query);
    },

    async create(data) {
        const fieldMapping = {
            name: 'nome_colaborador',
            nome_colaborador: 'nome_colaborador',
            email: 'email',
            cargo: 'cargo',
            nivel: 'nivel',
            torre: 'torre',
            role: 'role',
            active: 'ativo',
            ativo: 'ativo',
            avatarUrl: 'avatar_url',
            avatar_url: 'avatar_url',
            hourlyCost: 'custo_hora',
            custo_hora: 'custo_hora',
            dailyAvailableHours: 'horas_disponiveis_dia',
            horas_disponiveis_dia: 'horas_disponiveis_dia',
            monthlyAvailableHours: 'horas_disponiveis_mes',
            horas_disponiveis_mes: 'horas_disponiveis_mes'
        };

        const safeData = {};
        for (const [key, val] of Object.entries(data)) {
            const dbKey = fieldMapping[key];
            if (dbKey) {
                safeData[dbKey] = val;
            }
        }

        if (!safeData.nome_colaborador || !safeData.email) {
            throw new Error('Campos obrigatórios: nome e email.');
        }

        console.log('[CollaboratorRepository] Criando colaborador:', safeData);
        return await dbInsert('dim_colaboradores', safeData, { returning: true });
    },

    async update(id, data) {
        // Mapeamento de campos Frontend -> Backend
        const fieldMapping = {
            name: 'nome_colaborador',
            nome_colaborador: 'nome_colaborador',
            email: 'email',
            cargo: 'cargo',
            nivel: 'nivel',
            torre: 'torre',
            role: 'role',
            active: 'ativo',
            ativo: 'ativo',
            avatarUrl: 'avatar_url',
            avatar_url: 'avatar_url',
            hourlyCost: 'custo_hora',
            custo_hora: 'custo_hora',
            dailyAvailableHours: 'horas_disponiveis_dia',
            horas_disponiveis_dia: 'horas_disponiveis_dia',
            monthlyAvailableHours: 'horas_disponiveis_mes',
            horas_disponiveis_mes: 'horas_disponiveis_mes'
        };

        const safeData = {};
        for (const [key, val] of Object.entries(data)) {
            const dbKey = fieldMapping[key];
            if (dbKey) {
                safeData[dbKey] = val;
            }
        }

        if (Object.keys(safeData).length === 0) {
            throw new Error('Nenhum campo válido para atualizar.');
        }

        console.log(`[CollaboratorRepository] Atualizando ${id} com:`, safeData);
        return await dbUpdate('dim_colaboradores', { id_colaborador: id }, safeData);
    }
};
