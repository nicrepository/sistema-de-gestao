import { User, Task, Project, Client, Absence } from '@/types';

export interface UserStatus {
    label: string;
    color: string;
}

export const isTaskDelayed = (task: any): boolean => {
    return (task.daysOverdue ?? 0) > 0;
};

export const getUserStatus = (
    user: User,
    tasks: Task[],
    projects: Project[],
    clients: Client[],
    absences: Absence[] = []
): UserStatus => {
    if (user.active === false) return { label: 'Desligado', color: '#ef4444' };

    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // 1. Verificar Ausências Ativas (Férias, Atestado, etc.)
    const activeAbsence = absences.find(a => {
        if (String(a.userId) !== String(user.id)) return false;

        // Considerar aprovadas pelo RH ou Gestão como "Gozo" atual
        const isApproved = ['aprovada_gestao', 'aprovada_rh', 'finalizada_dp'].includes(a.status);
        if (!isApproved) return false;

        const start = new Date(a.startDate + 'T12:00:00');
        const end = new Date(a.endDate + 'T12:00:00');
        return today >= start && today <= end;
    });

    if (activeAbsence) {
        const typeLabels: Record<string, string> = {
            'férias': 'Férias',
            'atestado': 'Atestado',
            'day-off': 'Day Off',
            'feriado_local': 'Feriado Local',
            'pipeline_de_aprovacao': 'Pipeline de Aprovação'
        };
        return {
            label: typeLabels[activeAbsence.type] || activeAbsence.type.toUpperCase(),
            color: '#10b981' // Verde para ausência aprovada (ou roxo se preferir)
        };
    }

    const userAllTasks = tasks.filter(t => t.developerId === user.id || (t.collaboratorIds && t.collaboratorIds.includes(user.id)));
    const userActiveTasks = userAllTasks.filter(t => t.status !== 'Done');

    // Helper: identificar se é tarefa de estudo/treinamento
    const isStudyTask = (t: Task): boolean => {
        const p = projects.find(proj => proj.id === t.projectId);
        const pName = p?.name?.toLowerCase() || '';
        const isStudyProject = pName.includes('treinamento') || pName.includes('capacitação');
        const isTitleStudy = t.title.toLowerCase().includes('estudo');
        return isStudyProject || isTitleStudy;
    };

    const normalTasks = userActiveTasks.filter(t => !isStudyTask(t));
    const studyTasks = userActiveTasks.filter(t => isStudyTask(t));

    // 1. Atrasados (Apenas para tarefas normais ou flag forçada)
    const hasNormalDelayed = user.atrasado === true || normalTasks.some(t => isTaskDelayed(t) && t.status !== 'Review');

    // 2. Ocupados (Qualquer tarefa normal ativa)
    const hasNormalActive = normalTasks.length > 0;

    // 3. Estudando (Apenas se a tarefa de estudo não estiver atrasada/passado da data)
    const hasActiveStudy = studyTasks.some(t => !isTaskDelayed(t));

    const activeRoles = ['admin', 'system_admin', 'gestor', 'diretoria', 'pmo', 'ceo', 'tech_lead', 'developer'];
    const isSystemCollaborator = (user.torre && user.torre !== 'N/A') || activeRoles.includes(user.role?.toLowerCase() || '');

    if (user.torre === 'N/A') return { label: 'Fora do Fluxo', color: '#64748b' };
    if (!isSystemCollaborator) return { label: 'N/A', color: '#94a3b8' };

    // Hierarquia final
    if (hasNormalDelayed) return { label: 'Atrasado', color: '#ef4444' };
    if (hasNormalActive) return { label: 'Ocupado', color: '#f59e0b' };
    if (hasActiveStudy) return { label: 'Estudando', color: '#3b82f6' };

    return { label: 'Livre', color: '#10b981' };
};
