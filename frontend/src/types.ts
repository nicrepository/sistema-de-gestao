// types.ts
// Interface ORIGINAL do front-end - NÃO ALTERAR

export type Status = 'Todo' | 'In Progress' | 'Testing' | 'Review' | 'Done';

export type Role = 'admin' | 'administrador' | 'developer' | 'gestor' | 'gestao' | 'gestão' | 'diretoria' | 'diretoria_geral' | 'pmo' | 'rh' | 'financeiro' | 'financial' | 'tech_lead' | 'consultor' | 'system_admin' | 'executive' | 'resource' | 'ceo' | 'gerente' | 'coordenador';

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export type Impact = 'Low' | 'Medium' | 'High';

export interface Organization {
  id: string;
  name: string;
  logo_url?: string | null;
  theme_primary?: string | null;
  theme_secondary?: string | null;
  theme_accent?: string | null;
  theme_mode?: 'dark' | 'light' | null;
  theme_overrides?: any | null;
  slug?: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  cargo?: string; // Campo adicional do banco
  active?: boolean;
  torre?: string; // Torre de atuação
  hourlyCost?: number; // Custo hora
  nivel?: string; // Nível de experiência
  dailyAvailableHours?: number; // Horas liberadas dia
  monthlyAvailableHours?: number; // Horas liberadas mês
  atrasado?: boolean; // Indica se possui atrasos
  fora_do_fluxo?: boolean; // Ocultar do fluxo principal
}

export interface Client {
  id: string;
  name: string;
  logoUrl: string;
  active?: boolean;
  Criado?: string;
  Contrato?: string; // Manter para compatibilidade legada se necessário
  pais?: string;
  contato_principal?: string;
  cnpj?: string;
  telefone?: string;
  tipo_cliente?: 'parceiro' | 'cliente_final';
  partner_id?: string;
  responsavel_interno_id?: string;
  responsavel_externo?: string;
  email_contato?: string;
  doc_nic_ativo?: boolean;

  // Novos Campos
  razao_social?: string;
  segmento?: string;
  email_financeiro?: string;
  responsavel_tecnico?: string;
  data_inicio_contrato?: string;
  data_fim_contrato?: string;
  endereco_rua?: string;
  endereco_numero?: string;
  endereco_complemento?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_estado?: string;
  endereco_cep?: string;
  contato_celular?: string;
  contato_whatsapp?: string;
  contato_cargo?: string;
  contato_nome_1?: string;
  contato_email_1?: string;
  contato_nome_2?: string;
  contato_email_2?: string;
  contato_celular_2?: string;
  contato_cargo_2?: string;
}

export interface Project {
  id: string;
  name: string;
  clientId: string; // Cliente Final
  partnerId?: string; // Parceiro Nic-Labs
  description?: string; // Escopo resumido
  managerClient?: string; // Gerente do projeto pelo cliente
  responsibleNicLabsId?: string; // Responsável Nic-Labs (ID do Colaborador)
  startDate?: string; // Data início prevista
  estimatedDelivery?: string; // Data fim prevista
  startDateReal?: string;
  endDateReal?: string;
  budget?: number;
  status?: string;
  active?: boolean;
  manager?: string;
  valor_total_rs?: number;
  risks?: string;
  successFactor?: string; // Fator de sucesso
  criticalDate?: string; // Data crítica
  docLink?: string;
  gapsIssues?: string;
  importantConsiderations?: string;
  weeklyStatusReport?: string;
  horas_vendidas?: number;
  complexidade?: 'Alta' | 'Média' | 'Baixa';
  torre?: string;
  project_type?: 'planned' | 'continuous';
  valor_diario?: number;
  fora_do_fluxo?: boolean;
  projectManagerId?: string;
  responsibleUserId?: string;
}

export interface Task {
  id: string;
  externalId?: string;
  title: string;
  projectId: string;
  projectName?: string; // NOVO: Nome do projeto para facilitar exibição
  clientId: string;
  clientName?: string; // NOVO: Nome do cliente para facilitar exibição
  status: Status;
  estimatedDelivery: string;
  progress: number;
  description?: string;
  attachment?: string;
  developer?: string; // NOME do desenvolvedor (string)
  developerId?: string; // ID do desenvolvedor para JOIN com User
  notes?: string;
  scheduledStart?: string;
  actualStart?: string;
  actualDelivery?: string;
  priority?: Priority;
  impact?: Impact;
  risks?: string;
  daysOverdue?: number;
  em_testes?: boolean;
  link_ef?: string;
  id_tarefa_novo?: number;
  collaboratorIds?: string[]; // IDs dos colaboradores vinculados
  estimatedHours?: number; // Horas previstas para execução
  allocatedHours?: number; // Horas alocadas para o colaborador (mapa de capacidade)
  is_impediment?: boolean; // Flag de impedimento
  task_weight?: number; // Peso percentual da tarefa no projeto
  deleted_at?: string;
  fora_do_fluxo?: boolean;
}

export interface TaskMemberAllocation {
  id?: string;
  taskId: string;
  userId: string;
  reservedHours: number;
}

export interface TimesheetEntry {
  id: string;
  userId: string;
  userName: string;
  clientId: string;
  projectId: string;
  taskId: string;
  date: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  description?: string;
  lunchDeduction?: boolean;
  deleted_at?: string;
}

export type View =
  | 'login'
  | 'admin'
  | 'kanban'
  | 'task-detail'
  | 'task-create'
  | 'project-create'
  | 'user-tasks'
  | 'developer-projects'
  | 'client-create'
  | 'client-details'
  | 'project-detail'
  | 'team-list'
  | 'team-member-detail'
  | 'user-form'
  | 'user-profile'
  | 'timesheet-calendar'
  | 'timesheet-form'
  | 'timesheet-admin-dashboard'
  | 'timesheet-admin-detail';

export interface Absence {
  id: string;
  userId: string;
  type: 'férias' | 'atestado' | 'day-off' | 'feriado_local';
  startDate: string;
  endDate: string;
  status: 'sugestao' | 'aprovada_gestao' | 'aprovada_rh' | 'finalizada_dp' | 'cancelado' | 'rejeitado';
  observations?: string;
  period?: 'integral' | 'manha' | 'tarde' | 'noite';
  endTime?: string;
  hours?: number; // NOVO: Horas de ausência (especialmente p/ atestado)
  createdAt?: string;
}

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  created_at?: string;
  user_id: string; // Pode ser number no banco, mas string no front facilita join com users auth
  user_role: string;
  action: string;
  resource: string;
  resource_id: string; // ou number
  changes: any; // JSONB
  old_data?: any;
  new_data?: any;
  ip_address?: string;
  user_agent?: string;
  user_name?: string; // Campo calculado no front (join)
  avatar_url?: string;
  client_id?: string | number;
  project_id?: string | number;
  task_id?: string | number;
  client_name?: string;
  project_name?: string;
  task_name?: string;
  client_logo?: string;
}

export interface ProjectMember {
  id_pc: number;
  id_projeto: number;
  id_colaborador: number;
  allocation_percentage?: number | string;
  start_date?: string;
  end_date?: string;
  role_in_project?: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  endDate?: string;
  type: 'nacional' | 'corporativo' | 'local';
  observations?: string;
  period?: 'integral' | 'manha' | 'tarde' | 'noite';
  endTime?: string;
  hours?: number; // NOVO: Horas de folga (ex: ponto facultativo meio período)
}
