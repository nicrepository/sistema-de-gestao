// ProjectDetailView.tsx - Dashboard Unificado do Projeto
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useDataController } from '../controllers/useDataController';
import {
  ArrowLeft, Plus, Edit, CheckSquare, Clock, Filter, ChevronDown, Check,
  Trash2, LayoutGrid, Target, ShieldAlert, Link as LinkIcon, Users,
  Calendar, Info, Zap, RefreshCw, AlertTriangle, StickyNote, DollarSign,
  TrendingUp, BarChart2, Save, FileText, Settings, Shield, AlertCircle, Archive, X, CalendarDays
} from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserStatus } from '../utils/userStatus';
import * as CapacityUtils from '../utils/capacity';
import { formatDecimalToTime } from '../utils/normalizers';
import { User, Project, Client, Task, ProjectMember, TimesheetEntry, Holiday, Absence } from '../types';
import { getProjectStatusByTimeline } from '../utils/projectStatus';
import { ALL_ADMIN_ROLES } from '../constants/roles';
import CalendarPicker from './CalendarPicker';
import { toUpperCase, toSentenceCase, cleanText } from '../utils/textFormatter';

// --- UTILS ---
const parseSafeDate = (d: string | null | undefined) => {
  if (!d) return null;
  const s = d.split('T')[0];
  // Use noon to stay on the same local date regardless of offset < 12h
  return new Date(s + 'T12:00:00').getTime();
};
const ONE_DAY = 86400000;

const ProjectDetailView: React.FC = () => {
  const { projectId, clientId: paramClientId } = useParams<{ projectId: string; clientId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = projectId === 'new' || location.pathname.endsWith('/new');
  const isEditingRoute = location.pathname.endsWith('/edit');
  const {
    tasks, clients, projects, users, projectMembers, timesheetEntries,
    absences, holidays, taskMemberAllocations,
    deleteProject, deleteTask, updateProject, createProject, getProjectMembers,
    addProjectMember, removeProjectMember
  } = useDataController();

  const { currentUser, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'tasks' | 'technical'>(() => {
    // URL param tem prioridade máxima
    const queryTab = searchParams.get('tab');
    if (queryTab === 'tasks' || queryTab === 'technical') return queryTab as 'tasks' | 'technical';
    // Admins sempre abrem na Visão Geral; colaboradores sempre na aba Tarefas
    return isAdmin ? 'technical' : 'tasks';
  });

  const handleTabChange = (tab: 'tasks' | 'technical') => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };
  const [isEditing, setIsEditing] = useState(isNew || isEditingRoute);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'project', force?: boolean } | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('Todos');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showArchivedOverview, setShowArchivedOverview] = useState(false);
  const [hideDoneInOverview, setHideDoneInOverview] = useState(() => {
    const saved = localStorage.getItem('hideDoneInOverview');
    return saved === null ? true : saved === 'true';
  });
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  useEffect(() => {
    localStorage.setItem('hideDoneInOverview', hideDoneInOverview.toString());
  }, [hideDoneInOverview]);

  // --- SCROLL MANAGEMENT ---
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loading && scrollRef.current && projectId) {
      const saved = localStorage.getItem(`scroll_project_${projectId}`);
      if (saved) {
        scrollRef.current.scrollTop = parseInt(saved, 10);
      }
    }
  }, [loading, projectId]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (projectId) {
      localStorage.setItem(`scroll_project_${projectId}`, e.currentTarget.scrollTop.toString());
    }
  };

  useEffect(() => {
    if (projectId && projectId !== 'new') {
      localStorage.setItem(`project_last_tab_${projectId}`, activeTab);
    }
  }, [activeTab, projectId]);

  const project = projects.find((p: Project) => p.id === projectId);
  const client = project ? clients.find((c: Client) => c.id === project.clientId) : (paramClientId ? clients.find((c: Client) => c.id === paramClientId) : null);

  // --- FORM STATE ---
  const [formData, setFormData] = useState({
    name: '',
    clientId: '',
    partnerId: '',
    status: 'Não Iniciado',
    description: '',
    managerClient: '',
    responsibleNicLabsId: '',
    startDate: new Date().toISOString().split('T')[0],
    estimatedDelivery: '',
    startDateReal: '',
    endDateReal: '',
    criticalDate: '',
    docLink: '',
    gapsIssues: '',
    importantConsiderations: '',
    weeklyStatusReport: '',
    valor_total_rs: 0,
    horas_vendidas: 0,
    complexidade: 'Média' as 'Alta' | 'Média' | 'Baixa',
    torre: '',
    project_type: 'continuous' as 'planned' | 'continuous',
    valor_diario: 0,
    fora_do_fluxo: false,
    successFactor: '',
    risks: '',
    projectManagerId: '',
    responsibleUserId: ''
  });
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    if (isNew && paramClientId) {
      setFormData(prev => ({ ...prev, clientId: paramClientId }));
    }
  }, [isNew, paramClientId]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [memberAllocations, setMemberAllocations] = useState<Record<string, number>>({});

  // balanceAllocations removido (cálculos nas tarefas)

  const autoResize = (el: HTMLElement | null) => {
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  // --- AUTOMATION: Fill End Date based on Start Date if empty ---
  useEffect(() => {
    if (formData.startDate && !formData.estimatedDelivery) {
      const [y, m] = formData.startDate.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const endOfMonth = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setFormData(prev => ({ ...prev, estimatedDelivery: endOfMonth }));
    }
  }, [formData.startDate, formData.estimatedDelivery]);

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        clientId: project.clientId || '',
        partnerId: project.partnerId || '',
        status: project.status || 'Não Iniciado',
        description: project.description || '',
        managerClient: project.managerClient || '',
        responsibleNicLabsId: project.responsibleNicLabsId || '',
        startDate: (project.startDate || '').split('T')[0],
        estimatedDelivery: (project.estimatedDelivery || '').split('T')[0],
        startDateReal: (project.startDateReal || '').split('T')[0],
        endDateReal: (project.endDateReal || '').split('T')[0],
        criticalDate: (project.criticalDate || '').split('T')[0],
        docLink: project.docLink || '',
        gapsIssues: project.gapsIssues || '',
        importantConsiderations: project.importantConsiderations || '',
        weeklyStatusReport: project.weeklyStatusReport || '',
        valor_total_rs: project.valor_total_rs || 0,
        horas_vendidas: project.horas_vendidas || 0,
        complexidade: project.complexidade || 'Média',
        torre: project.torre || '',
        project_type: project.project_type || 'continuous',
        valor_diario: (project as any).valor_diario || 0,
        fora_do_fluxo: (project as any).fora_do_fluxo || false,
        successFactor: project.successFactor || '',
        risks: project.risks || '',
        projectManagerId: project.projectManagerId || '',
        responsibleUserId: project.responsibleUserId || ''
      });
      const membersResult = projectMembers.filter((pm: ProjectMember) => String(pm.id_projeto) === projectId);
      const selectedIds = membersResult.map((m: ProjectMember) => String(m.id_colaborador));
      setSelectedUsers(selectedIds);

      const initialAllocations: Record<string, number> = {};
      let totalSum = 0;
      membersResult.forEach((m: ProjectMember) => {
        const perc = Number(m.allocation_percentage) || 0;
        initialAllocations[String(m.id_colaborador)] = perc;
        totalSum += perc;
      });

      // Se a soma não for 100 e houver membros, re-balanceia automaticamente
      if (totalSum !== 100 && selectedIds.length > 0) {
        // Se houver membros, inicializa com 100% (flag de presença)
        const all100: Record<string, number> = {};
        selectedIds.forEach((id: string) => all100[id] = 100);
        setMemberAllocations(all100);
      } else {
        setMemberAllocations(initialAllocations);
      }
    } else if (isNew) {
      // Reset form for new project
      const today = new Date();
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      setFormData({
        name: '',
        clientId: paramClientId || '',
        partnerId: '',
        status: 'Não Iniciado',
        description: '',
        managerClient: '',
        responsibleNicLabsId: '',
        startDate: today.toISOString().split('T')[0],
        estimatedDelivery: lastDayOfMonth.toISOString().split('T')[0],
        startDateReal: '',
        endDateReal: '',
        criticalDate: '',
        docLink: '',
        gapsIssues: '',
        importantConsiderations: '',
        weeklyStatusReport: '',
        valor_total_rs: 0,
        horas_vendidas: 0,
        complexidade: 'Média',
        torre: '',
        project_type: 'continuous',
        valor_diario: 0,
        fora_do_fluxo: false,
        successFactor: '',
        risks: '',
        projectManagerId: '',
        responsibleUserId: ''
      });
      setSelectedUsers([]);
      setMemberAllocations({});
    }
  }, [project, projectId, projectMembers, isNew, paramClientId]);

  // --- AUTOMATION: Default Delivery Date to End of Month if empty ---
  useEffect(() => {
    if (isEditing && formData.startDate && !formData.estimatedDelivery) {
      const d = new Date(formData.startDate + 'T12:00:00');
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      setFormData(prev => ({ ...prev, estimatedDelivery: lastDay.toISOString().split('T')[0] }));
    }
  }, [formData.startDate, formData.estimatedDelivery, isEditing]);

  const projectTasks = useMemo(() => {
    const pTasks = tasks.filter((t: Task) => t.projectId === projectId && !t.deleted_at);
    if (currentUser && !isAdmin) {
      return pTasks.filter((t: Task) => t.developerId === currentUser.id || (t.collaboratorIds && t.collaboratorIds.includes(currentUser.id)));
    }
    return pTasks;
  }, [tasks, projectId, currentUser, isAdmin]);

  const isContinuousMode = false; // Desabilitado conforme solicitado

  const performance = useMemo(() => {
    if (!project) return null;
    const pTimesheets = timesheetEntries.filter((e: TimesheetEntry) => e.projectId === projectId);
    const consumedHours = pTimesheets.reduce((acc: number, entry: TimesheetEntry) => acc + (Number(entry.totalHours) || 0), 0);
    const committedCost = pTimesheets.reduce((acc: number, entry: TimesheetEntry) => {
      const u = users.find((u: User) => u.id === entry.userId);
      return acc + (entry.totalHours * (u?.hourlyCost || 0));
    }, 0);
    const totalEstimated = projectTasks.reduce((acc: number, t: Task) => {
      const reported = timesheetEntries
        .filter((e: TimesheetEntry) => e.taskId === t.id)
        .reduce((sum: number, e: TimesheetEntry) => sum + (Number(e.totalHours) || 0), 0);
      return acc + Math.max(t.estimatedHours || 0, reported);
    }, 0);

    const pStartTs = parseSafeDate(project.startDate) || Date.now();
    const pEndTs = parseSafeDate(project.estimatedDelivery) || pStartTs;
    const projectDurationTs = Math.max(0, pEndTs - pStartTs) + ONE_DAY;

    const memberIds = new Set(
      projectMembers.filter((pm: ProjectMember) => String(pm.id_projeto) === projectId).map((pm: ProjectMember) => String(pm.id_colaborador))
    );

    const getBusinessDays = (dStart: string, dEnd: string) => {
      let count = 0;
      let curr = new Date(dStart + 'T12:00:00');
      const stop = new Date(dEnd + 'T12:00:00');
      while (curr <= stop) {
        const day = curr.getDay();
        if (day !== 0 && day !== 6) {
          const ds = curr.toISOString().split('T')[0];
          const isH = holidays.some((h: Holiday) => ds >= h.date && ds <= (h.endDate || h.date));
          if (!isH) count++;
        }
        curr.setDate(curr.getDate() + 1);
      }
      return Math.max(1, count);
    };

    const projectDays = (project.startDate && project.estimatedDelivery)
      ? getBusinessDays(project.startDate.split('T')[0], project.estimatedDelivery.split('T')[0])
      : 1;

    const weightedProgress = CapacityUtils.calculateProjectWeightedProgress(projectId!, projectTasks);

    let plannedProgress = 0;
    if (project.startDate && project.estimatedDelivery) {
      const start = new Date(project.startDate).getTime();
      const end = new Date(project.estimatedDelivery).getTime();
      const now = Date.now();
      if (now > end) plannedProgress = 100;
      else if (now < start) plannedProgress = 0;
      else plannedProgress = ((now - start) / (end - start)) * 100;
    }

    let projection = null;
    if (project.startDate && weightedProgress > 0 && weightedProgress < 100) {
      const start = new Date(project.startDate).getTime();
      const now = Date.now();
      const elapsed = now - start;
      if (elapsed > 0) {
        const totalDuration = elapsed * (100 / weightedProgress);
        projection = new Date(start + totalDuration);
      }
    }

    const memberTimesheets = pTimesheets.filter((e: TimesheetEntry) => memberIds.has(String(e.userId)));

    const realStartDate = memberTimesheets.length > 0
      ? new Date(Math.min(...memberTimesheets.map((e: TimesheetEntry) => new Date(e.date + 'T12:00:00').getTime())))
      : null;

    const allTasksDone = projectTasks.length > 0 && projectTasks.every((t: Task) => t.status === 'Done');
    const realEndDate = allTasksDone && memberTimesheets.length > 0
      ? new Date(Math.max(...memberTimesheets.map((e: TimesheetEntry) => new Date(e.date + 'T12:00:00').getTime())))
      : null;

    const taskEntries = timesheetEntries.filter((e: TimesheetEntry) => e.projectId === projectId);
    const months = Array.from(new Set(
      taskEntries.map((e: TimesheetEntry) => e.date.substring(0, 7))
    )).sort();

    const monthlyAllocation = (months as string[]).map((month: string) => {
      const hours = taskEntries
        .filter((e: TimesheetEntry) => e.date.startsWith(month))
        .reduce((sum: number, e: TimesheetEntry) => sum + (Number(e.totalHours) || 0), 0);
      return { month, hours };
    });

    const totalDays = projectDurationTs / ONE_DAY;
    const holidaysInRange = holidays.filter((h: Holiday) => {
      const hStart = h.date;
      const hEnd = h.endDate || h.date;
      return (hStart >= project.startDate! && hStart <= project.estimatedDelivery!) ||
        (hEnd >= project.startDate! && hEnd <= project.estimatedDelivery!);
    });

    // --- CÁLCULOS ESPECÍFICOS PARA PROJETOS CONTÍNUOS ---
    let continuousPlannedValue = 0;
    if (project.startDate) {
      const start = new Date(project.startDate + 'T12:00:00');
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      let businessDays = 0;
      let currPlan = new Date(start);
      while (currPlan <= today) {
        const day = currPlan.getDay();
        if (day !== 0 && day !== 6) {
          const dateStr = currPlan.toISOString().split('T')[0];
          const isHoliday = holidays.some((h: Holiday) => {
            const hStart = h.date;
            const hEnd = h.endDate || h.date;
            return dateStr >= hStart && dateStr <= hEnd;
          });
          if (!isHoliday) businessDays++;
        }
        currPlan.setDate(currPlan.getDate() + 1);
      }
      continuousPlannedValue = businessDays * ((project as any).valor_diario || 0);
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const tasksDelayed = projectTasks.filter((t: Task) => {
      if (t.status === 'Done') return false;
      if (!t.estimatedDelivery) return false;
      const deliveryDate = new Date(t.estimatedDelivery + 'T23:59:59');
      return now > deliveryDate;
    });

    const tasksDueToday = projectTasks.filter((t: Task) => {
      if (t.status === 'Done') return false;
      if (!t.estimatedDelivery) return false;
      const deliveryDate = new Date(t.estimatedDelivery + 'T12:00:00').toISOString().split('T')[0];
      const todayStr = now.toISOString().split('T')[0];
      return deliveryDate === todayStr;
    });

    const tasksOvertime = projectTasks.filter((t: Task) => {
      const reported = timesheetEntries
        .filter((e: TimesheetEntry) => e.taskId === t.id)
        .reduce((sum: number, e: TimesheetEntry) => sum + (Number(e.totalHours) || 0), 0);
      return (Number(t.estimatedHours) || 0) > 0 && reported > (Number(t.estimatedHours) || 0);
    });

    const hasCriticalTask = tasksDelayed.length > 0 || tasksOvertime.length > 0;
    const hasTodayTask = tasksDueToday.length > 0;

    return {
      committedCost,
      consumedHours,
      weightedProgress,
      totalEstimated,
      plannedProgress,
      projection,
      realStartDate,
      realEndDate,
      continuousPlannedValue,
      hasCriticalTask,
      hasTodayTask,
      tasksDelayedCount: tasksDelayed.length,
      tasksOvertimeCount: tasksOvertime.length,
      tasksDueTodayCount: tasksDueToday.length,
      projectDays
    };
  }, [project, projectTasks, timesheetEntries, users, projectId, projectMembers, holidays]);

  const teamOperationalBalance = useMemo(() => {
    if (!project || !projectId) return null;

    const activeProjectMembers = projectMembers.filter((pm: ProjectMember) => String(pm.id_projeto) === projectId);

    const memberMetrics: Record<string, {
      allocatedHours: number;
      actualHours: number;
      status: 'green' | 'yellow' | 'red';
    }> = {};

    activeProjectMembers.forEach((pm: ProjectMember) => {
      const userId = String(pm.id_colaborador);

      // Soma das horas de alocação (reserva) para este usuário
      const allocatedHours = projectTasks
        .filter((t: Task) => String(t.developerId) === userId || (t.collaboratorIds && t.collaboratorIds.map(String).includes(userId)))
        .reduce((sum: number, t: Task) => {
          // --- NOVA LÓGICA: Busca alocação específica para o colaborador ---
          const specificAllocation = taskMemberAllocations.find((a: any) => String(a.taskId) === String(t.id) && String(a.userId) === userId);
          const hasAnyAllocationInTask = taskMemberAllocations.some((a: any) => String(a.taskId) === String(t.id) && (Number(a.reservedHours) || 0) > 0);

          let taskEffort = 0;
          if (specificAllocation && (Number(specificAllocation.reservedHours) || 0) > 0) {
            taskEffort = Number(specificAllocation.reservedHours) || 0;
          } else if (!hasAnyAllocationInTask) {
            // Se não houver distribuição específica, divide o total da tarefa igualmente entre o time
            const teamIds = Array.from(new Set([t.developerId, ...(t.collaboratorIds || [])])).filter(Boolean);
            taskEffort = (Number(t.estimatedHours) || 0) / (teamIds.length || 1);
          } else {
            // Se houver alocações específicas na tarefa, mas não para o usuário atual:
            // Regra: O Responsável (developerId) fica com o "resto" das horas. 
            // Outros colaboradores sem alocação explícita ficam com 0.
            const isMainDev = String(t.developerId) === userId;
            if (isMainDev) {
              const totalAllocatedToOthers = taskMemberAllocations
                .filter((a: any) => String(a.taskId) === String(t.id) && String(a.userId) !== userId)
                .reduce((s: number, a: any) => s + (Number(a.reservedHours) || 0), 0);
              taskEffort = Math.max(0, (Number(t.estimatedHours) || 0) - totalAllocatedToOthers);
            } else {
              taskEffort = 0;
            }
          }

          const estimated = taskEffort;

          if (t.status === 'Done') {
            // Se a tarefa acabou, ela não "reserva" mais horas futuras.
            // A alocação real consumida é o que foi apontado (no máximo o esforço alocado)
            const actualOnTask = timesheetEntries
              .filter((e: TimesheetEntry) => String(e.taskId) === String(t.id) && String(e.userId) === userId)
              .reduce((s: number, e: TimesheetEntry) => s + (Number(e.totalHours) || 0), 0);
            return sum + Math.min(estimated, actualOnTask);
          }

          return sum + estimated;
        }, 0);

      const actualHours = timesheetEntries
        .filter((e: TimesheetEntry) => String(e.projectId) === projectId && String(e.userId) === userId)
        .reduce((sum: number, e: TimesheetEntry) => sum + (Number(e.totalHours) || 0), 0);

      let status: 'green' | 'yellow' | 'red' = 'green';
      if (actualHours > allocatedHours * 1.1) status = 'red';
      else if (actualHours > allocatedHours) status = 'yellow';

      memberMetrics[userId] = {
        allocatedHours,
        actualHours,
        status
      };
    });

    return { memberMetrics, todayActiveCount: activeProjectMembers.length };
  }, [project, projectMembers, projectTasks, timesheetEntries, projectId, taskMemberAllocations]);


  const projectHolidays = useMemo(() => {
    if (!project || !project.startDate || !project.estimatedDelivery) return [];
    const start = new Date(project.startDate);
    const end = new Date(project.estimatedDelivery);
    return holidays.filter((h: Holiday) => {
      const hStart = new Date(h.date);
      const hEnd = h.endDate ? new Date(h.endDate) : hStart;
      return (hStart <= end && hEnd >= start);
    });
  }, [holidays, project]);

  const projectAbsences = useMemo(() => {
    if (!project || !project.startDate || !project.estimatedDelivery) return [];
    const start = new Date(project.startDate);
    const end = new Date(project.estimatedDelivery);
    const memberIdSet = new Set(
      projectMembers
        .filter((pm: ProjectMember) => String(pm.id_projeto) === projectId)
        .map((pm: ProjectMember) => String(pm.id_colaborador))
    );

    return absences.filter((a: Absence) => {
      const aStart = new Date(a.startDate);
      const aEnd = a.endDate ? new Date(a.endDate) : aStart;
      return memberIdSet.has(String(a.userId)) &&
        (aStart <= end && aEnd >= start);
    });
  }, [absences, project, projectMembers, projectId]);

  const isProjectIncomplete = useMemo(() => {
    const data = (isEditing || isNew) ? formData : { name: project?.name };
    // Apenas o nome é estritamente necessário para não quebrar a UI
    return !data.name?.trim();
  }, [project, formData, isEditing, isNew]);


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveProject();
    }
  };

  const hasTimeline = !!(project?.startDate && project?.estimatedDelivery);
  const hasBudget = (project?.valor_total_rs || 0) > 0;
  const hasHours = (project?.horas_vendidas || 0) > 0;

  // --- AUTOMATION: Auto-start project if there is activity ---
  useEffect(() => {
    if (!projectId || !isAdmin || isNew) return;
    const projectToCheck = projects.find((p: Project) => p.id === projectId);
    if (!projectToCheck) return;

    // Only check if currently "Not Started"
    if (projectToCheck.status === 'Não Iniciado') {
      const hasProgress = (performance?.weightedProgress || 0) > 0;
      const hasActiveTasks = projectTasks.some((t: Task) => t.status === 'In Progress' || t.status === 'Review' || t.status === 'Done');
      const reported = timesheetEntries.filter((s: TimesheetEntry) => s.projectId === projectId).reduce((acc: number, e: TimesheetEntry) => acc + (Number(e.totalHours) || 0), 0);

      if (hasProgress || hasActiveTasks || reported > 0) {
        // Auto-update to "In Progress"
        updateProject(projectId, { status: 'Em Andamento' } as any)
          .catch((err: any) => console.error("Falha ao iniciar projeto automaticamente:", err));
      }
    }
  }, [project, projectId, performance, projectTasks, timesheetEntries, updateProject, isAdmin]);

  const handleSaveProject = async () => {
    if (loading) return;
    if (!isNew && (!project || !projectId)) return;

    // Bloqueio removido conforme solicitação: permitir salvar mesmo incompleto.
    // if (isAdmin && isProjectIncomplete) {
    //   alert('Por favor, preencha todos os campos obrigatórios (Finanças, Timeline, Responsáveis e Equipe) antes de salvar.');
    //   return;
    // }


    const errors: string[] = [];
    if (!formData.name) errors.push('Nome do Projeto');
    if (!formData.startDate) errors.push('Data de Início');
    if (!formData.estimatedDelivery) errors.push('Data de Entrega');
    if (Number(formData.horas_vendidas) <= 0) errors.push('Horas Vendidas');
    if (selectedUsers.length === 0) errors.push('Pelo menos um membro na Equipe');

    if (errors.length > 0) {
      setValidationErrors(errors);
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setValidationErrors([]);

    // --- NOVA VALIDAÇÃO: Tarefas fora do intervalo do projeto ---
    // Impede que o projeto seja encurtado se houver tarefas que fiquem de fora, 
    // antecipando o erro 500 que o banco de dados retornaria.
    if (!isNew && isAdmin) {
      const projStart = new Date(formData.startDate + 'T00:00:00');
      const projEnd = new Date(formData.estimatedDelivery + 'T23:59:59');

      const outOfRangeTasks = projectTasks.filter((task: Task) => {
        if ((task as any).deleted_at) return false;
        const tStart = task.scheduledStart ? new Date(task.scheduledStart + 'T00:00:00') : null;
        const tEnd = task.estimatedDelivery ? new Date(task.estimatedDelivery + 'T23:59:59') : null;

        const isStartInvalid = tStart && tStart < projStart;
        const isEndInvalid = tEnd && tEnd > projEnd;
        return isStartInvalid || isEndInvalid;
      });

      if (outOfRangeTasks.length > 0) {
        const taskList = outOfRangeTasks.slice(0, 3).map((t: Task) => t.title).join(', ');
        const more = outOfRangeTasks.length > 3 ? ` e mais ${outOfRangeTasks.length - 3}` : '';
        alert(`Não é possível alterar o período do projeto pois existem ${outOfRangeTasks.length} tarefas fora do novo intervalo (${formData.startDate} a ${formData.estimatedDelivery}).\n\nExemplos: ${taskList}${more}.\n\nPor favor, ajuste as datas das tarefas antes de salvar.`);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      // Colaboradores só podem editar campos não-sensíveis
      if (!isAdmin) {
        const collaboratorData = {
          description: formData.description,
          weeklyStatusReport: formData.weeklyStatusReport,
          gapsIssues: formData.gapsIssues,
          importantConsiderations: formData.importantConsiderations,
          successFactor: formData.successFactor,
        };
        if (!projectId) throw new Error("ID do projeto não encontrado.");
        await updateProject(projectId, collaboratorData as any);
        setIsEditing(false);
        alert('Alterações salvas!');
        return;
      }

      const { ...cleanData } = formData;
      console.log("Saving project payload:", cleanData);

      let targetProjectId = projectId;

      if (isNew) {
        targetProjectId = await createProject({
          ...cleanData,
          status: 'Não Iniciado',
          active: true
        } as any);
      } else if (projectId) {
        await updateProject(projectId, cleanData as any);
      } else {
        throw new Error("ID do projeto não encontrado.");
      }

      const targetId = targetProjectId as string;
      const initialMembers = isNew ? [] : getProjectMembers(targetId);

      // Para cada usuário selecionado, calculamos a alocação proporcional para projetos contínuos (8h / N)
      const isContinuous = formData.project_type === 'continuous';
      const numMembers = selectedUsers.length;
      const allocationPercentage = isContinuous ? (numMembers > 0 ? 100 / numMembers : 100) : 100;

      for (const userId of selectedUsers) {
        await addProjectMember(targetId, userId, allocationPercentage);
      }

      // Remover membros que não estão mais na lista
      if (!isNew) {
        const toRemove = initialMembers.filter((uid: string) => !selectedUsers.includes(uid));
        for (const userId of toRemove) await removeProjectMember(targetId, userId);
      }

      setIsEditing(false);
      alert(isNew ? 'Projeto criado com sucesso!' : 'Projeto atualizado!');

      if (isNew && targetProjectId) {
        navigate(`/admin/projects/${targetProjectId}`, { replace: true });
      }
    } catch (error: any) {
      console.error(error);
      const msg = error.message || 'Erro ao salvar.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    let t = projectTasks;

    // Filtro principal: Ocultar o que é arquivado ou fora do fluxo por padrão
    if (!showArchived) {
      t = t.filter((task: Task) => !task.fora_do_fluxo);

      // Se não houver filtro de status específico para 'Done' e NÃO for 'Todos', oculta os concluídos
      if (selectedStatus !== 'Done' && selectedStatus !== 'Todos') {
        t = t.filter((task: Task) => task.status !== 'Done');
      }
    }

    if (selectedStatus !== 'Todos') {
      t = t.filter((task: Task) => task.status === selectedStatus);
    }

    return t.sort((a: Task, b: Task) => {
      const dateA = a.estimatedDelivery ? new Date(a.estimatedDelivery).getTime() : 2147483647000;
      const dateB = b.estimatedDelivery ? new Date(b.estimatedDelivery).getTime() : 2147483647000;
      return dateA - dateB;
    });
  }, [projectTasks, selectedStatus, showArchived]);

  const canCreateTask = !isProjectIncomplete;

  if (!project && !isNew) return <div className="p-20 text-center font-bold" style={{ color: 'var(--muted)' }}>Projeto não encontrado</div>;

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      {/* BANNER DE VALIDAÇÃO */}
      {validationErrors.length > 0 && isEditing && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 p-4 sticky top-0 z-[60] backdrop-blur-md">
          <div className="max-w-[1400px] mx-auto flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="text-yellow-600" size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black text-yellow-800 uppercase tracking-widest leading-none mb-1">Campos Obrigatórios Pendentes</h3>
              <p className="text-xs font-bold text-yellow-700 opacity-80 leading-relaxed">
                Por favor, preencha os seguintes campos destacados em amarelo: <span className="font-black text-yellow-900">{validationErrors.join(', ')}</span>
              </p>
            </div>
            <button
              onClick={() => setValidationErrors([])}
              className="ml-auto p-2 hover:bg-yellow-500/10 rounded-lg transition-colors text-yellow-700"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
      {/* HEADER */}
      <div className="px-8 py-6 bg-gradient-to-r from-[#1e1b4b] to-[#4c1d95] shadow-lg flex items-center justify-between text-white z-20">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ArrowLeft /></button>
          <div className="flex items-center gap-4">
            {client?.logoUrl && <div className="w-12 h-12 bg-white rounded-xl p-1.5 shadow-xl"><img src={client.logoUrl} className="w-full h-full object-contain" /></div>}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                {isEditing ? (
                  <input
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: toUpperCase(e.target.value) })}
                    onBlur={() => setFormData(prev => ({ ...prev, name: cleanText(prev.name) }))}
                    spellCheck={true}
                    onKeyDown={handleKeyDown}
                    className={`border-b outline-none px-2 py-1 text-xl font-bold rounded transition-colors min-w-[300px] ${!formData.name ? 'bg-yellow-500/20 border-yellow-500' : 'bg-white/10 border-white text-white'}`}
                  />
                ) : (
                  <h1 className="text-xl font-bold">{project?.name || 'Novo Projeto'}</h1>
                )}

                <div className="flex items-center gap-2">
                  {isAdmin && (performance?.hasCriticalTask || performance?.hasTodayTask) && (
                    <div className="flex items-center gap-2">
                      {performance.tasksDelayedCount > 0 && (
                        <span
                          className="text-[10px] font-black uppercase bg-red-500 text-white px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-lg shadow-red-500/20 animate-pulse"
                          title={`${performance.tasksDelayedCount} tarefas atrasadas.`}
                        >
                          <Clock size={12} /> ATRASADO
                        </span>
                      )}
                      {performance.tasksDelayedCount === 0 && performance.tasksOvertimeCount > 0 && (
                        <span
                          className="text-[10px] font-black uppercase bg-orange-500 text-white px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-lg shadow-orange-500/20"
                          title={`${performance.tasksOvertimeCount} tarefas com horas excedidas.`}
                        >
                          <Clock size={12} /> HORAS EXCEDIDAS
                        </span>
                      )}
                      {performance.tasksDueTodayCount > 0 && (
                        <span
                          className="text-[10px] font-black uppercase bg-amber-500 text-white px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                          title={`${performance.tasksDueTodayCount} tarefas vencendo hoje.`}
                        >
                          <Calendar size={12} /> HOJE
                        </span>
                      )}
                    </div>
                  )}
                  <span className="text-[10px] font-black uppercase bg-white/20 px-2.5 py-1 rounded-lg tracking-widest border border-white/10">
                    {project ? getProjectStatusByTimeline(project) : 'Draft'}
                  </span>
                  {isContinuousMode && (
                    <span className="text-[9px] font-black uppercase bg-amber-500 text-white px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-lg shadow-amber-500/20">
                      <RefreshCw size={12} /> CONTÍNUO
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xs text-white/60 font-medium">{client?.name}</span>
                {isAdmin && (
                  <div className="flex items-center gap-2 border-l border-white/10 pl-4 ml-2">
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className={`p-1.5 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${isEditing ? 'bg-white/20 border border-white/30' : ''}`}
                      title="Editar Projeto"
                    >
                      <Edit size={14} /> {isEditing ? 'Editando' : 'Editar'}
                    </button>
                    {isEditing && (
                      <button
                        onClick={handleSaveProject}
                        disabled={loading}
                        className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
                      >
                        {loading ? '...' : <><Save size={12} /> Salvar</>}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {/* TABS SELECTOR IN HEADER */}
          <div className="hidden md:flex bg-black/20 p-1 rounded-2xl gap-1">
            {isAdmin && (
              <button
                onClick={() => handleTabChange('technical')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'technical' ? 'bg-white text-purple-900 shadow-sm' : 'text-white/60 hover:text-white'}`}
              >
                Visão Geral
              </button>
            )}
            <button
              onClick={() => handleTabChange('tasks')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'tasks' ? 'bg-white text-purple-900 shadow-sm' : 'text-white/60 hover:text-white'}`}
            >
              Tarefas
            </button>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-black uppercase text-white/40">Progresso Real</p>
            <p className="text-2xl font-black">{hasTimeline ? Math.round(performance?.weightedProgress || 0) : '--'}%</p>
          </div>
          {!isNew && project && (
            <button
              onClick={() => navigate(`/tasks/new?project=${projectId}&client=${project?.clientId}`)}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl font-bold flex items-center gap-2 transition-all backdrop-blur-md"
            >
              <Plus size={18} /> Nova Tarefa
            </button>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-5 custom-scrollbar"
        style={{ backgroundColor: 'var(--bg)' }}
      >
        <div className="max-w-full px-4 md:px-8 space-y-5 pb-10">

          {/* VALIDATION BANNER FOR MANDATORY FIELDS - only show if fields are actually missing */}
          {isEditing && (
            (!formData.name || !formData.startDate || !formData.estimatedDelivery)
          ) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 rounded-[2rem] border bg-yellow-500/10 border-yellow-500/50 flex flex-col gap-2"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="text-yellow-600" size={20} />
                  <h3 className="text-xs font-black uppercase text-yellow-700">Campos Obrigatórios Pendentes</h3>
                </div>
                <ul className="text-[10px] font-bold text-yellow-700/80 list-disc ml-8 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {!formData.name && <li>Nome do Projeto</li>}
                  {!formData.startDate && <li>Data de Início</li>}
                  {!formData.estimatedDelivery && <li>Data Limite de Entrega</li>}
                </ul>
              </motion.div>
            )}

          {/* CRITICAL STATUS BANNER */}
          {isAdmin && performance?.hasCriticalTask && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-[2rem] border flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl bg-red-500/10 border-red-500/50`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl bg-red-500 text-white shadow-lg shadow-red-500/20`}>
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-tight text-red-700`}>
                    Atenção: Indicadores Críticos
                  </h3>
                  <p className="text-[10px] font-bold opacity-70 text-red-700">
                    {`Este projeto apresenta ${performance.tasksDelayedCount > 0 ? `${performance.tasksDelayedCount} tarefas em atraso` : ''}${performance.tasksDelayedCount > 0 && performance.tasksOvertimeCount > 0 ? ' e ' : ''}${performance.tasksOvertimeCount > 0 ? `${performance.tasksOvertimeCount} tarefas com horas excedidas` : ''}.`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {(!isProjectIncomplete || isEditing) && (
                  <button
                    onClick={() => setActiveTab('tasks')}
                    className="px-6 py-2 bg-red-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg"
                  >
                    Ver Detalhes
                  </button>
                )}
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {activeTab === 'technical' ? (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* KPI ROW */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
                  {/* Resumo do Planejamento - Cronograma & Peso */}
                  <div className={`p-4 rounded-[32px] border shadow-sm relative overflow-hidden transition-all hover:shadow-md flex flex-col ${isAdmin ? 'lg:col-span-6' : 'lg:col-span-7'}`} style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', height: '400px' }}>
                    <div className="flex items-center justify-between mb-4 shrink-0">
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>TAREFAS</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black text-purple-600/80 bg-purple-500/5 px-2 py-0.5 rounded-full border border-purple-500/10 uppercase tracking-tighter">
                            {formData.startDate ? new Date(formData.startDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'S/D'} → {formData.estimatedDelivery ? new Date(formData.estimatedDelivery + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'S/D'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setHideDoneInOverview(!hideDoneInOverview)}
                          className={`p-1.5 rounded-lg transition-all border ${hideDoneInOverview ? 'bg-purple-500 text-white border-purple-400 shadow-sm' : 'bg-purple-500/10 text-purple-600 border-purple-500/10'}`}
                          title={hideDoneInOverview ? "Mostrar Concluídas" : "Ocultar Concluídas"}
                        >
                          <CheckSquare size={10} />
                        </motion.button>
                        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/10">
                          <Calendar size={10} />
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                      {projectTasks
                        .slice()
                        .filter((t: Task) => !hideDoneInOverview || t.status !== 'Done')
                        .sort((a: Task, b: Task) => {
                          const dateA = a.estimatedDelivery ? new Date(a.estimatedDelivery + 'T12:00:00').getTime() : Number.MAX_SAFE_INTEGER;
                          const dateB = b.estimatedDelivery ? new Date(b.estimatedDelivery + 'T12:00:00').getTime() : Number.MAX_SAFE_INTEGER;
                          return dateA - dateB;
                        })
                        .map((task: Task) => {
                          const taskReported = timesheetEntries
                            .filter((e: TimesheetEntry) => e.taskId === task.id)
                            .reduce((sum: number, e: TimesheetEntry) => sum + (Number(e.totalHours) || 0), 0);

                          const pStartTs = parseSafeDate(project?.startDate) || Date.now();
                          const pEndTs = parseSafeDate(project?.estimatedDelivery) || pStartTs;
                          const tStartTs = parseSafeDate(task.scheduledStart || task.actualStart) || pStartTs;
                          const tEndTs = parseSafeDate(task.estimatedDelivery) || tStartTs;

                          const isDateOut = (tStartTs < pStartTs || tEndTs > pEndTs);

                          const startDate = task.scheduledStart ? new Date(task.scheduledStart + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '--/--';
                          const deliveryDate = task.estimatedDelivery ? new Date(task.estimatedDelivery + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;

                          const taskSoldHoursStatic = Number(task.estimatedHours) || 0;
                          const effectiveHours = task.status === 'Done' ? taskReported : taskSoldHoursStatic;
                          const weight = (project?.horas_vendidas || 0) > 0 ? (effectiveHours / project!.horas_vendidas) * 100 : 0;

                          const taskSoldHours = effectiveHours;
                          const collaboratorCount = (task.collaboratorIds?.length || 0);
                          const isHourOverrun = taskSoldHours > 0 && taskReported > taskSoldHours;
                          const isDelayed = task.status !== 'Done' && task.estimatedDelivery && new Date(task.estimatedDelivery + 'T23:59:59') < new Date();


                          return (
                            <div key={task.id} className={`p-2 rounded-xl border transition-all group/item cursor-pointer mb-1.5 flex flex-col gap-1.5 ${isDelayed || (isHourOverrun && task.status !== 'Done') ? 'border-red-500/10 bg-red-500/5 shadow-sm' : 'border-[var(--border)] hover:bg-[var(--bg)]'}`} onClick={() => navigate(`/tasks/${task.id}`)}>
                              <div className="flex justify-between items-center gap-2">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span className="text-[8px] font-black px-1 py-0.5 rounded bg-purple-500/10 text-purple-600 border border-purple-500/20 shrink-0">
                                    {weight.toFixed(1)}%
                                  </span>
                                  <h4 className={`text-[12px] font-bold truncate group-hover/item:text-purple-500 transition-colors ${isDelayed || (isHourOverrun && task.status !== 'Done') ? 'text-red-500' : 'text-[var(--text)]'}`}>
                                    {task.title}
                                  </h4>
                                </div>
                                <div className={`text-[12px] font-black tabular-nums shrink-0 ${isHourOverrun ? 'text-red-500' : 'text-[var(--text)]'}`}>
                                  {formatDecimalToTime(taskReported)}
                                  <span className={`text-[10px] font-black ml-1 ${isHourOverrun ? 'text-red-500/40' : 'opacity-60'}`}>
                                    / {formatDecimalToTime(taskSoldHours)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[8px] font-bold">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={`px-1 py-px rounded uppercase tracking-wider shrink-0 ${task.status === 'Done' ? 'bg-emerald-500/10 text-emerald-500' :
                                    task.status === 'Testing' ? 'bg-purple-500/10 text-purple-500' :
                                      isDelayed ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                                    }`}>
                                    {task.status === 'Todo' ? 'Pré-Projeto' :
                                      task.status === 'Review' ? 'Análise' :
                                        task.status === 'In Progress' ? 'Andamento' :
                                          task.status === 'Testing' ? 'Teste' : 'Concluído'}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded-lg shrink-0 font-black text-[10px] tabular-nums ${task.progress === 100 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-600'}`}>
                                    {task.progress}%
                                  </span>
                                  <span className="flex items-center gap-1.5 bg-slate-500/5 px-2 py-0.5 rounded-lg border border-slate-500/10 tabular-nums truncate font-black text-[9px] text-purple-600">
                                    <Calendar size={8} /> {startDate} → {deliveryDate || '--/--'}
                                  </span>
                                  {collaboratorCount > 1 && (
                                    <span className="bg-amber-500/10 text-amber-600 px-1 py-px rounded flex items-center gap-0.5 shrink-0" title={`${collaboratorCount} colaboradores`}>
                                      <Users size={8} />{collaboratorCount}
                                    </span>
                                  )}
                                </div>

                                <div className="flex gap-1 shrink-0">
                                  {isHourOverrun && <span className="text-[7px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded uppercase shadow-sm shadow-red-500/20 border border-red-600">Excedido</span>}
                                  {isDateOut && <span className="text-[7px] font-black bg-amber-500 text-black px-1.5 py-0.5 rounded uppercase border border-amber-600 shadow-sm shadow-amber-500/10" title="Fora do intervalo do projeto">Data Out ⚠</span>}
                                </div>
                              </div>

                              <div className="h-0.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-muted)' }}>
                                <div
                                  className={`h-full transition-all duration-1000 ${isHourOverrun ? 'bg-red-500' : 'bg-purple-600'}`}
                                  style={{ width: `${Math.min(100, (taskReported / (taskSoldHours || 1)) * 100)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}

                      {projectTasks.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                          <LayoutGrid size={24} className="mb-2" />
                          <p className="text-[9px] font-bold uppercase">Sem tarefas</p>
                        </div>
                      )}
                    </div>

                    {/* Footer com Totais do Cronograma */}
                    <div className="mt-4 pt-4 border-t border-dashed shrink-0" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center justify-between px-2 gap-4">
                        <div className="flex flex-col items-start min-w-0 shrink-0">
                          <span className="text-[7.5px] font-black uppercase opacity-40 tracking-widest whitespace-nowrap">Total Pesos</span>
                          <span className="text-[14px] font-black text-purple-600 whitespace-nowrap mt-0.5">
                            {(() => {
                              // Soma de pesos de TODAS as tarefas do projeto
                              const rawSum = projectTasks.reduce((acc: number, t: Task) => {
                                if (t.deleted_at) return acc;
                                const tr = timesheetEntries.filter((e: TimesheetEntry) => e.taskId === t.id).reduce((s: number, e: TimesheetEntry) => s + (Number(e.totalHours) || 0), 0);
                                const est = Number(t.estimatedHours) || 0;
                                // Se Done, usa real. Se não, usa o maior entre estimado/real.
                                const eff = t.status === 'Done' ? tr : Math.max(est, tr);
                                return acc + ((project?.horas_vendidas || 0) > 0 ? (eff / project!.horas_vendidas) * 100 : 0);
                              }, 0);
                              const sum = Math.min(100, Math.max(0, rawSum));
                              return Math.round(sum) + '%';
                            })()}
                          </span>
                        </div>
                        <div className="flex flex-col items-center min-w-0 shrink-0">
                          <span className="text-[7.5px] font-black uppercase opacity-40 tracking-widest whitespace-nowrap">Saldo Disp.</span>
                          <div className="flex items-baseline gap-1 mt-0.5 whitespace-nowrap">
                            <span className="text-[14px] font-black text-amber-500">
                              {(() => {
                                const totalUsed = projectTasks.reduce((acc: number, t: Task) => {
                                  if (t.deleted_at) return acc;
                                  const tr = timesheetEntries.filter((e: TimesheetEntry) => e.taskId === t.id).reduce((s: number, e: TimesheetEntry) => s + (Number(e.totalHours) || 0), 0);
                                  const est = Number(t.estimatedHours) || 0;
                                  // Se Done, usa real. Se não, usa o maior entre estimado/real.
                                  const eff = t.status === 'Done' ? tr : Math.max(est, tr);
                                  return acc + eff;
                                }, 0);
                                const saldo = (project?.horas_vendidas || 0) - totalUsed;
                                return formatDecimalToTime(Math.max(0, saldo));
                              })()}
                            </span>
                            <span className="text-[9px] font-bold text-amber-500/60 lowercase">hs</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end min-w-0 shrink-0">
                          <span className="text-[7.5px] font-black uppercase opacity-40 tracking-widest whitespace-nowrap">Horas Vendidas</span>
                          <span className="text-[14px] font-black whitespace-nowrap mt-0.5" style={{ color: 'var(--text)' }}>
                            {formatDecimalToTime(project?.horas_vendidas || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progresso vs Plano */}
                  <div className={`p-5 rounded-[32px] border shadow-sm relative transition-all hover:shadow-md h-[400px] flex flex-col ${isAdmin ? 'lg:col-span-2' : 'lg:col-span-2'}`} style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>

                    <div className="mb-6 pb-6 border-b border-dashed shrink-0" style={{ borderColor: 'var(--border)' }}>
                      <h4 className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: 'var(--muted)' }}>Status de Entrega</h4>
                      {(() => {
                        // Mostra placeholder quando valor_diario não está configurado
                        if (!project?.valor_diario || project.valor_diario < 0.01) {
                          return (
                            <div className="flex flex-col items-center justify-center py-4 opacity-30">
                              <DollarSign size={20} className="mb-2" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-center">Valor Diário Não Configurado</span>
                              <span className="text-[7px] font-medium uppercase tracking-wider text-center mt-1" style={{ color: 'var(--muted)' }}>
                                Configure o "Valor Diário (8h)" para calcular o desvio
                              </span>
                            </div>
                          );
                        }

                        const delta = ((performance?.committedCost || 0) / (performance?.continuousPlannedValue || 1) - 1) * 100;

                        const health = delta <= 5
                          ? { label: 'No Prazo', color: 'text-emerald-500', bg: 'bg-emerald-500' }
                          : delta <= 15
                            ? { label: 'Alerta', color: 'text-amber-500', bg: 'bg-amber-500' }
                            : { label: 'Crítico', color: 'text-red-500', bg: 'bg-red-500' };

                        return (
                          <div className="flex flex-col items-center justify-center py-1">
                            <div className={`w-3 h-3 rounded-full ${health.bg} animate-pulse shadow-[0_0_12px_rgba(0,0,0,0.1)] mb-2`} />
                            <span className={`text-xl font-black uppercase tracking-tighter ${health.color}`}>{health.label}</span>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                                Desvio: {delta > 0 ? '+' : ''}{Math.round(delta)}%
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <h4 className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: 'var(--muted)' }}>Rendimento</h4>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                          <span style={{ color: 'var(--text)' }}>PLANO — VALOR RENDIDO ESTIMADO</span>
                          <span style={{ color: 'var(--warning)' }}>
                            {(performance?.continuousPlannedValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
                          <div
                            className="h-full bg-amber-500 transition-all duration-1000"
                            style={{
                              width: `${Math.min(100, ((performance?.continuousPlannedValue || 0) / (Math.max(performance?.continuousPlannedValue || 0, performance?.committedCost || 0) || 1)) * 100)}%`
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                          <span style={{ color: 'var(--text)' }}>CUSTO REAL APURADO</span>
                          <span style={{ color: 'var(--success)' }}>
                            {(performance?.committedCost || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
                          <div
                            className="h-full bg-emerald-500 transition-all duration-1000"
                            style={{
                              width: `${Math.min(100, ((performance?.committedCost || 0) / (Math.max(performance?.continuousPlannedValue || 0, performance?.committedCost || 0) || 1)) * 100)}%`
                            }}
                          />
                        </div>
                      </div>
                      <p className="text-[7px] font-bold opacity-30 uppercase mt-2">
                        * Barras de progresso proporcionais entre Plano e Real.
                      </p>
                    </div>
                  </div>


                  {/* Finanças (Visible only to Admin) */}
                  {isAdmin && (
                    <div className="p-5 rounded-[32px] border shadow-sm relative transition-all hover:shadow-md h-[400px] flex flex-col lg:col-span-2" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>

                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Finanças</h4>
                      </div>

                      <div className="space-y-4">
                        {isEditing ? (
                          <div className="space-y-4">
                            <div>
                              <label className="text-[9px] font-bold uppercase mb-1 block" style={{ color: 'var(--muted)' }}>Valor Diário (8h) (R$)</label>
                              <input
                                type="number"
                                value={formData.valor_diario || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, valor_diario: e.target.value === '' ? 0 : Number(e.target.value) })}
                                onKeyDown={handleKeyDown}
                                className="text-xs p-2 rounded w-full border outline-none font-bold transition-colors bg-[var(--bg)] border-[var(--border)]"
                                style={{ color: 'var(--text)' }}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[9px] font-bold uppercase mb-1 block" style={{ color: 'var(--muted)' }}>Valor Total (R$)</label>
                                <input
                                  type="number"
                                  value={formData.valor_total_rs || ''}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, valor_total_rs: e.target.value === '' ? 0 : Number(e.target.value) })}
                                  onKeyDown={handleKeyDown}
                                  className="text-xs p-2 rounded w-full border outline-none font-bold transition-colors bg-[var(--bg)] border-[var(--border)]"
                                  style={{ color: 'var(--text)' }}
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold uppercase mb-1 block" style={{ color: 'var(--muted)' }}>Horas Vendidas</label>
                                <input
                                  type="number"
                                  value={formData.horas_vendidas || ''}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, horas_vendidas: e.target.value === '' ? 0 : Number(e.target.value) })}
                                  onKeyDown={handleKeyDown}
                                  className={`text-xs p-2 rounded w-full border outline-none font-bold transition-colors ${Number(formData.horas_vendidas) <= 0 ? 'bg-yellow-500/20 border-yellow-500/50' : 'bg-[var(--bg)] border-[var(--border)]'}`}
                                  style={{ color: 'var(--text)' }}
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] overflow-hidden">
                              <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">Valor Diário Acordado</p>
                              <p className="text-xl font-black text-amber-500 truncate">
                                {(project?.valor_diario || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                              <p className="text-[8px] font-bold opacity-40 mt-1 uppercase leading-none">Equivalente a 8h de operação.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                              <div>
                                <p className="text-[8px] font-black uppercase tracking-wider opacity-40 mb-1">Valor Total</p>
                                <p className="text-[11px] font-black truncate" style={{ color: 'var(--text)' }}>
                                  {(project?.valor_total_rs || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                              </div>
                              <div className="border-l border-[var(--border)] pl-3">
                                <p className="text-[8px] font-black uppercase tracking-wider opacity-40 mb-1">Horas Vendidas</p>
                                <p className="text-[11px] font-black" style={{ color: 'var(--text)' }}>
                                  {project?.horas_vendidas || 0}h
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timeline do Projeto */}
                  <div className={`h-[400px] flex flex-col p-5 rounded-[32px] border shadow-sm relative transition-all hover:shadow-md ${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}`} style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Timeline do Projeto</h4>
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                        <Calendar size={14} />
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3 relative">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="relative">
                            <label className="text-[9px] font-black uppercase mb-1 block" style={{ color: 'var(--muted)' }}>Data de Início</label>
                            <div className="flex items-center justify-between p-2 rounded w-full border transition-all" style={{ backgroundColor: !formData.startDate ? 'rgba(251, 191, 36, 0.2)' : 'var(--bg)', borderColor: !formData.startDate ? 'rgba(251, 191, 36, 0.5)' : 'var(--border)' }}>
                              <input
                                type="date"
                                value={formData.startDate}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, startDate: e.target.value })}
                                onKeyDown={handleKeyDown}
                                className="bg-transparent outline-none font-bold text-xs w-full cursor-pointer"
                                style={{ color: 'var(--text)' }}
                                onClick={(e) => { e.preventDefault(); setShowStartCalendar(!showStartCalendar); setShowEndCalendar(false); }}
                              />
                              <CalendarDays className="w-4 h-4 opacity-40 cursor-pointer hover:opacity-100 transition-opacity" onClick={() => { setShowStartCalendar(!showStartCalendar); setShowEndCalendar(false); }} />
                            </div>

                            {showStartCalendar && (
                              <CalendarPicker
                                selectedDate={formData.startDate}
                                onSelectDate={(date) => {
                                  setFormData({ ...formData, startDate: date });
                                }}
                                onClose={() => setShowStartCalendar(false)}
                              />
                            )}
                          </div>

                          <div className="relative">
                            <label className="text-[9px] font-black uppercase mb-1 block" style={{ color: 'var(--muted)' }}>Data de Entrega</label>
                            <div className="flex items-center justify-between p-2 rounded w-full border transition-all" style={{ backgroundColor: !formData.estimatedDelivery ? 'rgba(251, 191, 36, 0.2)' : 'var(--bg)', borderColor: !formData.estimatedDelivery ? 'rgba(251, 191, 36, 0.5)' : 'var(--border)' }}>
                              <input
                                type="date"
                                value={formData.estimatedDelivery}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, estimatedDelivery: e.target.value })}
                                onKeyDown={handleKeyDown}
                                className="bg-transparent outline-none font-bold text-xs w-full cursor-pointer"
                                style={{ color: 'var(--text)' }}
                                onClick={(e) => { e.preventDefault(); setShowEndCalendar(!showEndCalendar); setShowStartCalendar(false); }}
                              />
                              <CalendarDays className="w-4 h-4 opacity-40 cursor-pointer hover:opacity-100 transition-opacity" onClick={() => { setShowEndCalendar(!showEndCalendar); setShowStartCalendar(false); }} />
                            </div>

                            {showEndCalendar && (
                              <CalendarPicker
                                selectedDate={formData.estimatedDelivery}
                                onSelectDate={(date) => {
                                  setFormData({ ...formData, estimatedDelivery: date });
                                }}
                                onClose={() => setShowEndCalendar(false)}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {/* Linha de datas: Data de Início + Início Real */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                            <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Data de Início</p>
                            <p className="text-base font-black tracking-tight" style={{ color: 'var(--text)' }}>
                              {project?.startDate ? project.startDate.split('T')[0].split('-').reverse().join('/') : '--'}
                            </p>
                          </div>
                          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                            <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Início Real</p>
                            <p className={`text-base font-black tracking-tight ${performance?.realStartDate ? 'text-emerald-500' : 'opacity-20'}`}>
                              {performance?.realStartDate ? performance.realStartDate.toLocaleDateString('pt-BR') : '--'}
                            </p>
                          </div>
                        </div>

                        {/* Card de Entrega Estimada */}
                        {project?.estimatedDelivery ? (
                          <div className="p-4 rounded-[24px] bg-gradient-to-br from-amber-500/10 via-amber-500/[0.02] to-transparent border border-amber-500/20 relative overflow-hidden group">
                            <div className="absolute -top-3 -right-3 opacity-[0.04] group-hover:opacity-[0.08] transition-all">
                              <Clock size={80} />
                            </div>
                            <p className="text-[9px] font-black uppercase text-amber-600/60 tracking-[0.3em] mb-1 text-center">Entrega Estimada</p>
                            <p className="text-3xl font-black tracking-tighter text-center mb-3" style={{ color: 'var(--text)' }}>
                              {project.estimatedDelivery.split('T')[0].split('-').reverse().join('/')}
                            </p>
                            {project.startDate && (() => {
                              const start = new Date(project.startDate + 'T12:00:00');
                              const end = new Date(project.estimatedDelivery + 'T12:00:00');
                              const today = new Date();
                              today.setHours(12, 0, 0, 0);
                              let remaining = 0;
                              const current = new Date(today > start ? today : start);
                              while (current <= end) {
                                const day = current.getDay();
                                if (day !== 0 && day !== 6) {
                                  const dateStr = current.toISOString().split('T')[0];
                                  const isHoliday = holidays.some((h: Holiday) => {
                                    const hEnd = h.endDate || h.date;
                                    return dateStr >= h.date && dateStr <= hEnd;
                                  });
                                  if (!isHoliday) remaining++;
                                }
                                current.setDate(current.getDate() + 1);
                              }
                              return (
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black text-amber-500 flex items-center justify-center gap-2">
                                    <Clock size={11} />
                                    {remaining} dias úteis disponíveis
                                  </p>
                                  <p className="text-[9px] font-bold text-center uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                                    Capacidade Período: {(performance?.projectDays || 0) * 8}h ({(performance?.projectDays || 0)} dias úteis)
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="p-4 rounded-[24px] border border-dashed border-amber-500/20 flex items-center justify-center">
                            <p className="text-[10px] font-bold opacity-30">Sem data de entrega definida</p>
                          </div>
                        )}


                      </div>
                    )}
                  </div>

                </div>

                {/* MAIN GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  <div className="lg:col-span-8 space-y-5">
                    {(isEditing || project?.description) && (
                      <div className="p-6 rounded-[32px] border shadow-sm space-y-6" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-emerald-500/10">
                              <Target size={14} className="text-emerald-500" />
                            </div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text)' }}>Visão de Escopo</p>
                          </div>
                          {!isEditing && <span className="text-[8px] font-bold opacity-30 uppercase tracking-widest">Planejamento e Objetivos</span>}
                        </div>
                        
                        <div className="space-y-3">
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Descrição Detalhada</p>
                          {isEditing ? (
                            <textarea 
                              value={formData.description} 
                              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setFormData({ ...formData, description: toSentenceCase(e.target.value) }); autoResize(e.target); }}
                              onBlur={(e) => { setFormData(prev => ({ ...prev, description: cleanText(prev.description) })); autoResize(e.target); }}
                              onFocus={(e) => autoResize(e.target)}
                              spellCheck={true}
                              className="w-full min-h-[160px] p-5 rounded-[24px] border outline-none text-sm transition-all focus:border-emerald-500 shadow-inner overflow-hidden"
                              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} 
                              placeholder="Descreva o escopo detalhado, entregáveis e limites do projeto..."
                            />
                          ) : (
                            <div className="p-6 rounded-[24px] border bg-gradient-to-br from-white/[0.03] to-transparent h-fit" style={{ borderColor: 'var(--border)' }}>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium" style={{ color: 'var(--text-2)' }}>{project?.description || '(Sem descrição de escopo)'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="p-5 rounded-[32px] border shadow-sm" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                      <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--primary)' }}><Info size={14} /> Detalhes Estruturais</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Gestão e Estrutura */}
                        <div className="p-4 rounded-[24px] border border-dashed flex flex-col justify-between" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
                          <div className="space-y-4">
                            <div>
                              <p className="text-[8px] font-black uppercase tracking-widest mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                                <Target size={10} className="text-purple-500" /> Cliente & Parceiro
                              </p>
                              <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[7px] font-bold opacity-50 uppercase">Final</p>
                                  {isEditing ? (
                                    <select
                                      value={formData.clientId}
                                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, clientId: e.target.value })}
                                      onKeyDown={handleKeyDown}
                                      className={`w-full p-1 rounded vertical-select text-[10px] font-bold outline-none mt-1 border transition-colors bg-[var(--bg)] border-[var(--border)]`}
                                      style={{ color: 'var(--text)' }}
                                    >
                                      <option value="">Selecione...</option>
                                      {clients.map((c: Client) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                  ) : <p className="text-xs font-black truncate" style={{ color: 'var(--text)' }}>{clients.find((c: Client) => c.id === project?.clientId)?.name || '--'}</p>}
                                </div>
                                <div className="w-px h-5 bg-[var(--border)] opacity-20" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[7px] font-bold opacity-50 uppercase">Parceiro</p>
                                  {isEditing ? (
                                    <select
                                      value={formData.partnerId}
                                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, partnerId: e.target.value })}
                                      onKeyDown={handleKeyDown}
                                      className={`w-full p-1 rounded vertical-select text-[10px] font-bold outline-none mt-1 border transition-colors bg-[var(--bg)] border-[var(--border)]`}
                                      style={{ color: 'var(--text)' }}
                                    >
                                      <option value="">Selecione...</option>
                                      <option value="direto">Direto (Sem Parceiro)</option>
                                      {clients.filter((c: Client) => c.tipo_cliente === 'parceiro').map((c: Client) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                  ) : <p className="text-xs font-black truncate" style={{ color: 'var(--text)' }}>{clients.find((c: Client) => c.id === project?.partnerId)?.name || 'Direto'}</p>}
                                </div>
                              </div>
                            </div>

                            <div>
                              <p className="text-[8px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                                <Shield size={10} className="text-emerald-500" /> Gestor Interno
                              </p>
                              {isEditing ? (
                                <select
                                  value={formData.responsibleNicLabsId}
                                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, responsibleNicLabsId: e.target.value })}
                                  onKeyDown={handleKeyDown}
                                  className={`w-full p-1.5 rounded-lg text-xs font-bold border transition-colors bg-[var(--bg)] border-[var(--border)]`}
                                  style={{ color: 'var(--text)' }}
                                >
                                  <option value="">Selecione...</option>
                                  {users.slice().sort((a: User, b: User) => a.name.localeCompare(b.name)).map((u: User) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                              ) : <p className="text-xs font-black" style={{ color: 'var(--text)' }}>{users.find((u: User) => u.id === project?.responsibleNicLabsId)?.name || '--'}</p>}
                            </div>

                            <div>
                              <p className="text-[8px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                                <Target size={10} className="text-blue-500" /> Responsável Cliente
                              </p>
                              {isEditing ? (
                                <input
                                  value={formData.managerClient}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, managerClient: e.target.value })}
                                  onKeyDown={handleKeyDown}
                                  className={`w-full p-1.5 rounded-lg text-xs font-bold border transition-colors bg-[var(--bg)] border-[var(--border)]`}
                                  style={{ color: 'var(--text)' }}
                                />
                              ) : <p className="text-xs font-black" style={{ color: 'var(--text)' }}>{project?.managerClient || '--'}</p>}
                            </div>
                          </div>
                        </div>

                        {/* Feriados no Período */}
                        <div className="p-4 rounded-[24px] border border-dashed flex flex-col" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
                          <p className="text-[8px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                            <Calendar size={10} className="text-orange-500" /> Feriados
                          </p>
                          <div className="space-y-1.5 flex-1 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                            {projectHolidays.length > 0 ? projectHolidays.map((h: Holiday) => (
                              <div key={h.id} className="p-2 rounded-xl border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                                <p className="text-[10px] font-black uppercase truncate" style={{ color: 'var(--text)' }}>{h.name}</p>
                                <div className="flex items-center gap-1 text-[9px] font-bold mt-0.5" style={{ color: 'var(--muted)' }}>
                                  <span className="text-orange-500">{new Date(h.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                  {h.endDate && h.endDate !== h.date && <span> - {new Date(h.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>}
                                </div>
                              </div>
                            )) : (
                              <div className="h-full flex flex-col items-center justify-center opacity-20 py-2">
                                <Calendar size={14} className="mb-1" />
                                <p className="text-[7px] font-black uppercase text-center">Nenhum feriado</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Ausências no Período */}
                        <div className="p-4 rounded-[24px] border border-dashed flex flex-col" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
                          <p className="text-[8px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                            <Clock size={10} className="text-indigo-500" /> Ausências (Time)
                          </p>
                          <div className="space-y-1.5 flex-1 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                            {projectAbsences.length > 0 ? projectAbsences.map((a: Absence) => {
                              const user = users.find((u: User) => u.id === String(a.userId));
                              return (
                                <div key={a.id} className="p-2 rounded-xl border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                                  <div className="flex justify-between items-start mb-0.5">
                                    <p className="text-[10px] font-black uppercase truncate pr-2" style={{ color: 'var(--text)' }}>{user?.name?.split(' ')[0] || '---'}</p>
                                    <span className={`text-[7px] font-black uppercase px-1 rounded-sm ${a.type === 'férias' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}>{a.type}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[9px] font-bold" style={{ color: 'var(--muted)' }}>
                                    <span className="opacity-70">{new Date(a.startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                    {a.endDate && a.endDate !== a.startDate && <span className="opacity-70"> - {new Date(a.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>}
                                  </div>
                                </div>
                              );
                            }) : (
                              <div className="h-full flex flex-col items-center justify-center opacity-20 py-2">
                                <Users size={14} className="mb-1" />
                                <p className="text-[7px] font-black uppercase text-center">Time Presente</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {isEditing && (
                        <div className="mt-8 pt-8 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--bg)' }}>
                          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-black/5 transition-colors">
                            <input
                              type="checkbox"
                              checked={formData.fora_do_fluxo}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, fora_do_fluxo: e.target.checked })}
                              className="w-4 h-4 rounded border-[var(--border)] text-purple-600 focus:ring-purple-500"
                            />
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text)' }}>Fora do Fluxo</p>
                              <p className="text-[8px] font-bold opacity-40 uppercase tracking-tighter" style={{ color: 'var(--muted)' }}>Ignorar este projeto em métricas globais e ocultar da visão padrão</p>
                            </div>
                          </label>
                          <div className="flex gap-3">
                            <button onClick={() => setIsEditing(false)} className="px-6 py-2 rounded-xl font-bold text-sm" style={{ color: 'var(--muted)' }}>Cancelar</button>
                            <button onClick={handleSaveProject} disabled={loading} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-purple-500/20">{loading ? 'Salvando...' : <><Save size={16} /> Salvar Alterações</>}</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-4 space-y-6">
                    {/* SAÚDE QUALITATIVA */}
                    {(isEditing || project?.weeklyStatusReport || project?.gapsIssues || project?.importantConsiderations || project?.successFactor) && (
                      <div className="p-6 rounded-[32px] border shadow-sm space-y-6" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text)' }}><StickyNote size={16} className="text-amber-500" /> Status e Andamento</h3>
                        <div className="space-y-5">
                          {(isEditing || project?.weeklyStatusReport) && (
                            <div>
                              <p className="text-[9px] font-black uppercase mb-1" style={{ color: 'var(--muted)' }}>Resumo da Semana</p>
                              {isEditing ? (
                                <textarea value={formData.weeklyStatusReport} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setFormData({ ...formData, weeklyStatusReport: toSentenceCase(e.target.value) }); autoResize(e.target); }} onBlur={(e) => { setFormData(prev => ({ ...prev, weeklyStatusReport: cleanText(prev.weeklyStatusReport) })); autoResize(e.target); }} onFocus={(e) => autoResize(e.target)} spellCheck={true} className="w-full min-h-[80px] p-2 rounded text-xs border overflow-hidden" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} placeholder="O que aconteceu esta semana?" />
                              ) : <p className="text-xs border-l-2 pl-3 py-1 rounded-r-lg" style={{ borderColor: 'var(--warning)', backgroundColor: 'var(--bg)', color: 'var(--text-2)' }}>{project?.weeklyStatusReport}</p>}
                            </div>
                          )}
                          {(isEditing || project?.gapsIssues) && (
                            <div>
                              <p className="text-[9px] font-black uppercase mb-1" style={{ color: 'var(--muted)' }}>Problemas e Bloqueios</p>
                              {isEditing ? (
                                <textarea value={formData.gapsIssues} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setFormData({ ...formData, gapsIssues: toSentenceCase(e.target.value) }); autoResize(e.target); }} onBlur={(e) => { setFormData(prev => ({ ...prev, gapsIssues: cleanText(prev.gapsIssues) })); autoResize(e.target); }} onFocus={(e) => autoResize(e.target)} spellCheck={true} className="w-full min-h-[80px] p-2 rounded text-xs border overflow-hidden" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} placeholder="Ex: Acesso bloqueado, falta de doc..." />
                              ) : <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{project?.gapsIssues}</p>}
                            </div>
                          )}
                          
                          {(isEditing || project?.importantConsiderations) && (
                            <div className="pt-4 border-t border-dashed" style={{ borderColor: 'var(--border)' }}>
                              <p className="text-[9px] font-black uppercase mb-1" style={{ color: 'var(--muted)' }}>Considerações Importantes</p>
                              {isEditing ? (
                                <textarea 
                                  value={formData.importantConsiderations} 
                                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setFormData({ ...formData, importantConsiderations: toSentenceCase(e.target.value) }); autoResize(e.target); }} 
                                  onBlur={(e) => { setFormData(prev => ({ ...prev, importantConsiderations: cleanText(prev.importantConsiderations) })); autoResize(e.target); }}
                                  onFocus={(e) => autoResize(e.target)}
                                  spellCheck={true}
                                  className="w-full min-h-[100px] p-2 rounded text-xs border overflow-hidden" 
                                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} 
                                />
                              ) : <p className="text-xs leading-relaxed italic whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>{project?.importantConsiderations}</p>}
                            </div>
                          )}

                          {(isEditing || project?.successFactor) && (
                            <div className="pt-4 border-t border-dashed" style={{ borderColor: 'var(--border)' }}>
                              <p className="text-[9px] font-black uppercase mb-1" style={{ color: 'var(--muted)' }}>Fatores de Sucesso</p>
                              {isEditing ? (
                                <textarea 
                                  value={formData.successFactor} 
                                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setFormData({ ...formData, successFactor: toSentenceCase(e.target.value) }); autoResize(e.target); }} 
                                  onBlur={(e) => { setFormData(prev => ({ ...prev, successFactor: cleanText(prev.successFactor) })); autoResize(e.target); }}
                                  onFocus={(e) => autoResize(e.target)}
                                  spellCheck={true}
                                  className="w-full min-h-[100px] p-2 rounded text-xs border overflow-hidden" 
                                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} 
                                />
                              ) : <p className="text-xs leading-relaxed font-bold whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>{project?.successFactor}</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="p-6 rounded-[32px] border shadow-sm" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                      <div className="flex flex-col gap-1 mb-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text)' }}>
                            <Users size={16} className="text-purple-500" /> Equipe Alocada
                          </h3>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {isEditing ? (
                          <>
                            <div className="relative">
                              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" style={{ color: 'var(--text)' }} />
                              <input
                                type="text"
                                placeholder="Buscar colaborador..."
                                value={memberSearch}
                                onChange={(e) => setMemberSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs font-medium border rounded-xl bg-[var(--bg)] border-[var(--border)] outline-none"
                                style={{ color: 'var(--text)' }}
                              />
                            </div>
                            <div className={`border rounded-2xl p-4 max-h-[400px] overflow-y-auto space-y-1 custom-scrollbar transition-colors ${selectedUsers.length === 0 ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-[var(--bg)] border-[var(--border)]'}`}>
                              {(() => {
                                const filtered = (users || [])
                                  .filter((u: any) => {
                                    const status = getUserStatus(u, tasks, projects, clients, absences);
                                    const isForaDoFluxo = status.label === 'Fora do Fluxo';
                                    const isAlreadySelected = selectedUsers.includes(u.id) || u.id === formData.responsibleNicLabsId;

                                    return u.active !== false &&
                                      (!isForaDoFluxo || isAlreadySelected) &&
                                      (u.name.toLowerCase().includes(memberSearch.toLowerCase()) || (u.cargo || '').toLowerCase().includes(memberSearch.toLowerCase()));
                                  })
                                  .sort((a: User, b: User) => {
                                    // Ordem estável: manager primeiro, depois selecionados, depois alfabético
                                    // Mas NÃO muda a ordem durante interação — computa por status inicial
                                    const aManager = a.id === formData.responsibleNicLabsId;
                                    const bManager = b.id === formData.responsibleNicLabsId;
                                    if (aManager && !bManager) return -1;
                                    if (!aManager && bManager) return 1;

                                    const aSelected = selectedUsers.includes(a.id);
                                    const bSelected = selectedUsers.includes(b.id);
                                    if (aSelected && !bSelected) return -1;
                                    if (!aSelected && bSelected) return 1;
                                    return a.name.localeCompare(b.name);
                                  });

                                return filtered.map((user: User) => {
                                  const isSelected = selectedUsers.includes(user.id) || user.id === formData.responsibleNicLabsId;
                                  const isManager = user.id === formData.responsibleNicLabsId;

                                  return (
                                    <div
                                      key={user.id}
                                      role="checkbox"
                                      aria-checked={isSelected}
                                      onMouseDown={(e) => {
                                        e.preventDefault(); // ← Impede browser de fazer scroll para o elemento
                                        if (isManager) return;
                                        setSelectedUsers(prev =>
                                          prev.includes(user.id)
                                            ? prev.filter(id => id !== user.id)
                                            : [...prev, user.id]
                                        );
                                      }}
                                      className={`flex items-center gap-3 cursor-pointer hover:bg-[var(--surface-hover)] p-2 rounded-xl transition-colors border select-none ${isSelected ? 'border-purple-500/30 bg-purple-500/5' : 'border-transparent opacity-60'} ${isManager ? 'cursor-default' : 'cursor-pointer'}`}
                                    >
                                      {/* Selection Indicator */}
                                      <div className={`w-5 h-5 rounded-[4px] flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-purple-500' : 'bg-white/10 border border-white/20'}`}>
                                        {isSelected && <Check size={12} className="text-white" strokeWidth={4} />}
                                      </div>

                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold overflow-hidden bg-[var(--surface-2)] shrink-0 border ${isSelected ? 'border-purple-500' : 'border-[var(--border)]'}`} style={{ color: 'var(--text)' }}>
                                          {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" /> : user.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-[10px] font-black uppercase tracking-tighter truncate ${isSelected ? 'text-purple-400' : 'text-[var(--text)]'}`}>{user.name}</p>
                                          <p className="text-[8px] font-bold uppercase opacity-40 tracking-wider truncate" style={{ color: 'var(--text)' }}>
                                            {user.cargo || user.role}
                                            {isManager && <span className="ml-2 text-[7px] bg-yellow-400 text-black px-1 rounded">GESTOR</span>}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </>
                        ) : (
                          <>
                            {projectMembers
                              .filter((pm: ProjectMember) => String(pm.id_projeto) === projectId)
                              .map((pm: ProjectMember) => ({ pm, u: users.find((user: User) => user.id === String(pm.id_colaborador)) }))
                              .filter((item: { pm: ProjectMember, u: User | undefined }) => !!item.u)
                              .sort((a: { pm: ProjectMember, u: User | undefined }, b: { pm: ProjectMember, u: User | undefined }) => (a.u?.name || "").localeCompare(b.u?.name || ""))
                              .map(({ pm, u }: { pm: ProjectMember, u: User | undefined }) => {
                                if (!u) return null;
                                return (
                                  <div key={u.id} className="px-3 py-2.5 rounded-xl border transition-all" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
                                    {/* Header with User Info */}
                                    <div className="flex items-center gap-2.5 mb-2.5">
                                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-[var(--border)]" style={{ backgroundColor: 'var(--surface)' }}>
                                        {u.avatarUrl
                                          ? <img src={u.avatarUrl} className="w-full h-full object-cover" />
                                          : <div className="w-full h-full flex items-center justify-center text-[9px] font-black uppercase" style={{ color: 'var(--primary)' }}>{u.name.substring(0, 2).toUpperCase()}</div>
                                        }
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-bold tracking-tight truncate" style={{ color: 'var(--text)' }}>{u.name}</p>
                                        <p className="text-[7px] font-black uppercase opacity-35 tracking-widest truncate mt-0.5" style={{ color: 'var(--text)' }}>{u.cargo || 'Consultor'}</p>
                                      </div>
                                    </div>

                                    {/* Metrics: ALOCADO (TAREFAS) + APONTADO */}
                                    {(() => {
                                      const metrics = teamOperationalBalance?.memberMetrics[u.id];
                                      const allocatedHours = metrics?.allocatedHours ?? 0;
                                      const reported = timesheetEntries
                                        .filter((e: TimesheetEntry) => e.projectId === projectId && e.userId === u.id)
                                        .reduce((sum: number, e: TimesheetEntry) => sum + (Number(e.totalHours) || 0), 0);
                                      const actualHours = metrics?.actualHours ?? reported;

                                      return (
                                        <div className="grid grid-cols-2 gap-1.5">
                                          <div className="flex flex-col items-center px-2 py-2 rounded-lg border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                                            <p className="text-[6px] font-black uppercase opacity-40 tracking-wider mb-0.5">Alocado (Tarefas)</p>
                                            <p className="text-[12px] font-black tabular-nums" style={{ color: 'var(--text)' }}>{formatDecimalToTime(allocatedHours)}</p>
                                          </div>
                                          <div className="flex flex-col items-center px-2 py-2 rounded-lg border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                                            <p className="text-[6px] font-black uppercase opacity-40 tracking-wider mb-0.5">Apontado</p>
                                            <p className="text-[12px] font-black tabular-nums" style={{ color: 'var(--text)' }}>{formatDecimalToTime(actualHours)}</p>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                );
                              })}


                            {/* EX-COLABORADORES (Com horas mas sem vínculo atual) */}
                            {(() => {
                              const currentMemberIds = new Set(projectMembers.filter((pm: ProjectMember) => String(pm.id_projeto) === projectId).map((pm: ProjectMember) => String(pm.id_colaborador)));
                              const formerMembersWithHours = (Array.from(new Set<string>(
                                timesheetEntries
                                  .filter((e: TimesheetEntry) => e.projectId === projectId && !currentMemberIds.has(String(e.userId)))
                                  .map((e: TimesheetEntry) => String(e.userId))
                              )) as string[]).map((userId: string) => users.find((u: User) => String(u.id) === userId)).filter(Boolean) as User[];

                              if (formerMembersWithHours.length === 0) return null;

                              return (
                                <div className="mt-8 space-y-3">
                                  <div className="flex items-center gap-2 px-2">
                                    <Archive size={12} className="opacity-30" style={{ color: 'var(--text)' }} />
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Histórico de Contribuição</p>
                                  </div>
                                  {formerMembersWithHours.map((u: User) => u && (
                                    <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl border border-dashed transition-all opacity-70" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
                                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                                        {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover opacity-60" /> : <div className="w-full h-full flex items-center justify-center text-[9px] font-black opacity-40" style={{ color: 'var(--muted)' }}>{u.name.substring(0, 2).toUpperCase()}</div>}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-bold truncate" style={{ color: 'var(--text)' }}>{u.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <p className="text-[8px] font-black uppercase tracking-wider opacity-40" style={{ color: 'var(--text)' }}>{u.cargo || 'Consultor'}</p>
                                          <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-500">Ex-membro</span>
                                        </div>

                                        <div className="mt-2.5 pt-2 border-t border-dashed flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                                          <div>
                                            {(() => {
                                              const reported = timesheetEntries
                                                .filter((e: TimesheetEntry) => e.projectId === projectId && e.userId === u.id)
                                                .reduce((sum: number, e: TimesheetEntry) => sum + (Number(e.totalHours) || 0), 0);
                                              return (
                                                <div className="flex items-center gap-3">
                                                  <p className="text-[7px] font-black uppercase opacity-40">Total Apontado</p>
                                                  <p className="text-[12px] font-black" style={{ color: 'var(--text)' }}>{formatDecimalToTime(reported)}</p>
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </div>

                    {(isEditing || project?.docLink) && (
                      <div className="p-6 rounded-[32px] border shadow-sm" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}><FileText size={16} /> Documentação</h3>
                        {isEditing ? (
                          <div className="space-y-3">
                            <input value={formData.docLink} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, docLink: e.target.value })} className="w-full text-[11px] p-2 rounded border outline-none" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} placeholder="Link do Sharepoint/OneDrive" />
                          </div>
                        ) : (
                          <a href={project?.docLink || '#'} target="_blank" className="flex items-center justify-between p-3 rounded-2xl border transition-all" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)', borderColor: 'var(--info)' }}>
                            <span className="text-[10px] font-black uppercase">Doc. Principal</span>
                            <LinkIcon size={14} />
                          </a>
                        )}
                      </div>
                    )}

                    {isEditing && (
                      <button
                        onClick={() => {
                          const projectTasks = tasks.filter((t: Task) => t.projectId === projectId);
                          const hasTasks = projectTasks.length > 0;
                          setItemToDelete({ id: projectId!, type: 'project', force: hasTasks });
                        }}
                        className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all"
                        style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      >
                        <Trash2 size={14} className="inline mr-2" /> Deletar Projeto
                      </button>
                    )}
                  </div>
                </div>
              </motion.div >
            ) : (
              <motion.div
                key="tasks"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* FILTERS FOR TASKS TABS */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <h3 className="text-xl font-bold uppercase tracking-tight" style={{ color: 'var(--text)' }}>Tarefas</h3>
                    <div className="px-3 py-1 rounded-full text-[10px] font-black" style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}>
                      {filteredTasks.length} TAREFAS
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowArchived(!showArchived)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black transition-all border uppercase tracking-wider ${showArchived ? 'bg-amber-500/20 border-amber-500/50 text-amber-600 shadow-lg shadow-amber-500/10' : 'bg-[var(--bg)] border-[var(--border)] text-[var(--muted)] opacity-60 hover:opacity-100'}`}
                    >
                      <Archive size={14} className={showArchived ? "fill-amber-500/30" : ""} />
                      {(() => {
                        const archivedCount = projectTasks.filter((t: Task) => t.status === 'Done' || t.fora_do_fluxo).length;
                        return showArchived ? `Ocultar ${archivedCount} Arquivadas` : `Ver ${archivedCount} Arquivadas`;
                      })()}
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase" style={{ color: 'var(--muted)' }}>Filtrar por Status:</span>
                    <div className="flex bg-white/5 p-1 rounded-xl gap-1">
                      {[
                        { label: 'Todos', value: 'Todos' },
                        { label: 'Pré-Projeto', value: 'Todo' },
                        { label: 'Análise', value: 'Review' },
                        { label: 'Andamento', value: 'In Progress' },
                        { label: 'Teste', value: 'Testing' },
                        { label: 'Concluído', value: 'Done' }
                      ].map(item => (
                        <button
                          key={item.value}
                          onClick={() => setSelectedStatus(item.value)}
                          className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${selectedStatus === item.value ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'hover:bg-black/5'}`}
                          style={{ color: selectedStatus === item.value ? 'white' : 'var(--text-2)' }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                  {filteredTasks.length > 0 ? (
                    filteredTasks.map((task: Task) => (
                      <ProjectTaskCard
                        key={task.id}
                        project={project}
                        task={task}
                        users={users}
                        timesheetEntries={timesheetEntries}
                        tasks={tasks}
                        holidays={holidays}
                        absences={absences}
                        isAdmin={isAdmin}
                        currentUserId={currentUser?.id}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                      />
                    ))
                  ) : (
                    <div className="col-span-full py-24 text-center rounded-[32px] border-2 border-dashed" style={{ borderColor: 'var(--border)' }}>
                      <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-20" style={{ color: 'var(--text)' }} />
                      <p className="font-bold uppercase text-xs tracking-widest" style={{ color: 'var(--muted)' }}>Nenhuma tarefa encontrada com os filtros atuais.</p>
                      <button
                        onClick={() => {
                          if (!canCreateTask) {
                            alert('Complete as informações obrigatórias do projeto (Finanças, Timeline, Responsáveis e Equipe) antes de criar tarefas.');
                            return;
                          }
                          navigate(`/tasks/new?project=${projectId}&client=${project?.clientId}`);
                        }}
                        className={`mt-6 px-6 py-2 rounded-xl font-bold text-sm transition-all ${canCreateTask ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-50'}`}
                      >
                        Criar Nova Tarefa
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!itemToDelete}
        title={itemToDelete?.force ? "⚠️ EXCLUSÃO CRÍTICA (PROJETO COM DADOS)" : "Confirmar Exclusão"}
        message={
          itemToDelete?.force ? (
            <div className="space-y-4">
              <p className="text-red-500 font-black">
                Este projeto possui tarefas e possivelmente horas apontadas. A exclusão forçada removerá permanentemente TODO o histórico do projeto!
              </p>
              {!ALL_ADMIN_ROLES.includes(String(currentUser?.role || '').trim().toLowerCase()) ? (
                <p className="text-xs p-3 bg-red-500/10 rounded-lg text-red-600 font-bold border border-red-500/20">
                  Bloqueado: Apenas o Administrador do Sistema pode realizar a exclusão forçada de projetos com dados.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-bold opacity-50">Para habilitar, digite o nome do projeto abaixo:</p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeleteConfirmText(e.target.value)}
                    placeholder={project?.name}
                    className="w-full p-3 rounded-xl border-2 border-red-500/30 outline-none focus:border-red-500 text-xs font-black bg-red-500/5 text-red-600"
                  />
                </div>
              )
              }
            </div>
          ) : "Esta ação é definitiva. Deseja continuar?"
        }
        confirmText={itemToDelete?.force ? "EXCLUIR TUDO" : "Confirmar"}
        onConfirm={async () => {
          if (itemToDelete?.type === 'project') {
            // Validações de segurança para delete forçada
            if (itemToDelete.force) {
              if (!ALL_ADMIN_ROLES.includes(String(currentUser?.role || '').trim().toLowerCase())) {
                alert('Apenas Administradores do Sistema podem excluir projetos com dados ativos.');
                return;
              }
              if (deleteConfirmText !== project?.name) {
                alert('O nome do projeto digitado está incorreto.');
                return;
              }
            }

            try {
              setLoading(true);
              await deleteProject(itemToDelete.id, itemToDelete.force);
              navigate(isAdmin ? '/admin/projects' : '/developer/projects');
            } catch (error: any) {
              const msg = error.message || "";
              if (msg.includes("tarefas criadas") || msg.includes("hasTasks") || msg.includes("400")) {
                setItemToDelete({ id: itemToDelete.id, type: 'project', force: true });
                setDeleteConfirmText('');
              } else if (error.message?.includes("403")) {
                alert("Acesso Negado: Apenas Administradores do Sistema podem excluir projetos com tarefas.");
                setItemToDelete(null);
              } else {
                alert(msg || 'Erro ao excluir projeto.');
              }
            } finally {
              setLoading(false);
            }
          }
        }}
        onCancel={() => { setItemToDelete(null); setDeleteConfirmText(''); }}
        disabled={loading || !!(itemToDelete?.force && (!ALL_ADMIN_ROLES.includes(String(currentUser?.role || '').trim().toLowerCase()) || deleteConfirmText !== project?.name))}
      />
    </div>
  );
};

// SUBCOMPONENT
const ProjectTaskCard: React.FC<{
  project: Project,
  task: Task,
  users: User[],
  timesheetEntries: TimesheetEntry[],
  tasks: Task[],
  holidays: Holiday[],
  absences: Absence[],
  isAdmin: boolean,
  currentUserId?: string,
  onClick: () => void
}> = ({ project, task, users, timesheetEntries, tasks, holidays, absences, isAdmin, currentUserId, onClick }) => {
  const navigate = useNavigate();
  const dev = users.find((u: User) => u.id === task.developerId);
  const taskEntries = timesheetEntries.filter((e: TimesheetEntry) => e.taskId === task.id);
  const totalActualHours = taskEntries.reduce((sum: number, e: TimesheetEntry) => sum + (Number(e.totalHours) || 0), 0);
  const totalAllocatedHours = Number(task.estimatedHours) || 0;

  const statusMap: Record<string, { label: string, color: string, bg: string }> = {
    'Todo': { label: 'PRÉ-PROJETO', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    'In Progress': { label: 'ANDAMENTO', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    'Review': { label: 'ANÁLISE', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    'Testing': { label: 'TESTE', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    'Done': { label: 'CONCLUÍDO', color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
  };

  const statusInfo = statusMap[task.status] || { label: String(task.status).toUpperCase(), color: 'text-slate-400', bg: 'bg-slate-400/10' };
  const deadlineTime = task.estimatedDelivery ? parseSafeDate(task.estimatedDelivery) : null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const isLate = task.status !== 'Done' && deadlineTime && deadlineTime < today.getTime();
  const isToday = task.status !== 'Done' && deadlineTime && new Date(deadlineTime).toISOString().split('T')[0] === today.toISOString().split('T')[0];

  // Membros individuais da tarefa (Responsável + Colaboradores)
  const taskMemberIds = Array.from(new Set([
    task.developerId,
    ...(task.collaboratorIds || [])
  ])).filter(Boolean).map(String);

  const teamMembers = users.filter(u => taskMemberIds.includes(String(u.id)));

  // Horas do responsável principal
  const devActualHours = taskEntries
    .filter(e => String(e.userId) === String(task.developerId))
    .reduce((sum, e) => sum + (Number(e.totalHours) || 0), 0);

  // Formatação de datas
  const deliveryDateFormatted = task.estimatedDelivery ? new Date(task.estimatedDelivery + 'T12:00:00').toLocaleDateString('pt-BR') : '--/--/----';

  // Cálculo de dias úteis da tarefa
  const getBusinessDays = (dStart: string, dEnd: string) => {
    let count = 0;
    let curr = new Date(dStart + 'T12:00:00');
    const stop = new Date(dEnd + 'T12:00:00');
    if (isNaN(curr.getTime()) || isNaN(stop.getTime())) return 0;
    while (curr <= stop) {
      const day = curr.getDay();
      if (day !== 0 && day !== 6) {
        const ds = curr.toISOString().split('T')[0];
        const isH = holidays.some((h: Holiday) => ds >= h.date && ds <= (h.endDate || h.date));
        if (!isH) count++;
      }
      curr.setDate(curr.getDate() + 1);
    }
    return Math.max(1, count);
  };

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      onClick={onClick}
      className="cursor-pointer p-8 rounded-[40px] border transition-all relative overflow-hidden group shadow-xl hover:shadow-2xl flex flex-col gap-6"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)'
      }}
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-all" />

      {/* HEADER: BADGES */}
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-black px-4 py-2 rounded-xl tracking-widest ${statusInfo.bg} ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
        {isToday && (
          <span className="flex items-center gap-1.5 text-[10px] font-black text-amber-100 bg-amber-500/20 px-4 py-2 rounded-xl tracking-widest border border-amber-500/30">
            <Zap size={14} className="text-amber-400" /> HOJE
          </span>
        )}
        {isLate && !isToday && (
          <span className="flex items-center gap-1.5 text-[10px] font-black text-rose-100 bg-rose-500/20 px-4 py-2 rounded-xl tracking-widest border border-rose-500/30">
            <Clock size={14} className="text-rose-400" /> ATRASADA
          </span>
        )}
        {totalActualHours > totalAllocatedHours && totalAllocatedHours > 0 && (
          <span className="flex items-center gap-1.5 text-[10px] font-black text-red-100 bg-red-600/20 px-4 py-2 rounded-xl tracking-widest border border-red-500/30 animate-pulse">
            <Zap size={14} className="text-red-400" /> HORAS EXCEDIDAS
          </span>
        )}
        {task.fora_do_fluxo && (
          <span className="text-[10px] font-black bg-white/10 text-white/60 px-4 py-2 rounded-xl border border-white/10 uppercase tracking-widest">FORA DO FLUXO</span>
        )}
      </div>

      {/* TITLE */}
      <h3 className="font-black text-2xl leading-tight tracking-tight group-hover:text-purple-500 transition-colors line-clamp-2" style={{ color: 'var(--text)' }}>
        {task.title}
      </h3>

      {/* INFO ROW GRID */}
      <div className="grid grid-cols-3 gap-2 p-5 rounded-3xl border bg-[var(--surface-hover)] border-[var(--border)]">
        <div className="flex flex-col gap-1.5">
          <p className="text-[8px] font-black uppercase tracking-tighter flex items-center gap-1 opacity-50" style={{ color: 'var(--text)' }}>
            <Calendar size={10} /> Prazo
          </p>
          <p className={`text-[11px] font-black ${isLate ? 'text-rose-500' : ''}`} style={{ color: isLate ? undefined : 'var(--text)' }}>
            {deliveryDateFormatted}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 border-x px-2" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <p className="text-[8px] font-black uppercase tracking-tighter flex items-center gap-1 opacity-50" style={{ color: 'var(--text)' }}>
            <CalendarDays size={10} /> Dias Úteis
          </p>
          <p className="text-[11px] font-black" style={{ color: 'var(--text)' }}>
            {task.scheduledStart && task.estimatedDelivery ?
              `${getBusinessDays(task.scheduledStart as string, task.estimatedDelivery as string)} d` :
              '--'
            }
          </p>
        </div>
        <div className="flex flex-col gap-1.5 pl-1">
          <p className="text-[8px] font-black uppercase tracking-tighter flex items-center gap-1 opacity-50" style={{ color: 'var(--text)' }}>
            <Clock size={10} /> Horas
          </p>
          <p className="text-[11px] font-black" style={{ color: 'var(--text)' }}>
            {formatDecimalToTime(totalAllocatedHours)} <span className="opacity-20 mx-0.5">/</span> {formatDecimalToTime(totalActualHours)}
          </p>
        </div>
      </div>

      {/* EVOLUÇÃO (Progress) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest opacity-50" style={{ color: 'var(--text)' }}>Evolução</span>
          <span className="text-xs font-black text-purple-500">{task.progress}%</span>
        </div>
        <div className="h-2 rounded-full border overflow-hidden bg-[var(--surface-hover)] border-[var(--border)]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${task.progress}%` }}
            className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 shadow-[0_0_15px_rgba(147,51,234,0.3)]"
          />
        </div>
      </div>

      {/* MAIN RESPONSIBLE */}
      <div className="pt-4 border-t flex items-center justify-between border-[var(--border)]">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 p-0.5 shadow-inner bg-[var(--surface-hover)] border-[var(--border)]">
            {dev?.avatarUrl ? (
              <img src={dev.avatarUrl} className="w-full h-full object-cover rounded-[10px]" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-black opacity-40" style={{ color: 'var(--text)' }}>
                {task.developer?.substring(0, 2).toUpperCase() || '??'}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="font-black text-base tracking-tight" style={{ color: 'var(--text)' }}>{task.developer || 'Sem responsável'}</p>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--text)' }}>Responsável</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-black" style={{ color: 'var(--text)' }}>
            {formatDecimalToTime(totalAllocatedHours)} <span className="opacity-20">/</span> {formatDecimalToTime(devActualHours)}
          </p>
        </div>
      </div>

      {/* TEAM FOOTER SUMMARY */}
      <div className="mt-auto p-4 rounded-2xl border flex items-center justify-between bg-[var(--surface-hover)] border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-3">
            {teamMembers.slice(0, 3).map((m, idx) => (
              <div key={m.id} className="w-7 h-7 rounded-lg border-2 overflow-hidden ring-1 shadow-sm bg-[var(--surface)] border-[var(--border)] ring-[#0000000a]" title={m.name}>
                {m.avatarUrl ? <img src={m.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] font-bold opacity-50" style={{ color: 'var(--text)' }}>{m.name.charAt(0)}</div>}
              </div>
            ))}
            {teamMembers.length > 3 && (
              <div className="w-7 h-7 rounded-lg border-2 border-[#1e1b4b] bg-[#4c1d95] flex items-center justify-center text-[8px] font-black text-white ring-1 ring-[#0000000a]">
                +{teamMembers.length - 3}
              </div>
            )}
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-40" style={{ color: 'var(--text)' }}>Equipe</span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest opacity-50" style={{ color: 'var(--text)' }}>
          {teamMembers.length} {teamMembers.length === 1 ? 'membro' : 'membros'}
        </span>
      </div>

      {/* QUICK ACTION BUTTON (Only for concerned devs) */}
      {task.status !== 'Done' && !isAdmin && (
        task.developerId === currentUserId || (task.collaboratorIds || []).includes(currentUserId || '')
      ) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/timesheet/new?taskId=${task.id}&projectId=${task.projectId}&clientId=${task.clientId}&date=${new Date().toISOString().split('T')[0]}`);
            }}
            className="w-full py-4 bg-white text-indigo-950 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-purple-500 hover:text-white transition-all shadow-xl active:scale-95"
          >
            Apontar Horas
          </button>
        )}
    </motion.div>
  );
};

export default ProjectDetailView;
