import React, { useState, useMemo, useEffect, useRef, useTransition, useDeferredValue } from "react";

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDataController } from '../controllers/useDataController';
import { Project, Task, Role, TimesheetEntry, ProjectMember, Client, User, TaskMemberAllocation, Absence } from '../types';
import { Plus, Building2, Search, ArrowDownAZ, Briefcase, LayoutGrid, List, Edit2, CheckSquare, ChevronLeft, ChevronRight, ChevronDown, Filter, Clock, AlertCircle, AlertTriangle, ArrowUp, Trash2, DollarSign, Target, TrendingUp, BarChart, Users, User as UserIcon, Calendar, PieChart, ArrowRight, Layers, FileSpreadsheet, X, HelpCircle, Info, Handshake, ArrowLeft, Mail, Phone, ExternalLink, Activity, Zap, FolderKanban, UserCheck, FileText, FileCheck } from "lucide-react";
import ConfirmationModal from "./ConfirmationModal";
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from "framer-motion";
import * as CapacityUtils from '../utils/capacity';
import { formatDecimalToTime, formatDateBR } from '../utils/normalizers';
import { getProjectStatusByTimeline, getProjectStatusColor } from '../utils/projectStatus';
import CapacityDocumentation from "./CapacityDocumentation";
import WorkingDaysModal from "./WorkingDaysModal";
import { WorkingDayDetail } from '../utils/capacity';

type SortOption = 'recent' | 'alphabetical' | 'creation';

const InfoTooltip: React.FC<{ title: string; content: string; children?: React.ReactNode }> = ({ title, content, children }) => (
  <div className="group/tooltip relative inline-block">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-slate-950/95 text-[10px] text-white rounded-xl opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-[60] shadow-2xl border border-white/10 backdrop-blur-md">
      <div className="flex items-center gap-1.5 mb-1.5 border-b border-white/10 pb-1.5">
        <Info className="w-3 h-3 text-blue-400" />
        <p className="font-black uppercase tracking-widest text-[9px]">{title}</p>
      </div>
      <p className="leading-relaxed font-medium text-slate-300 lowercase first-letter:uppercase">{content}</p>
    </div>
  </div>
);

// --- COMPONENTES AUXILIARES PARA FLUIDEZ ---

const ExecutiveRow = React.memo(({ p, idx, safeClients, users, groupedData, navigate, isIncomplete }: {
  p: Project;
  idx: number;
  safeClients: Client[];
  users: User[];
  groupedData: {
    tasksByProj: Record<string, Task[]>;
    timesByProj: Record<string, TimesheetEntry[]>;
  };
  navigate: (path: string) => void;
  isIncomplete?: boolean;
}) => {
  const client = safeClients.find(c => c.id === p.clientId);
  const partner = safeClients.find(c => c.id === p.partnerId);
  const projectTasks = groupedData.tasksByProj[p.id] || [];
  const pTimesheets = groupedData.timesByProj[p.id] || [];
  const isContinuous = p.project_type === 'continuous';

  const costToday = pTimesheets.reduce((acc: number, e: TimesheetEntry) => {
    const u = users.find((user: User) => user.id === e.userId);
    return acc + (Number(e.totalHours) * (u?.hourlyCost || 0));
  }, 0);

  const progress = CapacityUtils.calculateProjectWeightedProgress(p.id, projectTasks);

  const hoursSold = p.horas_vendidas || 0;
  const hoursReal = pTimesheets.reduce((acc: number, e: TimesheetEntry) => acc + (Number(e.totalHours) || 0), 0);
  const sold = p.valor_total_rs || 0;
  const result = sold - costToday;
  const margin = sold > 0 ? (result / sold * 100) : 0;

  const now = new Date();
  const startP = p.startDate ? new Date(p.startDate) : null;
  const endP = p.estimatedDelivery ? new Date(p.estimatedDelivery) : null;
  let plannedProgress = 0;
  if (startP && endP && startP < endP) {
    if (now > endP) plannedProgress = 100;
    else if (now > startP) {
      const total = endP.getTime() - startP.getTime();
      const elapsed = now.getTime() - startP.getTime();
      plannedProgress = (elapsed / total) * 100;
    }
  }

  const getPlannedStatus = (prog: number, complexity?: string) => {
    const c = (complexity || 'Média') as 'Alta' | 'Média' | 'Baixa';
    if (prog >= 100) return 'Concluído';
    if (prog <= 0) return 'Não Iniciado';
    const thresholds = { 'Alta': [10, 20, 50], 'Média': [10, 20, 55], 'Baixa': [10, 20, 60] };
    const [t1, t2, t3] = thresholds[c];
    if (prog <= t1) return 'Entendimento';
    if (prog <= t2) return 'Análise';
    if (prog <= t3) return 'Arquitetura';
    return 'Desenvolvimento';
  };

  const statusP = getPlannedStatus(plannedProgress, p.complexidade);
  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr === "") return <span className="opacity-10">--/--/--</span>;
    // Divide a string da data para evitar problemas de fuso horário (YYYY-MM-DD)
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const isDelayed = !isContinuous && progress < (plannedProgress - 5);
  const isHourOverrun = !isContinuous && hoursReal > hoursSold && hoursSold > 0;

  const isEven = idx % 2 === 0;
  const rowBg = isEven ? 'var(--surface)' : 'var(--surface-2)';

  return (
    <tr
      onClick={() => navigate(`/admin/projects/${p.id}`)}
      className={`group hover:bg-[var(--surface-hover)] transition-all cursor-pointer relative border-b border-[var(--border)] ${isEven ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)] shadow-inner'}`}
    >
      <td className="p-3 sticky left-0 z-30 shadow-[1px_0_3px_rgba(0,0,0,0.05)] text-center group-hover:bg-[var(--surface-hover)] transition-colors border-r border-white/5" style={{ backgroundColor: rowBg }}>
        <input type="checkbox" onClick={(e) => e.stopPropagation()} className="rounded border-slate-300 text-slate-800 focus:ring-slate-800 opacity-20 group-hover:opacity-100 transition-opacity" />
      </td>
      <td className="p-3 sticky left-10 z-10 font-bold text-[9px] group-hover:bg-[var(--surface-hover)] shadow-[1px_0_5px_rgba(0,0,0,0.05)] uppercase tracking-wider truncate border-r border-white/5" style={{ backgroundColor: rowBg, color: 'var(--muted)' }}>
        {partner?.name || <span className="opacity-25 px-1 bg-white/5 rounded">N/A</span>}
      </td>
      <td className="p-3 sticky left-[150px] z-10 font-black text-[10px] group-hover:bg-[var(--surface-hover)] shadow-[1px_0_5px_rgba(0,0,0,0.05)] truncate border-r border-white/5" style={{ backgroundColor: rowBg, color: 'var(--text)' }}>
        {client?.name || "-"}
      </td>
      <td className="p-3 sticky left-[290px] z-10 group-hover:bg-[var(--surface-hover)] shadow-[2px_0_8px_rgba(0,0,0,0.05)] truncate border-r border-white/5" style={{ backgroundColor: rowBg, color: 'var(--text)' }}>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-black text-xs">{p.name}</span>
            {isContinuous && (
              <span className="bg-amber-500 text-black text-[7px] font-black px-1 rounded flex items-center gap-0.5">
                CONTÍNUO
              </span>
            )}
            {isDelayed && (
              <span className="flex-shrink-0 bg-red-500 text-white text-[7px] font-black px-1 rounded flex items-center gap-0.5 animate-pulse">
                <Clock size={8} /> ATRASO
              </span>
            )}
          </div>
          {isHourOverrun && <span className="text-[7px] font-black text-red-500 uppercase tracking-tighter">Budget Estourado</span>}
        </div>
      </td>
      <td className="p-3 border-r border-white/5 bg-blue-500/[0.02]"><span className="text-[10px] text-blue-400 whitespace-nowrap">{isContinuous ? 'Mensal' : statusP}</span></td>
      <td className="p-3 text-[10px] font-mono bg-blue-500/[0.02]" style={{ color: 'var(--text-2)' }}>{formatDate(p.startDate)}</td>
      <td className="p-3 text-[10px] font-mono font-bold bg-blue-500/[0.02]" style={{ color: 'var(--text)' }}>{isContinuous ? 'N/A' : formatDate(p.estimatedDelivery)}</td>
      <td className="p-3 border-r border-white/5 bg-blue-500/[0.02]">
        <div className="flex items-center gap-1.5 opacity-60">
          <div className="w-12 h-1 bg-[var(--surface-2)] rounded-full overflow-hidden border border-[var(--border)]">
            <div className="h-full bg-blue-400" style={{ width: `${isContinuous ? 100 : plannedProgress}%` }} />
          </div>
          <span className="text-[10px] font-bold" style={{ color: 'var(--text-2)' }}>{isContinuous ? '--' : Math.round(plannedProgress) + '%'}</span>
        </div>
      </td>
      <td className="p-3 bg-emerald-500/[0.02]">
        {(() => {
          const projStatus = getProjectStatusByTimeline(p);
          const colors = getProjectStatusColor(projStatus);
          return (
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border flex items-center gap-1 w-fit ${colors.bg} ${colors.text} ${colors.border}`}>
              <div className={`w-1 h-1 rounded-full ${colors.dot}`} />
              {projStatus}
            </span>
          );
        })()}
      </td>
      <td className="p-3 text-[10px] font-mono bg-emerald-500/[0.02]" style={{ color: 'var(--text-2)' }}>{formatDate(p.startDateReal)}</td>
      <td className="p-3 text-[10px] font-mono bg-emerald-500/[0.02]" style={{ color: 'var(--text-2)' }}>{formatDate(p.endDateReal)}</td>
      <td className="p-3 border-r border-white/5 bg-emerald-500/[0.02]">
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-1 bg-emerald-500/10 rounded-full overflow-hidden border border-emerald-500/20">
            <div className={`h-full ${isDelayed ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }} />
          </div>
          <span className={`text-[10px] font-black ${isDelayed ? 'text-red-500 font-black' : 'text-[var(--text)]'}`}>{Math.round(progress)}%</span>
        </div>
      </td>
      <td className="p-3 border-l border-white/5 text-[11px] font-bold font-mono bg-amber-500/[0.02]" style={{ color: 'var(--text-2)' }}>{isContinuous ? '--' : Math.round(hoursSold) + 'h'}</td>
      <td className={`p-3 border-r border-white/5 text-[11px] font-bold font-mono bg-amber-500/[0.02] ${isHourOverrun ? 'text-red-500 font-black' : 'text-emerald-400'}`}>{Math.round(hoursReal)}h</td>
      <td className="p-3 border-r border-white/5 text-[11px] font-bold font-mono bg-amber-500/[0.02]" style={{ color: 'var(--text)' }}>{isContinuous ? '--' : sold.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td className="p-3 border-r border-white/5 text-[11px] font-bold font-mono bg-amber-500/[0.02]" style={{ color: 'var(--text-2)' }}>{costToday.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td className={`p-3 text-[11px] font-black font-mono border-l bg-amber-500/5 ${result < 0 && !isContinuous ? 'text-red-500' : isContinuous ? 'text-blue-500' : 'text-emerald-500'}`} style={{ borderColor: 'var(--border)' }}>
        {isContinuous ? '--' : result.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </td>
      <td className={`p-3 text-[11px] font-black font-mono bg-amber-500/5 ${margin < 15 && !isContinuous ? 'text-red-500' : isContinuous ? 'text-slate-400' : margin < 30 ? 'text-amber-500' : 'text-emerald-500'}`}>
        {isContinuous ? '--' : Math.round(margin) + '%'}
      </td>
    </tr>
  );
});

const CapacityRow = React.memo<{
  res: any;
  navigate: (path: string) => void;
  selectedCapacityMonth: string;
  users: User[];
  openWorkingDaysBreakdown: (user: User) => void;
}>(({ res, navigate, selectedCapacityMonth, users, openWorkingDaysBreakdown }) => {
  return (
    <tr
      onClick={() => {
        navigate(`/admin/team/${res.id}?tab=details&month=${selectedCapacityMonth}`);
      }}
      className="group cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
    >
      <td className="py-3 px-3 border-b border-r border-[var(--border)]">
        <div className="flex flex-col">
          <span className="text-[12px] font-bold text-[var(--text)] group-hover:text-[var(--primary)] transition-colors line-clamp-1">{res.name}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[8px] font-black text-[var(--muted)] uppercase tracking-tighter opacity-70 leading-none">{res.cargo || 'Sem Cargo'}</span>
            <span className="text-[7px] text-[var(--border)]">•</span>
            <span className="text-[8px] font-black text-[var(--primary)] uppercase tracking-tighter opacity-60 leading-none">{res.torre || 'Geral'}</span>
          </div>
        </div>
      </td>
      <td className="py-3 px-2 text-center border-b border-r border-[var(--border)]">
        <span className={`text-[13px] font-black px-2 py-1 rounded border ${res.load > 100 ? 'bg-red-500/10 text-red-500 border-red-500/20' : res.load > 80 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
          {Math.round(res.load)}%
        </span>
      </td>
      <td className="py-3 px-2 text-center text-[13px] font-bold text-[var(--text)] border-b border-r border-[var(--border)]">
        {formatDecimalToTime(res.performed)}
      </td>
      <td className="py-3 px-2 text-center text-[13px] font-bold text-blue-500 border-b border-r border-[var(--border)]">
        {formatDecimalToTime(res.assigned)}
      </td>
      <td
        className="py-3 px-2 text-center border-b border-r border-[var(--border)] cursor-pointer hover:bg-blue-500/5 transition-all active:scale-95"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          const userObj = users.find((u: User) => String(u.id) === String(res.id));
          if (userObj) openWorkingDaysBreakdown(userObj);
        }}
      >
        <div className="flex flex-col items-center">
          <span className="text-[13px] font-black text-[var(--text)]">
            {formatDecimalToTime(res.capacity)}
          </span>
          {res.absenceTypes && res.absenceTypes.length > 0 && (
            <div className="flex flex-col gap-0 items-center">
              <span className="text-[7px] font-black text-purple-500 uppercase tracking-widest leading-none mt-1">
                {res.absenceTypes.join(' & ')}
              </span>
            </div>
          )}
        </div>
      </td>
      <td
        className="py-3 px-3 text-right font-black border-b border-[var(--border)] cursor-pointer hover:bg-[var(--surface-hover)] transition-all active:scale-95"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          const userObj = users.find((u: User) => String(u.id) === String(res.id));
          if (userObj) openWorkingDaysBreakdown(userObj);
        }}
      >
        <span className={`text-[14px] ${res.available < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
          {formatDecimalToTime(res.available)}
        </span>
      </td>
    </tr>
  );
});

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { clients, projects, tasks, error, loading, users, deleteProject, updateClient, projectMembers, timesheetEntries, holidays, taskMemberAllocations, absences } = useDataController();
  const { currentUser, isAdmin } = useAuth();
  const [sortBy, setSortBy] = useState<SortOption>(() => (localStorage.getItem('admin_clients_sort_by') as SortOption) || 'alphabetical');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'late' | 'ongoing' | 'done'>('all');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCapDoc, setShowCapDoc] = useState(false);
  const [showForaDoFluxo, setShowForaDoFluxo] = useState<boolean>(() => localStorage.getItem('admin_show_fora_do_fluxo') === 'true');

  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [partnerSearchTerm, setPartnerSearchTerm] = useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setShowScrollTop(scrollTop > 400);
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'tasks'>(() => {
    return (localStorage.getItem('admin_clients_view_mode') as 'grid' | 'list' | 'tasks') || 'grid';
  });

  const [partnerViewMode, setPartnerViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('admin_partners_view_mode') as 'grid' | 'list') || 'grid';
  });

  const selectedPartnerId = searchParams.get('partnerId');
  const partnerSubTab = (searchParams.get('sub') as 'clientes' | 'resumo' | 'info') || 'clientes';

  const setSelectedPartnerId = (id: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (id) {
      newParams.set('partnerId', id);
      if (!newParams.has('sub')) newParams.set('sub', 'clientes');
    } else {
      newParams.delete('partnerId');
      newParams.delete('sub');
    }
    setSearchParams(newParams);
  };

  const setPartnerSubTab = (tab: 'clientes' | 'resumo' | 'info') => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sub', tab);
    setSearchParams(newParams);
  };

  const [showPartnerDetailsId, setShowPartnerDetailsId] = useState<string | null>(null);
  const [showClientDetailsId, setShowClientDetailsId] = useState<string | null>(null);

  // Lógica de projeto incompleto (campos obrigatórios ausentes)
  const isProjectIncomplete = (p: Project) => {
    // Agora apenas o nome é estritamente obrigatório para evitar erros de renderização
    return !p.name?.trim();
  };

  const [workingDaysModal, setWorkingDaysModal] = useState<{
    isOpen: boolean;
    title: string;
    details: WorkingDayDetail[];
  }>({
    isOpen: false,
    title: '',
    details: []
  });

  const openWorkingDaysBreakdown = (user: User) => {
    // Pegar o range do mês atual da capacidade
    const [year, month] = selectedCapacityMonth.split('-');
    const firstDay = `${year}-${month}-01`;
    const lastDayDate = new Date(Number(year), Number(month), 0);
    const lastDay = `${year}-${month}-${String(lastDayDate.getDate()).padStart(2, '0')}`;

    // Ausências do colaborador
    const userAbsences = (absences || []).filter(a => String(a.userId) === String(user.id));

    const breakdown = CapacityUtils.getWorkingDaysBreakdown(
      firstDay,
      lastDay,
      holidays || [],
      userAbsences,
      user.dailyAvailableHours || 8
    );

    setWorkingDaysModal({
      isOpen: true,
      title: `CAPACIDADE - ${user.name.toUpperCase()} `,
      details: breakdown
    });
  };

  const toggleViewMode = (mode: 'grid' | 'list' | 'tasks') => {
    setViewMode(mode);
    localStorage.setItem('admin_clients_view_mode', mode);
  };

  const handleSortChange = (option: SortOption) => {
    setSortBy(option);
    localStorage.setItem('admin_clients_sort_by', option);
    setShowSortMenu(false);
  };

  // Data handling moved to useDataController

  // Painel de debug

  // Proteção contra undefined
  const safeClients = clients || [];
  const safeProjects = useMemo(() => {
    let filtered = (projects || []).filter((p: Project) => p.active !== false);
    if (!showForaDoFluxo) {
      filtered = filtered.filter((p: Project) => !p.fora_do_fluxo);
    }
    return filtered;
  }, [projects, showForaDoFluxo]);
  const safeTasks = tasks || [];

  // Realtime handling should be done in useDataController or hooks/useAppData to maintain normalization.
  // Removing local broken realtime logic.

  const activeClients = useMemo(() =>
    safeClients.filter((c: Client) => {
      // Incluir se for cliente final OU se tiver projetos ativos vinculados
      // ID comparison with String() for safety
      const hasProjects = safeProjects.some((p: Project) => String(p.clientId) === String(c.id));
      const isNicLabs = (c.name || '').toLowerCase().includes('nic-labs');
      return c.active !== false && (c.tipo_cliente !== 'parceiro' || hasProjects || isNicLabs);
    }),
    [safeClients, safeProjects]
  );

  // Data handling moved to useDataController
  // Otimização: Pre-calcular mapas de busca para evitar filtros O(n) dentro de loops e sorts
  const { tasksByClient, projectsByClient, recentTaskDateByClient } = useMemo(() => {
    const tbc: Record<string, Task[]> = {};
    const pbc: Record<string, Project[]> = {};
    const rtd: Record<string, number> = {};

    safeTasks.forEach((t: Task) => {
      if (!tbc[t.clientId]) tbc[t.clientId] = [];
      tbc[t.clientId].push(t);

      const d = t.actualStart ? new Date(t.actualStart).getTime() : 0;
      if (d > (rtd[t.clientId] || 0)) rtd[t.clientId] = d;
    });

    safeProjects.forEach((p: Project) => {
      if (!pbc[p.clientId]) pbc[p.clientId] = [];
      pbc[p.clientId].push(p);
    });

    return { tasksByClient: tbc, projectsByClient: pbc, recentTaskDateByClient: rtd };
  }, [safeTasks, safeProjects]);

  // Filtrar e Ordenar clientes
  const filteredSortedClients = useMemo(() => {
    let result = [...activeClients];

    // Aplicar Filtro de Busca Global - Refinado para match de início de palavra e ignorando acentos
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");

      result = result.filter((c: Client) => {
        // 1. Match Nome do Cliente
        const clientName = (c.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        const clientWords = clientName.split(/[\s-]+/);
        if (clientWords.some((word: string) => word.startsWith(term)) || clientName.includes(term)) return true;

        // 2. Match Nome de Projetos do Cliente
        const clientProjects = projectsByClient[c.id] || [];
        const matchesProject = clientProjects.some((p: Project) => {
          const name = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
          return name.includes(term);
        });
        if (matchesProject) return true;

        // 3. Match Nome de Tarefas ou Colaboradores
        const clientTasks = tasksByClient[c.id] || [];
        const matchesTaskOrCollab = clientTasks.some((t: Task) => {
          // Título da tarefa
          const title = (t.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
          if (title.includes(term)) return true;

          // Colaborador (Responsável) - O(1) user lookup suggested but users is small usually
          const dev = users.find((u: User) => u.id === t.developerId);
          const devName = (dev?.name || t.developer || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
          if (devName.includes(term)) return true;

          return false;
        });

        return matchesTaskOrCollab;
      });
    }

    // Aplicar Filtro de Status de Tarefa (Menu Operacional)
    if (taskStatusFilter !== 'all') {
      const ongoingStatuses: Array<Task['status']> = ['Todo', 'Review', 'In Progress', 'Testing'];

      result = result.filter((client: Client) => {
        const clientTasks = tasksByClient[client.id] || [];

        if (taskStatusFilter === 'late') {
          return clientTasks.some((t: Task) => ongoingStatuses.includes(t.status) && (t.daysOverdue ?? 0) > 0);
        }

        if (taskStatusFilter === 'ongoing') {
          return clientTasks.some((t: Task) => ongoingStatuses.includes(t.status));
        }

        if (taskStatusFilter === 'done') {
          const clientProjects = projectsByClient[client.id] || [];
          const hasTasks = clientTasks.length > 0;
          const allTasksDone = hasTasks && clientTasks.every((t: Task) => t.status === 'Done');
          const allProjectsDone = clientProjects.length > 0 && clientProjects.every((p: Project) => p.status === 'Concluído');

          return (hasTasks || clientProjects.length > 0) &&
            (hasTasks ? allTasksDone : true) &&
            (clientProjects.length > 0 ? allProjectsDone : true);
        }
        return true;
      });
    }

    // Aplicar Ordenação
    return result.sort((a: Client, b: Client) => {
      switch (sortBy) {
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        case 'creation':
          return a.id.localeCompare(b.id);
        case 'recent':
        default:
          const dateA = recentTaskDateByClient[a.id] || 0;
          const dateB = recentTaskDateByClient[b.id] || 0;
          return dateB - dateA;
      }
    });
  }, [activeClients, sortBy, taskStatusFilter, tasksByClient, projectsByClient, recentTaskDateByClient, searchTerm, users]);

  // Filtros Executivos (Excel-like)
  const [executiveFilters, setExecutiveFilters] = useState<{
    partner: string[];
    client: string[];
    project: string[];
    startDate: string;
    endDate: string;
  }>({ partner: [], client: [], project: [], startDate: '', endDate: '' });

  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);

  const filteredExecutiveProjects = useMemo(() => {
    return safeProjects.filter((p: Project) => {
      const partnerName = safeClients.find((c: Client) => c.id === p.partnerId)?.name || 'N/A';
      const clientName = safeClients.find((c: Client) => c.id === p.clientId)?.name || '-';

      if (executiveFilters.partner.length > 0 && !executiveFilters.partner.includes(partnerName)) return false;
      if (executiveFilters.client.length > 0 && !executiveFilters.client.includes(clientName)) return false;
      if (executiveFilters.project.length > 0 && !executiveFilters.project.includes(p.name)) return false;

      // Filtro de Data Fim Prevista (P.)
      if (executiveFilters.startDate && p.estimatedDelivery) {
        if (p.estimatedDelivery < executiveFilters.startDate) return false;
      }
      if (executiveFilters.endDate && p.estimatedDelivery) {
        if (p.estimatedDelivery > executiveFilters.endDate) return false;
      }

      return true;
    });
  }, [safeProjects, safeClients, executiveFilters]);

  // Valores únicos para os dropdowns de filtro, considerando filtros já aplicados nas OUTRAS colunas
  const uniqueValues = useMemo(() => {
    const getValuesForFilter = (activeFilter: 'partner' | 'client' | 'project') => {
      const filteredByOthers = safeProjects.filter((p: Project) => {
        const partnerName = safeClients.find((c: Client) => c.id === p.partnerId)?.name || 'N/A';
        const clientName = safeClients.find((c: Client) => c.id === p.clientId)?.name || '-';

        if (activeFilter !== 'partner' && executiveFilters.partner.length > 0 && !executiveFilters.partner.includes(partnerName)) return false;
        if (activeFilter !== 'client' && executiveFilters.client.length > 0 && !executiveFilters.client.includes(clientName)) return false;
        if (activeFilter !== 'project' && executiveFilters.project.length > 0 && !executiveFilters.project.includes(p.name)) return false;

        return true;
      });

      if (activeFilter === 'partner') return Array.from(new Set(filteredByOthers.map((p: Project) => safeClients.find((c: Client) => c.id === p.partnerId)?.name || 'N/A'))).sort();
      if (activeFilter === 'client') return Array.from(new Set(filteredByOthers.map((p: Project) => safeClients.find((c: Client) => c.id === p.clientId)?.name || '-'))).sort();
      return Array.from(new Set(filteredByOthers.map((p: Project) => p.name))).sort();
    };

    return {
      partner: getValuesForFilter('partner'),
      client: getValuesForFilter('client'),
      project: getValuesForFilter('project'),
    };
  }, [safeProjects, safeClients, executiveFilters.partner, executiveFilters.client, executiveFilters.project]);

  const toggleExecutiveFilter = (column: 'partner' | 'client' | 'project', value: string) => {
    setExecutiveFilters(prev => {
      const current = prev[column];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [column]: next };
    });
  };

  // Cálculos Executivos do Portfólio
  const portfolioTimesheets = timesheetEntries || [];

  // Otimização: Agrupar tarefas e timesheets por projeto uma única vez
  const groupedData = useMemo(() => {
    const tasksByProj: Record<string, Task[]> = {};
    const timesByProj: Record<string, typeof portfolioTimesheets> = {};
    const clientToProjects: Record<string, Project[]> = {};
    const userCostMap: Record<string, number> = {};

    users.forEach((u: User) => {
      userCostMap[u.id] = u.hourlyCost || 0;
    });

    safeProjects.forEach((p: Project) => {
      if (!clientToProjects[p.clientId]) clientToProjects[p.clientId] = [];
      clientToProjects[p.clientId].push(p);
    });

    safeTasks.forEach((t: Task) => {
      if (!tasksByProj[t.projectId]) tasksByProj[t.projectId] = [];
      tasksByProj[t.projectId].push(t);
    });

    (portfolioTimesheets || []).forEach((e: TimesheetEntry) => {
      if (!timesByProj[e.projectId]) timesByProj[e.projectId] = [];
      timesByProj[e.projectId].push(e);
    });

    return { tasksByProj, timesByProj, clientToProjects, userCostMap };
  }, [safeTasks, portfolioTimesheets, safeProjects, users]);

  const executiveMetrics = useMemo(() => {
    // Usar PROJETOS FILTRADOS para os cálculos e cards
    const projectsToUse = filteredExecutiveProjects;
    if (!projectsToUse.length) return null;

    // 1. Financeiro Global
    let totalBudgeted = 0;
    let totalCommitted = 0;
    let totalForecastedFinish = 0;

    // 2. Progresso Global (Ponderado por Horas Estimadas)
    let totalPortfolioEstimatedHours = 0;
    let totalPortfolioWeightedProgress = 0;

    projectsToUse.forEach((project: Project) => {
      totalBudgeted += project.valor_total_rs || 0;

      const projectTasks = groupedData.tasksByProj[project.id] || [];
      const pTimesheets = groupedData.timesByProj[project.id] || [];

      // Custo do Projeto - O(n) now
      const projectCost = pTimesheets.reduce((acc: number, entry: TimesheetEntry) => {
        const hourlyCost = groupedData.userCostMap[entry.userId] || 0;
        return acc + (entry.totalHours * hourlyCost);
      }, 0);
      totalCommitted += projectCost;

      // Progresso Real do Projeto
      const projectProgress = CapacityUtils.calculateProjectWeightedProgress(project.id, projectTasks);

      totalPortfolioWeightedProgress += projectProgress;

      // Previsão para terminar
      const remainingHours = projectTasks.reduce((acc: number, t: Task) => acc + ((t.estimatedHours || 0) * (1 - (t.progress || 0) / 100)), 0);
      totalForecastedFinish += (remainingHours * 150);
    });

    const globalProgress = projectsToUse.length > 0
      ? totalPortfolioWeightedProgress / projectsToUse.length
      : 0;

    const totalEstimatedROI = totalBudgeted - (totalCommitted + totalForecastedFinish);
    const averageMargin = totalBudgeted > 0 ? (totalEstimatedROI / totalBudgeted * 100) : 0;

    return {
      totalBudgeted,
      totalCommitted,
      totalEstimatedROI,
      averageMargin,
      globalProgress,
      activeProjectsCount: projectsToUse.filter(p => p.status !== 'Concluído').length,
      delayedTasksCount: (() => {
        const activeProjIds = new Set(projectsToUse.map((p: Project) => p.id));
        return safeTasks.filter((t: Task) =>
          activeProjIds.has(t.projectId) &&
          (t.daysOverdue ?? 0) > 0 &&
          t.status !== 'Done'
        ).length;
      })()
    };
  }, [safeProjects, safeTasks, portfolioTimesheets, users, filteredExecutiveProjects, groupedData]);

  // --- CÁLCULO DE MÉTRICAS DE PARCEIROS ---
  const partnerMetrics = useMemo(() => {
    const managers = safeClients.filter(c => c.tipo_cliente === 'parceiro');

    return managers.map(partner => {
      const partnerClients = safeClients.filter(c => c.partner_id?.split(',').includes(partner.id) && c.active !== false);
      const partnerProjects = safeProjects.filter(p => p.partnerId === partner.id);

      const totalRevenue = partnerProjects.reduce((acc, p) => acc + (p.valor_total_rs || 0), 0);

      const totalHours = (portfolioTimesheets || [])
        .filter(entry => partnerProjects.some(p => p.id === entry.projectId))
        .reduce((acc, entry) => acc + Number(entry.totalHours || 0), 0);

      // Calcular tempo de parceria
      let tenureStr = 'Novo';
      const startDate = partner.Criado ? new Date(partner.Criado) : null;
      if (startDate) {
        const diffTime = Math.abs(new Date().getTime() - startDate.getTime());
        const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
        if (diffMonths === 0) tenureStr = '< 1 mês';
        else if (diffMonths < 12) tenureStr = `${diffMonths} meses`;
        else {
          const years = Math.floor(diffMonths / 12);
          const months = diffMonths % 12;
          tenureStr = months === 0 ? `${years} ano(s)` : `${years}a ${months} m`;
        }
      }

      const partnerTasksCount = safeTasks.filter((t: Task) =>
        partnerProjects.some((p: Project) => p.id === t.projectId)
      ).length;

      const totalProgress = partnerProjects.length > 0
        ? partnerProjects.reduce((acc: number, p: Project) => {
          const pProg = CapacityUtils.calculateProjectWeightedProgress(p.id, safeTasks);
          return acc + pProg;
        }, 0) / partnerProjects.length
        : 0;

      return {
        ...partner,
        clients: partnerClients,
        projectCount: partnerProjects.length,
        taskCount: partnerTasksCount,
        averageProgress: totalProgress,
        totalRevenue,
        totalHours,
        tenure: tenureStr
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [safeClients, safeProjects, portfolioTimesheets]);

  const filteredPartnerMetrics = useMemo(() => {
    if (!partnerSearchTerm.trim()) return partnerMetrics;
    const term = partnerSearchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");

    return partnerMetrics.filter(p => {
      const partnerName = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
      if (partnerName.includes(term)) return true;

      return p.clients.some(c => {
        const clientName = (c.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        return clientName.includes(term);
      });
    });
  }, [partnerMetrics, partnerSearchTerm]);

  // --- CONTROLE DE MÊS DA CAPACIDADE ---
  const [selectedCapacityMonth, setSelectedCapacityMonth] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().slice(0, 7); // YYYY-MM
  });

  const [resourceSearchTerm, setResourceSearchTerm] = useState('');
  const [capacitySortBy, setCapacitySortBy] = useState<'alphabetical' | 'least_occupied' | 'most_occupied'>('alphabetical');
  const deferredCapacityMonth = useDeferredValue(selectedCapacityMonth);

  const resourceMetrics = useMemo(() => {
    if (!users || !portfolioTimesheets) return [];

    // Filtro de "Operacional": Mostra todos, EXCETO quem está explicitamente "Fora do Fluxo" (torre === N/A)
    return users.filter(u => {
      // 1. Deve estar ativo
      if (u.active === false) return false;

      // 2. Remove apenas se estiver explicitamente como 'N/A' (Fora do Fluxo)
      const torre = (u.torre || '').toUpperCase().trim();
      return torre !== 'N/A';
    }).map(u => {
      // 1. Cálculos centralizados no CapacityUtils (Single Source of Truth)
      const capData = CapacityUtils.getUserMonthlyAvailability(u, selectedCapacityMonth, safeProjects, projectMembers, timesheetEntries, safeTasks, holidays, taskMemberAllocations, absences, users);

      // 2. Data de Disponibilidade (Preditivo - Baseado em Backlog Total)
      const releaseDate = CapacityUtils.calculateIndividualReleaseDate(u, safeProjects, projectMembers, timesheetEntries, safeTasks, holidays, taskMemberAllocations, absences, users);

      // 3. Tipos de Ausência no mês (Regra: Mostrar se for específico do colaborador)
      const monthStart = `${selectedCapacityMonth}-01`;
      const [year, month] = selectedCapacityMonth.split('-').map(Number);
      const monthEnd = new Date(year, month, 0).toISOString().split('T')[0];

      const userAbsencesInMonth = (absences || []).filter(a => {
        const isUser = String(a.userId) === String(u.id);
        const isApproved = ['aprovada_gestao', 'aprovada_rh', 'finalizada_dp', 'programado'].includes(a.status);
        const start = a.startDate;
        const end = a.endDate || a.startDate;
        const overlaps = start <= monthEnd && end >= monthStart;
        return isUser && isApproved && overlaps;
      });

      const uniqueTypes = Array.from(new Set(userAbsencesInMonth.map(a => a.type.toUpperCase())))
        .filter(type => type !== 'FERIADO' && type !== 'FERIADO_LOCAL'); // Filtra tipos genéricos/feriados se necessário

      return {
        id: u.id,
        name: u.name,
        torre: u.torre,
        cargo: u.cargo,
        capacity: capData.capacity,
        assigned: capData.allocated,
        performed: capData.performed,
        available: capData.available,
        load: capData.occupancyRate,
        releaseDate,
        absenceTypes: uniqueTypes
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [users, portfolioTimesheets, deferredCapacityMonth, safeTasks, safeProjects, projectMembers, timesheetEntries, holidays, taskMemberAllocations, absences]);

  const filteredResourceMetrics = useMemo(() => {
    let result = [...resourceMetrics];
    
    // 1. Filtragem por busca
    if (resourceSearchTerm.trim()) {
      const term = resourceSearchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
      result = result.filter(r =>
        r.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").includes(term) ||
        (r.torre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").includes(term)
      );
    }

    // 2. Ordenação
    return result.sort((a, b) => {
      if (capacitySortBy === 'alphabetical') {
        return a.name.localeCompare(b.name);
      }
      if (capacitySortBy === 'least_occupied') {
        return a.load - b.load;
      }
      if (capacitySortBy === 'most_occupied') {
        return b.load - a.load;
      }
      return 0;
    });
  }, [resourceMetrics, resourceSearchTerm, capacitySortBy]);

  const systemicMetrics = useMemo(() => {
    if (!resourceMetrics || resourceMetrics.length === 0) return null;

    const totalResources = resourceMetrics.length;
    const saturatedResources = resourceMetrics.filter(r => r.releaseDate?.isSaturated).length;
    const saturationRate = (saturatedResources / totalResources) * 100;

    const avgLoad = resourceMetrics.reduce((acc, r) => acc + r.load, 0) / totalResources;

    // Projetos bloqueados: Projetos do tipo 'planned' onde TODOS os membros alocados estão saturados
    const blockedProjects = safeProjects.filter(p => {
      if (p.project_type !== 'planned' || p.active === false) return false;
      const members = projectMembers.filter(pm => String(pm.id_projeto) === String(p.id));
      if (members.length === 0) return false;

      // Verifica se todos os membros deste projeto estão saturados
      return members.every(pm => {
        const res = resourceMetrics.find(r => String(r.id) === String(pm.id_colaborador));
        if (!res) return false; // Se não encontrou o recurso (ex: fora do fluxo), não conta como saturado para bloqueio
        return res.releaseDate?.isSaturated;
      });
    });

    return {
      totalResources,
      saturatedResources,
      saturationRate,
      avgLoad,
      blockedProjectsCount: blockedProjects.length,
      isRiskHigh: saturationRate > 25 || blockedProjects.length > 0
    };
  }, [resourceMetrics, safeProjects, projectMembers]);

  // --- ANÁLISE PROATIVA E TENDÊNCIAS ---
  const teamElasticity = useMemo(() => {
    return CapacityUtils.calculateTeamElasticity(users || [], deferredCapacityMonth, safeProjects, projectMembers, timesheetEntries, safeTasks, holidays, taskMemberAllocations);
  }, [users, deferredCapacityMonth, safeProjects, projectMembers, timesheetEntries, safeTasks, holidays, taskMemberAllocations, absences]);

  const saturationTrend = useMemo(() => {
    return CapacityUtils.calculateTeamSaturationTrend(users || [], safeProjects, projectMembers, safeTasks, timesheetEntries, holidays, taskMemberAllocations);
  }, [users, safeProjects, projectMembers, safeTasks, timesheetEntries, holidays, taskMemberAllocations, absences]);

  const [simulationHours, setSimulationHours] = useState<number>(0);
  const simulationImpact = useMemo(() => {
    if (simulationHours <= 0) return [];
    return CapacityUtils.simulateNewProjectImpact(simulationHours, users || [], safeProjects, projectMembers, safeTasks, timesheetEntries, holidays, taskMemberAllocations);
  }, [simulationHours, users, safeProjects, projectMembers, safeTasks, timesheetEntries, holidays, taskMemberAllocations, absences]);


  const [isPending, startTransition] = useTransition();

  const changeMonth = (delta: number) => {
    const [year, month] = selectedCapacityMonth.split('-').map(Number);
    const newDate = new Date(year, month - 1 + delta, 1);
    const newMonthStr = newDate.toISOString().slice(0, 7);
    startTransition(() => {
      setSelectedCapacityMonth(newMonthStr);
    });
  };


  const activeTab = (searchParams.get('tab') as 'operacional' | 'executivo' | 'capacidade' | 'parceiros') || 'operacional';

  // Efeito para fechar o sidebar quando entra no modo executivo
  useEffect(() => {
    if (activeTab === 'executivo') {
      window.dispatchEvent(new CustomEvent('closeSidebar'));
    }
  }, [activeTab]);

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Scroll automático para a direita no modo executivo
  useEffect(() => {
    if (activeTab === 'executivo' && tableContainerRef.current) {
      const container = tableContainerRef.current;
      // Pequeno delay para garantir que o DOM renderizou as colunas
      setTimeout(() => {
        container.scrollLeft = container.scrollWidth;
      }, 100);
    }
  }, [activeTab]);


  return (
    <div className="h-full flex flex-col p-0 overflow-y-auto custom-scrollbar" style={{ backgroundColor: 'var(--bg)' }}>
      {/* NAVEGAÇÃO DE SUB-MENUS (VERSÃO COMPACTA & FUNCIONAL) */}
      <div className="px-6 py-2 bg-[var(--bg)] sticky top-0 z-50 border-b border-[var(--border)]">
        <div className="flex gap-1 bg-[var(--surface-2)] p-1 rounded-lg border border-[var(--border)] w-fit">
          <button
            onClick={() => setActiveTab('operacional')}
            className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${activeTab === 'operacional'
              ? 'bg-[var(--text)] text-[var(--bg)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'
              }`}
          >
            Operacional
          </button>

          <button
            onClick={() => setActiveTab('parceiros')}
            className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${activeTab === 'parceiros'
              ? 'bg-[var(--text)] text-[var(--bg)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'
              }`}
          >
            Parceiros
          </button>

          <button
            onClick={() => setActiveTab('executivo')}
            className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${activeTab === 'executivo'
              ? 'bg-[var(--text)] text-[var(--bg)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'
              }`}
          >
            Executivo
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('capacidade')}
              className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${activeTab === 'capacidade'
                ? 'bg-[var(--text)] text-[var(--bg)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'
                }`}
            >
              Capacidade
            </button>
            {activeTab === 'capacidade' && (
              <div className="flex items-center ml-1.5 opacity-50">
                <Info size={14} className="text-blue-500" />
              </div>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'executivo' && executiveMetrics && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col min-h-0">
          {/* EXECUTIVE KPIs AND FILTERS CONTROL */}
          <div className="bg-[var(--surface-2)] border-b border-[var(--border)] p-4">
            <div className="max-w-[1600px] mx-auto flex flex-col gap-4">

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-6 flex-1">
                  <div>
                    <InfoTooltip title="Vendido Total" content="Soma dos orçamentos (Valor Total R$) de todos os projetos visíveis no filtro atual.">
                      <div className="text-[9px] font-black uppercase tracking-widest mb-1.5 flex items-center cursor-help border-b border-dotted border-[var(--muted)]/30 w-fit" style={{ color: 'var(--muted)' }}>
                        Vendido Total
                      </div>
                    </InfoTooltip>
                    <p className="text-xl font-black text-[var(--text)] font-mono">{executiveMetrics.totalBudgeted.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</p>
                  </div>
                  <div>
                    <InfoTooltip title="Custo Operacional" content="Soma das horas apontadas multiplicadas pelo custo/hora de cada colaborador alocado.">
                      <div className="text-[9px] font-black uppercase tracking-widest mb-1.5 flex items-center cursor-help border-b border-dotted border-[var(--muted)]/30 w-fit" style={{ color: 'var(--muted)' }}>
                        Custo Real
                      </div>
                    </InfoTooltip>
                    <p className="text-xl font-black text-amber-500 font-mono">{executiveMetrics.totalCommitted.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</p>
                  </div>
                  <div>
                    <InfoTooltip title="ROI (Previsão)" content="Cálculo do saldo previsto: Valor Vendido (-) Custo Realizado (-) Previsão de custo para finalizar tarefas.">
                      <div className="text-[9px] font-black uppercase tracking-widest mb-1.5 flex items-center cursor-help border-b border-dotted border-[var(--muted)]/30 w-fit" style={{ color: 'var(--muted)' }}>
                        Resultado Est.
                      </div>
                    </InfoTooltip>
                    <p className={`text-xl font-black font-mono ${executiveMetrics.totalEstimatedROI < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {executiveMetrics.totalEstimatedROI.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div>
                    <InfoTooltip title="Margem de Lucro" content="Percentual de lucro previsto sobre o valor total vendido.">
                      <div className="text-[9px] font-black uppercase tracking-widest mb-1.5 flex items-center cursor-help border-b border-dotted border-[var(--muted)]/30 w-fit" style={{ color: 'var(--muted)' }}>
                        Margem Est.
                      </div>
                    </InfoTooltip>
                    <p className={`text-xl font-black font-mono ${executiveMetrics.averageMargin < 15 ? 'text-red-500' : executiveMetrics.averageMargin < 30 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {Math.round(executiveMetrics.averageMargin)}%
                    </p>
                  </div>
                  <div>
                    <InfoTooltip title="Progresso do Portfólio" content="Média aritmética simples da evolução real (input manual) dos projetos.">
                      <div className="text-[9px] font-black uppercase tracking-widest mb-1.5 flex items-center cursor-help border-b border-dotted border-[var(--muted)]/30 w-fit" style={{ color: 'var(--muted)' }}>
                        Progresso Médio
                      </div>
                    </InfoTooltip>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-black text-blue-500 font-mono">{Math.round(executiveMetrics.globalProgress)}%</p>
                      <div className="w-12 h-1.5 rounded-full overflow-hidden hidden xl:block" style={{ backgroundColor: 'var(--surface-hover)' }}>
                        <div className="h-full bg-blue-500" style={{ width: `${executiveMetrics.globalProgress}% ` }} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <InfoTooltip title="Saúde do Portfólio" content="Projetos ativos e tarefas com atraso.">
                      <div className="text-[9px] font-black uppercase tracking-widest mb-1.5 flex items-center cursor-help border-b border-dotted border-[var(--muted)]/30 w-fit" style={{ color: 'var(--muted)' }}>
                        Status Operação
                      </div>
                    </InfoTooltip>
                    <p className="text-xl font-black text-[var(--text)]">
                      {executiveMetrics.activeProjectsCount} <span className="text-[10px] text-slate-400 font-bold">Ativos</span>
                      {executiveMetrics.delayedTasksCount > 0 && (
                        <span className="text-red-500 ml-1">/ {executiveMetrics.delayedTasksCount} <span className="text-[10px] font-bold">Atrasos</span></span>
                      )}
                    </p>
                  </div>
                </div>

                {/* CLEAR FILTERS */}
                {(executiveFilters.partner.length > 0 || executiveFilters.client.length > 0 || executiveFilters.project.length > 0 || executiveFilters.startDate || executiveFilters.endDate) && (
                  <button
                    onClick={() => setExecutiveFilters({ partner: [], client: [], project: [], startDate: '', endDate: '' })}
                    className="px-4 py-2 bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 border border-purple-600/20"
                  >
                    <X size={14} /> Limpar Filtros
                  </button>
                )}
              </div>

              {/* DATE FILTERS BAR */}
              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">Prazo Estimado de:</span>
                  <input
                    type="date"
                    value={executiveFilters.startDate}
                    onChange={(e) => setExecutiveFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1 text-xs font-bold text-[var(--text)] outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">até:</span>
                  <input
                    type="date"
                    value={executiveFilters.endDate}
                    onChange={(e) => setExecutiveFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1 text-xs font-bold text-[var(--text)] outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>

                <div className="h-4 w-px bg-[var(--border)] opacity-20" />

                <div className="flex items-center gap-2">
                  <Info className="w-3 h-3 text-[var(--primary)] opacity-50" />
                  <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-tight">Utilize os filtros nos cabeçalhos da tabela para Parceiro e Cliente</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-0 border-t border-[var(--border)] transition-all overflow-hidden flex flex-col flex-1" style={{ backgroundColor: 'var(--surface)' }}>
            <div
              ref={tableContainerRef}
              className="flex-1 overflow-auto custom-scrollbar relative font-sans text-xs"
            >
              <table className="w-full text-left border-collapse min-w-[2000px] table-fixed">
                <thead className="sticky top-0 z-40 bg-[var(--surface-2)]">
                  <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {/* CHECKBOX GMAIL STYLE */}
                    <th className="p-3 sticky left-0 z-50 w-10 bg-[var(--surface-2)] shadow-[2px_0_5px_rgba(0,0,0,0.05)] text-center">
                      <input type="checkbox" className="rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]" />
                    </th>

                    {/* FIXED COLUMNS - REDUCED WIDTHS & CORRECT OFFSETS */}
                    <th className="p-3 sticky left-10 z-50 shadow-[2px_0_10px_rgba(0,0,0,0.1)] w-[110px] bg-[var(--surface-2)] border-r border-white/5">
                      <div className="flex items-center justify-between group cursor-pointer relative" onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'partner' ? null : 'partner'); }}>
                        <span>Parceiro</span>
                        <Filter className={`w-3 h-3 ${executiveFilters.partner.length > 0 ? 'text-[var(--primary)] opacity-100' : 'text-slate-500 opacity-20 group-hover:opacity-100 transition-opacity'}`} />

                        {activeFilterColumn === 'partner' && (
                          <div className="absolute top-full left-0 mt-2 w-48 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl p-2 max-h-60 overflow-y-auto cursor-default" onClick={e => e.stopPropagation()}>
                            {uniqueValues.partner.map(val => (
                              <div key={val} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded-lg cursor-pointer" onClick={() => toggleExecutiveFilter('partner', val)}>
                                <div className={`w-3 h-3 border rounded flex items-center justify-center ${executiveFilters.partner.includes(val) ? 'bg-[var(--primary)] border-[var(--primary)]' : 'border-slate-500'}`}>
                                  {executiveFilters.partner.includes(val) && <div className="w-1.5 h-1.5 bg-white rounded-[1px]" />}
                                </div>
                                <span className="text-xs font-medium truncate text-[var(--text)]">{val}</span>
                              </div>
                            ))}
                            {uniqueValues.partner.length === 0 && <span className="text-xs p-2 opacity-50 block">Sem dados</span>}
                          </div>
                        )}
                      </div>
                    </th>

                    <th className="p-3 sticky left-[150px] z-50 shadow-[2px_0_10px_rgba(0,0,0,0.1)] w-[140px] bg-[var(--surface-2)] border-r border-white/5">
                      <div className="flex items-center justify-between group cursor-pointer relative" onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'client' ? null : 'client'); }}>
                        <span>Cliente</span>
                        <Filter className={`w-3 h-3 ${executiveFilters.client.length > 0 ? 'text-[var(--primary)] opacity-100' : 'text-slate-500 opacity-20 group-hover:opacity-100 transition-opacity'}`} />

                        {activeFilterColumn === 'client' && (
                          <div className="absolute top-full left-0 mt-2 w-48 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl p-2 max-h-60 overflow-y-auto cursor-default" onClick={e => e.stopPropagation()}>
                            {uniqueValues.client.map(val => (
                              <div key={val} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded-lg cursor-pointer" onClick={() => toggleExecutiveFilter('client', val)}>
                                <div className={`w-3 h-3 border rounded flex items-center justify-center ${executiveFilters.client.includes(val) ? 'bg-[var(--primary)] border-[var(--primary)]' : 'border-slate-500'}`}>
                                  {executiveFilters.client.includes(val) && <div className="w-1.5 h-1.5 bg-white rounded-[1px]" />}
                                </div>
                                <span className="text-xs font-medium truncate text-[var(--text)]">{val}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </th>

                    <th className="p-3 sticky left-[290px] z-50 shadow-[4px_0_15px_rgba(0,0,0,0.15)] w-[180px] bg-[var(--surface-2)]">
                      <div className="flex items-center justify-between group cursor-pointer relative" onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'project' ? null : 'project'); }}>
                        <span>Projeto</span>
                        <Filter className={`w-3 h-3 ${executiveFilters.project.length > 0 ? 'text-[var(--primary)] opacity-100' : 'text-slate-500 opacity-20 group-hover:opacity-100 transition-opacity'}`} />

                        {activeFilterColumn === 'project' && (
                          <div className="absolute top-full left-0 mt-2 w-48 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl p-2 max-h-60 overflow-y-auto cursor-default" onClick={e => e.stopPropagation()}>
                            {uniqueValues.project.map(val => (
                              <div key={val} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded-lg cursor-pointer" onClick={() => toggleExecutiveFilter('project', val)}>
                                <div className={`w-3 h-3 border rounded flex items-center justify-center ${executiveFilters.project.includes(val) ? 'bg-[var(--primary)] border-[var(--primary)]' : 'border-slate-500'}`}>
                                  {executiveFilters.project.includes(val) && <div className="w-1.5 h-1.5 bg-white rounded-[1px]" />}
                                </div>
                                <span className="text-xs font-medium truncate text-[var(--text)]">{val}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </th>

                    {/* SCROLLABLE COLUMNS */}
                    {/* SEÇÃO PREVISTO */}
                    <th className="p-3 w-[130px] border-r border-white/10 bg-blue-500/5 text-blue-400">
                      <InfoTooltip title="Status de Planejamento" content="Fase teórica baseada no tempo decorrido do cronograma (Entendimento, Análise, Desenvolv., etc).">
                        <span className="cursor-help border-b border-dotted border-blue-400/30">Status P.</span>
                      </InfoTooltip>
                    </th>
                    <th className="p-3 w-[100px] bg-blue-500/5 text-blue-400">Início P.</th>
                    <th className="p-3 w-[100px] bg-blue-500/5 text-blue-400 text-center">Fim P.</th>
                    <th className="p-3 w-[110px] border-r border-white/10 bg-blue-500/5 text-blue-400">
                      <InfoTooltip title="Evolução Teórica" content="Percentual matemático de onde o projeto deveria estar hoje de acordo com as datas cadastradas.">
                        <span className="cursor-help border-b border-dotted border-blue-400/30">Progresso P.</span>
                      </InfoTooltip>
                    </th>

                    {/* SEÇÃO REAL */}
                    <th className="p-3 w-[110px] bg-emerald-500/5 text-emerald-400">
                      <InfoTooltip title="Status Real" content="Fase atual do projeto baseada no progresso real (Input Manual).">
                        <span className="cursor-help border-b border-dotted border-emerald-400/30">Status R.</span>
                      </InfoTooltip>
                    </th>
                    <th className="p-3 w-[100px] bg-emerald-500/5 text-emerald-400">
                      <InfoTooltip title="Início Real" content="Data de início real do projeto.">
                        <span className="cursor-help border-b border-dotted border-emerald-400/30">Início R.</span>
                      </InfoTooltip>
                    </th>
                    <th className="p-3 w-[100px] bg-emerald-500/5 text-emerald-400">
                      <InfoTooltip title="Fim Real" content="Data de término real do projeto.">
                        <span className="cursor-help border-b border-dotted border-emerald-400/30">Fim R.</span>
                      </InfoTooltip>
                    </th>
                    <th className="p-3 w-[110px] border-r border-white/10 bg-emerald-500/5 text-emerald-400">
                      <InfoTooltip title="Evolução Real" content="Média de progresso das tarefas inseridas pelos colaboradores (Input Manual).">
                        <span className="cursor-help border-b border-dotted border-emerald-400/30">Progresso R.</span>
                      </InfoTooltip>
                    </th>

                    {/* SEÇÃO ANÁLISE */}
                    {/* SEÇÃO TEMPO (NOVAS COLUNAS) */}
                    <th className="p-3 w-[80px] bg-amber-500/5 text-amber-400 font-bold border-l border-white/5">
                      <InfoTooltip title="Horas Planejadas" content="Total de horas previstas para o projeto.">
                        <span className="cursor-help border-b border-dotted border-amber-400/30">Horas P.</span>
                      </InfoTooltip>
                    </th>
                    <th className="p-3 w-[80px] bg-amber-500/5 text-amber-400 font-bold border-r border-white/5">
                      <InfoTooltip title="Horas Reais" content="Total de horas apontadas no projeto até o momento.">
                        <span className="cursor-help border-b border-dotted border-amber-400/30">Horas R.</span>
                      </InfoTooltip>
                    </th>

                    {/* SEÇÃO ANÁLISE (FINANCEIRO) */}
                    <th className="p-3 w-[120px] bg-amber-500/5 text-amber-400">
                      <InfoTooltip title="Valor Vendido" content="Valor total do orçamento do projeto.">
                        <span className="cursor-help border-b border-dotted border-amber-400/30">Vendido</span>
                      </InfoTooltip>
                    </th>
                    <th className="p-3 w-[120px] bg-amber-500/5 text-amber-400">
                      <InfoTooltip title="Custo Operacional" content="Soma das horas apontadas x custo/hora dos colaboradores envolvidos.">
                        <span className="cursor-help border-b border-dotted border-amber-400/30">Custo Real</span>
                      </InfoTooltip>
                    </th>
                    {/* <th className="p-3 w-[140px] bg-amber-500/5 text-amber-400">Custo Proj.</th> */}
                    <th className="p-3 w-[120px] bg-amber-500/5 text-amber-400 font-black">
                      <InfoTooltip title="Resultado Financeiro" content="Saldo atual da operação (Valor Vendido - Custo Apontado até agora).">
                        <span className="cursor-help border-b border-dotted border-amber-400/30">Resultado</span>
                      </InfoTooltip>
                    </th>
                    <th className="p-3 w-[70px] border-l bg-amber-500/5 text-amber-400" style={{ borderColor: 'var(--border)' }}>
                      <InfoTooltip title="Margem Atual" content="Percentual de lucratividade atual da operação.">
                        <span className="cursor-help border-b border-dotted border-amber-400/30">%</span>
                      </InfoTooltip>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {filteredExecutiveProjects.map((p: Project, idx: number) => (
                    <ExecutiveRow
                      key={p.id}
                      p={p}
                      idx={idx}
                      safeClients={safeClients}
                      users={users}
                      groupedData={groupedData}
                      navigate={navigate}
                      isIncomplete={isProjectIncomplete(p)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'capacidade' && resourceMetrics && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
          <div className="p-8 rounded-[40px] border shadow-2xl transition-all relative overflow-hidden" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            
            {/* OVERLAY DE CARREGAMENTO (ESTILO ORGÂNICO) */}
            <AnimatePresence>
              {selectedCapacityMonth !== deferredCapacityMonth && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 backdrop-blur-[2px] bg-[var(--surface)]/40 flex items-center justify-center"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-[var(--primary)]/20 border-t-[var(--primary)] rounded-full animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Atualizando Mapa...</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 flex-1 w-full lg:w-auto">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--text)]">
                      Mapa de Ocupação
                    </h3>
                    <p className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-wider mt-0.5">Visão Mensal de Capacidade</p>
                  </div>
                </div>

                <div className="hidden sm:block h-6 w-px bg-[var(--border)] opacity-30" />

                {/* SELETOR DE MÊS COMPACTO */}
                <div className="flex items-center bg-[var(--surface-2)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm p-0.5">
                  <button
                    onClick={() => changeMonth(-1)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-[var(--surface-hover)] rounded-lg transition-all text-[var(--muted)] hover:text-[var(--text)] active:scale-95"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <div className="relative px-4 min-w-[160px] text-center flex items-center justify-center gap-2 hover:bg-[var(--surface-hover)] rounded-lg transition-all cursor-pointer group/month h-8">
                    <input 
                      type="month" 
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                      value={selectedCapacityMonth}
                      onChange={(e) => startTransition(() => setSelectedCapacityMonth(e.target.value))}
                      onClick={(e) => (e.target as any).showPicker?.()}
                    />
                    <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--text)] font-mono">
                      {new Date(selectedCapacityMonth + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </span>
                    <Calendar className="w-2.5 h-2.5 text-[var(--primary)] opacity-40 group-hover/month:opacity-100 transition-opacity" />
                  </div>

                  <button
                    onClick={() => changeMonth(1)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-[var(--surface-hover)] rounded-lg transition-all text-[var(--muted)] hover:text-[var(--text)] active:scale-95"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full lg:w-auto">
                <div className="relative group min-w-[140px]">
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--text)] hover:border-[var(--primary)]/50 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-1.5">
                      <ArrowDownAZ size={12} className="text-[var(--primary)]" />
                      <span>{capacitySortBy === 'least_occupied' ? 'Menos Ocupado' : capacitySortBy === 'most_occupied' ? 'Mais Ocupado' : 'Alfabético'}</span>
                    </div>
                    <ChevronDown size={12} className={`transition-transform duration-300 ${showSortMenu ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showSortMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute top-full right-0 mt-2 w-48 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden"
                      >
                        {(['alphabetical', 'least_occupied', 'most_occupied'] as const).map(option => (
                          <button
                            key={option}
                            onClick={() => {
                              setCapacitySortBy(option);
                              setShowSortMenu(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-colors ${capacitySortBy === option ? 'bg-[var(--primary)] text-white' : 'text-[var(--text)] hover:bg-[var(--surface-hover)]'}`}
                          >
                            {option === 'least_occupied' ? 'Menos Ocupado' : option === 'most_occupied' ? 'Mais Ocupado' : 'Alfabético'}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="relative flex-1 lg:w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3 h-3" />
                  <input
                    type="text"
                    placeholder="PESQUISAR..."
                    value={resourceSearchTerm}
                    onChange={(e) => setResourceSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-[10px] font-bold text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--primary)]/10 focus:border-[var(--primary)]/50 transition-all placeholder:opacity-30 placeholder:uppercase placeholder:tracking-widest"
                  />
                  {resourceSearchTerm && (
                    <button
                      onClick={() => setResourceSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-red-500 transition-colors p-1"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className={`grid grid-cols-1 xl:grid-cols-2 gap-x-16 transition-all duration-500 ${selectedCapacityMonth !== deferredCapacityMonth ? 'grayscale-[0.5] opacity-40 scale-[0.99] blur-sm' : ''}`}>
              {[0, 1].map(colIdx => {
                const half = Math.ceil(filteredResourceMetrics.length / 2);
                const subset = colIdx === 0 ? filteredResourceMetrics.slice(0, half) : filteredResourceMetrics.slice(half);
                if (subset.length === 0) return null;

                return (
                  <div key={colIdx} className="overflow-hidden mb-6 xl:mb-0">
                    <table className="w-full border-collapse border border-[var(--border)]">
                      <thead>
                        <tr className="bg-[var(--surface-2)]">
                          <th className="py-2.5 px-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted)] text-left border-b border-r border-[var(--border)]">COLABORADOR</th>
                          <th className="py-2.5 px-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted)] text-center border-b border-r border-[var(--border)]">OCUPAÇÃO</th>
                          <th className="py-2.5 px-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted)] text-center border-b border-r border-[var(--border)]">APONTADO</th>
                          <th className="py-2.5 px-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted)] text-center border-b border-r border-[var(--border)]">ALOCADO</th>
                          <th className="py-2.5 px-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted)] text-center border-b border-r border-[var(--border)]">
                            <InfoTooltip title="Carga Meta Mês" content="Total de horas disponíveis do colaborador no mês selecionado, descontando feriados e ausências/férias.">
                              <span className="cursor-help border-b border-dotted border-[var(--muted)]/30">HORAS MÊS</span>
                            </InfoTooltip>
                          </th>
                          <th className="py-2.5 px-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted)] text-right border-b border-[var(--border)]">SALDO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subset.map((res: any) => (
                              <CapacityRow 
                                res={res} 
                                navigate={navigate} 
                                selectedCapacityMonth={selectedCapacityMonth} 
                                users={users} 
                                openWorkingDaysBreakdown={openWorkingDaysBreakdown} 
                              />
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {
        activeTab === 'parceiros' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-8 pb-10 flex flex-col h-full">
            {/* PREMIUM PARTNERS HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-4 border-b border-[var(--border)] mb-8 bg-[var(--surface)]/50 backdrop-blur-sm sticky top-0 z-40 -mx-8 px-8">
              {/* LEFT: PARTNER INFO & BREADCRUMBS */}
              <div className="flex flex-col md:flex-row md:items-center gap-4 lg:gap-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl border-2 flex items-center justify-center bg-white shadow-md relative overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                    {selectedPartnerId && partnerMetrics.find(p => p.id === selectedPartnerId)?.logoUrl ? (
                      <img
                        src={partnerMetrics.find(p => p.id === selectedPartnerId)?.logoUrl}
                        className="w-full h-full object-cover"
                        alt="Logo Parceiro"
                      />
                    ) : (
                      <Handshake className="w-6 h-6 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] opacity-80">Rede de Parceiros</span>
                      <div className="w-1 h-1 rounded-full bg-emerald-500/30" />
                      <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest">
                        {selectedPartnerId ? 'Visão Detalhada' : partnerSearchTerm ? `${partnerMetrics.length} Resultados` : 'Visão Geral'}
                      </span>
                    </div>
                    <h1 className="text-xl lg:text-2xl font-black tracking-tight flex items-center gap-2" style={{ color: 'var(--text)' }}>
                      {selectedPartnerId ? (
                        <button
                          onClick={() => setSelectedPartnerId(null)}
                          className="flex items-center gap-2 hover:text-emerald-500 transition-colors group"
                        >
                          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                          <span className="truncate max-w-[200px] md:max-w-[400px]">
                            {partnerMetrics.find(p => p.id === selectedPartnerId)?.name}
                          </span>
                        </button>
                      ) : partnerViewMode === 'grid' ? (
                        'Ecossistema de Parceiros'
                      ) : (
                        'Portfólio de Canais'
                      )}
                      <InfoTooltip title="Gestão de Canais" content="Gerencie seus parceiros comerciais e acompanhe o sucesso de cada canal de venda no ecossistema." />
                    </h1>
                  </div>
                </div>

                {/* KPI MINI BADGES - PARTNER THEME (EMERALD) */}
                {!selectedPartnerId && (
                  <div className="flex items-center gap-2 p-1.5 bg-[var(--surface-2)]/80 rounded-2xl border border-[var(--border)] shadow-inner">
                    <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-sm hover:shadow-md transition-all group">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-[var(--text)] -mb-0.5">{partnerMetrics.length}</span>
                        <span className="text-[8px] font-black text-[var(--muted)] uppercase tracking-widest opacity-60">Parceiros</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-sm hover:shadow-md transition-all group">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)] group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-[var(--text)] -mb-0.5">{partnerMetrics.reduce((acc: number, p: any) => acc + p.clients.length, 0)}</span>
                        <span className="text-[8px] font-black text-[var(--muted)] uppercase tracking-widest opacity-60">Clientes</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: FILTERS & ACTIONS */}
              <div className="flex flex-wrap items-center gap-3">
                {!selectedPartnerId && (
                  <>
                    <div className="relative group/search flex-1 md:flex-none min-w-[200px]">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] group-focus-within/search:text-emerald-500 transition-colors" />
                      <input
                        type="text"
                        value={partnerSearchTerm}
                        onChange={(e) => setPartnerSearchTerm(e.target.value)}
                        placeholder="Buscar parceiro ou cliente..."
                        className="pl-10 pr-4 py-2.5 w-full md:w-64 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-2xl text-[11px] font-bold text-[var(--text)] outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/40 transition-all placeholder:text-[var(--text-placeholder)] placeholder:opacity-75 shadow-inner"
                      />
                      {partnerSearchTerm && (
                        <button onClick={() => setPartnerSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--surface-3)] rounded-full text-[var(--muted)]">
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-[var(--surface-2)]/80 rounded-2xl border border-[var(--border)] shadow-inner">
                      {(['grid', 'list'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => { setPartnerViewMode(mode); localStorage.setItem('admin_partners_view_mode', mode); }}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${partnerViewMode === mode ? 'bg-[var(--surface)] shadow-md text-emerald-500 border border-[var(--border)]' : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'}`}
                          title={mode === 'grid' ? 'Visão em Cards' : 'Visão em Lista'}
                        >
                          {mode === 'grid' ? <LayoutGrid size={16} /> : <List size={16} />}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => navigate('/admin/clients/new?tipo=parceiro&returnTo=dashboard&sub=parceiros')}
                      className="h-10 px-6 rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all font-black text-[11px] uppercase tracking-[0.1em] bg-[var(--text)] text-[var(--bg)] hover:scale-[1.02] active:scale-[0.98] group"
                    >
                      <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                      <span>Novo Parceiro</span>
                    </button>
                  </>
                )}

                {selectedPartnerId && (
                  <button
                    onClick={() => navigate(`/admin/clients/${selectedPartnerId}/edit?returnTo=dashboard&sub=parceiros`)}
                    className="h-10 px-6 rounded-2xl flex items-center gap-2 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-all font-black text-[11px] uppercase tracking-[0.1em] shadow-sm hover:shadow-emerald-500/10 active:scale-[0.98]"
                  >
                    <Edit2 size={16} />
                    Editar Dados do Canal
                  </button>
                )}
              </div>
            </div>

            {/* CONTEÚDO PARCEIROS */}
            <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
              {selectedPartnerId ? (
                /* VIEW DRILL-DOWN DO PARCEIRO (3 TABS) */
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {(() => {
                    const partner = partnerMetrics.find(p => p.id === selectedPartnerId);
                    if (!partner) return <div className="p-10 text-center">Parceiro não encontrado.</div>;

                    const internalResp = users.find(u => u.id === partner.responsavel_interno_id);

                    return (
                      <div className="space-y-8">
                        {/* SUB-MENU DE NAVEGAÇÃO INTERNA */}
                        <div className="flex border-b border-[var(--border)] gap-8">
                          <button
                            onClick={() => setPartnerSubTab('clientes')}
                            className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${partnerSubTab === 'clientes' ? 'text-emerald-500' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                          >
                            1. Clientes
                            {partnerSubTab === 'clientes' && <motion.div layoutId="partner-tab" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-full" />}
                          </button>
                          <button
                            onClick={() => setPartnerSubTab('resumo')}
                            className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${partnerSubTab === 'resumo' ? 'text-emerald-500' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                          >
                            2. Dados e Resumo
                            {partnerSubTab === 'resumo' && <motion.div layoutId="partner-tab" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-full" />}
                          </button>
                          <button
                            onClick={() => setPartnerSubTab('info')}
                            className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${partnerSubTab === 'info' ? 'text-emerald-500' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                          >
                            3. Informações
                            {partnerSubTab === 'info' && <motion.div layoutId="partner-tab" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-full" />}
                          </button>
                        </div>

                        {/* CONTEÚDO DA SUB-TAB */}
                        <div className="min-h-[400px]">
                          {partnerSubTab === 'clientes' && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 animate-in fade-in duration-300">
                              {partner.clients.map(client => {
                                const clientProjects = safeProjects.filter(p => p.clientId === client.id);
                                return (
                                  <div
                                    key={client.id}
                                    onClick={() => setShowClientDetailsId(client.id)}
                                    className="group relative border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-[220px]"
                                    style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                                  >
                                    <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                                      <img
                                        src={client.logoUrl}
                                        className="max-w-[80%] max-h-[80%] object-contain group-hover:scale-110 transition-transform duration-500"
                                        alt={client.name}
                                        onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name)}&background=f0f9ff&color=0ea5e9`; }}
                                      />
                                    </div>
                                    <div className="shrink-0 px-4 py-4 flex flex-col justify-center text-center bg-[var(--surface-2)]/50 backdrop-blur-sm border-t border-[var(--border)]">
                                      <h4 className="text-[11px] font-black uppercase tracking-tight truncate mb-0.5" style={{ color: 'var(--text)' }}>{client.name}</h4>
                                      <div className="flex items-center justify-center gap-2">
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[8px] font-black uppercase tracking-widest">
                                          {clientProjects.length} {clientProjects.length === 1 ? 'PROJETO' : 'PROJETOS'}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              <button
                                onClick={() => setIsAddClientModalOpen(true)}
                                className="border-2 border-dashed border-[var(--border)] rounded-2xl flex flex-col items-center justify-center p-6 text-[var(--muted)] hover:text-emerald-500 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group h-[220px]"
                              >
                                <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                  <Plus className="w-5 h-5 opacity-50 group-hover:opacity-100" />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-widest">Vincular Cliente</span>
                              </button>
                            </div>
                          )}

                          {
                            partnerSubTab === 'resumo' && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in duration-300">
                                {/* Coluna de Métricas */}
                                <div className="md:col-span-2 space-y-6">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="p-6 rounded-[2.5rem] border bg-emerald-500/10 border-emerald-500/30 group hover:bg-emerald-500/20 transition-all duration-300">
                                      <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] mb-1">Faturamento Total</p>
                                      <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
                                        {partner.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                                      </p>
                                    </div>
                                    <div className="p-6 rounded-[2.5rem] border bg-blue-500/10 border-blue-500/30 group hover:bg-blue-500/20 transition-all duration-300">
                                      <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-1">Carga Horária</p>
                                      <p className="text-2xl font-black text-blue-700 dark:text-blue-300 font-mono">
                                        {Math.round(partner.totalHours)}<span className="text-xs ml-0.5 opacity-50 uppercase">h</span>
                                      </p>
                                    </div>
                                    <div className="p-6 rounded-[2.5rem] border bg-amber-500/10 border-amber-500/30 group hover:bg-amber-500/20 transition-all duration-300">
                                      <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.2em] mb-1">Entregabilidade</p>
                                      <p className="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono">{Math.round(partner.averageProgress)}%</p>
                                    </div>
                                    <div className="p-6 rounded-[2.5rem] border bg-slate-500/10 border-slate-500/30 group hover:bg-slate-500/20 transition-all duration-300">
                                      <p className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em] mb-1">Volume de Tarefas</p>
                                      <p className="text-2xl font-black text-slate-700 dark:text-slate-300 font-mono">{partner.taskCount}</p>
                                    </div>
                                  </div>

                                  <div className="p-8 rounded-[2.5rem] border shadow-sm" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)] mb-6 flex items-center gap-2">
                                      <TrendingUp size={14} className="text-emerald-500" /> Histórico de Performance
                                    </h4>
                                    <div className="h-40 flex items-center justify-center border-2 border-dashed rounded-3xl text-[10px] font-bold uppercase tracking-widest bg-[var(--surface)]/50" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                                      Gráfico de Crescimento (Em breve)
                                    </div>
                                  </div>
                                </div>

                                {/* Coluna de Contato Rápido */}
                                <div className="space-y-6">
                                  <div className="p-6 rounded-[2.5rem] border shadow-sm overflow-hidden relative" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12" />
                                    
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 pb-2 border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-muted)' }}>Gestão do Relacionamento</h4>
                                    <div className="space-y-8 relative z-10">
                                      <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-emerald-500/30">
                                          {internalResp?.name?.charAt(0) || 'N'}
                                        </div>
                                        <div>
                                          <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-0.5">Gestor de Canal</p>
                                          <p className="text-sm font-black text-[var(--textTitle)]">{internalResp?.name || 'Não atribuído'}</p>
                                        </div>
                                      </div>

                                      <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--border-muted)' }}>
                                        <div>
                                          <p className="text-[9px] font-black text-[var(--muted)] uppercase tracking-widest mb-3">Ponto Focal Parceiro</p>
                                          <div className="flex items-center gap-3 mb-3">
                                            <div className="p-2 rounded-lg icon-box" style={{ color: 'var(--text-muted)' }}><UserIcon size={16} /></div>
                                            <p className="text-[13px] font-black text-[var(--textTitle)]">{partner.responsavel_externo || 'Não informado'}</p>
                                          </div>
                                          <div className="flex flex-col gap-2 pl-11">
                                            {partner.email_contato && (
                                              <span className="flex items-center gap-2 text-[11px] font-bold text-blue-600"><Mail size={12} /> {partner.email_contato}</span>
                                            )}
                                            {partner.telefone && (
                                              <span className="flex items-center gap-2 text-[11px] font-bold text-[var(--text-2)]"><Phone size={12} /> {partner.telefone}</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          }

                          {
                            partnerSubTab === 'info' && (
                              <div className="max-w-4xl animate-in fade-in duration-300">
                                <div className="p-10 rounded-[2.5rem] border shadow-sm space-y-10" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                                  <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                      <h4 className="text-xl font-black text-[var(--textTitle)]">Detalhes do Registro</h4>
                                      <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">Informações cadastrais completas do parceiro</p>
                                    </div>
                                    <button
                                      onClick={() => navigate(`/admin/clients/${partner.id}/edit?returnTo=${partner.id}&sub=info`)}
                                      className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                      <Edit2 size={12} /> Editar
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                    <div className="space-y-1.5">
                                      <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Nome do Parceiro</p>
                                      <p className="text-sm font-bold text-[var(--textTitle)] border-b pb-2" style={{ borderColor: 'var(--border-muted)' }}>{partner.name}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                      <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">CNPJ</p>
                                      <p className="text-sm font-mono font-bold text-[var(--textTitle)] border-b pb-2" style={{ borderColor: 'var(--border-muted)' }}>{partner.cnpj || '---'}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                      <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Email Principal</p>
                                      <p className="text-sm font-bold text-[var(--textTitle)] border-b pb-2" style={{ borderColor: 'var(--border-muted)' }}>{partner.email_contato || '---'}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                      <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Telefone</p>
                                      <p className="text-sm font-bold text-[var(--textTitle)] border-b pb-2" style={{ borderColor: 'var(--border-muted)' }}>{partner.telefone || '---'}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                      <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Responsável Externo</p>
                                      <p className="text-sm font-bold text-[var(--textTitle)] border-b pb-2" style={{ borderColor: 'var(--border-muted)' }}>{partner.responsavel_externo || '---'}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                      <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Gestor da Conta (Interno)</p>
                                      <p className="text-sm font-bold text-[var(--textTitle)] border-b pb-2" style={{ borderColor: 'var(--border-muted)' }}>{internalResp?.name || '---'}</p>
                                    </div>
                                  </div>

                                  <div className="pt-6">
                                    <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest mb-4">Identidade Visual</p>
                                    <div className="w-32 h-32 rounded-2xl border-2 border-dashed p-4 flex items-center justify-center" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                                      <img src={partner.logoUrl} className="max-w-full max-h-full object-contain mix-blend-multiply" alt="Logo" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          }
                        </div >
                      </div >
                    );
                  })()}
                </div >
              ) : (
                /* VIEW LISTAGEM GERAL DE PARCEIROS */
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {partnerViewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                      {filteredPartnerMetrics.map(partner => (
                        <div
                          key={partner.id}
                          onClick={() => setSelectedPartnerId(partner.id)}
                          className="group relative border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-[220px]"
                          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                        >
                          <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center p-4 bg-white dark:bg-slate-100/10">
                            <img
                              src={partner.logoUrl}
                              className="max-w-[80%] max-h-[80%] object-contain group-hover:scale-110 transition-transform duration-500"
                              alt={partner.name}
                              onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(partner.name)}&background=ecfdf5&color=059669`; }}
                            />
                          </div>
                          <div className="shrink-0 px-4 py-4 flex flex-col justify-center text-center bg-[var(--surface-2)]/50 backdrop-blur-sm border-t border-[var(--border)]">
                            <h3 className="text-[11px] font-black truncate uppercase tracking-tight mb-0.5" style={{ color: 'var(--text)' }}>{partner.name}</h3>
                            <div className="flex items-center justify-center">
                              <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[8px] font-black uppercase tracking-widest">
                                {partner.clients.length} {partner.clients.length === 1 ? 'CLIENTE' : 'CLIENTES'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredPartnerMetrics.map(partner => (
                        <div
                          key={partner.id}
                          onClick={() => setSelectedPartnerId(partner.id)}
                          className="flex flex-col md:flex-row items-center justify-between p-4 rounded-3xl border group transition-all hover:shadow-xl hover:shadow-emerald-500/5 relative overflow-hidden cursor-pointer gap-4"
                          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                        >
                          <div className="flex items-center gap-6 z-10 w-full">
                            <div className="w-16 h-16 rounded-2xl border flex items-center justify-center overflow-hidden shadow-sm p-1 shrink-0 bg-white dark:bg-slate-100/10" style={{ borderColor: 'var(--border)' }}>
                              <img
                                src={partner.logoUrl}
                                className="max-w-[90%] max-h-[90%] object-contain group-hover:scale-110 transition-transform duration-500"
                                alt={partner.name}
                                onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(partner.name)}&background=ecfdf5&color=059669`; }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm lg:text-base font-black uppercase tracking-tight truncate" style={{ color: 'var(--text)' }}>{partner.name}</h3>
                                {partner.cnpj && <span className="text-[9px] font-mono text-[var(--muted)] opacity-60 bg-[var(--surface-3)] px-1.5 py-0.5 rounded-md">CNPJ: {partner.cnpj}</span>}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                  {partner.clients.length} {partner.clients.length === 1 ? 'Cliente Vinculado' : 'Clientes Vinculados'}
                                </span>
                                {partner.tenure && (
                                  <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest px-2.5 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)]">
                                    {partner.tenure}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button className="h-10 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all flex items-center gap-2 bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500 active:scale-95 group-hover:shadow-lg group-hover:shadow-emerald-500/20">
                            Ver Detalhes
                            <ArrowRight size={14} className="-ml-1 group-hover:ml-0 transition-all" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div >
          </motion.div >
        )
      }

      {
        activeTab === 'operacional' && (
          <div className="px-8 pb-10">
            {/* PREMIUM OPERATIONAL HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-4 border-b border-[var(--border)] mb-8 bg-[var(--surface)]/50 backdrop-blur-sm sticky top-0 z-30 -mx-8 px-8">
              {/* LEFT: STATUS & TITLE */}
              <div className="flex flex-col md:flex-row md:items-center gap-4 lg:gap-8">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-black text-[var(--primary)] uppercase tracking-[0.2em] opacity-80">Gestão Operacional</span>
                    <div className="w-1 h-1 rounded-full bg-[var(--primary)]/30" />
                    <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest">{searchTerm ? `${filteredSortedClients.length} Resultados` : 'Dashboard Geral'}</span>
                  </div>
                  <h1 className="text-xl lg:text-2xl font-black tracking-tight flex items-center gap-2" style={{ color: 'var(--text)' }}>
                    {viewMode === 'grid' ? 'Ecossistema de Clientes' : viewMode === 'list' ? 'Gestão de Clientes' : 'Fluxo de Projetos'}
                    <InfoTooltip title="Visão de Gestão" content="Espaço dedicado ao acompanhamento operacional. Alterne entre as visualizações de Clientes, Projetos ou Tarefas nos ícones à direita." />
                  </h1>
                </div>

                {/* KPI MINI BADGES - PREMIUM STYLE */}
                <div className="flex items-center gap-2 p-1.5 bg-[var(--surface-2)]/80 rounded-2xl border border-[var(--border)] shadow-inner">
                  <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-sm hover:shadow-md transition-all group">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.5)] group-hover:scale-110 transition-transform" />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-[var(--text)] -mb-0.5">{activeClients.length}</span>
                      <span className="text-[8px] font-black text-[var(--muted)] uppercase tracking-widest opacity-60">Clientes</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-sm hover:shadow-md transition-all group">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)] group-hover:scale-110 transition-transform" />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-[var(--text)] -mb-0.5">{safeProjects.length}</span>
                      <span className="text-[8px] font-black text-[var(--muted)] uppercase tracking-widest opacity-60">Projetos</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: FILTERS & ACTIONS */}
              <div className="flex flex-wrap items-center gap-3">
                {/* ADVANCED SEARCH COMPACTA */}
                <div className="relative group/search flex-1 md:flex-none min-w-[180px]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] group-focus-within/search:text-[var(--primary)] transition-colors" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Pesquisar por nome, tag ou status..."
                    className="pl-10 pr-4 py-2.5 w-full md:w-64 lg:w-72 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-2xl text-[11px] font-bold text-[var(--text)] outline-none focus:ring-4 focus:ring-[var(--primary)]/10 focus:border-[var(--primary)]/40 transition-all placeholder:text-[var(--text-placeholder)] placeholder:opacity-75 shadow-inner"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--surface-3)] rounded-full text-[var(--muted)]">
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 p-1 bg-[var(--surface-2)]/80 rounded-2xl border border-[var(--border)] shadow-inner">
                  {/* SORT & FILTER DROPDOWNS */}
                  <div className="flex items-center gap-1">
                    <div className="relative">
                      <button
                        onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false); }}
                        className={`h-9 px-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${showSortMenu ? 'bg-[var(--surface)] shadow-md text-[var(--primary)] border border-[var(--border)]' : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'}`}
                      >
                        <ArrowDownAZ size={14} />
                        <span className="hidden xl:inline">{sortBy === 'recent' ? 'Recentes' : sortBy === 'alphabetical' ? 'A-Z' : 'Criação'}</span>
                      </button>

                      <AnimatePresence>
                        {showSortMenu && (
                          <>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }} 
                              animate={{ opacity: 1, y: 0 }} 
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute right-0 mt-2 w-40 rounded-xl shadow-2xl z-50 p-1.5 border bg-[var(--surface)] border-[var(--border)]"
                            >
                              {(['recent', 'alphabetical', 'creation'] as const).map(option => (
                                <button 
                                  key={option}
                                  onClick={() => handleSortChange(option)} 
                                  className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === option ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted)] hover:bg-[var(--surface-hover)]'}`}
                                >
                                  {option === 'recent' ? 'Recentes' : option === 'alphabetical' ? 'Alfabética' : 'Criação'}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); }}
                        className={`h-9 px-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${showFilterMenu || taskStatusFilter !== 'all' ? 'bg-[var(--surface)] shadow-md text-[var(--primary)] border border-[var(--border)]' : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'}`}
                      >
                        <Filter size={14} />
                        <span className="hidden xl:inline">{taskStatusFilter === 'all' ? 'Status' : taskStatusFilter === 'late' ? 'Atraso' : taskStatusFilter === 'ongoing' ? 'Progresso' : 'Fim'}</span>
                        {taskStatusFilter !== 'all' && <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />}
                      </button>

                      <AnimatePresence>
                        {showFilterMenu && (
                          <>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)} />
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }} 
                              animate={{ opacity: 1, y: 0 }} 
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute right-0 mt-2 w-48 rounded-xl shadow-2xl z-50 p-1.5 border bg-[var(--surface)] border-[var(--border)]"
                            >
                              {[
                                { id: 'all', label: 'Todos', color: 'text-[var(--muted)]' },
                                { id: 'late', label: 'Em Atraso', color: 'text-red-500' },
                                { id: 'ongoing', label: 'Em Andamento', color: 'text-blue-500' },
                                { id: 'done', label: 'Concluídos', color: 'text-emerald-500' }
                              ].map(filter => (
                                <button 
                                  key={filter.id}
                                  onClick={() => { setTaskStatusFilter(filter.id as any); setShowFilterMenu(false); }} 
                                  className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${taskStatusFilter === filter.id ? 'bg-[var(--primary)] text-white' : `${filter.color} hover:bg-[var(--surface-hover)]`}`}
                                >
                                  {filter.label}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="w-px h-5 bg-[var(--border)] mx-1 opacity-50" />

                  {/* VIEW MODE TOGGLE */}
                  <div className="flex items-center gap-1 p-0.5">
                    {(['grid', 'list', 'tasks'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => toggleViewMode(mode)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${viewMode === mode ? 'bg-[var(--surface)] shadow-md text-[var(--primary)] border border-[var(--border)]' : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'}`}
                        title={mode === 'grid' ? 'Visualização em Cards' : mode === 'list' ? 'Visualização em Lista' : 'Visualização de Fluxo'}
                      >
                        {mode === 'grid' && <LayoutGrid size={16} />}
                        {mode === 'list' && <List size={16} />}
                        {mode === 'tasks' && <Layers size={16} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* PRIMARY ACTION BUTTON */}
                <button
                  onClick={() => navigate('/admin/clients/new?tipo=cliente_final')}
                  className="h-10 px-6 rounded-2xl flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all font-black text-[11px] uppercase tracking-[0.1em] bg-[var(--text)] text-[var(--bg)] hover:scale-[1.02] active:scale-[0.98] group"
                >
                  <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                  <span>Novo Cliente</span>
                </button>
              </div>
            </div>



            {/* LISTA DE CLIENTES */}
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--primary)' }}></div>
                  <p className="animate-pulse" style={{ color: 'var(--muted)' }}>Carregando clientes...</p>
                </div>
              </div>
            ) : filteredSortedClients.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center" style={{ color: 'var(--muted)' }}>
                  <Building2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">
                    Nenhum cliente ativo
                  </p>
                  <p className="text-sm">
                    Clique em "Novo Cliente" para começar
                  </p>
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 overflow-y-auto custom-scrollbar"
              >
                {filteredSortedClients.map((client) => {
                  const clientProjects = safeProjects.filter((p) => String(p.clientId) === String(client.id));

                  return (
                    <div
                      key={client.id}
                      className={`group border rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 cursor-pointer flex flex-col h-[220px] relative`}
                      style={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                      }}
                      onClick={() => {
                        navigate(`/admin/clients/${client.id}`);
                      }}
                    >
                      {/* DOC. NIC Indicator */}
                      {client.doc_nic_ativo && (
                        <div className="absolute top-2 right-2 z-30 pointer-events-none">
                          <div className="bg-emerald-600 text-white px-1.5 py-1 rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-emerald-400 flex items-center gap-1 transition-all">
                            <FileCheck size={10} className="stroke-[3]" />
                            <span className="text-[8px] font-black uppercase tracking-tight">DOC NIC</span>
                          </div>
                        </div>
                      )}

                      <div className="w-full flex-1 bg-white dark:bg-white/95 flex items-center justify-center transition-all overflow-hidden border-b border-[var(--border)]">
                        <img
                          src={client.logoUrl}
                          alt={client.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => (e.currentTarget.src = "https://placehold.co/200x200?text=Logo")}
                        />
                      </div>

                      <div className="px-4 py-3 flex flex-col justify-center text-center border-t" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <h2 className="text-[12px] font-black uppercase tracking-tight line-clamp-1 mb-0.5" style={{ color: 'var(--text)' }}>
                          {client.name}
                        </h2>
                        <div className="text-[10px] font-bold opacity-50 uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                          {safeProjects.filter((p) => String(p.clientId) === String(client.id)).length} {safeProjects.filter((p) => String(p.clientId) === String(client.id)).length === 1 ? 'PROJETO' : 'PROJETOS'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* LIST VIEW IMPROVED (USER REQUEST) */
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pb-10"
              >
                {filteredSortedClients.map((client) => {
                  const clientProjects = safeProjects.filter(p => String(p.clientId) === String(client.id));
                  const clientTasks = safeTasks.filter(t => String(t.clientId) === String(client.id));

                  return (
                    <div key={client.id} className="space-y-4">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 rounded-2xl border group transition-all shadow-lg relative overflow-hidden"
                        style={{
                          background: 'var(--header-bg)',
                          borderColor: 'rgba(255,255,255,0.1)',
                          borderWidth: '1px'
                        }}
                      >
                        {/* DOC. NIC Indicator for List View */}
                        {client.doc_nic_ativo && (
                          <div className="absolute top-0 right-10 z-20">
                            <div className="bg-emerald-600 text-white px-2 py-0.5 rounded-b-lg shadow-[0_2px_6px_rgba(0,0,0,0.3)] border-x border-b border-white/20 flex items-center gap-1 transform hover:translate-y-0.5 transition-transform">
                              <FileCheck size={9} className="stroke-[3]" />
                              <span className="text-[7px] font-black uppercase tracking-widest">DOC NIC</span>
                            </div>
                          </div>
                        )}

                        <div
                          className="flex items-center gap-5 cursor-pointer flex-1"
                          onClick={() => {
                            navigate(`/admin/clients/${client.id}`);
                          }}
                        >
                          <div className="w-16 h-16 rounded-xl border flex items-center justify-center shadow-lg bg-white border-white/20 overflow-hidden">
                            <img
                              src={client.logoUrl}
                              alt={client.name}
                              className="w-full h-full object-cover"
                              onError={(e) => (e.currentTarget.src = "https://placehold.co/100x100?text=Logo")}
                            />
                          </div>
                          <div>
                            <h2 className="text-xl font-black tracking-tight text-white mb-1">{client.name}</h2>
                            <div className="flex items-center gap-2 text-sm font-medium text-white/80 uppercase tracking-widest text-[10px]">
                              <span>{clientProjects.length} {clientProjects.length === 1 ? 'projeto' : 'projetos'}</span>
                              <span className="text-white/40">•</span>
                              <span>{clientTasks.length} {clientTasks.length === 1 ? 'tarefa' : 'tarefas'}</span>
                              {client.tipo_cliente === 'parceiro' && (
                                <>
                                  <span className="text-white/40">•</span>
                                  <span className="bg-white/20 px-2 py-0.5 rounded-full border border-white/10">Parceiro</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mt-4 md:mt-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/clients/${client.id}`);
                            }}
                            className="flex items-center gap-2 px-6 py-2.5 bg-white text-purple-700 hover:bg-purple-50 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest shadow-xl group"
                          >
                            Ver Detalhes
                            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </div>

                      {viewMode === 'list' ? (
                        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar-thin pl-2">
                          {clientProjects.length === 0 ? (
                            <div className="text-xs text-slate-500 italic py-4">Nenhum projeto cadastrado para este cliente.</div>
                          ) : (
                            clientProjects.map(project => {
                              const projectTasks = safeTasks.filter(t => t.projectId === project.id);
                              const doneTasks = projectTasks.filter(t => t.status === 'Done').length;
                              const progress = projectTasks.length > 0 ? Math.round(CapacityUtils.calculateProjectWeightedProgress(project.id, safeTasks)) : 0;

                              const startP = project.startDate ? new Date(project.startDate) : null;
                              const endP = project.estimatedDelivery ? new Date(project.estimatedDelivery) : null;
                              const now = new Date();
                              let plannedProgress = 0;
                              if (startP && endP && startP < endP) {
                                if (now > endP) plannedProgress = 100;
                                else if (now > startP) {
                                  const total = endP.getTime() - startP.getTime();
                                  const elapsed = now.getTime() - startP.getTime();
                                  plannedProgress = (elapsed / total) * 100;
                                }
                              }

                              const isDelayed = progress < (plannedProgress - 5);

                              return (
                                <motion.div
                                  whileHover={{ y: -4 }}
                                  key={project.id}
                                  onClick={() => navigate(`/admin/projects/${project.id}`)}
                                  className={`min-w-[280px] max-w-[280px] border rounded-2xl p-5 cursor-pointer transition-all group/card shadow-sm hover:shadow-md relative overflow-hidden`}
                                  style={{
                                    backgroundColor: 'var(--surface)',
                                    borderColor: 'var(--border)'
                                  }}
                                >
                                  {/* Accent line at the top to keep the premium purple identity */}
                                  <div className={`absolute top-0 left-0 right-0 h-1 ${isDelayed ? 'bg-red-500' : 'bg-gradient-to-r from-purple-500 to-indigo-500'} opacity-80`} />
                                  {isAdmin && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setProjectToDelete(project.id);
                                      }}
                                      className="absolute top-3 right-3 p-1.5 text-purple-400 hover:text-red-500 hover:bg-white rounded-lg transition-all z-10 opacity-0 group-hover/card:opacity-100"
                                      title="Excluir Projeto"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  <div className="flex items-start justify-between mb-3 gap-2">
                                    <h4 className="font-bold line-clamp-1 transition-colors uppercase text-[11px] tracking-wider text-purple-600 dark:text-purple-400 flex-1">
                                      {project.name}
                                    </h4>
                                    <div className="flex gap-1 shrink-0">

                                      {isDelayed && (
                                        <span className="bg-red-500 text-white text-[7px] font-black px-1 rounded flex items-center gap-0.5">
                                          <Clock size={8} /> ATR
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="space-y-4">
                                    {/* Evolução Física */}
                                    <div>
                                      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                                        <span>Evolução Física</span>
                                        <span style={{ color: 'var(--text)' }}>{progress}%</span>
                                      </div>
                                      <div className="w-full h-1 rounded-full overflow-hidden mt-1" style={{ backgroundColor: 'var(--surface-2)' }}>
                                        <div
                                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000"
                                          style={{ width: `${progress}%` }}
                                        />
                                      </div>
                                    </div>

                                    {/* Consumo de Horas */}
                                    {(() => {
                                      const pTimesheets = timesheetEntries.filter(e => e.projectId === project.id);
                                      const hoursConsumed = pTimesheets.reduce((acc, e) => acc + (Number(e.totalHours) || 0), 0);
                                      const hoursSold = project.horas_vendidas || 0;
                                      const hourPercentage = hoursSold > 0 ? (hoursConsumed / hoursSold) * 100 : 0;
                                      return (
                                        <div>
                                          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                                            <span>Consumo de Horas</span>
                                            <span className={hourPercentage > 100 ? 'text-red-500' : ''} style={{ color: hourPercentage > 100 ? undefined : 'var(--text)' }}>{formatDecimalToTime(hoursConsumed)} / {formatDecimalToTime(hoursSold)}</span>
                                          </div>
                                          <div className="w-full h-1 rounded-full overflow-hidden mt-1" style={{ backgroundColor: 'var(--surface-2)' }}>
                                            <div
                                              className={`h-full transition-all duration-1000 ${hourPercentage > 100 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                              style={{ width: `${Math.min(100, hourPercentage)}%` }}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    <div className="flex items-center justify-between pt-1">
                                      <div className="flex items-center gap-2 text-[10px] font-bold" style={{ color: 'var(--muted)' }}>
                                        <CheckSquare className="w-3 h-3 text-purple-500" />
                                        <span className="dark:text-slate-400">{doneTasks}/{projectTasks.length}</span>
                                      </div>
                                      {(() => {
                                        const projStatus = getProjectStatusByTimeline(project);
                                        const colors = getProjectStatusColor(projStatus);
                                        return (
                                          <div className={`p-1 px-2 rounded-lg text-[8px] font-black uppercase tracking-tighter border flex items-center gap-1 shadow-sm ${colors.text} ${colors.border} ${colors.bg}`}>
                                            <div className={`w-1 h-1 rounded-full ${colors.dot}`} />
                                            {projStatus}
                                          </div>
                                        );
                                      })()}
                                    </div>

                                    {/* Project Team Avatars */}
                                    <div className="pt-3 border-t flex items-center -space-x-1.5 overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                                      {projectMembers
                                        .filter(pm => String(pm.id_projeto) === project.id)
                                        .slice(0, 5)
                                        .map(pm => {
                                          const member = users.find(u => u.id === String(pm.id_colaborador));
                                          if (!member) return null;
                                          return (
                                            <div
                                              key={member.id}
                                              className="w-6 h-6 rounded-full border border-[var(--surface)] flex items-center justify-center overflow-hidden bg-[var(--surface-hover)]"
                                              title={member.name}
                                            >
                                              {member.avatarUrl ? (
                                                <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                                              ) : (
                                                <span className="text-[8px] font-bold" style={{ color: 'var(--muted)' }}>
                                                  {member.name.substring(0, 2).toUpperCase()}
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      {projectMembers.filter(pm => String(pm.id_projeto) === project.id).length > 5 && (
                                        <div className="w-6 h-6 rounded-full border border-[var(--surface)] bg-[var(--surface-2)] flex items-center justify-center text-[8px] font-bold" style={{ color: 'var(--muted)' }}>
                                          +{projectMembers.filter(pm => String(pm.id_projeto) === project.id).length - 5}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })
                          )}
                        </div>
                      ) : (
                        /* NEW OPERATIONS VIEW (PROJECT BAR + TASK CARDS) */
                        <div className="space-y-6">
                          {clientProjects.length === 0 ? (
                            <div className="text-xs text-slate-500 italic py-4">Nenhum projeto cadastrado para este cliente.</div>
                          ) : (
                            clientProjects.map(project => {
                              const projectTasks = safeTasks.filter(t => t.projectId === project.id);
                              const doneTasks = projectTasks.filter(t => t.status === 'Done').length;
                              const avgProgress = Math.round(CapacityUtils.calculateProjectWeightedProgress(project.id, projectTasks));

                              return (
                                <div key={project.id} className="space-y-3">
                                  {/* Project Banner Bar - Adaptive Standard Surface */}
                                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 p-4 rounded-2xl border transition-all relative overflow-hidden" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>

                                    {/* Accent Line Left */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${isProjectIncomplete(project) ? 'bg-yellow-500' : 'bg-purple-500 dark:bg-purple-600'}`} />

                                    <div className="flex items-center gap-4 flex-1 pl-2">
                                      {/* Removed redundant inner bar, using border accent instead */}
                                      <div className="flex flex-col">
                                        <div className="flex items-center gap-2 mb-1">
                                          <h4 className="font-black text-[10px] uppercase tracking-widest" style={{ color: 'var(--text)' }}>
                                            {project.name}
                                          </h4>
                                          {isProjectIncomplete(project) && (
                                            <div className="bg-yellow-500 text-black px-1.5 py-0.5 rounded text-[7px] font-black flex items-center gap-1 self-center">
                                              <AlertTriangle size={8} /> INC
                                            </div>
                                          )}
                                          {(() => {
                                            const startP = project.startDate ? new Date(project.startDate) : null;
                                            const endP = project.estimatedDelivery ? new Date(project.estimatedDelivery) : null;
                                            const now = new Date();
                                            let plannedProgress = 0;
                                            if (startP && endP && startP < endP) {
                                              if (now > endP) plannedProgress = 100;
                                              else if (now > startP) {
                                                const total = endP.getTime() - startP.getTime();
                                                const elapsed = now.getTime() - startP.getTime();
                                                plannedProgress = (elapsed / total) * 100;
                                              }
                                            }
                                            const isDelayed = avgProgress < (plannedProgress - 5);
                                            return isDelayed && (
                                              <div className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[7px] font-black flex items-center gap-1 self-center animate-pulse">
                                                <Clock size={8} /> ATR
                                              </div>
                                            );
                                          })()}
                                        </div>
                                        <div className="flex items-center gap-3">
                                          {(() => {
                                            const projStatus = getProjectStatusByTimeline(project);
                                            const colors = getProjectStatusColor(projStatus);
                                            return (
                                              <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${colors.text} ${colors.border} ${colors.bg}`}>
                                                {projStatus}
                                              </div>
                                            );
                                          })()}
                                          <span className="text-[10px] font-bold opacity-30 text-purple-900 dark:text-purple-300">•</span>
                                          <span className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>
                                            {projectTasks.length} {projectTasks.length === 1 ? 'Tarefa' : 'Tarefas'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between md:justify-end gap-6 px-4 border-t md:border-t-0 md:border-l pt-4 md:pt-0 border-purple-200/50 dark:border-white/5">
                                      {/* Evolution Stats */}
                                      <div className="flex flex-col min-w-[90px]">
                                        <div className="flex items-center gap-1 mb-1 opacity-50">
                                          <span className="text-[8px] font-black uppercase tracking-tighter" style={{ color: 'var(--muted)' }}>Evolução Média</span>
                                          <InfoTooltip title="Média de Evolução" content="Média aritmética do progresso manual inserido pelos colaboradores em todas as tarefas deste projeto." />
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-black" style={{ color: 'var(--primary)' }}>{avgProgress}%</span>
                                          <div className="flex-1 h-1 w-12 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-2)' }}>
                                            <div className="h-full" style={{ width: `${avgProgress}%`, backgroundColor: 'var(--primary)' }} />
                                          </div>
                                        </div>
                                      </div>

                                      {/* Completion Stats */}
                                      <div className="flex flex-col">
                                        <div className="flex items-center gap-1 mb-1 opacity-50">
                                          <span className="text-[8px] font-black uppercase tracking-tighter" style={{ color: 'var(--muted)' }}>Concluído</span>
                                          <InfoTooltip title="Status de Entrega" content="Quantidade de tarefas com status 'Done' em relação ao total de tarefas criadas." />
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <CheckSquare className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
                                          <span className="text-sm font-black" style={{ color: 'var(--text)' }}>{doneTasks}/{projectTasks.length}</span>
                                        </div>
                                      </div>

                                      <button
                                        onClick={() => navigate(`/admin/projects/${project.id}`)}
                                        className="p-2 hover:bg-white/40 dark:hover:bg-white/10 rounded-xl transition-all border border-purple-200 dark:border-purple-700/50 text-purple-400 hover:text-purple-600 dark:text-purple-400 dark:hover:text-purple-200 group"
                                      >
                                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Task Line */}
                                  <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar-thin pl-1">
                                    {projectTasks.length === 0 ? (
                                      <div className="text-[10px] font-bold uppercase tracking-widest opacity-30 py-4 pl-4" style={{ color: 'var(--muted)' }}>Nenhuma tarefa nesta operação</div>
                                    ) : (
                                      projectTasks.map(task => (
                                        <motion.div
                                          whileHover={{ y: -4 }}
                                          key={task.id}
                                          onClick={() => navigate(`/tasks/${task.id}`)}
                                          className="min-w-[280px] max-w-[280px] p-4 rounded-2xl border shadow-sm transition-all cursor-pointer group flex flex-col justify-between h-[100px]"
                                          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                                        >
                                          <div className="flex justify-between items-start gap-4">
                                            <div className="min-w-0 flex-1">
                                              <h5 className="font-bold text-xs group-hover:text-blue-500 transition-colors line-clamp-1" style={{ color: 'var(--text)' }}>
                                                {task.title}
                                              </h5>
                                              <div className="mt-1 flex items-center gap-2">
                                                <span className={`text-[6px] font-black uppercase px-2 py-0.5 rounded-md border ${task.status === 'Done' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                                  task.status === 'In Progress' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                    task.status === 'Testing' ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' :
                                                      task.status === 'Review' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                                        'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                                  }`}>
                                                  {task.status === 'Todo' ? 'Pré-Projeto' :
                                                    task.status === 'Review' ? 'Análise' :
                                                      task.status === 'In Progress' ? 'Andamento' :
                                                        task.status === 'Testing' ? 'Teste' :
                                                          task.status === 'Done' ? 'Concluído' : task.status}
                                                </span>
                                                {task.status !== 'Done' && task.estimatedDelivery && new Date(task.estimatedDelivery) < new Date() && (
                                                  <span className="text-[6px] font-black uppercase px-2 py-0.5 rounded-md bg-red-500 text-white animate-pulse">
                                                    ATRASADA
                                                  </span>
                                                )}
                                              </div>
                                            </div>

                                            <div className="shrink-0">
                                              {task.developerId && (
                                                <div className="w-7 h-7 rounded-lg border p-0.5 shadow-sm" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                                                  {users.find(u => u.id === task.developerId)?.avatarUrl ? (
                                                    <img
                                                      src={users.find(u => u.id === task.developerId)?.avatarUrl}
                                                      className="w-full h-full object-cover rounded"
                                                      alt="Dev"
                                                      onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.onerror = null;
                                                        const name = users.find(u => u.id === task.developerId)?.name || 'Dev';
                                                        target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f8fafc&color=475569`;
                                                      }}
                                                    />
                                                  ) : (
                                                    <div className="w-full h-full flex items-center justify-center font-bold text-[8px] uppercase" style={{ color: 'var(--muted)' }}>
                                                      {(task.developer || '??').substring(0, 2)}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          <div className="mt-2 text-right">
                                            <span className="text-[10px] font-black" style={{ color: 'var(--brand)' }}>{task.progress}%</span>
                                            <div className="w-full h-1 rounded-full overflow-hidden mt-1" style={{ backgroundColor: 'var(--surface-hover)' }}>
                                              <div
                                                className="h-full bg-gradient-to-r from-[var(--brand)] to-[var(--primary-hover)] transition-all duration-500"
                                                style={{ width: `${task.progress}%` }}
                                              />
                                            </div>
                                          </div>
                                        </motion.div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      }

      {/* FLOAT SCROLL TO TOP */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            onClick={scrollToTop}
            className="fixed bottom-10 right-10 p-4 bg-slate-800 text-white rounded-full shadow-2xl hover:bg-slate-700 transition-all z-50 border border-white/10 group"
          >
            <ArrowUp className="w-6 h-6 group-hover:-translate-y-1 transition-transform" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* PAINEL DE DETALHES DO PARCEIRO (SIDEBAR) */}
      <AnimatePresence>
        {showPartnerDetailsId && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowPartnerDetailsId(null)}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[var(--surface)] shadow-2xl z-[101] flex flex-col border-l border-[var(--border)]"
            >
              {(() => {
                const partner = partnerMetrics.find(p => p.id === showPartnerDetailsId);
                const internalResp = users?.find(u => u.id === partner?.responsavel_interno_id);
                if (!partner) return null;

                return (
                  <>
                    {/* Header do Painel */}
                    <div className="p-8 border-b border-[var(--border)] bg-gradient-to-br from-purple-500/10 to-transparent relative">
                      <button onClick={() => setShowPartnerDetailsId(null)} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} className="text-[var(--text)]" />
                      </button>
                      <div className="flex items-center gap-5 mt-4">
                        <div className="w-20 h-20 rounded-3xl shadow-xl border border-[var(--border)] overflow-hidden flex items-center justify-center" style={{ backgroundColor: 'var(--surface)' }}>
                          <img
                            src={partner.logoUrl}
                            className="w-full h-full object-cover"
                            alt={partner.name}
                            onError={(e) => { e.currentTarget.src = `https://placehold.co/200x200?text=${partner.name.charAt(0)}`; }}
                          />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-[var(--textTitle)] leading-tight">{partner.name}</h2>
                          <p className="text-xs font-bold text-purple-600 uppercase tracking-widest mt-1">Informações do Canal</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar pr-6">
                      {/* Sessão 1: Identificação Básica */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg border icon-box">
                            <Building2 size={16} style={{ color: 'var(--text-muted)' }} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Documentação</p>
                            <p className="text-sm font-mono font-bold text-[var(--text)]">{partner.cnpj || 'CNPJ Não informado'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg border icon-box">
                            <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Tempo de Parceria</p>
                            <p className="text-sm font-bold text-[var(--text)]">{partner.tenure}</p>
                          </div>
                        </div>
                      </div>

                      {/* Sessão de Contato */}
                      <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.2em] flex items-center gap-2 border-b border-[var(--border)] pb-2">
                          <Handshake size={12} className="text-purple-500" /> Contatos e Responsáveis
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="p-5 rounded-2xl bg-purple-500/5 border border-purple-100">
                            <p className="text-[9px] font-black text-purple-600 uppercase mb-3">Gestão Nic-Labs (Interno)</p>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-purple-500/20">
                                {internalResp?.name?.charAt(0) || 'N'}
                              </div>
                              <div>
                                <p className="text-sm font-black text-[var(--text)]">{internalResp?.name || 'Não atribuído'}</p>
                                <p className="text-[11px] text-[var(--muted)] font-bold">{internalResp?.email || '-'}</p>
                              </div>
                            </div>
                          </div>

                          <div className="p-5 rounded-2xl border border-[var(--border)] shadow-sm" style={{ backgroundColor: 'var(--surface)' }}>
                            <p className="text-[9px] font-black text-[var(--muted)] uppercase mb-3">Ponto de Contato (Parceiro)</p>
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <UserIcon size={14} className="text-slate-400" />
                                <p className="text-sm font-black text-[var(--text)]">{partner.responsavel_externo || 'Não informado'}</p>
                              </div>
                              <div className="flex flex-col gap-2 pl-6">
                                {partner.email_contato && (
                                  <a href={`mailto:${partner.email_contato}`} className="flex items-center gap-2 text-[11px] font-bold text-blue-600 hover:underline">
                                    <Mail size={12} /> {partner.email_contato}
                                  </a>
                                )}
                                {partner.telefone && (
                                  <span className="flex items-center gap-2 text-[11px] font-bold text-[var(--text-2)]">
                                    <Phone size={12} /> {partner.telefone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sessão Financeira e Métricas */}
                      <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.2em] flex items-center gap-2 border-b border-[var(--border)] pb-2">
                          <Target size={12} className="text-emerald-500" /> Saúde do Canal
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-5 rounded-2xl border surface-tinted-emerald">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase">Faturamento</p>
                            </div>
                            <p className="text-lg font-black text-[var(--textTitle)] font-mono">
                              {partner.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                            </p>
                          </div>
                          <div className="p-5 rounded-2xl border surface-tinted-blue">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase">Esforço (Horas)</p>
                            </div>
                            <p className="text-lg font-black text-[var(--textTitle)] font-mono">
                              {Math.round(partner.totalHours)}<span className="text-xs ml-0.5 opacity-50 uppercase">h</span>
                            </p>
                          </div>
                          <div className="p-5 rounded-2xl border surface-tinted-purple">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                              <p className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase">Contas Ativas</p>
                            </div>
                            <p className="text-lg font-black text-[var(--textTitle)] font-mono">
                              {partner.projectCount}
                            </p>
                          </div>
                          <div className="p-5 rounded-2xl border surface-tinted-amber">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <p className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase">Progresso Médio</p>
                            </div>
                            <p className="text-lg font-black text-[var(--textTitle)] font-mono">
                              {Math.round(partner.averageProgress)}%
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Links e Ações */}
                      <div className="pt-6">
                        <button
                          onClick={() => { navigate(`/admin/clients/${partner.id}`); setShowPartnerDetailsId(null); }}
                          className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-purple-500/20 active:scale-[0.98]"
                        >
                          <Edit2 size={16} /> Detalhes do Cadastro Completo
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* PAINEL DE DETALHES DO CLIENTE (SIDEBAR) */}
      <AnimatePresence>
        {showClientDetailsId && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowClientDetailsId(null)}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[var(--surface)] shadow-2xl z-[101] flex flex-col border-l border-[var(--border)]"
            >
              {(() => {
                const client = safeClients.find(c => c.id === showClientDetailsId);
                const clientProjects = safeProjects.filter(p => p.clientId === showClientDetailsId);
                const partner = client?.partner_id ? safeClients.find(c => c.id === client.partner_id) : null;
                if (!client) return null;

                return (
                  <>
                    {/* Header do Painel */}
                    <div className="p-8 border-b border-[var(--border)] bg-gradient-to-br from-blue-500/10 to-transparent relative">
                      <button onClick={() => setShowClientDetailsId(null)} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} className="text-[var(--text)]" />
                      </button>
                      <div className="flex items-center gap-5 mt-4">
                        <div className="w-20 h-20 rounded-3xl shadow-xl border border-[var(--border)] overflow-hidden flex items-center justify-center" style={{ backgroundColor: 'var(--surface)' }}>
                          <img
                            src={client.logoUrl}
                            className="w-full h-full object-cover"
                            alt={client.name}
                            onError={(e) => { e.currentTarget.src = `https://placehold.co/200x200?text=${client.name.charAt(0)}`; }}
                          />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-[var(--textTitle)] leading-tight">{client.name}</h2>
                          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">Informações do Cliente</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar pr-6">
                      {/* Sessão 1: Identificação Básica */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg icon-box">
                            <Building2 size={16} style={{ color: 'var(--text-muted)' }} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Documentação</p>
                            <p className="text-sm font-mono font-bold text-[var(--text)]">{client.cnpj || 'CNPJ Não informado'}</p>
                          </div>
                        </div>
                        {partner && (
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg icon-box">
                              <Handshake size={16} style={{ color: 'var(--text-muted)' }} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Parceiro</p>
                              <p className="text-sm font-bold text-[var(--text)]">{partner.name}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg icon-box">
                            <Briefcase size={16} style={{ color: 'var(--text-muted)' }} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Projetos Ativos</p>
                            <p className="text-sm font-bold text-[var(--text)]">{clientProjects.length} {clientProjects.length === 1 ? 'projeto' : 'projetos'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Sessão de Contato */}
                      {(client.contato_principal || client.email_contato || client.telefone) && (
                        <div className="space-y-4">
                          <h3 className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.2em] flex items-center gap-2 border-b border-[var(--border)] pb-2">
                            <UserIcon size={12} className="text-blue-500" /> Contatos
                          </h3>
                          <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                            <div className="space-y-3">
                              {client.contato_principal && (
                                <div className="flex items-center gap-2">
                                  <UserIcon size={14} className="text-slate-400" />
                                  <p className="text-sm font-black text-[var(--text)]">{client.contato_principal}</p>
                                </div>
                              )}
                              <div className="flex flex-col gap-2 pl-6">
                                {client.email_contato && (
                                  <a href={`mailto:${client.email_contato}`} className="flex items-center gap-2 text-[11px] font-bold text-blue-600 hover:underline">
                                    <Mail size={12} /> {client.email_contato}
                                  </a>
                                )}
                                {client.telefone && (
                                  <span className="flex items-center gap-2 text-[11px] font-bold text-[var(--text-2)]">
                                    <Phone size={12} /> {client.telefone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Projetos do Cliente */}
                      {clientProjects.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.2em] flex items-center gap-2 border-b border-[var(--border)] pb-2">
                            <Briefcase size={12} className="text-blue-500" /> Projetos
                          </h3>
                          <div className="space-y-3">
                            {clientProjects.map(project => (
                              <div key={project.id} className="p-4 rounded-xl bg-blue-50/30 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20 hover:border-blue-300 dark:hover:border-blue-500/40 transition-all cursor-pointer" onClick={() => { navigate(`/admin/projects/${project.id}`); setShowClientDetailsId(null); }}>
                                <p className="text-sm font-black text-[var(--text)] mb-1">{project.name}</p>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--muted)]">
                                  <span>{project.status || 'Ativo'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Botão para ver detalhes completos */}
                      <div className="pt-6">
                        <button
                          onClick={() => { navigate(`/admin/clients/${client.id}`); setShowClientDetailsId(null); }}
                          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 active:scale-[0.98]"
                        >
                          <Edit2 size={16} /> Detalhes do Cadastro Completo
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={!!projectToDelete}
        title="Excluir Projeto"
        message="Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita."
        onConfirm={async () => {
          if (projectToDelete) {
            try {
              await deleteProject(projectToDelete);
              setProjectToDelete(null);
            } catch (err: any) {
              console.error('Erro ao excluir projeto:', err);
              const msg = err.message || "";
              if (msg.includes("tarefas criadas") || msg.includes("hasTasks")) {
                if (window.confirm("Este projeto possui tarefas e possivelmente horas apontadas. Deseja realizar a EXCLUSÃO FORÇADA de todos os dados vinculados? Esta ação é irreversível.")) {
                  try {
                    await deleteProject(projectToDelete, true);
                    setProjectToDelete(null);
                  } catch (forceErr: any) {
                    alert('Erro na exclusão forçada: ' + (forceErr.message || 'Erro desconhecido'));
                  }
                }
              } else {
                alert(msg || 'Erro ao excluir projeto.');
              }
            }
          }
        }}
        onCancel={() => setProjectToDelete(null)}
        disabled={loading}
      />
      {/* Modal de Documentação de Capacidade */}
      <CapacityDocumentation isOpen={showCapDoc} onClose={() => setShowCapDoc(false)} />
      {/* MODAL ADICIONAR CLIENTE AO PARCEIRO */}
      <AnimatePresence>
        {isAddClientModalOpen && selectedPartnerId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddClientModalOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-[var(--border)] bg-[var(--surface-2)]">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-[var(--text)] uppercase">Vincular Cliente</h2>
                    <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mt-0.5 opacity-80">Associe clientes ao parceiro</p>
                  </div>
                  <button
                    onClick={() => setIsAddClientModalOpen(false)}
                    className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-[var(--muted)]" />
                  </button>
                </div>

                <div className="relative group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500 transition-transform group-focus-within:scale-110" />
                  <input
                    type="text"
                    placeholder="Filtrar por nome ou CNPJ..."
                    value={clientSearchTerm}
                    onChange={(e) => setClientSearchTerm(e.target.value)}
                    className="w-full bg-[var(--surface)] border-2 border-[var(--border)] focus:border-purple-500 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-[var(--text)] transition-all outline-none"
                  />
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-[var(--surface)]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(() => {
                    const filtered = (safeClients as Client[])
                      .filter((c: Client) =>
                        c.tipo_cliente !== 'parceiro' &&
                        c.active !== false &&
                        (c.name?.toLowerCase().includes(clientSearchTerm.toLowerCase()) || c.cnpj?.includes(clientSearchTerm))
                      )
                      .sort((a: Client, b: Client) => {
                        const aHasPartner = !!a.partner_id;
                        const bHasPartner = !!b.partner_id;
                        if (!aHasPartner && bHasPartner) return -1;
                        if (aHasPartner && !bHasPartner) return 1;
                        return a.name.localeCompare(b.name);
                      });

                    if (filtered.length === 0) {
                      return (
                        <div className="py-20 text-center">
                          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-white/10">
                            <Users className="w-8 h-8 text-[var(--muted)]" />
                          </div>
                          <p className="text-xs font-black text-[var(--muted)] uppercase tracking-widest">Nenhum cliente encontrado</p>
                        </div>
                      );
                    }

                    return filtered.map((client: Client) => {
                      const linkedPartners = client.partner_id ? client.partner_id.split(',') : [];
                      const isLinked = linkedPartners.includes(selectedPartnerId);
                      const otherPartners = linkedPartners.filter(id => id !== selectedPartnerId);

                      return (
                        <button
                          key={client.id}
                          onClick={async () => {
                            const newIds = isLinked
                              ? linkedPartners.filter((id: string) => id !== selectedPartnerId).join(',')
                              : [...linkedPartners, selectedPartnerId].join(',');
                            await updateClient(client.id, { partner_id: newIds });
                          }}
                          className={`group p-2.5 rounded-2xl border-2 transition-all flex items-center justify-between text-left ${isLinked
                            ? 'bg-purple-600/5 border-purple-500/20'
                            : 'bg-[var(--surface-2)] border-transparent hover:border-purple-500/20 hover:bg-white/5'
                            }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-lg border bg-white overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm" style={{ borderColor: 'var(--border)' }}>
                              <img
                                src={client.logoUrl}
                                className="w-full h-full object-cover"
                                alt={client.name}
                                onError={(e) => { e.currentTarget.src = `https://placehold.co/100x100?text=${client.name.charAt(0)}`; }}
                              />
                            </div>
                            <div className="min-w-0 pr-2">
                              <h4 className="text-[11px] font-bold text-[var(--text)] uppercase truncate leading-tight">{client.name}</h4>
                              {linkedPartners.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {linkedPartners.map((id: string) => {
                                    const pName = (safeClients as Client[]).find((c: Client) => c.id === id)?.name;
                                    if (!pName) return null;
                                    return (
                                      <span key={id} className="text-[8px] font-black bg-purple-600/10 text-purple-400 px-1.5 py-0.5 rounded-md uppercase tracking-tight">
                                        {pName}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${isLinked
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                            : 'bg-white/5 text-transparent group-hover:text-purple-400 border border-white/5 group-hover:border-purple-500/20'
                            }`}>
                            {isLinked ? <UserCheck className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-[var(--surface-2)] border-t border-[var(--border)] flex justify-center">
                <button
                  onClick={() => setIsAddClientModalOpen(false)}
                  className="px-8 py-3 bg-[var(--text)] text-[var(--bg)] rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 shadow-xl"
                >
                  Concluir Seleção
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <WorkingDaysModal
        isOpen={workingDaysModal.isOpen}
        onClose={() => setWorkingDaysModal(prev => ({ ...prev, isOpen: false }))}
        title={workingDaysModal.title}
        details={workingDaysModal.details}
      />
    </div >
  );
};

export default AdminDashboard;
