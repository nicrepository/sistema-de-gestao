import { taskService } from '../services/taskService.js';
import { adminService } from '../services/adminService.js';
import { sendSuccess, handleRouteError } from '../utils/responseHelper.js';

export const taskController = {
    async getTasks(req, res) {
        try {
            const { page, limit, sort, order, ...filters } = req.query;
            const tasks = await taskService.getTasks(req.user, { ...filters, page, limit, sort, order });
            return sendSuccess(res, tasks);
        } catch (e) {
            return handleRouteError(res, e, 'TaskController.getTasks');
        }
    },

    async getTaskById(req, res) {
        try {
            const { id } = req.params;
            const task = await taskService.getTaskById(req.user, id);
            if (!task) return handleRouteError(res, { message: 'Tarefa não encontrada', status: 404 });
            return sendSuccess(res, task);
        } catch (e) {
            return handleRouteError(res, e, 'TaskController.getTaskById');
        }
    },

    async createTask(req, res) {
        try {
            const newTask = await taskService.createTask(req.body);
            return sendSuccess(res, newTask, 201);
        } catch (e) {
            return handleRouteError(res, e, 'TaskController.createTask');
        }
    },

    async updateTask(req, res) {
        try {
            const { id } = req.params;
            const updatedTask = await taskService.updateTask(req.user, id, req.body);
            return sendSuccess(res, updatedTask);
        } catch (e) {
            return handleRouteError(res, e, 'TaskController.updateTask');
        }
    },

    async deleteTask(req, res) {
        try {
            const { id } = req.params;
            const { force, deleteHours } = req.query;
            await adminService.deactivateTask(id, force === 'true', deleteHours === 'true', req.user);
            return sendSuccess(res, { message: 'Tarefa excluída com sucesso.' });
        } catch (e) {
            return handleRouteError(res, e, 'TaskController.deleteTask');
        }
    }
};
