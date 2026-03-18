import { dbFindAll, dbFindById, dbInsert, dbUpdate } from '../database/index.js';

/**
 * Repositório para operações de dados na tabela organizations.
 */
export const organizationRepository = {
    /**
     * Busca uma organização pelo ID.
     */
    async findById(id) {
        return await dbFindById('organizations', { id });
    },

    /**
     * Busca uma organização pelo ID do colaborador vinculado.
     */
    async findByCollaboratorId(userIdOrEmail) {
        // Tenta buscar por ID ou Email na view de colaboradores
        const colab = await dbFindAll('v_colaboradores', {
            select: 'organization_id',
            filters: { id: userIdOrEmail },
            maybeSingle: true
        }) || await dbFindAll('v_colaboradores', {
            select: 'organization_id',
            filters: { email: userIdOrEmail },
            maybeSingle: true
        });

        if (!colab || !colab.organization_id) return null;
        
        return await this.findById(colab.organization_id);
    },

    /**
     * Atualiza dados da organização.
     */
    async update(id, data) {
        return await dbUpdate('organizations', { id }, data);
    },

    /**
     * Cria uma nova organização.
     */
    async create(data) {
        return await dbInsert('organizations', data);
    }
};
