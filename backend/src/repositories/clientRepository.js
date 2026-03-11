import { dbFindAll, dbFindById, dbInsert, dbUpdate, dbDelete } from '../database/index.js';

// Colunas existentes na view v_clientes:
// id, nome, pais, cnpj, telefone, email_contato, ativo
const CLIENT_SELECT = [
    'id',
    '"ID_Cliente"',
    'nome',
    '"NomeCliente"',
    'ativo',
    'pais',
    '"logoUrl"',
    'contato_principal',
    'tipo_cliente',
    'partner_id'
].join(', ');

export const clientRepository = {
    async findAll(query = {}) {
        const dbQuery = {
            select: CLIENT_SELECT,
            order: query.order || { column: 'nome' },
            filters: query.filters || {},
            in: query.in || {}
        };

        return await dbFindAll('v_clientes', dbQuery);
    },

    async findById(id) {
        return await dbFindById('v_clientes', { id }, { select: CLIENT_SELECT });
    },

    async create(data) {
        return await dbInsert('dim_clientes', data);
    },

    async update(id, data) {
        return await dbUpdate('dim_clientes', { ID_Cliente: id }, data);
    },

    async delete(id) {
        await dbDelete('dim_clientes', { ID_Cliente: id });
        return true;
    }
};
