// frontend/src/constants/roles.ts
// Definição dos roles do sistema (Frontend)

export const USER_ROLES = {
    SYSTEM_ADMIN: 'system_admin',
    ADMIN: 'admin',
    CEO: 'ceo',
    EXECUTIVE: 'executive',
    PMO: 'pmo',
    FINANCIAL: 'financial',
    TECH_LEAD: 'tech_lead',
    RH: 'rh',
    RESOURCE: 'resource'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const ROLE_DISPLAY_NAMES: Record<string, string> = {
    system_admin: 'Administrador do Sistema',
    admin: 'Administrador',
    ceo: 'CEO / Presidência',
    executive: 'Direção / Gestão Executiva',
    pmo: 'Gerente de Projetos / PMO',
    financial: 'Financeiro / Controladoria',
    tech_lead: 'Líder Técnico / Torre',
    rh: 'Recursos Humanos / RH',
    resource: 'Recurso / Consultor'
};

export const ROLE_HIERARCHY: Record<string, number> = {
    system_admin: 6,
    admin: 6,
    ceo: 6,
    executive: 5,
    pmo: 4,
    financial: 4,
    tech_lead: 3,
    rh: 4,
    resource: 1
};

// Roles que podem ver dados financeiros
export const FINANCIAL_ROLES: UserRole[] = [
    USER_ROLES.SYSTEM_ADMIN,
    USER_ROLES.CEO,
    USER_ROLES.EXECUTIVE,
    USER_ROLES.FINANCIAL,
    'admin' as any // Incluindo admin antigo
];

// Todos os roles com privilégios administrativos
export const ALL_ADMIN_ROLES: string[] = [
    'system_admin',
    'admin',
    'administrador',
    'ceo',
    'executive',
    'diretoria',
    'diretoria_geral',
    'pmo',
    'gestor',
    'gestao',
    'gestão',
    'gerente',
    'coordenador',
    'financial',
    'financeiro',
    'tech_lead',
    'manutencao',
    'manutenção',
    'manutencao_do_sistema',
    'rh',
    'pmo_gestor',
];

// Roles que podem editar projetos
export const PROJECT_EDIT_ROLES: string[] = ALL_ADMIN_ROLES;

// Roles que podem gerenciar usuários
export const USER_MANAGEMENT_ROLES: string[] = ALL_ADMIN_ROLES;

// Roles que podem ver os lançamentos (Timesheet) de todos os colaboradores
export const TIMESHEET_VIEW_ALL_ROLES: string[] = ALL_ADMIN_ROLES;
