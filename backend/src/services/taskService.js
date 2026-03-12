import { taskRepository } from '../repositories/taskRepository.js';
import { auditService } from '../audit/auditService.js';
import { auditContext } from '../audit/auditMiddleware.js';
import { isAdmUser } from '../utils/security.js';
import { projectService, checkTaskHasHours } from './projectService.js';
import { notifyUpdates } from '../utils/realtime.js';
import { dbFindAll } from '../database/index.js';

const safeNum = (val) => {
    if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined') return null;
    const n = Number(val);
    return Number.isNaN(n) ? null : n;
};

function mapStatusToDb(status) {
    switch (status) {
        case 'Done': return 'Concluído';
        case 'In Progress': return 'Andamento';
        case 'Review': return 'Análise';
        case 'Testing': return 'Teste';
        case 'Todo':
        default: return 'Pré-Projeto';
    }
}

function mapPriorityToDb(priority) {
    if (!priority) return null;
    switch (priority) {
        case 'Critical': return 'Crítica';
        case 'High': return 'Alta';
        case 'Medium': return 'Média';
        case 'Low': return 'Baixa';
        default: return null;
    }
}

function mapImpactToDb(impact) {
    if (!impact) return null;
    switch (impact) {
        case 'High': return 'Alto';
        case 'Medium': return 'Médio';
        case 'Low': return 'Baixo';
        default: return null;
    }
}

async function mapInputToPayload(data) {
    const payload = {};
    if (data.title !== undefined) payload.Afazer = data.title;
    if (data.developerId !== undefined) {
        payload.ID_Colaborador = safeNum(data.developerId);
    } else if (data.developer !== undefined) {
        payload.ID_Colaborador = await taskRepository.getCollaboratorIdByName(data.developer);
    }
    if (data.priority !== undefined) payload.Prioridade = mapPriorityToDb(data.priority);
    if (data.impact !== undefined) payload.Impacto = mapImpactToDb(data.impact);
    if (data.estimatedDelivery !== undefined) payload.entrega_estimada = data.estimatedDelivery || null;
    if (data.actualDelivery !== undefined) payload.entrega_real = data.actualDelivery || null;
    if (data.scheduledStart !== undefined) payload.inicio_previsto = data.scheduledStart || null;
    if (data.actualStart !== undefined) payload.inicio_real = data.actualStart || null;
    if (data.risks !== undefined) payload.Riscos = data.risks || null;
    if (data.notes !== undefined) payload["Observações"] = data.notes || null;
    if (data.attachment !== undefined) payload.attachment = data.attachment || null;
    if (data.description !== undefined) payload.description = data.description || null;
    if (data.em_testes !== undefined) payload.em_testes = data.em_testes ? 1 : 0;
    if (data.link_ef !== undefined) payload.link_ef = data.link_ef || null;
    if (data.estimatedHours !== undefined) payload.estimated_hours = data.estimatedHours || null;
    if (data.is_impediment !== undefined) payload.is_impediment = data.is_impediment;
    return payload;
}

async function _cleanupProjectMembers(projectId, potentialUserIds) {
    if (!projectId || !potentialUserIds || potentialUserIds.length === 0) return;

    // Get all users who still have ANY task in this project
    const activeTasksMembers = await taskRepository.getAllProjectTaskMembers(projectId);

    // Get project info to avoid removing the manager
    const project = await projectService.getProjectById({ role: 'admin' }, projectId);
    const managerId = project?.colaborador_central_id ? String(project.colaborador_central_id) : null;

    for (const userId of potentialUserIds) {
        const sUserId = String(userId);
        if (sUserId === 'null' || sUserId === 'undefined') continue;

        if (!activeTasksMembers.has(sUserId) && sUserId !== managerId) {
            console.log(`[TaskService] Auto-removing user ${sUserId} from project ${projectId} (no tasks left)`);
            try {
                await projectService.removeProjectMember(null, projectId, sUserId);
            } catch (err) {
                console.error(`[TaskService] Error auto-removing user ${sUserId}:`, err);
            }
        }
    }
}

export const taskService = {
    // ... (getTasks, getTaskById)
    async getTasks(user, filters) {
        if (!isAdmUser(user)) {
            const userProjectIds = await projectService._getUserLinkedProjectIds(user);

            // Filtra por (ID_Colaborador = user.id) OR (ID_Projeto IN userProjectIds)
            return await taskRepository.findAll({
                ...filters,
                idColaborador: user.id,
                projectIds: userProjectIds
            });
        }
        return await taskRepository.findAll(filters);
    },

    async getTaskById(user, id) {
        const task = await taskRepository.findById(id);
        if (!task) {
            throw new Error('Tarefa não encontrada');
        }

        if (!isAdmUser(user)) {
            const userProjectIds = await projectService._getUserLinkedProjectIds(user);
            const isAssigned = String(task.colaborador_id) === String(user.id);
            const isInLinkedProject = userProjectIds.includes(task.projeto_id);

            if (!isAssigned && !isInLinkedProject) {
                const error = new Error('Você não tem permissão para visualizar esta tarefa.');
                error.status = 403;
                throw error;
            }
        }

        return task;
    },

    async createTask(data) {
        let collaboratorId = safeNum(data.developerId);

        if (!collaboratorId && data.developer) {
            collaboratorId = await taskRepository.getCollaboratorIdByName(data.developer);
        }

        const payload = {
            Afazer: data.title || "(Sem título)",
            ID_Projeto: safeNum(data.projectId),
            ID_Cliente: safeNum(data.clientId),
            ID_Colaborador: collaboratorId,
            StatusTarefa: mapStatusToDb(data.status),
            entrega_estimada: data.estimatedDelivery || null,
            entrega_real: data.actualDelivery || null,
            inicio_previsto: data.scheduledStart || null,
            inicio_real: data.actualStart || null,
            Porcentagem: data.progress ?? 0,
            Prioridade: mapPriorityToDb(data.priority),
            Impacto: mapImpactToDb(data.impact),
            Riscos: data.risks || null,
            "Observações": data.notes || null,
            attachment: data.attachment || null,
            description: data.description || null,
            em_testes: data.em_testes ? 1 : 0,
            link_ef: data.link_ef || null,
            estimated_hours: data.estimatedHours || null,
            is_impediment: data.is_impediment ?? false,
        };

        const createdTask = await taskRepository.create(payload);

        // Insere colaboradores se houver
        if (data.collaboratorIds && data.collaboratorIds.length > 0 && createdTask?.id_tarefa_novo) {
            await taskRepository.updateCollaborators(createdTask.id_tarefa_novo, data.collaboratorIds);
        }

        const context = auditContext.getStore() || {};
        await auditService.logAction({
            userId: context.userId,
            action: 'CREATE',
            entity: 'fato_tarefas',
            entityId: createdTask?.id_tarefa_novo,
            newData: createdTask,
            ip: context.ip
        });

        await notifyUpdates('tasks', { type: 'created', data: createdTask });
        return createdTask;
    },

    async updateTask(user, id, data) {
        // Verifica se a tarefa existe e se o usuário tem permissão
        const oldTask = await this.getTaskById(user, id);
        const oldCollabs = await dbFindAll('tarefa_colaboradores', { filters: { id_tarefa: id } });
        const oldTeam = new Set([
            String(oldTask.colaborador_id),
            ...oldCollabs.map(c => String(c.id_colaborador))
        ]);

        const payload = await mapInputToPayload(data);

        // Lógica de sincronização Status <-> Progresso
        if (data.progress !== undefined) {
            const prog = Number(data.progress);
            payload.Porcentagem = prog;

            // Se chegou em 100% e não enviou status, muda para Concluído automaticamente
            if (prog >= 100 && data.status === undefined) {
                payload.StatusTarefa = 'Concluído';
            }
        }

        if (data.status !== undefined) {
            const mapped = mapStatusToDb(data.status);
            payload.StatusTarefa = mapped;
            // Se mudou para Concluído e não enviou progresso, coloca 100% automaticamente
            if (mapped === 'Concluído' && data.progress === undefined) {
                payload.Porcentagem = 100;
            }
        }

        if (Object.keys(payload).length > 0) {
            await taskRepository.update(id, payload);
        }

        if (data.collaboratorIds !== undefined) {
            // Apenas administradores ou gestores podem gerenciar equipe da tarefa via updateTask
            if (isAdmUser(user)) {
                await taskRepository.updateCollaborators(id, data.collaboratorIds);
            }
        }

        const updatedTask = await this.getTaskById(user, id);
        const newCollabs = await dbFindAll('tarefa_colaboradores', { filters: { id_tarefa: id } });
        const newTeam = new Set([
            String(updatedTask.colaborador_id),
            ...newCollabs.map(c => String(c.id_colaborador))
        ]);

        const context = auditContext.getStore() || {};
        await auditService.logAction({
            userId: context.userId,
            action: 'UPDATE',
            entity: 'fato_tarefas',
            entityId: id,
            oldData: oldTask,
            newData: updatedTask,
            ip: context.ip
        });

        await notifyUpdates('tasks', { type: 'updated', data: updatedTask });

        // Cleanup: remove users that lost their last task in this project
        const removedCandidates = Array.from(oldTeam).filter(uid => !newTeam.has(uid));
        if (removedCandidates.length > 0) {
            await _cleanupProjectMembers(updatedTask.projeto_id, removedCandidates);
        }

        return updatedTask;
    },

    async deleteTask(user, id, deleteHours = false, force = false) {
        // Verifica existência e permissão básica (assigned ou vinculado)
        const task = await this.getTaskById(user, id);
        const taskCollabs = await dbFindAll('tarefa_colaboradores', { filters: { id_tarefa: id } });
        const teamIds = [
            String(task.colaborador_id),
            ...taskCollabs.map(c => String(c.id_colaborador))
        ].filter(id => id !== 'null' && id !== 'undefined');

        const hasHours = await checkTaskHasHours(id);

        if (hasHours && !force) {
            const error = new Error('Não é possível excluir esta tarefa pois existem horas apontadas nela.');
            error.status = 400;
            error.hasHours = true;
            throw error;
        }

        if (hasHours && force && !isAdmUser(user)) {
            const error = new Error('Apenas Administradores podem realizar a exclusão forçada de tarefas com horas.');
            error.status = 403;
            throw error;
        }

        await taskRepository.delete(id);

        if (deleteHours && hasHours) {
            const now = new Date().toISOString();
            await taskRepository.softDeleteHours(id, now);
        }

        const context = auditContext.getStore() || {};
        await auditService.logAction({
            userId: context.userId,
            action: 'DELETE',
            entity: 'fato_tarefas',
            entityId: id,
            oldData: task,
            ip: context.ip
        });

        await notifyUpdates('tasks', { id, deleted: true });

        // Cleanup
        await _cleanupProjectMembers(task.projeto_id, teamIds);

        return true;
    }
};
