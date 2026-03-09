import { apiRequest, apiDownload } from './apiClient';

type PreviewFilters = {
    startDate?: string; // YYYY-MM-DD
    endDate?: string;   // YYYY-MM-DD
    clientIds?: number[];
    projectIds?: number[];
    collaboratorIds?: number[];
    taskIds?: (number | string)[];
    statuses?: string[];
    includeCost?: boolean;
    includeHours?: boolean;
    includeStatus?: boolean;
};

export type ReportRow = {
    id_cliente: number;
    cliente: string;
    id_projeto: number;
    projeto: string;
    id_colaborador: number;
    colaborador: string;
    data_registro: string;
    tarefa: string | null;
    status_tarefa: string | null;
    horas: number;
    valor_projeto: number | null;
    horas_projeto_total: number;
    valor_hora_projeto: number | null;
    valor_rateado: number | null;
    data_inicio_p: string | null;
    data_fim_p: string | null;
    status_p: string | null;
    complexidade_p: string | null;
    progresso_p: number | null;
};

export type ProjectTotal = {
    id_projeto: number;
    projeto: string;
    cliente: string;
    id_cliente: number;
    horas_projeto_total: number;
    valor_projeto: number | null;
    valor_hora_projeto: number | null;
    valor_rateado_total: number | null;
};

export type ReportPreviewResponse = {
    generatedAt: string;
    rows: ReportRow[];
    projectTotals: ProjectTotal[];
    totals: {
        horas_total: number;
        valor_total_rateado: number | null;
    };
};

export async function fetchClients(includeInactive: boolean = false): Promise<Array<{ id: number; name: string }>> {
    return apiRequest(`/admin/clients${includeInactive ? '?includeInactive=true' : ''}`);
}

export async function fetchProjects(clientIds?: number[], includeInactive: boolean = false): Promise<Array<{ id: number; name: string; clientId: number; clientName: string }>> {
    const params = new URLSearchParams();
    if (clientIds?.length) params.set('clientIds', clientIds.join(','));
    if (includeInactive) params.set('includeInactive', 'true');

    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiRequest(`/admin/projects${qs}`);
}

export async function fetchCollaborators(includeInactive: boolean = false): Promise<Array<{ id: number; name: string; email: string; role: string }>> {
    return apiRequest(`/admin/collaborators${includeInactive ? '?includeInactive=true' : ''}`);
}

export async function fetchTasks(projectIds?: number[]): Promise<Array<{ id: string; name: string; projectId: number }>> {
    const qs = projectIds?.length ? `?projectIds=${projectIds.join(',')}` : '';
    return apiRequest(`/admin/tasks${qs}`);
}

export async function fetchReportPreview(filters: PreviewFilters): Promise<ReportPreviewResponse> {
    const params = new URLSearchParams();
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.clientIds?.length) params.set('clientIds', filters.clientIds.join(','));
    if (filters.projectIds?.length) params.set('projectIds', filters.projectIds.join(','));
    if (filters.collaboratorIds?.length) params.set('collaboratorIds', filters.collaboratorIds.join(','));
    if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));

    return apiRequest(`/admin/report/preview?${params.toString()}`);
}

export async function upsertProjectCost(id_projeto: number, budget: number | null): Promise<void> {
    await apiRequest('/admin/report/project-budgets', {
        method: 'PUT',
        body: JSON.stringify({ budgets: [{ id_projeto, budget }] }),
    });
}

export async function exportReportExcel(filters: PreviewFilters): Promise<{ blob: Blob, filename: string }> {
    const params = new URLSearchParams();
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.clientIds?.length) params.set('clientIds', filters.clientIds.join(','));
    if (filters.projectIds?.length) params.set('projectIds', filters.projectIds.join(','));
    if (filters.collaboratorIds?.length) params.set('collaboratorIds', filters.collaboratorIds.join(','));
    if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));
    if (filters.includeCost) params.set('includeCost', 'true');
    if (filters.includeHours) params.set('includeHours', 'true');
    if (filters.includeStatus) params.set('includeStatus', 'true');

    return apiDownload(`/admin/report/excel?${params.toString()}`);
}

export async function exportReportPowerBI(filters: PreviewFilters): Promise<{ blob: Blob, filename: string }> {
    const params = new URLSearchParams();
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.clientIds?.length) params.set('clientIds', filters.clientIds.join(','));
    if (filters.projectIds?.length) params.set('projectIds', filters.projectIds.join(','));
    if (filters.collaboratorIds?.length) params.set('collaboratorIds', filters.collaboratorIds.join(','));
    if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));

    return apiDownload(`/admin/report/powerbi?${params.toString()}`);
}

export async function syncExcel(file: File): Promise<{ message: string; details: any }> {
    const formData = new FormData();
    formData.append('file', file);

    const baseUrl = await (await import('./apiClient')).getApiBaseUrl();
    const token = localStorage.getItem('nic_labs_auth_token');

    const res = await fetch(`${baseUrl}/sync/excel`, {
        method: 'POST',
        headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            'ngrok-skip-browser-warning': 'true',
        },
        body: formData
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Sync ${res.status}: ${text || res.statusText}`);
    }

    const result = await res.json();
    return result.success ? result.data : result;
}

export async function exportDatabaseExcel(): Promise<{ blob: Blob, filename: string }> {
    return apiDownload('/sync/export-database');
}
