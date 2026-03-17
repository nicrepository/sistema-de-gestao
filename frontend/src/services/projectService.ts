// services/projectService.ts
// CRUD de Projetos via Backend Express

import { Project } from '@/types';
import { apiRequest } from './apiClient';

const clean = (val: any) => (typeof val === 'string' && val.trim() === '') ? null : val;
const safeNum = (val: any) => {
  if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
};

// ===========================
// CREATE
// ===========================
export async function createProject(data: Partial<Project>): Promise<number> {
  const payload = {
    NomeProjeto: data.name || "(Sem nome)",
    ID_Cliente: safeNum(data.clientId),
    StatusProjeto: data.status || "Em andamento",
    ativo: true,
    budget: clean(data.budget),
    description: clean(data.description),
    estimatedDelivery: clean(data.estimatedDelivery),
    startDate: clean(data.startDate),
    valor_total_rs: clean(data.valor_total_rs),
    partner_id: safeNum(data.partnerId),
    manager_client: clean(data.managerClient),
    responsible_nic_labs_id: safeNum(data.responsibleNicLabsId),
    start_date_real: clean(data.startDateReal),
    end_date_real: clean(data.endDateReal),
    risks: clean(data.risks),
    success_factor: clean(data.successFactor),
    critical_date: clean(data.criticalDate),
    doc_link: clean(data.docLink),
    gaps_issues: clean((data as any).gaps_issues || (data as any).gapsIssues),
    important_considerations: clean((data as any).important_considerations || (data as any).importantConsiderations),
    weekly_status_report: clean((data as any).weekly_status_report || (data as any).weeklyStatusReport),
    complexidade: data.complexidade || 'Média',
    horas_vendidas: clean(data.horas_vendidas),
    torre: clean(data.torre),
    project_type: data.project_type || 'continuous',
    valor_diario: clean(data.valor_diario),
    project_manager_id: safeNum(data.projectManagerId),
    responsible_user_id: safeNum(data.responsibleUserId),
  };

  const result = await apiRequest<any>('/projects', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!result || !result.ID_Projeto) {
    throw new Error("Erro ao criar projeto: ID não retornado pelo servidor.");
  }

  return result.ID_Projeto;
}

// ===========================
// UPDATE
// ===========================
export async function updateProject(projectId: string, data: Partial<Project>): Promise<void> {
  const payload: Record<string, any> = {};

  if (data.name !== undefined) payload.NomeProjeto = data.name;
  if (data.clientId !== undefined) payload.ID_Cliente = safeNum(data.clientId);
  if (data.status !== undefined) payload.StatusProjeto = data.status;
  if (data.budget !== undefined) payload.budget = clean(data.budget);
  if (data.description !== undefined) payload.description = clean(data.description);
  if (data.estimatedDelivery !== undefined) payload.estimatedDelivery = clean(data.estimatedDelivery);
  if (data.startDate !== undefined) payload.startDate = clean(data.startDate);
  if (data.valor_total_rs !== undefined) payload.valor_total_rs = clean(data.valor_total_rs);
  if (data.partnerId !== undefined) payload.partner_id = safeNum(data.partnerId);
  if (data.managerClient !== undefined) payload.manager_client = clean(data.managerClient);
  if (data.responsibleNicLabsId !== undefined) payload.responsible_nic_labs_id = safeNum(data.responsibleNicLabsId);
  if (data.startDateReal !== undefined) payload.start_date_real = clean(data.startDateReal);
  if (data.endDateReal !== undefined) payload.end_date_real = clean(data.endDateReal);
  if (data.risks !== undefined) payload.risks = clean(data.risks);
  if (data.successFactor !== undefined) payload.success_factor = clean(data.successFactor);
  if (data.criticalDate !== undefined) payload.critical_date = clean(data.criticalDate);
  if (data.docLink !== undefined) payload.doc_link = clean(data.docLink);

  const gaps = (data as any).gaps_issues !== undefined ? (data as any).gaps_issues : (data as any).gapsIssues;
  if (gaps !== undefined) payload.gaps_issues = clean(gaps);

  const considerations = (data as any).important_considerations !== undefined ? (data as any).important_considerations : (data as any).importantConsiderations;
  if (considerations !== undefined) payload.important_considerations = clean(considerations);

  const report = (data as any).weekly_status_report !== undefined ? (data as any).weekly_status_report : (data as any).weeklyStatusReport;
  if (report !== undefined) payload.weekly_status_report = clean(report);

  if (data.complexidade !== undefined) payload.complexidade = data.complexidade;
  if (data.horas_vendidas !== undefined) payload.horas_vendidas = clean(data.horas_vendidas);
  if (data.torre !== undefined) payload.torre = clean(data.torre);
  if (data.project_type !== undefined) payload.project_type = data.project_type;
  if ((data as any).valor_diario !== undefined) payload.valor_diario = clean((data as any).valor_diario);
  if (data.projectManagerId !== undefined) payload.project_manager_id = safeNum(data.projectManagerId);
  if (data.responsibleUserId !== undefined) payload.responsible_user_id = safeNum(data.responsibleUserId);

  await apiRequest(`/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

// ===========================
// DELETE (Soft Delete ou Hard Delete baseado no parâmetro force)
// ===========================
export async function deleteProject(projectId: string, force: boolean = false): Promise<void> {
  const query = force ? '?force=true' : '';
  await apiRequest(`/projects/${projectId}${query}`, {
    method: 'DELETE'
  });
}

// ===========================
// DELETE (Hard Delete - remove do banco)
// ===========================
export async function hardDeleteProject(projectId: string): Promise<void> {
  await apiRequest(`/projects/${projectId}?force=true`, {
    method: 'DELETE'
  });
}
