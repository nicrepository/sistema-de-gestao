import { timesheetService } from '../services/timesheetService.js';
import { sendSuccess, handleRouteError, sendError } from '../utils/responseHelper.js';

export const timesheetController = {
    async getTimesheets(req, res) {
        try {
            const timesheets = await timesheetService.getTimesheets(req.user, req.query);
            return sendSuccess(res, timesheets);
        } catch (e) {
            return handleRouteError(res, e, 'TimesheetController.getTimesheets');
        }
    },

    async getTimesheetById(req, res) {
        try {
            const { id } = req.params;
            const timesheet = await timesheetService.getTimesheetById(req.user, id);
            return sendSuccess(res, timesheet);
        } catch (e) {
            if (e.message === 'Apontamento não encontrado') {
                return sendError(res, e.message, 404);
            }
            return handleRouteError(res, e, 'TimesheetController.getTimesheetById');
        }
    },

    async createTimesheet(req, res) {
        try {
            const newTimesheet = await timesheetService.createTimesheet(req.user, req.body);
            return sendSuccess(res, newTimesheet, 201);
        } catch (e) {
            if (e.message?.includes('Dados incompletos')) {
                return sendError(res, e.message, 400);
            }
            return handleRouteError(res, e, 'TimesheetController.createTimesheet');
        }
    },

    async updateTimesheet(req, res) {
        try {
            const { id } = req.params;
            const updatedTimesheet = await timesheetService.updateTimesheet(req.user, id, req.body);
            return sendSuccess(res, updatedTimesheet);
        } catch (e) {
            if (e.message === 'Apontamento não encontrado') {
                return sendError(res, e.message, 404);
            }
            return handleRouteError(res, e, 'TimesheetController.updateTimesheet');
        }
    },

    async deleteTimesheet(req, res) {
        try {
            const { id } = req.params;
            await timesheetService.deleteTimesheet(req.user, id);
            return sendSuccess(res, { message: 'Apontamento excluído com sucesso.' });
        } catch (e) {
            if (e.message === 'Apontamento não encontrado') {
                return sendError(res, e.message, 404);
            }
            return handleRouteError(res, e, 'TimesheetController.deleteTimesheet');
        }
    }
};
