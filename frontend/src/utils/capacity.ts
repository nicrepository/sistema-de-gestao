import { User, Task, Project, ProjectMember, Holiday, TimesheetEntry, TaskMemberAllocation, Absence } from '@/types';

/**
 * Retorna o número de dias úteis (Segunda a Sexta) em um determinado mês, descontando feriados.
 */
export const getWorkingDaysInMonth = (monthStr: string, holidays: Holiday[] = []): number => {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1, 12, 0, 0);
    let workingDays = 0;

    const currentMonth = date.getMonth();

    while (date.getMonth() === currentMonth) {
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;

            const isHoliday = holidays.some(h => {
                const hStart = h.date;
                const hEnd = h.endDate || h.date;
                return dateStr >= hStart && dateStr <= hEnd;
            });

            if (!isHoliday) {
                workingDays++;
            }
        }
        date.setDate(date.getDate() + 1);
    }

    return workingDays;
};

/**
 * Retorna o número de dias úteis entre duas datas (inclusive), descontando feriados.
 */
export const getWorkingDaysInRange = (startDate: string, endDate: string, holidays: Holiday[] = [], absences: Absence[] = []): number => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    if (start > end) return 0;

    let workingDays = 0;
    let current = new Date(start);

    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const y = current.getFullYear();
            const m = String(current.getMonth() + 1).padStart(2, '0');
            const d = String(current.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;

            const isHoliday = holidays.some(h => {
                const hStart = h.date;
                const hEnd = h.endDate || h.date;
                return dateStr >= hStart && dateStr <= hEnd;
            });

            const isAbsent = absences.some(a => {
                const aStart = a.startDate;
                const aEnd = a.endDate || a.startDate;
                return dateStr >= aStart && dateStr <= aEnd && a.status === 'aprovada_gestao';
            });

            if (!isHoliday && !isAbsent) {
                workingDays++;
            }
        }
        current.setDate(current.getDate() + 1);
    }

    return workingDays;
};

/**
 * Adiciona dias úteis a uma data.
 */
export const addBusinessDays = (startDate: string, daysToAdd: number, holidays: Holiday[] = []): string => {
    if (daysToAdd <= 0) return startDate;
    let current = new Date(startDate + 'T12:00:00');
    let added = 0;
    while (added < daysToAdd) {
        current.setDate(current.getDate() + 1);
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const dateStr = current.toISOString().split('T')[0];
            const isHoliday = holidays.some(h => {
                const hStart = h.date;
                const hEnd = h.endDate || h.date;
                return dateStr >= hStart && dateStr <= hEnd;
            });
            if (!isHoliday) added++;
        }
    }
    return current.toISOString().split('T')[0];
};

/**
 * Interface para Alocação Diária
 */
export interface DayAllocation {
    date: string;
    plannedHours: number;
    continuousHours: number;
    bufferHours: number;
    totalOccupancy: number;
    isWorkingDay: boolean;
    capacity: number;
}

/**
 * Calcula o compromisso diário do colaborador com projetos contínuos.
 * Regra: Capacidade diária (ex: 8h) dividida pelo número de membros no projeto.
 */
export const getUserContinuousCommitment = (
    userId: string,
    allProjects: Project[],
    projectMembers: ProjectMember[],
    userDailyCap: number = 8,
    dateStr?: string
): number => {
    // REFORMULADO: Alocação automática por membresia foi abolida.
    // Agora o sistema considera apenas o que está explicitamente alocado em tarefas.
    return 0;
};

/**
 * LÓGICA DE ALOCAÇÃO DIÁRIA (SIMULAÇÃO) - REFORMULADA
 * Prioridade: Planejado (O que sobra após compromisso contínuo) | Contínuo (Compromisso base ou 100% se sem planejado)
 */
export const simulateUserDailyAllocation = (
    userId: string,
    startDate: string,
    endDate: string,
    allProjects: Project[],
    allTasks: Task[],
    projectMembers: ProjectMember[],
    timesheetEntries: TimesheetEntry[],
    holidays: Holiday[] = [],
    userDailyCap: number = 8
): DayAllocation[] => {
    const allocations: DayAllocation[] = [];
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    const todayStr = new Date().toISOString().split('T')[0];
    const capacityDia = userDailyCap;

    let current = new Date(start);
    while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        const dayOfWeek = current.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = holidays.some(h => dateStr >= h.date && dateStr <= (h.endDate || h.date));
        const isWorkingDay = !isWeekend && !isHoliday;

        let plannedHours = 0;
        let continuousHours = 0;
        let bufferHours = 0;

        if (isWorkingDay) {
            // 1. Verificar tarefas planejadas ativas no dia
            const userTasks = allTasks.filter(t =>
                (String(t.developerId) === String(userId) || t.collaboratorIds?.some(id => String(id) === String(userId))) &&
                t.status !== 'Done' &&
                (t.status as string) !== 'Cancelled' &&
                (t.status as string) !== 'Cancelada' &&
                !t.deleted_at
            );

            const activePlannedTasks = userTasks.filter(t => {
                const project = allProjects.find(p => String(p.id) === String(t.projectId));
                if (!project || project.project_type !== 'planned') return false;

                const tStart = t.scheduledStart || t.actualStart || project.startDate || '';
                const tEnd = t.estimatedDelivery || '';
                return dateStr >= tStart && (tEnd === '' || dateStr <= tEnd);
            });

            // 2. Verificar o compromisso contínuo dinâmico no dia (Passando a data para filtrar vigência)
            const continuousCommitment = getUserContinuousCommitment(String(userId), allProjects, projectMembers, capacityDia, dateStr);
            const availableForPlanned = Math.max(0, capacityDia - continuousCommitment);

            if (activePlannedTasks.length > 0) {
                // Tem tarefa planejada: Consome o que sobra do compromisso contínuo (Prioriza o planejado no que sobrar)
                plannedHours = availableForPlanned;
                continuousHours = continuousCommitment;
            } else {
                // Sem tarefas planejadas: Aloca apenas o compromisso contínuo real e libera o resto como disponível (Buffer)
                continuousHours = continuousCommitment;
                bufferHours = Math.max(0, capacityDia - continuousHours);
            }
        }

        allocations.push({
            date: dateStr,
            plannedHours: Number(plannedHours.toFixed(2)),
            continuousHours: Number(continuousHours.toFixed(2)),
            bufferHours: Number(bufferHours.toFixed(2)),
            totalOccupancy: Number((plannedHours + continuousHours).toFixed(2)),
            isWorkingDay,
            capacity: capacityDia
        });

        current.setDate(current.getDate() + 1);
    }

    return allocations;
};

/**
 * CÁLCULO DE DATA FINAL DA TAREFA PLANEJADA (PREVISÃO MATEMÁTICA)
 * REGRA: Se entrar em um projeto planejado, assume-se que ele pode dedicar ATÉ 100% para finalizar.
 * Mas respeitando a nova regra de prioridade de 50% para prazos regulares.
 * O usuário pediu: "se entrar em um projeto planejado, ele terá 100% ocupado, qual a data que ele vai finalizar essa tarefa?"
 */
export const calculateTaskPredictedEndDate = (
    task: Task,
    allProjects: Project[],
    allTasks: Task[],
    projectMembers: ProjectMember[],
    timesheetEntries: TimesheetEntry[],
    holidays: Holiday[] = [],
    userDailyCap: number = 8,
    taskMemberAllocations: TaskMemberAllocation[] = []
): { ideal: string; realistic: string; isSaturated?: boolean } => {
    const userId = task.developerId;
    const fallback = { ideal: task.estimatedDelivery || '', realistic: task.estimatedDelivery || '' };
    if (!userId) return fallback;

    const project = allProjects.find(p => String(p.id) === String(task.projectId));
    if (!project || project.project_type !== 'planned') return fallback;

    const isIgnored = task.status === 'Done' || (task.status as string) === 'Cancelled' || (task.status as string) === 'Cancelada' || task.deleted_at;
    const reported = timesheetEntries
        .filter(e => String(e.taskId) === String(task.id) && String(e.userId) === String(userId))
        .reduce((sum, e) => sum + (Number(e.totalHours) || 0), 0);

    // --- LÓGICA DE ALOCAÇÃO ESPECÍFICA ---
    const specificAllocation = taskMemberAllocations.find(a => String(a.taskId) === String(task.id) && String(a.userId) === String(userId));
    const hasAnyAllocationInTask = taskMemberAllocations.some(a => String(a.taskId) === String(task.id) && a.reservedHours > 0);

    let taskEffort = 0;
    if (specificAllocation && specificAllocation.reservedHours > 0) {
        taskEffort = specificAllocation.reservedHours;
    } else if (!hasAnyAllocationInTask) {
        const teamIds = Array.from(new Set([task.developerId, ...(task.collaboratorIds || [])])).filter(Boolean);
        taskEffort = (Number(task.estimatedHours) || 0) / (teamIds.length || 1);
    } else {
        taskEffort = 0;
    }

    const effortRestante = isIgnored ? 0 : Math.max(0, taskEffort - reported);
    if (effortRestante <= 0) {
        const date = task.actualDelivery || task.estimatedDelivery || '';
        return { ideal: date, realistic: date };
    }

    const startCalc = new Date().toISOString().split('T')[0];

    // MODO IDEAL: 100% da capacidade
    const diasIdeal = Math.ceil(effortRestante / userDailyCap);
    const idealDate = addBusinessDays(startCalc, diasIdeal, holidays);

    // MODO REALISTA: Dinâmico (Capacidade Total - Compromisso Contínuo)
    const commitment = getUserContinuousCommitment(String(userId), allProjects, projectMembers, userDailyCap);

    // Detector de Saturação (Sobrecarga estrutural)
    const isSaturated = commitment >= userDailyCap;

    // O fallback de 0.1h é APENAS técnico para evitar divisão por zero ou negativa,
    // mas o sinal de saturação deve ser disparado para a gestão.
    const capRealista = Math.max(0.1, userDailyCap - commitment);

    const diasRealista = Math.ceil(effortRestante / capRealista);
    const realisticDate = addBusinessDays(startCalc, diasRealista, holidays);

    return { ideal: idealDate, realistic: realisticDate, isSaturated };
};

/**
 * MAPA DE OCUPAÇÃO MENSAL
 */
export const getUserMonthlyAvailability = (
    user: User,
    monthStr: string, // "YYYY-MM"
    projects: Project[],
    projectMembers: ProjectMember[],
    timesheetEntries: TimesheetEntry[],
    tasks: Task[],
    holidays: Holiday[] = [],
    taskMemberAllocations: TaskMemberAllocation[] = [],
    absences: Absence[] = []
): {
    capacity: number;
    plannedHours: number;
    continuousHours: number;
    totalOccupancy: number;
    occupancyRate: number;
    balance: number;
    status: 'Sobrecarregado' | 'Alto' | 'Disponível';
    allocated: number;
    available: number;
    breakdown: {
        planned: { id: string; name: string; hours: number }[];
        continuous: { id: string; name: string; hours: number }[];
    };
} => {
    const [year, month] = monthStr.split('-').map(Number);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const isCurrentMonth = todayStr.startsWith(monthStr);

    const startDate = `${monthStr}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // Ocultar Warning unused
    const _todayStr = todayStr;
    const _isCurrentMonth = isCurrentMonth;

    const dailyGoal = user.dailyAvailableHours || 8;
    const userAbsences = absences.filter(a => String(a.userId) === String(user.id) && a.status === 'aprovada_gestao');
    const workingDays = getWorkingDaysInRange(startDate, endDate, holidays, userAbsences);
    const capacity = dailyGoal * workingDays;

    // 1. Calcular detalhamento de projetos (Baseado estritamente em horas alocadas às tarefas)
    const plannedProjectsBreakdown: { id: string; name: string; hours: number }[] = [];
    let plannedHoursTotal = 0;
    const continuousProjectsBreakdown: { id: string; name: string; hours: number }[] = [];
    let continuousHoursTotal = 0;

    tasks.forEach(t => {
        const isOwner = String(t.developerId) === String(user.id) || t.collaboratorIds?.some(id => String(id) === String(user.id));
        // Permitir que tarefas concluídas (mas não deletadas) entrem no cálculo ALOCADO do mês
        if (!isOwner || !!t.deleted_at) return;

        const p = projects.find(proj => proj.id === t.projectId);
        if (!p) return;

        // --- LÓGICA DE ALOCAÇÃO ESPECÍFICA ---
        const specificAllocation = taskMemberAllocations.find(a => String(a.taskId) === String(t.id) && String(a.userId) === String(user.id));
        const hasAnyAllocationInTask = taskMemberAllocations.some(a => String(a.taskId) === String(t.id) && a.reservedHours > 0);

        let totalEffort = 0;
        if (specificAllocation && specificAllocation.reservedHours > 0) {
            totalEffort = specificAllocation.reservedHours;
        } else if (!hasAnyAllocationInTask) {
            // Fallback: Se NINGUÉM tiver alocação manual, divide o esforço total pelo tamanho da equipe
            const teamIds = Array.from(new Set([t.developerId, ...(t.collaboratorIds || [])])).filter(Boolean);
            totalEffort = (Number(t.estimatedHours) || 0) / (teamIds.length || 1);
        } else {
            totalEffort = 0;
        }

        // REGRA DE SALDO: Se a tarefa foi concluída, a alocação real é o que foi apontado (se for menor que o alocado)
        // Isso libera as horas excedentes de volta para o saldo do usuário.
        if (t.status === 'Done') {
            const reportedOnTask = timesheetEntries
                .filter(e => String(e.taskId) === String(t.id) && String(e.userId) === String(user.id))
                .reduce((sum, e) => sum + (Number(e.totalHours) || 0), 0);

            // A alocação passa a ser o menor entre o planejado original e o executado real
            totalEffort = Math.min(totalEffort, reportedOnTask);
        }

        if (totalEffort <= 0 && t.status !== 'Done') return;

        const tStart = t.scheduledStart || t.actualStart || p.startDate || startDate;
        // Se a tarefa já foi entregue, o esforço real de alocação terminou na data de entrega efetiva
        const tEnd = t.actualDelivery || t.estimatedDelivery || p.estimatedDelivery || endDate;

        // Distribuição teórica linear do Esforço por todos os dias da tarefa
        const effectiveStart = tStart;
        const effectiveEnd = tEnd;

        const totalTaskDays = getWorkingDaysInRange(effectiveStart, effectiveEnd, holidays, userAbsences) || 1; // Mínimo 1 dia
        const hoursPerDay = totalEffort / totalTaskDays;

        const intStart = effectiveStart > startDate ? effectiveStart : startDate;
        const intEnd = effectiveEnd < endDate ? effectiveEnd : endDate;

        if (intStart <= intEnd && intStart <= endDate && intEnd >= startDate) {
            const bizDaysInMonth = getWorkingDaysInRange(intStart, intEnd, holidays, userAbsences);
            const effortInMonth = bizDaysInMonth * hoursPerDay;

            if (p.project_type === 'continuous') {
                continuousHoursTotal += effortInMonth;
                const existing = continuousProjectsBreakdown.find(pb => pb.id === p.id);
                if (existing) existing.hours += effortInMonth;
                else continuousProjectsBreakdown.push({ id: p.id, name: p.name, hours: effortInMonth });
            } else {
                plannedHoursTotal += effortInMonth;
                const existing = plannedProjectsBreakdown.find(pb => pb.id === p.id);
                if (existing) existing.hours += effortInMonth;
                else plannedProjectsBreakdown.push({ id: p.id, name: p.name, hours: effortInMonth });
            }
        }
    });

    plannedProjectsBreakdown.forEach(pb => pb.hours = Number(pb.hours.toFixed(2)));
    continuousProjectsBreakdown.forEach(pb => pb.hours = Number(pb.hours.toFixed(2)));

    const totalOccupancy = plannedHoursTotal + continuousHoursTotal;
    const occupancyRateVal = capacity > 0 ? (totalOccupancy / capacity) : 0;
    const balance = capacity - totalOccupancy;

    let status: 'Sobrecarregado' | 'Alto' | 'Disponível' = 'Disponível';
    if (occupancyRateVal > 1) status = 'Sobrecarregado';
    else if (occupancyRateVal >= 0.85) status = 'Alto';

    return {
        capacity: Number(capacity.toFixed(2)) || 0,
        plannedHours: Number(plannedHoursTotal.toFixed(2)) || 0,
        continuousHours: Number(continuousHoursTotal.toFixed(2)) || 0,
        totalOccupancy: Number(totalOccupancy.toFixed(2)) || 0,
        occupancyRate: Number((occupancyRateVal * 100).toFixed(2)) || 0,
        balance: Number(balance.toFixed(2)) || 0,
        status,
        allocated: Number(totalOccupancy.toFixed(2)) || 0,
        available: Number(balance.toFixed(2)) || 0,
        breakdown: {
            planned: plannedProjectsBreakdown,
            continuous: continuousProjectsBreakdown
        }
    };
};

/**
 * Helpers legados
 */
export const calculateProjectWeightedProgress = (projectId: string, tasks: Task[]): number => {
    const projectTasks = tasks.filter(t => String(t.projectId) === String(projectId));
    if (projectTasks.length === 0) return 0;

    let totalWeight = 0;
    let totalWeightedProgress = 0;

    projectTasks.forEach(t => {
        const weight = Number(t.estimatedHours) || 0;
        const progress = Number(t.progress) || (t.status === 'Done' ? 100 : 0);
        totalWeight += weight;
        totalWeightedProgress += weight * progress;
    });

    if (totalWeight === 0) {
        const sumProgress = projectTasks.reduce((sum, t) => sum + (Number(t.progress) || (t.status === 'Done' ? 100 : 0)), 0);
        return sumProgress / projectTasks.length;
    }

    return totalWeightedProgress / totalWeight;
};

export const calculateProjectTaskWeights = (projectId: string, tasks: Task[]): Task[] => {
    const projectTasks = tasks.filter(t => String(t.projectId) === String(projectId));
    const totalForecast = projectTasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
    return tasks.map(t => {
        if (String(t.projectId) === String(projectId)) {
            const peso = totalForecast > 0 ? (Number(t.estimatedHours) || 0) / totalForecast : 0;
            return { ...t, task_weight: peso };
        }
        return t;
    });
};

/**
 * Calcula a data estimada de "Backlog Free"
 * Nova regra: Assume que o colaborador dedica 100% ao planejado para definir a data de entrega final.
 */
export const calculateIndividualReleaseDate = (
    user: User,
    allProjects: Project[],
    projectMembers: ProjectMember[],
    timesheetEntries: TimesheetEntry[],
    allTasks: Task[],
    holidays: Holiday[] = [],
    taskMemberAllocations: TaskMemberAllocation[] = []
): { ideal: string; realistic: string; isSaturated?: boolean } | null => {
    const userPlannedTasks = allTasks.filter(t => {
        const isOwner = String(t.developerId) === String(user.id);
        const isCollaborator = t.collaboratorIds?.some(id => String(id) === String(user.id));
        if (!isOwner && !isCollaborator) return false;

        const project = allProjects.find(p => String(p.id) === String(t.projectId));
        const isIgnored = t.status === 'Done' || (t.status as string) === 'Cancelled' || (t.status as string) === 'Cancelada' || t.deleted_at;

        return project?.active !== false && !isIgnored; // Consideramos todas as tarefas ativas
    });

    if (userPlannedTasks.length === 0) return null;

    let totalEffortRemaining = 0;
    userPlannedTasks.forEach(task => {
        const reported = timesheetEntries
            .filter(e => String(e.taskId) === String(task.id) && String(e.userId) === String(user.id))
            .reduce((sum, e) => sum + (Number(e.totalHours) || 0), 0);

        // --- NOVA LÓGICA: Busca alocação específica para o colaborador ---
        const specificAllocation = taskMemberAllocations.find(a => String(a.taskId) === String(task.id) && String(a.userId) === String(user.id));
        const hasAnyAllocationInTask = taskMemberAllocations.some(a => String(a.taskId) === String(task.id) && a.reservedHours > 0);

        let taskEffort = 0;
        if (specificAllocation && specificAllocation.reservedHours > 0) {
            taskEffort = specificAllocation.reservedHours;
        } else if (!hasAnyAllocationInTask) {
            const teamIds = Array.from(new Set([task.developerId, ...(task.collaboratorIds || [])])).filter(Boolean);
            taskEffort = (Number(task.estimatedHours) || 0) / (teamIds.length || 1);
        } else {
            taskEffort = 0;
        }

        totalEffortRemaining += Math.max(0, taskEffort - reported);
    });

    if (totalEffortRemaining <= 0) return null;

    const dailyCap = user.dailyAvailableHours || 8;
    const today = new Date().toISOString().split('T')[0];

    // IDEAL (100%)
    const diasIdeal = Math.ceil(totalEffortRemaining / dailyCap);
    const ideal = addBusinessDays(today, diasIdeal, holidays);

    // REALISTA (Dinâmico)
    const commitment = getUserContinuousCommitment(String(user.id), allProjects, projectMembers, dailyCap);
    const isSaturated = commitment >= dailyCap;

    // Fallback apenas técnico para evitar divisão por zero, sinalizando saturação na UI
    const capRealista = Math.max(0.1, dailyCap - commitment);

    const diasRealista = Math.ceil(totalEffortRemaining / capRealista);
    const realistic = addBusinessDays(today, diasRealista, holidays);

    return { ideal, realistic, isSaturated };
};

/**
 * TENDÊNCIA DE SATURAÇÃO (PRÓXIMOS 90 DIAS)
 * Analisa a evolução da taxa de saturação e carga.
 */
export const calculateTeamSaturationTrend = (
    users: User[],
    allProjects: Project[],
    projectMembers: ProjectMember[],
    allTasks: Task[],
    timesheetEntries: TimesheetEntry[],
    holidays: Holiday[] = [],
    taskMemberAllocations: TaskMemberAllocation[] = []
): { month: string; saturationRate: number; avgLoad: number }[] => {
    const trends: { month: string; saturationRate: number; avgLoad: number }[] = [];
    const today = new Date();

    for (let i = 0; i < 4; i++) {
        const futureDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthStr = futureDate.toISOString().slice(0, 7);

        const operationalUsers = users.filter(u => u.active !== false && (u.torre || '').toUpperCase() !== 'N/A');
        if (operationalUsers.length === 0) continue;

        let saturatedCount = 0;
        let totalLoad = 0;

        operationalUsers.forEach(u => {
            const availability = getUserMonthlyAvailability(u, monthStr, allProjects, projectMembers, timesheetEntries, allTasks, holidays, taskMemberAllocations);
            totalLoad += availability.occupancyRate;

            if (availability.occupancyRate >= 100) {
                saturatedCount++;
            }
        });

        trends.push({
            month: monthStr,
            saturationRate: (saturatedCount / operationalUsers.length) * 100,
            avgLoad: totalLoad / operationalUsers.length
        });
    }

    return trends;
};

/**
 * ÍNDICE DE ELASTICIDADE DA EQUIPE
 * Quanto % da capacidade total ainda pode absorver novos projetos (buffer real).
 */
export const calculateTeamElasticity = (
    users: User[],
    monthStr: string,
    projects: Project[],
    projectMembers: ProjectMember[],
    timesheetEntries: TimesheetEntry[],
    tasks: Task[],
    holidays: Holiday[] = [],
    taskMemberAllocations: TaskMemberAllocation[] = []
): number => {
    const operationalUsers = users.filter(u => u.active !== false && (u.torre || '').toUpperCase() !== 'N/A');
    if (operationalUsers.length === 0) return 0;

    let totalCapacity = 0;
    let totalAvailable = 0;

    operationalUsers.forEach(u => {
        const data = getUserMonthlyAvailability(u, monthStr, projects, projectMembers, timesheetEntries, tasks, holidays, taskMemberAllocations);
        totalCapacity += data.capacity;
        totalAvailable += Math.max(0, data.available); // Apenas saldo positivo conta como elasticidade
    });

    return totalCapacity > 0 ? (totalAvailable / totalCapacity) * 100 : 0;
};

/**
 * SIMULAÇÃO DE IMPACTO DE NOVO PROJETO
 * "Se eu vender um projeto de X horas, como fica a equipe?"
 */
export const simulateNewProjectImpact = (
    hours: number,
    users: User[],
    allProjects: Project[],
    projectMembers: ProjectMember[],
    allTasks: Task[],
    timesheetEntries: TimesheetEntry[],
    holidays: Holiday[] = [],
    taskMemberAllocations: TaskMemberAllocation[] = []
): { userId: string; name: string; releaseDateBefore: string; releaseDateAfter: string; isNewSaturated: boolean }[] => {
    const impact: any[] = [];
    const operationalUsers = users.filter(u => u.active !== false && (u.torre || '').toUpperCase() !== 'N/A');

    operationalUsers.forEach(u => {
        const current = calculateIndividualReleaseDate(u, allProjects, projectMembers, timesheetEntries, allTasks, holidays, taskMemberAllocations);
        if (!current) return;

        // Simula o acréscimo de horas distribuído no backlog do usuário
        // Criamos uma tarefa "fantasma" para simular o efeito
        const ghostTask: Task = {
            id: 'ghost',
            projectId: 'ghost_proj',
            developerId: u.id,
            status: 'Todo',
            estimatedHours: hours,
            title: 'Simulação'
        } as any;

        const simulatedTasks = [...allTasks, ghostTask];
        const after = calculateIndividualReleaseDate(u, allProjects, projectMembers, timesheetEntries, simulatedTasks, holidays, taskMemberAllocations);

        impact.push({
            userId: u.id,
            name: u.name,
            releaseDateBefore: current.realistic,
            releaseDateAfter: after?.realistic || current.realistic,
            isNewSaturated: after?.isSaturated || false
        });
    });

    return impact.sort((a, b) => {
        // Ordena por maior impacto (maior deslocamento de data)
        return new Date(b.releaseDateAfter).getTime() - new Date(a.releaseDateAfter).getTime();
    });
};
/**
 * CÁLCULO DE CAPACIDADE E SALDO DO USUÁRIO NO MÊS
 */
export const calculateUserCapacity = (
    userId: string,
    referenceDate: Date,
    allTasks: Task[],
    holidays: Holiday[] = [],
    absences: Absence[] = [],
    dailyCap: number = 8
) => {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth() + 1;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const startDate = `${monthStr}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const userAbsences = absences.filter(a => String(a.userId) === String(userId) && a.status === 'aprovada_gestao');
    const workingDays = getWorkingDaysInRange(startDate, endDate, holidays, userAbsences);
    const monthlyCapacity = dailyCap * workingDays;

    let allocatedHours = 0;
    allTasks.forEach(t => {
        const isOwner = String(t.developerId) === String(userId) || t.collaboratorIds?.some(id => String(id) === String(userId));
        if (!isOwner || t.status === 'Done' || t.deleted_at) return;

        const tStart = t.scheduledStart || t.actualStart || startDate;
        const tEnd = t.estimatedDelivery || endDate;

        const totalTaskDays = getWorkingDaysInRange(tStart, tEnd, holidays, userAbsences) || 1;
        const hoursPerDay = (Number(t.estimatedHours) || 0) / totalTaskDays;

        const intStart = tStart > startDate ? tStart : startDate;
        const intEnd = tEnd < endDate ? tEnd : endDate;

        if (intStart <= intEnd) {
            const bizDaysInMonth = getWorkingDaysInRange(intStart, intEnd, holidays, userAbsences);
            allocatedHours += bizDaysInMonth * hoursPerDay;
        }
    });

    return {
        monthlyCapacity,
        allocatedHours,
        availableBalance: monthlyCapacity - allocatedHours
    };
};
