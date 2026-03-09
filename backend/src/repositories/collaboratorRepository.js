import { dbFindAll, dbUpdate } from '../database/index.js';

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

    async update(id, data) {
        // Permitir apenas colunas seguras para atualização
        const ALLOWED_FIELDS = ['nome_colaborador', 'cargo', 'nivel', 'torre', 'role', 'ativo', 'custo_hora', 'horas_disponiveis_dia', 'horas_disponiveis_mes', 'avatar_url'];
        const safeData = {};
        for (const [key, val] of Object.entries(data)) {
            if (ALLOWED_FIELDS.includes(key)) {
                safeData[key] = val;
            }
        }

        if (Object.keys(safeData).length === 0) {
            throw new Error('Nenhum campo válido para atualizar.');
        }

        return await dbUpdate('dim_colaboradores', { id_colaborador: id }, safeData);
    }
};
