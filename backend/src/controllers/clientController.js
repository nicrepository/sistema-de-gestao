import { clientService } from '../services/clientService.js';
import { sendSuccess, handleRouteError } from '../utils/responseHelper.js';

export const clientController = {
    async getClients(req, res) {
        try {
            const { includeInactive, page, limit, sort, order } = req.query;
            const clients = await clientService.getAllClients(req.user, includeInactive, { page, limit, sort, order });
            return sendSuccess(res, clients);
        } catch (e) {
            return handleRouteError(res, e, 'ClientController.getClients');
        }
    },

    async getById(req, res) {
        try {
            const { id } = req.params;
            const client = await clientService.getClientById(req.user, id);
            if (!client) return handleRouteError(res, { message: 'Cliente não encontrado', status: 404 });
            return sendSuccess(res, client);
        } catch (e) {
            return handleRouteError(res, e, 'ClientController.getById');
        }
    },

    async create(req, res) {
        try {
            const client = await clientService.createClient(req.body);
            return sendSuccess(res, client, 201);
        } catch (e) {
            return handleRouteError(res, e, 'ClientController.create');
        }
    },

    async update(req, res) {
        try {
            const { id } = req.params;
            const client = await clientService.updateClient(id, req.body);
            return sendSuccess(res, client);
        } catch (e) {
            return handleRouteError(res, e, 'ClientController.update');
        }
    },

    async delete(req, res) {
        try {
            const { id } = req.params;
            await clientService.deleteClient(id);
            return sendSuccess(res, { message: 'Cliente excluído com sucesso.' });
        } catch (e) {
            return handleRouteError(res, e, 'ClientController.delete');
        }
    }
};
