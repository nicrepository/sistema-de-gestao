// ProjectDetailView.tsx - Dashboard Unificado do Projeto
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useDataController } from '@/controllers/useDataController';
import {
  ArrowLeft, Plus, Edit, CheckSquare, Clock, Filter, ChevronDown, Check,
  Trash2, LayoutGrid, Target, ShieldAlert, Link as LinkIcon, Users,
  Calendar, Info, Zap, RefreshCw, AlertTriangle, StickyNote, DollarSign,
  TrendingUp, BarChart2, Save, FileText, Settings, Shield, AlertCircle, Archive
} from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserStatus } from '@/utils/userStatus';
import * as CapacityUtils from '@/utils/capacity';
import { formatDecimalToTime } from '@/utils/normalizers';
import { getProjectStatusByTimeline } from '@/utils/projectStatus';

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
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = projectId === 'new' || location.pathname.endsWith('/new');
  const isEditingRoute = location.pathname.endsWith('/edit');
  const {
    tasks, clients, projects, users, projectMembers, timesheetEntries,
    absences, holidays,
    deleteProject, deleteTask, updateProject, createProject, getProjectMembers,
    addProjectMember, removeProjectMember
  } = useDataController();

  const { currentUser, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'tasks' | 'technical'>('technical');
  const [isEditing, setIsEditing] = useState(isNew || isEditingRoute);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'project', force?: boolean } | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('Todos');
  const [showArchived, setShowArchived] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showArchivedOverview, setShowArchivedOverview] = useState(false);

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

  // Redirecionar colaboradores para aba de tarefas
  useEffect(() => {
    if (!isAdmin) {
      setActiveTab('tasks');
    }
  }, [isAdmin]);

  const project = projects.find(p => p.id === projectId);
  const client = project ? clients.find(c => c.id === project.clientId) : (paramClientId ? clients.find(c => c.id === paramClientId) : null);

  // --- FORM STATE ---
  const [formData, setFormData] = useState({
    name: '',
    clientId: '',
    partnerId: '',
    status: 'Não Iniciado',
    description: '',
    managerClient: '',
    responsibleNicLabsId: '',
    startDate: '',
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
    fora_do_fluxo: false
  });

  useEffect(() => {
    if (isNew && paramClientId) {
      setFormData(prev => ({ ...prev, clientId: paramClientId }));
    }
  }, [isNew, paramClientId]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [memberAllocations, setMemberAllocations] = useState<Record<string, number>>({});

  // balanceAllocations removido (cálculos nas tarefas)

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
        fora_do_fluxo: (project as any).fora_do_fluxo || false
      });
      const membersResult = projectMembers.filter(pm => String(pm.id_projeto) === projectId);
      const selectedIds = membersResult.map(m => String(m.id_colaborador));
      setSelectedUsers(selectedIds);

      const initialAllocations: Record<string, number> = {};
      let totalSum = 0;
      membersResult.forEach(m => {
        const perc = Number(m.allocation_percentage) || 0;
        initialAllocations[String(m.id_colaborador)] = perc;
        totalSum += perc;
      });

      // Se a soma não for 100 e houver membros, re-balanceia automaticamente
      if (totalSum !== 100 && selectedIds.length > 0) {
        // Se houver membros, inicializa com 100% (flag de presença)
        const all100: Record<string, number> = {};
        selectedIds.forEach(id => all100[id] = 100);
        setMemberAllocations(all100);
      } else {
        setMemberAllocations(initialAllocations);
      }
    } else if (isNew) {
      // Reset form for new project
      setFormData({
        name: '',
        clientId: paramClientId || '',
        partnerId: '',
        status: 'Não Iniciado',
        description: '',
        managerClient: '',
        responsibleNicLabsId: '',
        startDate: new Date().toISOString().split('T')[0],
        estimatedDelivery: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
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
        fora_do_fluxo: false
      });
      setSelectedUsers([]);
      setMemberAllocations({});
    }
  }, [project, projectId, projectMembers, isNew, paramClientId]);

  const projectTasks = useMemo(() => {
    const pTasks = tasks.filter(t => t.projectId === projectId);
    if (currentUser && !isAdmin) {
      return pTasks.filter(t => t.developerId === currentUser.id || (t.collaboratorIds && t.collaboratorIds.includes(currentUser.id)));
    }
    return pTasks;
  }, [tasks, projectId, currentUser, isAdmin]);

  const isContinuousMode = true; // Forçar modo contínuo permanentemente conforme solicitado

  const performance = useMemo(() => {
    if (!project) return null;
    const pTimesheets = timesheetEntries.filter(e => e.projectId === projectId);
    const consumedHours = pTimesheets.reduce((acc, entry) => acc + (Number(entry.totalHours) || 0), 0);
    const committedCost = pTimesheets.reduce((acc, entry) => {
      const u = users.find(u => u.id === entry.userId);
      return acc + (entry.totalHours * (u?.hourlyCost || 0));
    }, 0);
    const totalEstimated = projectTasks.reduce((acc, t) => {
      const reported = timesheetEntries
        .filter(e => e.taskId === t.id)
        .reduce((sum, e) => sum + (Number(e.totalHours) || 0), 0);
      return acc + Math.max(t.estimatedHours || 0, reported);
    }, 0);

    const pStartTs = parseSafeDate(project.startDate) || Date.now();
    const pEndTs = parseSafeDate(project.estimatedDelivery) || pStartTs;
    const projectDurationTs = Math.max(0, pEndTs - pStartTs) + ONE_DAY;

    const memberIds = new Set(
      projectMembers.filter(pm => String(pm.id_projeto) === projectId).map(pm => String(pm.id_colaborador))
    );

    const projectFactors = projectTasks.map(t => {
      const factor = Number(t.estimatedHours) || 0;
      return { id: t.id, factor, progress: t.progress || 0 };
    });
    const totalFactor = projectFactors.reduce((acc, f) => acc + f.factor, 0);

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

    const memberTimesheets = pTimesheets.filter(e => memberIds.has(String(e.userId)));

    const realStartDate = memberTimesheets.length > 0
      ? new Date(Math.min(...memberTimesheets.map(e => new Date(e.date + 'T12:00:00').getTime())))
      : null;

    const allTasksDone = projectTasks.length > 0 && projectTasks.every(t => t.status === 'Done');
    const realEndDate = allTasksDone && memberTimesheets.length > 0
      ? new Date(Math.max(...memberTimesheets.map(e => new Date(e.date + 'T12:00:00').getTime())))
      : null;

    // --- CÁLCULOS ESPECÍFICOS PARA PROJETOS CONTÍNUOS ---
    let continuousPlannedValue = 0;
    if (project.startDate) {
      const start = new Date(project.startDate + 'T12:00:00');
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      let businessDays = 0;
      let curr = new Date(start);
      while (curr <= today) {
        const day = curr.getDay();
        if (day !== 0 && day !== 6) {
          const dateStr = curr.toISOString().split('T')[0];
          const isHoliday = holidays.some(h => {
            const hStart = h.date;
            const hEnd = h.endDate || h.date;
            return dateStr >= hStart && dateStr <= hEnd;
          });
          if (!isHoliday) businessDays++;
        }
        curr.setDate(curr.getDate() + 1);
      }
      continuousPlannedValue = businessDays * ((project as any).valor_diario || 0);
    }

    return { committedCost, consumedHours, weightedProgress, totalEstimated, plannedProgress, projection, realStartDate, realEndDate, projectFactors, totalFactor, continuousPlannedValue };
  }, [project, projectTasks, timesheetEntries, users, projectId, projectMembers, holidays]);

  const teamOperationalBalance = useMemo(() => {
    if (!isContinuousMode || !project || !project.startDate) return null;

    const startDate = new Date(project.startDate + 'T12:00:00');
    const endDate = project.estimatedDelivery ? new Date(project.estimatedDelivery + 'T12:00:00') : new Date(startDate);
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    // 1. Dicionário de dias -> contagem de ativos
    const activeProjectMembers = projectMembers.filter(pm => String(pm.id_projeto) === projectId);

    // Contabiliza total de dias úteis reais do projeto (descontando fins de semana e feriados)
    let totalBusinessDays = 0;
    let curr = new Date(startDate);
    while (curr <= endDate) {
      const day = curr.getDay();
      if (day !== 0 && day !== 6) {
        const dateStr = curr.toISOString().split('T')[0];
        const isHoliday = holidays.some(h => {
          const hStart = h.date;
          const hEnd = h.endDate || h.date;
          return dateStr >= hStart && dateStr <= hEnd;
        });
        if (!isHoliday) totalBusinessDays++;
      }
      curr.setDate(curr.getDate() + 1);
    }

    const totalProjectHours = totalBusinessDays * 8;
    const dividedIdealAccumulated = activeProjectMembers.length > 0 ? (totalProjectHours / activeProjectMembers.length) : 0;
    const currentBaseDaily = activeProjectMembers.length > 0 ? (8 / activeProjectMembers.length) : 8;

    // 2. Calcular métricas por integrante
    const memberMetrics: Record<string, {
      baseDaily: number;
      idealAccumulated: number;
      actualHours: number;
      deviation: number;
      deviationPercent: number;
      status: 'green' | 'yellow' | 'red';
    }> = {};

    activeProjectMembers.forEach(pm => {
      const userId = String(pm.id_colaborador);
      const idealAccumulated = dividedIdealAccumulated;

      const actualHours = timesheetEntries
        .filter(e => e.projectId === projectId && e.userId === userId)
        .reduce((sum, e) => sum + (Number(e.totalHours) || 0), 0);

      const deviation = actualHours - idealAccumulated;
      const deviationPercent = idealAccumulated > 0 ? (deviation / idealAccumulated) : 0;

      let status: 'green' | 'yellow' | 'red' = 'green';
      const absPercent = Math.abs(deviationPercent);
      if (absPercent > 0.15) status = 'red';
      else if (absPercent > 0.10) status = 'yellow';
      else if (absPercent <= 0.05) status = 'green';
      else status = 'yellow';

      memberMetrics[userId] = {
        baseDaily: currentBaseDaily,
        idealAccumulated,
        actualHours,
        deviation,
        deviationPercent: deviationPercent * 100,
        status
      };
    });

    // 3. Lógica de Sugestão
    const suggestions: Record<string, number> = {};
    const absoluteDeviationsSum = Object.values(memberMetrics).reduce((sum, m) => sum + Math.abs(m.deviation), 0);
    const hasSignificantDeviation = Object.values(memberMetrics).some(m => Math.abs(m.deviationPercent) > 10);

    if (hasSignificantDeviation && absoluteDeviationsSum > 0) {
      let rawWeights: Record<string, number> = {};
      let totalWeight = 0;

      activeProjectMembers.forEach(pm => {
        const userId = String(pm.id_colaborador);
        const weight = Math.max(0.1, 1 - (memberMetrics[userId].deviation / absoluteDeviationsSum));
        rawWeights[userId] = weight;
        totalWeight += weight;
      });

      let totalSuggested = 0;
      activeProjectMembers.forEach(pm => {
        const userId = String(pm.id_colaborador);
        let suggested = 8 * (rawWeights[userId] / totalWeight);
        suggested = Math.max(1, Math.min(8, suggested));
        suggestions[userId] = suggested;
        totalSuggested += suggested;
      });

      // Arredondamento
      let roundedTotal = 0;
      const userIds = Object.keys(suggestions);
      userIds.forEach(uid => {
        suggestions[uid] = Math.round(suggestions[uid] * 10) / 10;
        roundedTotal += suggestions[uid];
      });

      const diff = 8 - roundedTotal;
      if (diff !== 0 && userIds.length > 0) {
        suggestions[userIds[userIds.length - 1]] = Math.round((suggestions[userIds[userIds.length - 1]] + diff) * 10) / 10;
      }
    }

    return { memberMetrics, suggestions, hasSignificantDeviation, todayActiveCount: activeProjectMembers.length };
  }, [isContinuousMode, project, projectMembers, timesheetEntries, holidays, projectId]);


  const projectHolidays = useMemo(() => {
    if (!project || !project.startDate || !project.estimatedDelivery) return [];
    const start = new Date(project.startDate);
    const end = new Date(project.estimatedDelivery);
    return holidays.filter(h => {
      const hStart = new Date(h.date);
      const hEnd = h.endDate ? new Date(h.endDate) : hStart;
      return (hStart <= end && hEnd >= start);
    });
  }, [holidays, project]);

  const projectAbsences = useMemo(() => {
    if (!project || !project.startDate || !project.estimatedDelivery) return [];
    const start = new Date(project.startDate);
    const end = new Date(project.estimatedDelivery);
    const memberIds = projectMembers.filter(pm => String(pm.id_projeto) === projectId).map(pm => String(pm.id_colaborador));
    return absences.filter(a => {
      const aStart = new Date(a.startDate);
      const aEnd = a.endDate ? new Date(a.endDate) : aStart;
      return memberIds.includes(String(a.userId)) &&
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
    const projectToCheck = projects.find(p => p.id === projectId);
    if (!projectToCheck) return;

    // Only check if currently "Not Started"
    if (projectToCheck.status === 'Não Iniciado') {
      const hasProgress = (performance?.weightedProgress || 0) > 0;
      const hasActiveTasks = projectTasks.some(t => t.status === 'In Progress' || t.status === 'Review' || t.status === 'Done');
      const hasHours = timesheetEntries.some(e => e.projectId === projectId);

      if (hasProgress || hasActiveTasks || hasHours) {
        // Auto-update to "In Progress"
        updateProject(projectId, { status: 'Em Andamento' } as any)
          .catch(err => console.error("Falha ao iniciar projeto automaticamente:", err));
      }
    }
  }, [project, projectId, performance, projectTasks, timesheetEntries, updateProject, isAdmin]);

  const handleSaveProject = async () => {
    if (!isNew && (!project || !projectId)) return;

    // Bloqueio removido conforme solicitação: permitir salvar mesmo incompleto.
    // if (isAdmin && isProjectIncomplete) {
    //   alert('Por favor, preencha todos os campos obrigatórios (Finanças, Timeline, Responsáveis e Equipe) antes de salvar.');
    //   return;
    // }


    setLoading(true);
    try {
      // Colaboradores só podem editar campos não-sensíveis
      if (!isAdmin) {
        const collaboratorData = {
          description: formData.description,
          weeklyStatusReport: formData.weeklyStatusReport,
          gapsIssues: formData.gapsIssues,
          importantConsiderations: formData.importantConsiderations,
        };
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

      const initialMembers = isNew ? [] : getProjectMembers(targetProjectId);

      // Para cada usuário selecionado, calculamos a alocação proporcional para projetos contínuos (8h / N)
      const isContinuous = formData.project_type === 'continuous';
      const numMembers = selectedUsers.length;
      const allocationPercentage = isContinuous ? (numMembers > 0 ? 100 / numMembers : 100) : 100;

      for (const userId of selectedUsers) {
        await addProjectMember(targetProjectId, userId, allocationPercentage);
      }

      // Remover membros que não estão mais na lista
      if (!isNew) {
        const toRemove = initialMembers.filter(uid => !selectedUsers.includes(uid));
        for (const userId of toRemove) await removeProjectMember(targetProjectId, userId);
      }

      setIsEditing(false);
      alert(isNew ? 'Projeto criado com sucesso!' : 'Projeto atualizado!');

      if (isNew && targetProjectId) {
        navigate(`/admin/projects/${targetProjectId}`, { replace: true });
      }
    } catch (error: any) {
      console.error(error);
      alert('Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    let t = projectTasks;

    // Filtro principal: Ocultar o que é arquivado ou fora do fluxo por padrão
    if (!showArchived) {
      t = t.filter(task => !task.fora_do_fluxo);

      // Se não houver filtro de status específico para 'Done', oculta os concluídos
      if (selectedStatus !== 'Done') {
        t = t.filter(task => task.status !== 'Done');
      }
    }

    if (selectedStatus !== 'Todos') {
      t = t.filter(task => task.status === selectedStatus);
    }

    return t.sort((a, b) => {
      const dateA = a.estimatedDelivery ? new Date(a.estimatedDelivery).getTime() : 2147483647000;
      const dateB = b.estimatedDelivery ? new Date(b.estimatedDelivery).getTime() : 2147483647000;
      return dateA - dateB;
    });
  }, [projectTasks, selectedStatus, showArchived]);

  const canCreateTask = !isProjectIncomplete;

  const teamMetrics = useMemo(() => {
    if (!project || !projectId) return {};
    const metrics: Record<string, { reported: number; remaining: number }> = {};

    const projectMems = projectMembers.filter(pm => String(pm.id_projeto) === projectId);

    projectMems.forEach(pm => {
      const userId = String(pm.id_colaborador);
      const reported = timesheetEntries
        .filter(e => e.projectId === projectId && e.userId === userId)
        .reduce((sum, e) => sum + (Number(e.totalHours) || 0), 0);

      const userTasks = tasks.filter(t => t.projectId === projectId && (t.developerId === userId || t.collaboratorIds?.includes(userId)));
      const estimated = userTasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
      const remaining = Math.max(0, estimated - reported);

      metrics[userId] = { reported, remaining };
    });

    return metrics;
  }, [projectId, projectMembers, timesheetEntries, tasks, project]);

  if (!project && !isNew) return <div className="p-20 text-center font-bold" style={{ color: 'var(--muted)' }}>Projeto não encontrado</div>;

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
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
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    onKeyDown={handleKeyDown}
                    className="bg-white/10 border-b border-white outline-none px-2 py-1 text-xl font-bold rounded transition-colors min-w-[300px]"
                  />
                ) : (
                  <h1 className="text-xl font-bold">{project?.name || 'Novo Projeto'}</h1>
                )}

                <div className="flex items-center gap-2">
                  {isAdmin && performance && ((performance?.weightedProgress || 0) < (performance?.plannedProgress || 0) - 5) && (
                    <span
                      className="text-[10px] font-black uppercase bg-red-500 text-white px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-lg shadow-red-500/20 animate-pulse"
                      title="Projeto com progresso abaixo do planejado."
                    >
                      <Clock size={12} /> ATR
                    </span>
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
                onClick={() => setActiveTab('technical')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'technical' ? 'bg-white text-purple-900 shadow-sm' : 'text-white/60 hover:text-white'}`}
              >
                Visão Geral
              </button>
            )}
            <button
              onClick={() => setActiveTab('tasks')}
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
      >
        <div className="max-w-7xl mx-auto space-y-5">

          {/* CRITICAL STATUS BANNER */}
          {isAdmin && (((performance?.weightedProgress || 0) < (performance?.plannedProgress || 0) - 5) || ((performance?.consumedHours || 0) > (project?.horas_vendidas || 0) && (project?.horas_vendidas || 0) > 0)) && (
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
                    {`Este projeto apresenta ${((performance?.weightedProgress || 0) < (performance?.plannedProgress || 0) - 5) ? 'atraso no cronograma' : ''}${((performance?.weightedProgress || 0) < (performance?.plannedProgress || 0) - 5) && ((performance?.consumedHours || 0) > (project?.horas_vendidas || 0)) ? ' e ' : ''}${((performance?.consumedHours || 0) > (project?.horas_vendidas || 0)) ? 'estouro de orçamento de horas' : ''}.`}
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
                <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
                  {/* Resumo do Planejamento - Cronograma & Peso */}
                  <div className="p-4 rounded-[32px] border shadow-sm relative overflow-hidden transition-all hover:shadow-md flex flex-col" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', height: '350px' }}>
                    <div className="flex items-center justify-between mb-2 shrink-0">
                      <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--muted)' }}>Cronograma & Peso</h4>
                      <div className="p-1 rounded-lg bg-purple-500/10 text-purple-600">
                        <Calendar size={10} />
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                      {projectTasks
                        .slice()
                        .sort((a, b) => {
                          const dateA = a.estimatedDelivery ? new Date(a.estimatedDelivery + 'T12:00:00').getTime() : Number.MAX_SAFE_INTEGER;
                          const dateB = b.estimatedDelivery ? new Date(b.estimatedDelivery + 'T12:00:00').getTime() : Number.MAX_SAFE_INTEGER;
                          return dateA - dateB;
                        })
                        .map(task => {
                          const taskReported = timesheetEntries
                            .filter(e => e.taskId === task.id)
                            .reduce((sum, e) => sum + (Number(e.totalHours) || 0), 0);

                          const pStartTs = parseSafeDate(project?.startDate) || Date.now();
                          const pEndTs = parseSafeDate(project?.estimatedDelivery) || pStartTs;
                          const tStartTs = parseSafeDate(task.scheduledStart || task.actualStart) || pStartTs;
                          const tEndTs = parseSafeDate(task.estimatedDelivery) || tStartTs;

                          const isDateOut = (tStartTs < pStartTs || tEndTs > pEndTs);

                          const startDate = task.scheduledStart ? new Date(task.scheduledStart + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '--/--';
                          const deliveryDate = task.estimatedDelivery ? new Date(task.estimatedDelivery + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;

                          // Peso = duração da tarefa / soma de todas as durações (= mesma fórmula do TaskDetail)
                          const taskFactor = performance?.projectFactors?.find(f => f.id === task.id)?.factor || 0;
                          const weight = (performance?.totalFactor || 0) > 0 ? (taskFactor / performance!.totalFactor) * 100 : 0;

                          const taskSoldHours = (project?.horas_vendidas || 0) > 0 ? (weight / 100) * project!.horas_vendidas : (Number(task.estimatedHours) || 0);
                          const collaboratorCount = (task.collaboratorIds?.length || 0);
                          const isHourOverrun = taskSoldHours > 0 && taskReported > taskSoldHours;
                          const isDelayed = task.status !== 'Done' && (
                            (task.estimatedDelivery && new Date(task.estimatedDelivery + 'T23:59:59') < new Date()) ||
                            (task.actualDelivery && new Date(task.actualDelivery + 'T23:59:59') < new Date())
                          );


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
                                  <span className={`px-1 py-px rounded shrink-0 ${task.progress === 100 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                    {task.progress}%
                                  </span>
                                  <span className="opacity-20 tabular-nums truncate">
                                    {startDate} → {deliveryDate || '--/--'}
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

                              <div className="h-0.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
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
                  </div>

                  {/* Progresso vs Plano */}
                  <div className="p-5 rounded-[32px] border shadow-sm relative transition-all hover:shadow-md h-[350px] flex flex-col" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>

                    <div className="mb-6 pb-6 border-b border-dashed shrink-0" style={{ borderColor: 'var(--border)' }}>
                      <h4 className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: 'var(--muted)' }}>Status de Entrega</h4>
                      {(() => {
                        // Check if continuous mode has no planned value configured
                        if (isContinuousMode && (!performance?.continuousPlannedValue || performance.continuousPlannedValue < 0.01)) {
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

                        const delta = isContinuousMode
                          ? ((performance?.committedCost || 0) / (performance?.continuousPlannedValue || 1) - 1) * 100
                          : (performance?.weightedProgress || 0) - (performance?.plannedProgress || 0);

                        const hourOverrun = !isContinuousMode && hasHours && (performance?.consumedHours || 0) > (project?.horas_vendidas || 0);

                        if (!hasTimeline && !isContinuousMode) {
                          return (
                            <div className="flex flex-col items-center justify-center py-4 opacity-30">
                              <Calendar size={20} className="mb-2" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Aguardando Timeline</span>
                            </div>
                          );
                        }

                        // Tolerance logic for status
                        let health;
                        if (isContinuousMode) {
                          // For continuous: Committed Cost vs Planned Value
                          health = delta <= 5 ? { label: 'No Prazo', color: 'text-emerald-500', bg: 'bg-emerald-500' } :
                            delta <= 15 ? { label: 'Alerta', color: 'text-amber-500', bg: 'bg-amber-500' } :
                              { label: 'Crítico', color: 'text-red-500', bg: 'bg-red-500' };
                        } else {
                          health = hourOverrun ? { label: 'Custo Excedido', color: 'text-red-500', bg: 'bg-red-500' } :
                            delta >= -1 ? { label: 'No Prazo', color: 'text-emerald-500', bg: 'bg-emerald-500' } :
                              delta >= -10 ? { label: 'Atraso Leve', color: 'text-amber-500', bg: 'bg-amber-500' } :
                                { label: 'Em Atraso', color: 'text-red-500', bg: 'bg-red-500' };
                        }

                        return (
                          <div className="flex flex-col items-center justify-center py-1">
                            <div className={`w-3 h-3 rounded-full ${health.bg} animate-pulse shadow-[0_0_12px_rgba(0,0,0,0.1)] mb-2`} />
                            <span className={`text-xl font-black uppercase tracking-tighter ${health.color}`}>{health.label}</span>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                                Desvio: {delta > 0 ? '+' : ''}{Math.round(delta)}%
                              </span>
                              {hourOverrun && <span className="text-[7px] font-black text-red-500 uppercase">Eficiência Negativa</span>}
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    <h4 className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: 'var(--muted)' }}>{isContinuousMode ? 'Rendimento Contínuo' : 'Progresso vs Plano'}</h4>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                          <span style={{ color: 'var(--text)' }}>PLANO — VALOR RENDIDO ESTIMADO</span>
                          <span style={{ color: isContinuousMode ? 'var(--warning)' : 'var(--info)' }}>
                            {isContinuousMode
                              ? (performance?.continuousPlannedValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              : `${hasTimeline ? Math.round(performance?.plannedProgress || 0) : '--'}%`}
                          </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
                          <div
                            className={`h-full transition-all duration-1000 ${isContinuousMode ? 'bg-amber-500' : 'bg-blue-500'}`}
                            style={{
                              width: isContinuousMode
                                ? `${Math.min(100, ((performance?.continuousPlannedValue || 0) / (Math.max(performance?.continuousPlannedValue || 0, performance?.committedCost || 0) || 1)) * 100)}%`
                                : `${hasTimeline ? (performance?.plannedProgress || 0) : 0}%`
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                          <span style={{ color: 'var(--text)' }}>CUSTO REAL APURADO</span>
                          <span style={{ color: 'var(--success)' }}>
                            {isContinuousMode
                              ? (performance?.committedCost || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              : `${hasTimeline ? Math.round(performance?.weightedProgress || 0) : '--'}%`}
                          </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
                          <div
                            className="h-full bg-emerald-500 transition-all duration-1000"
                            style={{
                              width: isContinuousMode
                                ? `${Math.min(100, ((performance?.committedCost || 0) / (Math.max(performance?.continuousPlannedValue || 0, performance?.committedCost || 0) || 1)) * 100)}%`
                                : `${Math.min(100, (hasTimeline ? performance?.weightedProgress : 0) || 0)}%`
                            }}
                          />
                        </div>
                      </div>
                      {isContinuousMode && (
                        <p className="text-[7px] font-bold opacity-30 uppercase mt-2">
                          * Barras de progresso proporcionais entre Plano e Real.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Finanças (Visible only to Admin) */}
                  {isAdmin && (
                    <div className="p-5 rounded-[32px] border shadow-sm relative transition-all hover:shadow-md h-[350px] flex flex-col" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>

                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Finanças</h4>
                      </div>

                      {isContinuousMode && (
                        <div className="space-y-4">
                          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 mb-4">
                            <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest flex items-center gap-2">
                              <Info size={12} /> Projeto Contínuo
                            </p>
                            <p className="text-[9px] font-bold opacity-60 mt-1 uppercase leading-tight">
                              Escopo mensal baseado em valor diário. A alocação do time é calculada automaticamente (8h/N).
                            </p>
                          </div>

                          {isEditing ? (
                            <div className="space-y-4">
                              <div>
                                <label className="text-[9px] font-bold uppercase mb-1 block" style={{ color: 'var(--muted)' }}>Valor Diário (8h) (R$)</label>
                                <input
                                  type="number"
                                  value={formData.valor_diario || ''}
                                  onChange={e => setFormData({ ...formData, valor_diario: e.target.value === '' ? 0 : Number(e.target.value) })}
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
                                    onChange={e => setFormData({ ...formData, valor_total_rs: e.target.value === '' ? 0 : Number(e.target.value) })}
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
                                    onChange={e => setFormData({ ...formData, horas_vendidas: e.target.value === '' ? 0 : Number(e.target.value) })}
                                    onKeyDown={handleKeyDown}
                                    className="text-xs p-2 rounded w-full border outline-none font-bold transition-colors bg-[var(--bg)] border-[var(--border)]"
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
                      )}
                    </div>
                  )}
                  {/* Timeline do Projeto */}
                  <div className="p-5 rounded-[32px] border shadow-sm relative transition-all hover:shadow-md h-[350px] flex flex-col" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <h4 className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Timeline do Projeto</h4>
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] font-black uppercase mb-1 block" style={{ color: 'var(--muted)' }}>Data de Início</label>
                            <input
                              type="date"
                              value={formData.startDate}
                              onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                              onKeyDown={handleKeyDown}
                              className="text-xs p-2 rounded w-full border outline-none font-bold transition-colors bg-[var(--bg)] border-[var(--border)]"
                              style={{ color: 'var(--text)' }}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black uppercase mb-1 block" style={{ color: 'var(--muted)' }}>Data de Entrega</label>
                            <input
                              type="date"
                              value={formData.estimatedDelivery}
                              onChange={e => setFormData({ ...formData, estimatedDelivery: e.target.value })}
                              onKeyDown={handleKeyDown}
                              className="text-xs p-2 rounded w-full border outline-none font-bold transition-colors bg-[var(--bg)] border-[var(--border)]"
                              style={{ color: 'var(--text)' }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col justify-between space-y-8 py-2">
                        <div className="space-y-8">
                          <div className="grid grid-cols-2 gap-8">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Data de Início</p>
                              <p className="text-sm font-black" style={{ color: 'var(--text)' }}>
                                {project?.startDate ? project?.startDate.split('T')[0].split('-').reverse().join('/') : '--'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Início Real</p>
                              <p className={`text-sm font-black ${performance?.realStartDate ? 'text-emerald-500' : 'opacity-30'}`}>
                                {performance?.realStartDate ? performance?.realStartDate.toLocaleDateString('pt-BR') : '--'}
                              </p>
                            </div>
                          </div>

                          {project?.startDate && project?.estimatedDelivery && (
                            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-center">
                              <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Resumo do Período</p>
                              <p className="text-sm font-black mt-1" style={{ color: 'var(--text)' }}>
                                {project.estimatedDelivery.split('T')[0].split('-').reverse().join('/')}
                              </p>
                              <p className="text-[8px] font-bold opacity-30 mt-1 uppercase">Baseado no período planejado</p>

                              <div className="mt-3 pt-3 border-t border-amber-500/10">
                                <p className="text-[12px] font-black text-amber-600">
                                  {(() => {
                                    const start = new Date(project.startDate + 'T12:00:00');
                                    const end = new Date(project.estimatedDelivery + 'T12:00:00');
                                    let businessDays = 0;
                                    const current = new Date(start);
                                    while (current <= end) {
                                      const day = current.getDay();
                                      if (day !== 0 && day !== 6) {
                                        const dateStr = current.toISOString().split('T')[0];
                                        const isHoliday = holidays.some(h => {
                                          const hStart = h.date;
                                          const hEnd = h.endDate || h.date;
                                          return dateStr >= hStart && dateStr <= hEnd;
                                        });
                                        if (!isHoliday) businessDays++;
                                      }
                                      current.setDate(current.getDate() + 1);
                                    }
                                    return `${businessDays} dias úteis (${businessDays * 8}h totais)`;
                                  })()}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* MAIN GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-2 space-y-5">
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
                                      onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                                      onKeyDown={handleKeyDown}
                                      className={`w-full p-1 rounded vertical-select text-[10px] font-bold outline-none mt-1 border transition-colors bg-[var(--bg)] border-[var(--border)]`}
                                      style={{ color: 'var(--text)' }}
                                    >
                                      <option value="">Selecione...</option>
                                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                  ) : <p className="text-xs font-black truncate" style={{ color: 'var(--text)' }}>{clients.find(c => c.id === project?.clientId)?.name || '--'}</p>}
                                </div>
                                <div className="w-px h-5 bg-[var(--border)] opacity-20" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[7px] font-bold opacity-50 uppercase">Parceiro</p>
                                  {isEditing ? (
                                    <select
                                      value={formData.partnerId}
                                      onChange={e => setFormData({ ...formData, partnerId: e.target.value })}
                                      onKeyDown={handleKeyDown}
                                      className={`w-full p-1 rounded vertical-select text-[10px] font-bold outline-none mt-1 border transition-colors bg-[var(--bg)] border-[var(--border)]`}
                                      style={{ color: 'var(--text)' }}
                                    >
                                      <option value="">Selecione...</option>
                                      <option value="direto">Direto (Sem Parceiro)</option>
                                      {clients.filter(c => c.tipo_cliente === 'parceiro').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                  ) : <p className="text-xs font-black truncate" style={{ color: 'var(--text)' }}>{clients.find(c => c.id === project?.partnerId)?.name || 'Nic-Labs'}</p>}
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
                                  onChange={e => setFormData({ ...formData, responsibleNicLabsId: e.target.value })}
                                  onKeyDown={handleKeyDown}
                                  className={`w-full p-1.5 rounded-lg text-xs font-bold border transition-colors bg-[var(--bg)] border-[var(--border)]`}
                                  style={{ color: 'var(--text)' }}
                                >
                                  <option value="">Selecione...</option>
                                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                              ) : <p className="text-xs font-black" style={{ color: 'var(--text)' }}>{users.find(u => u.id === project?.responsibleNicLabsId)?.name || '--'}</p>}
                            </div>

                            <div>
                              <p className="text-[8px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                                <Target size={10} className="text-blue-500" /> Responsável Cliente
                              </p>
                              {isEditing ? (
                                <input
                                  value={formData.managerClient}
                                  onChange={e => setFormData({ ...formData, managerClient: e.target.value })}
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
                            {projectHolidays.length > 0 ? projectHolidays.map(h => (
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
                            {projectAbsences.length > 0 ? projectAbsences.map(a => {
                              const user = users.find(u => u.id === String(a.userId));
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
                      {(isEditing || project?.description) && (
                        <div>
                          <p className="text-[10px] font-black uppercase mb-3" style={{ color: 'var(--muted)' }}>Visão de Escopo</p>
                          {isEditing ? <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full h-32 p-4 rounded-2xl border outline-none text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} /> : <p className="text-sm leading-relaxed italic p-5 rounded-2xl border" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>{project?.description}</p>}
                        </div>
                      )}
                      {isEditing && (
                        <div className="mt-8 pt-8 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--bg)' }}>
                          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-black/5 transition-colors">
                            <input
                              type="checkbox"
                              checked={formData.fora_do_fluxo}
                              onChange={e => setFormData({ ...formData, fora_do_fluxo: e.target.checked })}
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

                  <div className="space-y-6">
                    {/* SAÚDE QUALITATIVA */}
                    {(isEditing || project?.weeklyStatusReport || project?.gapsIssues) && (
                      <div className="p-6 rounded-[32px] border shadow-sm space-y-4" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text)' }}><StickyNote size={16} className="text-amber-500" /> Status e Andamento</h3>
                        <div className="space-y-4">
                          {(isEditing || project?.weeklyStatusReport) && (
                            <div>
                              <p className="text-[9px] font-black uppercase mb-1" style={{ color: 'var(--muted)' }}>Resumo da Semana</p>
                              {isEditing ? (
                                <textarea value={formData.weeklyStatusReport} onChange={e => setFormData({ ...formData, weeklyStatusReport: e.target.value })} className="w-full h-20 p-2 rounded text-xs border" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} placeholder="O que aconteceu esta semana?" />
                              ) : <p className="text-xs border-l-2 pl-3 py-1 rounded-r-lg" style={{ borderColor: 'var(--warning)', backgroundColor: 'var(--bg)', color: 'var(--text-2)' }}>{project?.weeklyStatusReport}</p>}
                            </div>
                          )}
                          {(isEditing || project?.gapsIssues) && (
                            <div>
                              <p className="text-[9px] font-black uppercase mb-1" style={{ color: 'var(--muted)' }}>Problemas e Bloqueios</p>
                              {isEditing ? (
                                <textarea value={formData.gapsIssues} onChange={e => setFormData({ ...formData, gapsIssues: e.target.value })} className="w-full h-20 p-2 rounded text-xs border" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} placeholder="Ex: Acesso bloqueado, falta de doc..." />
                              ) : <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{project?.gapsIssues}</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="p-6 rounded-[32px] border shadow-sm" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                      <div className="flex flex-col gap-1 mb-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text)' }}>
                            <Users size={16} className="text-purple-500" /> Equipe Alocada {isContinuousMode ? '(Alocação Diária Automática)' : ''}
                          </h3>
                        </div>
                        {isContinuousMode && (
                          <div className="space-y-1.5 mt-2">
                            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                              <div className="flex items-center gap-1.5">
                                <Zap size={12} className="text-purple-500" />
                                <span className="text-[8px] font-black uppercase tracking-wider text-purple-500">Modo: Equalização Assistida</span>
                              </div>
                              <span className="text-[8px] font-bold opacity-50 uppercase">Base: 8h / {teamOperationalBalance?.todayActiveCount || 0} colab. = {(8 / (teamOperationalBalance?.todayActiveCount || 1)).toFixed(1)}h/dia</span>
                            </div>

                            {teamOperationalBalance?.hasSignificantDeviation && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                <AlertTriangle size={12} className="text-amber-500" />
                                <span className="text-[8px] font-black uppercase tracking-wider text-amber-500">Desequilíbrio Detectado — Redistribuição Sugerida</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {isEditing ? (
                          <div className={`border rounded-2xl p-4 max-h-[400px] overflow-y-auto space-y-2 custom-scrollbar shadow-inner transition-colors ${selectedUsers.length === 0 ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-[var(--bg)] border-[var(--border)]'}`}>
                            {users.filter(u => u.active !== false && u.torre !== 'N/A').sort((a, b) => a.name.localeCompare(b.name)).map(user => (
                              <label key={user.id} className={`flex items-center gap-3 cursor-pointer hover:bg-[var(--surface-hover)] p-2 rounded-xl transition-all border ${selectedUsers.includes(user.id) ? 'border-purple-500/30 bg-purple-500/5' : 'border-transparent opacity-60'}`}>
                                <input
                                  type="checkbox"
                                  checked={selectedUsers.includes(user.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      const next = [...selectedUsers, user.id];
                                      setSelectedUsers(next);
                                    } else {
                                      const next = selectedUsers.filter(id => id !== user.id);
                                      setSelectedUsers(next);
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-[var(--border)] text-purple-600 focus:ring-purple-500"
                                />
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold overflow-hidden bg-[var(--surface-2)] shrink-0" style={{ color: 'var(--text)' }}>
                                    {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" /> : user.name.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-tighter truncate" style={{ color: 'var(--text)' }}>{user.name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <p className="text-[8px] font-bold uppercase opacity-40 tracking-wider truncate" style={{ color: 'var(--text)' }}>{user.cargo || user.role}</p>
                                    </div>
                                  </div>

                                  {selectedUsers.includes(user.id) && (
                                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                                      <div className="flex items-center gap-1.5 glass-purple px-2 py-1 rounded-lg">
                                        <Users className="w-3 h-3 text-purple-400" />
                                        <span className="text-[8px] font-black text-purple-400 uppercase tracking-tighter">Membro</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </label>

                            ))}
                          </div>
                        ) : (
                          <>
                            {projectMembers.filter(pm => String(pm.id_projeto) === projectId).map(pm => {
                              const u = users.find(user => user.id === String(pm.id_colaborador));
                              return u ? (
                                <div key={u.id} className="p-3 rounded-xl border transition-all" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
                                  {/* Header with User Info */}
                                  <div className="flex items-center gap-2.5 mb-2">
                                    <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-[var(--border)] shadow-sm" style={{ backgroundColor: 'var(--surface)' }}>
                                      {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[9px] font-black uppercase" style={{ color: 'var(--primary)' }}>{u.name.substring(0, 2).toUpperCase()}</div>}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[10px] font-black tracking-tight truncate mb-0.5" style={{ color: 'var(--text)' }}>{u.name}</p>
                                      <p className="text-[7px] font-black uppercase opacity-40 tracking-wider truncate" style={{ color: 'var(--text)' }}>{u.cargo || 'Consultor'}</p>
                                    </div>
                                  </div>

                                  {/* Metrics Section */}
                                  {(() => {
                                    const metrics = teamOperationalBalance?.memberMetrics[u.id];
                                    if (isContinuousMode && metrics) {
                                      const statusColor = metrics.status === 'green' ? 'text-emerald-500' : metrics.status === 'yellow' ? 'text-amber-500' : 'text-red-500';
                                      const statusBg = metrics.status === 'green' ? 'bg-emerald-500/5' : metrics.status === 'yellow' ? 'bg-amber-500/5' : 'bg-red-500/5';
                                      const statusBorder = metrics.status === 'green' ? 'border-emerald-500/20' : metrics.status === 'yellow' ? 'border-amber-500/20' : 'border-red-500/20';

                                      return (
                                        <div className="space-y-1.5">
                                          {/* Metrics Grid */}
                                          <div className="grid grid-cols-2 gap-1.5">
                                            {/* Expected */}
                                            <div className="flex flex-col items-center px-2 py-1.5 rounded-lg border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                                              <p className="text-[6px] font-black uppercase opacity-40 tracking-wider mb-0.5">Esperado</p>
                                              <p className="text-[10px] font-black tabular-nums" style={{ color: 'var(--text)' }}>{formatDecimalToTime(metrics.idealAccumulated)}</p>
                                            </div>

                                            {/* Actual */}
                                            <div className="flex flex-col items-center px-2 py-1.5 rounded-lg border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                                              <p className="text-[6px] font-black uppercase opacity-40 tracking-wider mb-0.5">Apontado</p>
                                              <p className="text-[10px] font-black tabular-nums" style={{ color: 'var(--text)' }}>{formatDecimalToTime(metrics.actualHours)}</p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }

                                    // Non-continuous mode - simple display
                                    const reported = timesheetEntries.filter(e => e.projectId === projectId && e.userId === u.id).reduce((sum, e) => sum + (Number(e.totalHours) || 0), 0);
                                    return (
                                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                                        <p className="text-[7px] font-black uppercase opacity-40 tracking-wider">Total Apontado</p>
                                        <p className="text-[11px] font-black" style={{ color: 'var(--text)' }}>{formatDecimalToTime(reported)}</p>
                                      </div>
                                    );
                                  })()}


                                </div>
                              ) : null;
                            })}

                            {/* EX-COLABORADORES (Com horas mas sem vínculo atual) */}
                            {(() => {
                              const currentMemberIds = new Set(projectMembers.filter(pm => String(pm.id_projeto) === projectId).map(pm => String(pm.id_colaborador)));
                              const formerMembersWithHours = Array.from(new Set(
                                timesheetEntries
                                  .filter(e => e.projectId === projectId && !currentMemberIds.has(String(e.userId)))
                                  .map(e => String(e.userId))
                              )).map(userId => users.find(u => String(u.id) === userId)).filter(Boolean);

                              if (formerMembersWithHours.length === 0) return null;

                              return (
                                <div className="mt-8 space-y-3">
                                  <div className="flex items-center gap-2 px-2">
                                    <Archive size={12} className="opacity-30" style={{ color: 'var(--text)' }} />
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Histórico de Contribuição</p>
                                  </div>
                                  {formerMembersWithHours.map(u => u && (
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
                                                .filter(e => e.projectId === projectId && e.userId === u.id)
                                                .reduce((sum, e) => sum + (Number(e.totalHours) || 0), 0);
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
                            <input value={formData.docLink} onChange={e => setFormData({ ...formData, docLink: e.target.value })} className="w-full text-[11px] p-2 rounded border outline-none" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} placeholder="Link do Sharepoint/OneDrive" />
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
                          const projectTasks = tasks.filter(t => t.projectId === projectId);
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
                        const archivedCount = projectTasks.filter(t => t.status === 'Done' || t.fora_do_fluxo).length;
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTasks.length > 0 ? (
                    filteredTasks.map(task => (
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
              {currentUser?.role !== 'system_admin' ? (
                <p className="text-xs p-3 bg-red-500/10 rounded-lg text-red-600 font-bold border border-red-500/20">
                  Bloqueado: Apenas o Administrador do Sistema pode realizar a exclusão forçada de projetos com dados.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-bold opacity-50">Para habilitar, digite o nome do projeto abaixo:</p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
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
            // Validações de segurança para delete forçado
            if (itemToDelete.force) {
              if (currentUser?.role !== 'system_admin') {
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
        disabled={!!(itemToDelete?.force && (currentUser?.role !== 'system_admin' || deleteConfirmText !== project?.name))}
      />
    </div>
  );
};

// SUBCOMPONENT
const ProjectTaskCard: React.FC<{
  project: any,
  task: any,
  users: any[],
  timesheetEntries: any[],
  tasks: any[],
  holidays: any[],
  absences: any[],
  isAdmin: boolean,
  currentUserId?: string,
  onClick: () => void
}> = ({ project, task, users, timesheetEntries, tasks, holidays, absences, isAdmin, currentUserId, onClick }) => {
  const navigate = useNavigate();
  const dev = users.find(u => u.id === task.developerId);
  const actualHours = timesheetEntries.filter(e => e.taskId === task.id).reduce((sum, e) => sum + (Number(e.totalHours) || 0), 0);

  const distributedHours = useMemo(() => {
    const pStartTs = parseSafeDate(project?.startDate);
    const pEndTs = parseSafeDate(project?.estimatedDelivery);
    const tStartTs = parseSafeDate(task.scheduledStart || task.actualStart);
    const tEndTs = parseSafeDate(task.estimatedDelivery);

    if (!pStartTs || !pEndTs || !tStartTs || !tEndTs) return 0;

    const projectDurationTs = Math.max(0, pEndTs - pStartTs) + ONE_DAY;
    const taskDurationTs = Math.max(0, tEndTs - tStartTs) + ONE_DAY;

    if (projectDurationTs <= 0 || taskDurationTs <= 0) return 0;
    const weight = (taskDurationTs / projectDurationTs);
    return weight * (project?.horas_vendidas || 0);
  }, [project, task]);

  const statusMap: Record<string, { label: string, color: string, bg: string }> = {
    'Todo': { label: 'Pré-Projeto', color: 'text-slate-500', bg: 'bg-slate-500/10' },
    'In Progress': { label: 'Andamento', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    'Review': { label: 'Análise', color: 'text-yellow-600', bg: 'bg-yellow-500/10' },
    'Testing': { label: 'Teste', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    'Done': { label: 'Concluído', color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
  };

  const statusInfo = statusMap[task.status] || { label: task.status, color: 'text-slate-400', bg: 'bg-slate-400/10' };
  const deadlineTime = task.estimatedDelivery ? parseSafeDate(task.estimatedDelivery) : null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayTime = today.getTime();
  const isLate = task.status !== 'Done' && deadlineTime && deadlineTime < todayTime;

  // Cálculo do Saldo Disponível
  const userMetrics = CapacityUtils.calculateUserCapacity(
    dev?.id || '',
    new Date(),
    tasks,
    holidays,
    absences
  );

  // Se a tarefa estiver em atraso, mostramos o saldo cheio do mês (ignorando alocações)
  const displayBalance = isLate ? userMetrics.monthlyCapacity : userMetrics.availableBalance;

  const startDate = task.scheduledStart ? new Date(task.scheduledStart + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '--/--';
  const deliveryDate = task.estimatedDelivery ? new Date(task.estimatedDelivery + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '--/--';

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.01 }}
      onClick={onClick}
      className="cursor-pointer p-6 rounded-[32px] border transition-all relative overflow-hidden group shadow-sm hover:shadow-xl"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-600 opacity-0 group-hover:opacity-100 transition-all" />

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${statusInfo.bg} ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
          {isLate && (
            <span className="flex items-center gap-1.5 text-[9px] font-black text-white bg-red-500 px-3 py-1.5 rounded-full uppercase tracking-widest animate-pulse shadow-lg shadow-red-500/20">
              <Clock size={12} /> ATRASADA
            </span>
          )}
        </div>
        <div className="flex flex-col items-end">
          <p className="text-[8px] font-black uppercase opacity-40 tracking-widest" style={{ color: 'var(--muted)' }}>Capacidade Disp.</p>
          <p className={`text-xs font-black ${displayBalance < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {formatDecimalToTime(displayBalance)}
          </p>
        </div>
      </div>

      <div className="mb-2">
        {task.fora_do_fluxo && (
          <span className="text-[8px] font-black bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-tighter">Fora do Fluxo</span>
        )}
      </div>

      <h3 className="font-bold text-lg leading-tight mb-8 line-clamp-2 min-h-[50px] group-hover:text-purple-600 transition-colors" style={{ color: 'var(--text)' }}>
        {task.title}
      </h3>

      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-2xl border bg-[var(--bg)]" style={{ borderColor: 'var(--border)' }}>
          <div className="flex flex-col">
            <p className="text-[8px] font-black uppercase opacity-60 tracking-widest mb-1.5 flex items-center gap-1" style={{ color: 'var(--muted)' }}>
              <Calendar size={10} /> Prazo de Entrega
            </p>
            <p className={`text-xs font-black flex items-center gap-2 ${isLate ? 'text-red-500' : 'text-[var(--text)]'}`}>
              <span className="opacity-40">{startDate}</span>
              <span className="opacity-20">→</span>
              <span>{deliveryDate}</span>
            </p>
          </div>
          <div className="flex flex-col items-end">
            <p className="text-[8px] font-black uppercase opacity-60 tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>Peso Estimado</p>
            <p className="text-xs font-black" style={{ color: 'var(--text)' }}>
              {distributedHours.toFixed(1)}h
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[10px] font-black uppercase mb-2" style={{ color: 'var(--muted)' }}>
            <span className="tracking-widest">Evolução</span>
            <span style={{ color: 'var(--primary)' }}>{task.progress}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${task.progress}%` }}
              className="h-full bg-gradient-to-r from-purple-600 to-indigo-600"
            />
          </div>
        </div>

        {task.status !== 'Done' && !isAdmin && (
          task.developerId === currentUserId ||
          (task.collaboratorIds || []).includes(currentUserId || '')
        ) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const url = `/timesheet/new?taskId=${task.id}&projectId=${task.projectId}&clientId=${task.clientId}&date=${new Date().toISOString().split('T')[0]}`;
                navigate(url);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl transition-all text-[10px] font-black border uppercase tracking-widest"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--primary)',
                color: 'var(--primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
            >
              <Clock size={12} />
              Apontar Tarefa
            </button>
          )}

        <div className="flex items-center justify-between pt-6 border-t" style={{ borderColor: 'var(--bg)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden border-2 shadow-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--surface)' }}>
              {dev?.avatarUrl ? <img src={dev.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-black uppercase" style={{ color: 'var(--muted)' }}>{task.developer?.substring(0, 2) || '??'}</div>}
            </div>
            <div>
              <p className="text-[11px] font-bold" style={{ color: 'var(--text)' }}>{task.developer || 'Sem resp.'}</p>
              <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Responsável</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <span className="text-sm font-black tabular-nums" style={{ color: 'var(--text)' }}>{formatDecimalToTime(actualHours)}</span>
              {isAdmin && (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-black opacity-70" style={{ color: 'var(--muted)' }}>
                    / {formatDecimalToTime(distributedHours)}
                  </span>
                </div>
              )}
            </div>
            <p className="text-[7px] font-black uppercase opacity-40" style={{ color: 'var(--muted)' }}>Horas Reportadas</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProjectDetailView;
