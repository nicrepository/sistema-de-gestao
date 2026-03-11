import { projectService } from '../services/projectService.js';
import { sendSuccess, handleRouteError } from '../utils/responseHelper.js';

export const projectController = {
    async getProjects(req, res) {
        try {
            const projects = await projectService.getAllProjects(req.user, req.query);
            return sendSuccess(res, projects);
        } catch (e) {
            return handleRouteError(res, e, 'ProjectController.getProjects');
        }
    },

    async getById(req, res) {
        try {
            const { id } = req.params;
            const project = await projectService.getProjectById(req.user, id);
            return sendSuccess(res, project);
        } catch (e) {
            return handleRouteError(res, e, 'ProjectController.getById');
        }
    },

    async create(req, res) {
        try {
            const project = await projectService.createProject(req.body);
            return sendSuccess(res, project, 201);
        } catch (e) {
            return handleRouteError(res, e, 'ProjectController.create');
        }
    },

    async update(req, res) {
        try {
            const { id } = req.params;
            const project = await projectService.updateProject(id, req.body);
            return sendSuccess(res, project);
        } catch (e) {
            return handleRouteError(res, e, 'ProjectController.update');
        }
    },

    async delete(req, res) {
        try {
            const { id } = req.params;
            const { force } = req.query;
            await projectService.deleteProject(id, force === 'true');
            return sendSuccess(res, { message: 'Projeto processado com sucesso.' });
        } catch (e) {
            return handleRouteError(res, e, 'ProjectController.delete');
        }
    }
};
