// utils/towerConfig.ts

export interface Level {
    id: string;
    name: string;
}

export interface Specialization {
    id: string;
    name: string;
}

export interface Tower {
    id: string;
    name: string;
    description: string;
    specializations: Specialization[];
}

export interface TowerGroup {
    id: string;
    name: string;
    towers: Tower[];
}

export interface CargoConfig {
    id: string;
    name: string;
    availableLevels: string[]; // IDs of levels
    availableTowerGroups: string[]; // IDs of tower groups
}

export const LEVELS: Level[] = [
    { id: 'estagiario', name: 'Estagiário' },
    { id: 'trainee', name: 'Trainee' },
    { id: 'junior', name: 'Júnior' },
    { id: 'pleno', name: 'Pleno' },
    { id: 'senior', name: 'Sênior' },
    { id: 'especialista', name: 'Especialista' },
    { id: 'coordenador', name: 'Coordenador' },
    { id: 'gerente', name: 'Gerente' },
    { id: 'head', name: 'Head / Gestor' },
    { id: 'diretor', name: 'Diretor' },
    { id: 'ceo', name: 'CEO' },
];

export const TOWER_GROUPS: TowerGroup[] = [
    {
        id: 'dev_sap',
        name: 'Desenvolvimento SAP',
        towers: [
            {
                id: 'abap',
                name: 'ABAP',
                description: 'Especialistas em Backend SAP e linguagem proprietária ABAP.',
                specializations: [
                    { id: 'abap_standard', name: 'ABAP Standard' },
                    { id: 'abap_hana', name: 'ABAP on HANA' },
                    { id: 'abap_rap_cap', name: 'ABAP RAP/CAP' }
                ]
            },
            {
                id: 'fiori',
                name: 'Fiori / UI5',
                description: 'Desenvolvimento de interfaces modernas para o ecossistema SAP.',
                specializations: [
                    { id: 'ui5_dev', name: 'UI5 Development' },
                    { id: 'fiori_elements', name: 'Fiori Elements' }
                ]
            }
        ]
    },
    {
        id: 'dev_web',
        name: 'Desenvolvimento Web',
        towers: [
            {
                id: 'fullstack',
                name: 'FullStack',
                description: 'Desenvolvedores que atuam tanto no Frontend quanto no Backend.',
                specializations: [
                    { id: 'react_node', name: 'React + Node.js' },
                    { id: 'typescript', name: 'TypeScript / Next.js' }
                ]
            }
        ]
    },
    {
        id: 'funcional_sap',
        name: 'Funcional SAP (Módulos)',
        towers: [
            {
                id: 'func_logistica',
                name: 'Logística',
                description: 'Consultores focados em processos de cadeia de suprimentos e vendas.',
                specializations: [
                    { id: 'sd', name: 'SAP SD (Sales)' },
                    { id: 'mm', name: 'SAP MM (Materials)' },
                    { id: 'pp', name: 'SAP PP (Production)' }
                ]
            },
            {
                id: 'func_financas',
                name: 'Finanças',
                description: 'Consultores focados em controladoria e processos financeiros.',
                specializations: [
                    { id: 'fi', name: 'SAP FI (Finance)' },
                    { id: 'co', name: 'SAP CO (Controlling)' }
                ]
            }
        ]
    },
    {
        id: 'infra_basis',
        name: 'Infraestrutura & Basis',
        towers: [
            {
                id: 'basis',
                name: 'SAP Basis',
                description: 'Administração, instalação e manutenção de ambientes SAP.',
                specializations: [
                    { id: 'basis_admin', name: 'Basis Administration' },
                    { id: 'hana_db', name: 'HANA Database Admin' }
                ]
            },
            {
                id: 'cloud_devops',
                name: 'Cloud & DevOps',
                description: 'Gestão de infraestrutura em nuvem e automação de processos.',
                specializations: [
                    { id: 'azure', name: 'Azure Cloud' },
                    { id: 'aws', name: 'AWS Cloud' }
                ]
            }
        ]
    },
    {
        id: 'gestao_projetos',
        name: 'Gestão de Projetos',
        towers: [
            {
                id: 'pmo',
                name: 'PMO / Projetos',
                description: 'Planejamento, controle e governança de projetos corporativos.',
                specializations: [
                    { id: 'pmo_agile', name: 'Gestão Ágil (Scrum/Kanban)' },
                    { id: 'pmo_trad', name: 'Gestão Tradicional (Waterfall)' }
                ]
            },
            {
                id: 'delivery',
                name: 'Delivery Management',
                description: 'Foco na qualidade e entrega contínua de soluções aos clientes.',
                specializations: [
                    { id: 'service_delivery', name: 'Service Delivery' }
                ]
            }
        ]
    },
    {
        id: 'corporativo',
        name: 'Corporativo',
        towers: [
            {
                id: 'rh_gente',
                name: 'RH / Gente & Cultura',
                description: 'Gestão do capital humano, talentos e cultura organizacional.',
                specializations: [
                    { id: 'rh_recrutamento', name: 'Recrutamento & Seleção' },
                    { id: 'rh_dp', name: 'Departamento Pessoal' }
                ]
            },
            {
                id: 'financeiro',
                name: 'Financeiro / Administrativo',
                description: 'Gestão fiscal, contábil e administrativa da empresa.',
                specializations: [
                    { id: 'fin_billing', name: 'Faturamento & Cobrança' },
                    { id: 'fin_adm', name: 'Administrativo Interno' }
                ]
            }
        ]
    }
];

export const CARGOS: CargoConfig[] = [
    {
        id: 'Desenvolvedor',
        name: 'Desenvolvedor',
        availableLevels: ['estagiario', 'trainee', 'junior', 'pleno', 'senior', 'especialista'],
        availableTowerGroups: ['dev_sap', 'dev_web']
    },
    {
        id: 'Gestor',
        name: 'Gestor',
        availableLevels: ['gerente', 'head'],
        availableTowerGroups: ['gestao_projetos', 'corporativo']
    },
    {
        id: 'Diretor',
        name: 'Diretor',
        availableLevels: ['diretor', 'ceo'],
        availableTowerGroups: ['gestao_projetos', 'corporativo']
    },
    {
        id: 'Administrativo',
        name: 'Administrativo',
        availableLevels: ['junior', 'pleno', 'senior'],
        availableTowerGroups: ['corporativo']
    }
];

export const SPECIAL_TOWERS = {
    NA: { id: 'N/A', name: 'Não participa do fluxo (N/A)', description: 'O colaborador não será monitorado em dashboards de capacidade ou alocado em tarefas.' }
};

export function getLevelsForCargo(cargoId: string): Level[] {
    const cargo = CARGOS.find(c => c.id === cargoId);
    if (!cargo) return [];
    return LEVELS.filter(l => cargo.availableLevels.includes(l.id));
}

export function getTowerGroupsForCargo(cargoId: string): TowerGroup[] {
    const cargo = CARGOS.find(c => c.id === cargoId);
    if (!cargo) return [];
    return TOWER_GROUPS.filter(g => cargo.availableTowerGroups.includes(g.id));
}

export function findTowerById(towerId: string): Tower | undefined {
    for (const group of TOWER_GROUPS) {
        const tower = group.towers.find(t => t.id === towerId);
        if (tower) return tower;
    }
    return undefined;
}
