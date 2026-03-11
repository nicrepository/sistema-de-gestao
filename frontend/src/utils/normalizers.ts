// utils/normalizers.ts
import { Task, Status, Priority, Impact, TimesheetEntry, Client, Project, User, Role } from "@/types";

export function normalizeStatus(raw: string | null): Status {
    if (!raw) return "Todo";
    const s = raw.toLowerCase().trim();
    if (s.includes("pré-projeto") || s.includes("projeto") || s.includes("não iniciado")) return "Todo";
    if (s.includes("conclu") || s.includes("done") || s.includes("finaliz") || s.includes("entregue")) return "Done";
    if (s.includes("analise") || s.includes("análise") || s.includes("revis") || s.includes("review") || s.includes("valida") || s.includes("pendente")) return "Review";
    if (s.includes("teste") || s.includes("testing")) return "Testing";
    if (s.includes("andamento") || s.includes("progresso") || s.includes("progress") || s.includes("execu") || s.includes("iniciado") || s.includes("trabalhando")) return "In Progress";
    return "Todo";
}

export function getStatusDisplayName(status: Status): string {
    switch (status) {
        case 'Todo': return 'PRÉ-PROJETO';
        case 'In Progress': return 'ANDAMENTO';
        case 'Testing': return 'TESTE';
        case 'Review': return 'ANÁLISE';
        case 'Done': return 'CONCLUÍDO';
        default: return status;
    }
}

export function normalizePriority(raw: string | null): Priority | undefined {
    if (!raw) return undefined;
    const s = raw.toLowerCase().trim();
    if (s.includes("critica") || s.includes("critical") || s.includes("urgente")) return "Critical";
    if (s.includes("alta") || s.includes("high")) return "High";
    if (s.includes("media") || s.includes("medium")) return "Medium";
    if (s.includes("baixa") || s.includes("low")) return "Low";
    return undefined;
}

export function normalizeImpact(raw: string | null): Impact | undefined {
    if (!raw) return undefined;
    const s = raw.toLowerCase().trim();
    if (s.includes("alto") || s.includes("high")) return "High";
    if (s.includes("medio") || s.includes("medium")) return "Medium";
    if (s.includes("baixo") || s.includes("low")) return "Low";
    return undefined;
}

export function getRoleDisplayName(role: string): string {
    const r = role.toLowerCase().trim();
    switch (r) {
        case 'system_admin':
        case 'admin': return 'Administrador TI (System Admin)';
        case 'executive': return 'Gestão Executiva / Executivo';
        case 'ceo':
        case 'diretoria': return 'Diretoria Geral / CEO';
        case 'pmo': return 'Planejamento / PMO';
        case 'tech_lead': return 'Tech Lead / Liderança';
        case 'developer':
        case 'consultor': return 'Padrão';
        case 'gestor': return 'Gestor / Gerente';
        case 'financeiro': return 'Financeiro';
        default: return role.charAt(0).toUpperCase() + role.slice(1);
    }
}

export function formatDate(dateStr: string | null): string {
    if (!dateStr) {
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 7);
        return defaultDate.toISOString().split("T")[0];
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    if (dateStr.includes('T')) return dateStr.split('T')[0];
    try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            const userTimezoneOffset = date.getTimezoneOffset() * 60000;
            const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
            return adjustedDate.toISOString().split("T")[0];
        }
    } catch { }
    return new Date().toISOString().split("T")[0];
}

/**
 * Formata uma data YYYY-MM-DD para o padrão brasileiro DD/MM/YYYY
 */
export function formatDateBR(dateStr: string | null | undefined): string {
    if (!dateStr) return "---";
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function mapDbTaskToTask(row: any, userMap?: Map<string, any>, projectName?: string, clientName?: string): Task {
    const safeString = (val: any) => (val === null || val === undefined || val === 'null' || val === 'undefined') ? '' : String(val);
    let developerName = undefined;
    if (row.colaborador_id && userMap) {
        const dev = userMap.get(String(row.colaborador_id));
        developerName = dev?.name;
    }

    const status = normalizeStatus(row.status);

    return {
        id: safeString(row.id),
        title: (row.tarefa && row.tarefa !== 'null') ? row.tarefa : "(Sem título)",
        projectId: safeString(row.projeto_id),
        projectName: projectName,
        clientId: safeString(row.cliente_id),
        clientName: clientName,
        developer: developerName,
        developerId: row.colaborador_id ? safeString(row.colaborador_id) : undefined,
        collaboratorIds: [],
        status: status,
        estimatedDelivery: formatDate(row.entrega_estimada),
        actualDelivery: row.entrega_real || undefined,
        scheduledStart: row.inicio_previsto || undefined,
        actualStart: row.inicio_real || undefined,
        progress: Math.min(100, Math.max(0, Number(row.progress) || 0)),
        priority: normalizePriority(row.prioridade),
        impact: normalizeImpact(row.impacto),
        description: row.description || undefined,
        estimatedHours: row.estimated_hours ? Number(row.estimated_hours) : undefined,
        allocatedHours: row.allocated_hours ? Number(row.allocated_hours) : undefined,
        is_impediment: !!row.is_impediment,
        daysOverdue: row.dias_atraso || calculateDaysOverdue(row.entrega_estimada, row.entrega_real, status),
        deleted_at: row.deleted_at || undefined
    };
}

function calculateDaysOverdue(estimated: string | null, actual: string | null, status: Status): number {
    if (!estimated) return 0;
    if (status === 'Done') return 0;

    const parseLocalDate = (dateStr: string) => {
        const parts = dateStr.split('T')[0].split('-');
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    };

    const deadline = parseLocalDate(estimated);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const diff = Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
}

export function mapDbTimesheetToEntry(r: any, taskExternalMap?: Map<string, string>): TimesheetEntry {
    const safeString = (val: any) => (val === null || val === undefined || val === 'null' || val === 'undefined') ? '' : String(val);
    let taskId = safeString(r.id_tarefa_novo || '');
    if (taskExternalMap && (!taskId || taskId === '0')) {
        const extId = safeString(r.ID_Tarefa || '').toLowerCase();
        if (extId && taskExternalMap.has(extId)) {
            taskId = taskExternalMap.get(extId)!;
        } else {
            taskId = safeString(r.ID_Tarefa || '');
        }
    }

    return {
        id: safeString(r.ID_Horas_Trabalhadas || r.id || ''),
        userId: safeString(r.ID_Colaborador || ''),
        userName: r.dim_colaboradores?.nome_colaborador || r.userName || '',
        clientId: safeString(r.ID_Cliente || ''),
        projectId: safeString(r.ID_Projeto || ''),
        taskId: taskId,
        date: r.Data ? (r.Data.includes('T') ? r.Data.split('T')[0] : r.Data) : formatDate(null),
        startTime: r.Hora_Inicio || '',
        endTime: r.Hora_Fim || '',
        totalHours: Number(r.Horas_Trabalhadas || 0),
        lunchDeduction: !!r.Almoco_Deduzido,
        description: r.Descricao || undefined,
        deleted_at: r.deleted_at || undefined
    };
}

export function mapDbProjectToProject(row: any): Project {
    const safeString = (val: any) => (val === null || val === undefined || val === 'null' || val === 'undefined') ? '' : String(val);
    return {
        id: String(row.id),
        name: row.nome || "Sem nome",
        clientId: safeString(row.cliente_id),
        partnerId: row.partner_id ? safeString(row.partner_id) : undefined,
        status: row.status || undefined,
        active: row.ativo ?? true,
        complexidade: row.complexidade || undefined,
        manager: row.manager || undefined,
        startDate: row.startDate || undefined,
        estimatedDelivery: row.estimatedDelivery || undefined,
        valor_total_rs: row.valor_total_rs ? Number(row.valor_total_rs) : undefined,
        torre: row.torre || undefined,
        project_type: row.project_type || 'planned'
    };
}

export function mapDbUserToUser(row: any): User {
    const safeString = (val: any) => (val === null || val === undefined || val === 'null' || val === 'undefined') ? '' : String(val);
    const normalizeUserRole = (roleValue: string | null): Role => {
        if (!roleValue) return "developer";
        const p = roleValue.toLowerCase().trim();
        if (p === 'system_admin' || p === 'system admin') return 'system_admin';
        if (p === 'diretoria') return 'diretoria';
        if (p === 'pmo') return 'pmo';
        if (p === 'gestor') return 'gestor';
        if (p === 'tech lead' || p === 'tech_lead') return 'tech_lead';
        if (p === 'financeiro') return 'financeiro';
        if (p === 'administrador' || p === 'admin') return 'admin';
        if (p === 'executive' || p === 'executivo') return 'executive';
        if (p === 'ceo') return 'ceo';
        return 'developer';
    };

    return {
        id: safeString(row.id),
        name: row.nome || "Sem nome",
        email: String(row.email || "").trim().toLowerCase(),
        avatarUrl: row.avatarUrl || row.avatar_url || undefined,
        cargo: row.cargo || undefined,
        role: normalizeUserRole(row.role),
        active: row.ativo !== false,
        torre: row.torre || undefined,
        nivel: row.nivel || undefined,
        hourlyCost: row.custo_hora ? Number(row.custo_hora) : undefined,
        dailyAvailableHours: row.horas_disponiveis_dia ? Number(row.horas_disponiveis_dia) : undefined,
        monthlyAvailableHours: row.horas_disponiveis_mes ? Number(row.horas_disponiveis_mes) : undefined,
        atrasado: !!row.atrasado
    };
}

export function mapDbAbsenceToAbsence(row: any): any {
    const safeString = (val: any) => (val === null || val === undefined || val === 'null' || val === 'undefined') ? '' : String(val);
    return {
        id: safeString(row.id),
        userId: safeString(row.colaborador_id),
        type: row.tipo || row.type,
        startDate: row.data_inicio,
        endDate: row.data_fim,
        status: row.status,
        observations: row.observacoes || undefined,
        period: row.periodo || undefined,
        endTime: row.hora_fim || undefined,
        createdAt: row.created_at
    };
}

export function formatDecimalToTime(decimalHours: number | null | undefined): string {
    if (decimalHours == null || isNaN(decimalHours) || decimalHours === 0) return "0:00";
    const isNegative = decimalHours < 0;
    const absHours = Math.abs(decimalHours);
    let hours = Math.floor(absHours);
    let minutes = Math.round((absHours - hours) * 60);
    if (minutes === 60) {
        hours += 1;
        minutes = 0;
    }
    const timeStr = `${hours}:${minutes.toString().padStart(2, '0')}`;
    return isNegative ? `-${timeStr}` : timeStr;
}

export function parseTimeToDecimal(timeStr: string): number {
    if (!timeStr) return 0;
    let val = timeStr.trim().replace(',', '.');
    val = val.replace('h', '');

    if (val.includes(':')) {
        const parts = val.split(':');
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        return h + (m / 60);
    }

    if (val.includes('.')) {
        return parseFloat(val) || 0;
    }

    if (/^\d{3,4}$/.test(val)) {
        if (val.length === 4 || (val.length === 3 && val.startsWith('0'))) {
            const h = parseInt(val.slice(0, val.length - 2), 10) || 0;
            const m = parseInt(val.slice(val.length - 2), 10) || 0;
            return h + (m / 60);
        }
    }

    return parseFloat(val) || 0;
}
