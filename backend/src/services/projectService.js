import { supabaseAdmin } from '../config/supabaseAdmin.js';
import { projectRepository } from '../repositories/projectRepository.js';
import { auditService } from '../audit/auditService.js';
import { auditContext } from '../audit/auditMiddleware.js';
import { isAdmUser } from '../utils/security.js';

export const projectService = {
    async getAllProjects(user, filters) {
        if (!isAdmUser(user)) {
            // Se não for admin, filtra apenas os projetos que o usuário tem vínculo
            const userProjectIds = await this._getUserLinkedProjectIds(user);
            if (userProjectIds.length === 0) return [];

            return await projectRepository.findAll({
                ...filters,
                projectIds: userProjectIds
            });
        }
        return await projectRepository.findAll(filters);
    },

    async getProjectById(user, id) {
        const project = await projectRepository.findById(id);
        if (!project) {
            const error = new Error('Projeto não encontrado');
            error.status = 404;
            throw error;
        }

        // Se não for admin, verifica se tem vínculo
        if (!isAdmUser(user)) {
            const isMember = await checkUserIsMember(id, user.id);
            const hasTasks = await checkUserHasTasks(id, user.id);
            const isManager = project.manager === user.nome || project.manager === user.email;

            if (!isMember && !hasTasks && !isManager) {
                const error = new Error('Você não tem permissão para visualizar este projeto.');
                error.status = 403;
                throw error;
            }
        }

        return project;
    },

    /**
     * Auxiliar para buscar IDs de projetos vinculados ao usuário
     */
    async _getUserLinkedProjectIds(user) {
        // Busca em project_members
        const { data: memberProjects } = await supabaseAdmin
            .from('project_members')
            .select('id_projeto')
            .eq('id_colaborador', user.id);

        // Busca em fato_tarefas
        const { data: taskProjects } = await supabaseAdmin
            .from('fato_tarefas')
            .select('ID_Projeto')
            .eq('ID_Colaborador', user.id)
            .is('deleted_at', null);

        // Busca por gerência
        const { data: managedProjects } = await supabaseAdmin
            .from('dim_projetos')
            .select('ID_Projeto')
            .or(`manager.eq."${user.nome}",manager.eq."${user.email}"`)
            .is('deleted_at', null);

        const ids = new Set([
            ...(memberProjects || []).map(p => p.id_projeto),
            ...(taskProjects || []).map(p => p.ID_Projeto),
            ...(managedProjects || []).map(p => p.ID_Projeto)
        ]);

        return Array.from(ids).map(Number).filter(id => !Number.isNaN(id));
    },

    async createProject(data) {
        if (!data.NomeProjeto) {
            const error = new Error('Nome do projeto é obrigatório');
            error.status = 400;
            throw error;
        }

        const payload = {
            ...data,
            ativo: data.ativo ?? true,
            StatusProjeto: data.StatusProjeto || 'Em andamento'
        };

        const created = await projectRepository.create(payload);

        const context = auditContext.getStore() || {};
        await auditService.logAction({
            userId: context.userId,
            action: 'CREATE',
            entity: 'dim_projetos',
            entityId: created.ID_Projeto,
            newData: created,
            ip: context.ip
        });

        return created;
    },

    async updateProject(id, data) {
        const project = await projectRepository.findById(id);
        if (!project) {
            const error = new Error('Projeto não encontrado');
            error.status = 404;
            throw error;
        }

        const updated = await projectRepository.update(id, data);

        const context = auditContext.getStore() || {};
        await auditService.logAction({
            userId: context.userId,
            action: 'UPDATE',
            entity: 'dim_projetos',
            entityId: id,
            oldData: project,
            newData: updated,
            ip: context.ip
        });

        return updated;
    },

    async deleteProject(id, force = false) {
        const project = await projectRepository.findById(id);
        if (!project) {
            const error = new Error('Projeto não encontrado');
            error.status = 404;
            throw error;
        }

        // Se não for forçado, podemos fazer um soft delete (marcar como inativo)
        const context = auditContext.getStore() || {};

        if (!force) {
            const updated = await projectRepository.update(id, { ativo: false });

            await auditService.logAction({
                userId: context.userId,
                action: 'UPDATE', // É um Mute Logic / Soft delete na real
                entity: 'dim_projetos',
                entityId: id,
                oldData: project,
                newData: updated,
                ip: context.ip
            });
            return updated;
        }

        await projectRepository.delete(id);

        await auditService.logAction({
            userId: context.userId,
            action: 'DELETE',
            entity: 'dim_projetos',
            entityId: id,
            oldData: project,
            ip: context.ip
        });

        return true;
    }
};

/**
 * MANTIDO PARA COMPATIBILIDADE - Obtém um projeto pelo ID
 * @param {string|number} projectId 
 */
export async function getProjectById(projectId) {
    return await projectService.getProjectById(projectId);
}

/**
 * Verifica se um usuário é membro do projeto
 */
export async function checkUserIsMember(projectId, userId) {
    const { data, error } = await supabaseAdmin
        .from('project_members')
        .select('id_pc')
        .eq('id_projeto', projectId)
        .eq('id_colaborador', userId)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') {
        console.error('Erro checkUserIsMember:', error);
        return false;
    }
    return !!data;
}

/**
 * Verifica se o usuário tem tarefas atribuídas no projeto
 */
export async function checkUserHasTasks(projectId, userId) {
    const { data, error } = await supabaseAdmin
        .from('fato_tarefas')
        .select('id_tarefa_novo')
        .eq('ID_Projeto', projectId)
        .eq('ID_Colaborador', userId)
        .limit(1);

    if (error) {
        console.error('Erro checkUserHasTasks:', error);
        return false;
    }
    return data && data.length > 0;
}

/**
 * Verifica se existe algum membro no projeto que pertença à torre do usuário
 */
export async function checkTowerMembersInProject(projectId, towerName) {
    if (!towerName) return false;

    const { data: members, error } = await supabaseAdmin
        .from('project_members')
        .select('id_colaborador')
        .eq('id_projeto', projectId);

    if (error || !members || members.length === 0) return false;

    const memberIds = members.map(m => m.id_colaborador);

    const { data: towerMembers, error: towerError } = await supabaseAdmin
        .from('dim_colaboradores')
        .select('ID_Colaborador')
        .in('ID_Colaborador', memberIds)
        .eq('tower', towerName)
        .limit(1);

    if (towerError) {
        console.error('Erro checkTowerMembersInProject:', towerError);
        return false;
    }

    return towerMembers && towerMembers.length > 0;
}

/**
 * Verifica se o projeto tem tarefas criadas
 */
export async function checkProjectHasTasks(projectId) {
    const { data, error } = await supabaseAdmin
        .from('fato_tarefas')
        .select('id_tarefa_novo')
        .eq('ID_Projeto', projectId)
        .is('deleted_at', null)
        .limit(1);

    if (error) {
        console.error('Erro checkProjectHasTasks:', error);
        throw error;
    }
    return data && data.length > 0;
}

/**
 * Verifica se a tarefa tem horas apontadas
 */
export async function checkTaskHasHours(taskId) {
    const { data, error } = await supabaseAdmin
        .from('horas_trabalhadas')
        .select('ID_Horas_Trabalhadas')
        .eq('id_tarefa_novo', taskId)
        .is('deleted_at', null)
        .limit(1);

    if (error) {
        console.error('Erro checkTaskHasHours:', error);
        throw error;
    }
    return data && data.length > 0;
}
