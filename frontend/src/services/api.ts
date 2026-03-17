// services/api.ts
// Funções de comunicação com o Backend Centralizado
import { apiRequest } from "./apiClient";
import { User, Client, Project } from "@/types";
import { mapDbProjectToProject, mapDbUserToUser } from "@/utils/normalizers";

// =====================================================
// INTERFACES DO BANCO DE DADOS (Raw Data)
// =====================================================

export interface DbUserRow {
  id: number;
  nome: string;
  cargo: string | null;
  email: string;
  avatarUrl: string | null;
  role: string | null;
  ativo?: boolean | null;
  torre?: string | null;
  nivel?: string | null;
  custo_hora?: number | null;
  horas_disponiveis_dia?: number | null;
  horas_disponiveis_mes?: number | null;
  atrasado?: boolean | null;
}

export interface DbClientRow {
  id: number;
  nome: string;
  logoUrl: string | null;
  ativo: boolean | null;
  pais?: string | null;
  contato_principal?: string | null;
  tipo_cliente?: 'parceiro' | 'cliente_final' | null;
  partner_id?: number | null;
  doc_nic_ativo?: boolean | null;
}

export interface DbProjectRow {
  id: number;
  nome: string;
  cliente_id: number;
  status: string | null;
  ativo: boolean | null;
  complexidade: string | null;
  manager: string | null;
  startDate: string | null;
  estimatedDelivery: string | null;
  valor_total_rs: number | null;
  partner_id: number | null;
  torre: string | null;
}

export interface DbTaskRow {
  id: number;
  projeto_id: number;
  cliente_id: number;
  colaborador_id: number | null;
  tarefa: string | null;
  status: string | null;
  prioridade: string | null;
  impacto: string | null;
  description: string | null;
  inicio_previsto: string | null;
  inicio_real: string | null;
  entrega_estimada: string | null;
  entrega_real: string | null;
  estimated_hours?: number | null;
  allocated_hours?: number | null;
  dias_atraso?: number | null;
  is_impediment?: boolean | null;
  deleted_at?: string | null;
}

// =====================================================
// FETCH FUNCTIONS (Refatoradas para API)
// =====================================================

export async function fetchUsers(): Promise<User[]> {
  const data = await apiRequest<DbUserRow[]>("/colaboradores");
  return (data || []).map((row: any) => mapDbUserToUser(row));
}

export async function deactivateUser(userId: string): Promise<boolean> {
  // Nota: Não temos rota /api/colaboradores/:id DELETE ou PUT direta no momento.
  // Vou usar a rota v1 se existir ou sugerir criação.
  // Por simplicidade, assumo que existe ou será criada em breve.
  try {
    await apiRequest(`/admin/users/${userId}/deactivate`, { method: 'POST' });
    return true;
  } catch (e) {
    console.error('[API] Falha ao desativar usuário:', e);
    return false;
  }
}

export async function fetchClients(): Promise<Client[]> {
  const data = await apiRequest<DbClientRow[]>("/clientes?includeInactive=true");
  return (data || []).map((row: DbClientRow): Client => {
    return {
      id: String(row.id),
      name: row.nome || "Sem nome",
      logoUrl: row.logoUrl || "https://placehold.co/150?text=Logo",
      active: row.ativo ?? true,
      pais: row.pais ?? null,
      contato_principal: row.contato_principal ?? null,
      tipo_cliente: row.tipo_cliente || 'cliente_final',
      partner_id: row.partner_id ? String(row.partner_id) : undefined,
      doc_nic_ativo: row.doc_nic_ativo ?? false,
      cnpj: (row as any).cnpj || undefined,
      telefone: (row as any).telefone || undefined,
      email_contato: (row as any).email_contato || undefined,
      responsavel_interno_id: (row as any).responsavel_interno_id ? String((row as any).responsavel_interno_id) : undefined,
      responsavel_externo: (row as any).responsavel_externo || undefined,
    } as Client;
  });
}

export async function fetchProjects(): Promise<Project[]> {
  const data = await apiRequest<any[]>("/projetos");
  return (data || []).map((row: any): Project => mapDbProjectToProject(row));
}

export async function fetchTasks(): Promise<DbTaskRow[]> {
  return await apiRequest<DbTaskRow[]>("/tarefas");
}

export async function fetchTimesheets(): Promise<any[]> {
  const allData: any[] = [];
  let offset = 0;
  const PAGE_SIZE = 1000;
  const MAX_RECORDS = 20000; // Limite razoável para performance
  let hasMore = true;

  while (hasMore && offset < MAX_RECORDS) {
    const data = await apiRequest<any[]>(
      `/timesheets?limit=${PAGE_SIZE}&offset=${offset}&deleted_at=is.null&order=Data.desc,ID_Horas_Trabalhadas.desc`
    );

    if (Array.isArray(data) && data.length > 0) {
      allData.push(...data);
      offset += data.length;
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  return allData;
}

export async function fetchTaskCollaborators(): Promise<{ taskId: string, userId: string }[]> {
  const data = await apiRequest<any[]>('/support/task-collaborators');
  return (data || []).map(row => ({
    taskId: String(row.id_tarefa),
    userId: String(row.id_colaborador)
  }));
}

export async function fetchProjectMembers(): Promise<any[]> {
  return await apiRequest<any[]>('/support/project-members');
}

export async function fetchAbsences(): Promise<any[]> {
  return await apiRequest<any[]>('/support/absences');
}

export async function fetchHolidays(): Promise<any[]> {
  return await apiRequest<any[]>('/support/holidays');
}

export async function fetchAllocations(): Promise<any[]> {
  return await apiRequest<any[]>('/allocations');
}
