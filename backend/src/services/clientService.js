import { clientRepository } from '../repositories/clientRepository.js';
import { auditService } from '../audit/auditService.js';
import { auditContext } from '../audit/auditMiddleware.js';
import { isAdmUser } from '../utils/security.js';
import { projectService } from './projectService.js';

export const clientService = {
    async getAllClients(user, includeInactive, options = {}) {
        const query = {
            page: options.page,
            limit: options.limit,
            order: options.sort ? { column: options.sort, ascending: options.order !== 'desc' } : { column: 'nome', ascending: true },
            filters: {},
            in: {}
        };

        if (includeInactive !== 'true') {
            query.filters.ativo = true;
        }

        if (!isAdmUser(user)) {
            // Se não for admin, busca apenas clientes de projetos vinculados
            const projects = await projectService.getAllProjects(user);
            const clientIds = [...new Set(projects.map(p => p.cliente_id))];

            if (clientIds.length === 0) return [];
            query.in.id = clientIds;
        }

        return await clientRepository.findAll(query);
    },

    async getClientById(user, id) {
        const client = await clientRepository.findById(id);

        if (client && !isAdmUser(user)) {
            const projects = await projectService.getAllProjects(user);
            const clientIds = [...new Set(projects.map(p => p.cliente_id))];

            if (!clientIds.includes(Number(id))) {
                const error = new Error('Você não tem permissão para visualizar este cliente.');
                error.status = 403;
                throw error;
            }
        }

        return client;
    },

    async createClient(data) {
        // Formata os dados conforme a tabela dim_clientes
        const payload = {
            NomeCliente: data.NomeCliente.trim(),
            "E-mail": data["E-mail"] || null,
            email: data.email || null,
            ativo: data.ativo ?? true,
            Responsavel: data.Responsavel || null,
            Telefone: data.Telefone || null,
            Criado: new Date().toISOString()
        };

        const created = await clientRepository.create(payload);

        const context = auditContext.getStore() || {};
        await auditService.logAction({
            userId: context.userId,
            userName: context.userName,
            action: 'CREATE',
            entity: 'dim_clientes',
            entityId: created.ID_Cliente,
            entityName: created.NomeCliente,
            newData: created,
            ip: context.ip
        });

        return created;
    },

    async updateClient(id, data) {
        const client = await clientRepository.findById(id);
        if (!client) throw new Error('Cliente não encontrado');

        const updated = await clientRepository.update(id, data);

        const context = auditContext.getStore() || {};
        await auditService.logAction({
            userId: context.userId,
            userName: context.userName,
            action: 'UPDATE',
            entity: 'dim_clientes',
            entityId: id,
            entityName: updated.NomeCliente,
            oldData: client,
            newData: updated,
            ip: context.ip
        });

        return updated;
    },

    async deleteClient(id) {
        const client = await clientRepository.findById(id);
        if (!client) throw new Error('Cliente não encontrado');

        await clientRepository.delete(id);

        const context = auditContext.getStore() || {};
        await auditService.logAction({
            userId: context.userId,
            userName: context.userName,
            action: 'DELETE',
            entity: 'dim_clientes',
            entityId: id,
            entityName: client.NomeCliente,
            oldData: client,
            ip: context.ip
        });

        return true;
    }
};
