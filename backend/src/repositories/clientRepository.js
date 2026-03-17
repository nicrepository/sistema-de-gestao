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
    'partner_id',
    'doc_nic_ativo',
    'cnpj',
    'email_contato',
    'telefone',
    'responsavel_interno_id',
    'responsavel_externo',
    'razao_social',
    'segmento',
    'email_financeiro',
    'responsavel_tecnico',
    'data_inicio_contrato',
    'data_fim_contrato',
    'endereco_rua',
    'endereco_numero',
    'endereco_complemento',
    'endereco_bairro',
    'endereco_cidade',
    'endereco_estado',
    'endereco_cep',
    'contato_celular',
    'contato_whatsapp',
    'contato_cargo'
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
