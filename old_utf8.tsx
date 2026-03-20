// ProjectDetailView.tsx - Dashboard Unificado do Projeto
import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataController } from '@/controllers/useDataController';
import {
  ArrowLeft, Plus, Edit, CheckSquare, Clock, Filter, ChevronDown, Check,
  Trash2, LayoutGrid, Target, ShieldAlert, Link as LinkIcon, Users,
  Calendar, Info, Zap, RefreshCw, AlertTriangle, StickyNote, DollarSign,
  TrendingUp, BarChart2, Save, FileText, Settings, Shield, AlertCircle
} from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserStatus } from '@/utils/userStatus';
import * as CapacityUtils from '@/utils/capacity';
import { formatDecimalToTime } from '@/utils/normalizers';
import { getProjectStatusByTimeline } from '@/utils/projectStatus';

const ProjectDetailView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const {
    tasks, clients, projects, users, projectMembers, timesheetEntries,
    absences, holidays,
    deleteProject, deleteTask, updateProject, getProjectMembers,
    addProjectMember, removeProjectMember
  } = useDataController();

  const { currentUser, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'tasks' | 'technical'>('technical');
  const [isEditing, setIsEditing] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'project', force?: boolean } | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('Todos');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Redirecionar colaboradores para aba de tarefas
  useEffect(() => {
    if (!isAdmin) {
      setActiveTab('tasks');
    }
  }, [isAdmin]);

  const project = projects.find(p => p.id === projectId);
  const client = project ? clients.find(c => c.id === project.clientId) : null;

  // --- FORM STATE ---
  const [formData, setFormData] = useState({
    name: '',
    clientId: '',
    partnerId: '',
    status: 'N├úo Iniciado',
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
    complexidade: 'M├®dia' as 'Alta' | 'M├®dia' | 'Baixa',
    torre: ''
  });
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [memberAllocations, setMemberAllocations] = useState<Record<string, number>>({});

  // balanceAllocations removido (c├ílculos nas tarefas)

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        clientId: project.clientId || '',
        partnerId: project.partnerId || '',
        status: project.status || 'N├úo Iniciado',
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
        complexidade: project.complexidade || 'M├®dia',
        torre: project.torre || ''
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

      // Se a soma n├úo for 100 e houver membros, re-balanceia automaticamente
      if (totalSum !== 100 && selectedIds.length > 0) {
        // Se houver membros, inicializa com 100% (flag de presen├ºa)
        const all100: Record<string, number> = {};
        selectedIds.forEach(id => all100[id] = 100);
        setMemberAllocations(all100);
      } else {
        setMemberAllocations(initialAllocations);
      }
    }
  }, [project, projectId, projectMembers]);

  const projectTasks = useMemo(() => {
    const pTasks = tasks.filter(t => t.projectId === projectId);
    if (currentUser && !isAdmin) {
      return pTasks.filter(t => t.developerId === currentUser.id || (t.collaboratorIds && t.collaboratorIds.includes(currentUser.id)));
    }
    return pTasks;
  }, [tasks, projectId, currentUser, isAdmin]);

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

    const pStart = project.startDate ? new Date(project.startDate) : new Date();
    const pEnd = project.estimatedDelivery ? new Date(project.estimatedDelivery) : pStart;
    const projectDuration = Math.max(1, Math.ceil((pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24)));

    const weightedProgress = projectDuration > 0
      ? projectTasks.reduce((acc, t) => {
        const tStart = t.scheduledStart ? new Date(t.scheduledStart) : new Date();
        const tEnd = t.estimatedDelivery ? new Date(t.estimatedDelivery) : tStart;
        const duration = Math.max(1, Math.ceil((tEnd.getTime() - tStart.getTime()) / (1000 * 60 * 60 * 24)));
        return acc + ((t.progress || 0) * duration);
      }, 0) / projectDuration
      : (projectTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / (projectTasks.length || 1));

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

    const realStartDate = pTimesheets.length > 0
      ? new Date(Math.min(...pTimesheets.map(e => new Date(e.date).getTime())))
      : null;

    const allTasksDone = projectTasks.length > 0 && projectTasks.every(t => t.status === 'Done');
    const realEndDate = allTasksDone && pTimesheets.length > 0
      ? new Date(Math.max(...pTimesheets.map(e => new Date(e.date).getTime())))
      : null;

    return { committedCost, consumedHours, weightedProgress, totalEstimated, plannedProgress, projection, realStartDate, realEndDate };
  }, [project, projectTasks, timesheetEntries, users, projectId]);

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
    if (!project) return true;
    const data = isEditing ? formData : {
      name: project.name,
      clientId: project.clientId,
      partnerId: project.partnerId,
      valor_total_rs: project.valor_total_rs,
      horas_vendidas: project.horas_vendidas,
      startDate: project.startDate,
      estimatedDelivery: project.estimatedDelivery,
      responsibleNicLabsId: project.responsibleNicLabsId,
      managerClient: project.managerClient
    };

    return (
      !data.name?.trim() ||
      !data.clientId ||
      !data.partnerId ||
      !data.valor_total_rs ||
      !data.horas_vendidas ||
      !data.startDate ||
      !data.estimatedDelivery ||
      !data.responsibleNicLabsId ||
      !data.managerClient ||
      selectedUsers.length === 0
    );
  }, [project, formData, isEditing, selectedUsers]);

  const hasTimeline = !!(project.startDate && project.estimatedDelivery);
  const hasBudget = (project.valor_total_rs || 0) > 0;
  const hasHours = (project.horas_vendidas || 0) > 0;

  // --- AUTOMATION: Auto-start project if there is activity ---
  useEffect(() => {
    if (!project || !projectId || !isAdmin) return;

    // Only check if currently "Not Started"
    if (project.status === 'N├úo Iniciado') {
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
    if (!project || !projectId) return;

    if (isProjectIncomplete) {
      alert('Por favor, preencha todos os campos obrigat├│rios (Finan├ºas, Timeline, Respons├íveis e Equipe) antes de salvar.');
      return;
    }

    setLoading(true);
    try {
      await updateProject(projectId, { ...formData, active: true } as any);
      const initialMembers = getProjectMembers(projectId);
      const initialMembersSet = new Set(initialMembers);

      // Para cada usu├írio selecionado, adicionamos sempre como 100% (flag)
      for (const userId of selectedUsers) {
        await addProjectMember(projectId, userId, 100);
      }

      // Remover membros que n├úo est├úo mais na lista
      const toRemove = initialMembers.filter(uid => !selectedUsers.includes(uid));
      for (const userId of toRemove) await removeProjectMember(projectId, userId);
      setIsEditing(false);
      alert('Projeto atualizado!');
    } catch (error: any) {
      console.error(error);
      alert('Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    let t = projectTasks;
    if (selectedStatus !== 'Todos') t = t.filter(task => task.status === selectedStatus);
    return t.sort((a, b) => (new Date(a.estimatedDelivery || '2099-12-31').getTime() - new Date(b.estimatedDelivery || '2099-12-31').getTime()));
  }, [projectTasks, selectedStatus]);

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

  if (!project) return <div className="p-20 text-center font-bold" style={{ color: 'var(--muted)' }}>Projeto n├úo encontrado</div>;

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      {/* HEADER */}
      <div className="px-8 py-6 bg-gradient-to-r from-[#1e1b4b] to-[#4c1d95] shadow-lg flex items-center justify-between text-white z-20">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ArrowLeft /></button>
          <div className="flex items-center gap-4">
            {client?.logoUrl && <div className="w-12 h-12 bg-white rounded-xl p-1.5 shadow-xl"><img src={client.logoUrl} className="w-full h-full object-contain" /></div>}
            <div>
              {isEditing ? (
                <input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className={`bg-white/10 border-b outline-none px-2 py-1 text-xl font-bold rounded transition-colors ${!formData.name?.trim() ? 'border-yellow-400 bg-yellow-400/20' : 'border-white'}`}
                />
              ) : (
                <h1 className="text-xl font-bold">{project.name}</h1>
              )}
              <div className="flex items-center gap-2 mt-1">
                {isAdmin && isProjectIncomplete && (
                  <span
                    className="text-[10px] font-black uppercase bg-yellow-500 text-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg shadow-yellow-500/20 cursor-help"
                    title="Cadastro incompleto. Clique no ├¡cone de l├ípis ao lado para editar e preencher os campos amarelados."
                  >
                    <AlertTriangle size={10} /> INCOMPLETO
                  </span>
                )}
                <span className="text-[10px] font-black uppercase bg-white/20 px-2 py-0.5 rounded-full tracking-tighter">
                  {getProjectStatusByTimeline(project)}
                </span>
                <span className="text-xs text-white/60">{client?.name}</span>
                {isAdmin && (
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`ml-2 p-1 hover:bg-white/20 rounded transition-colors ${isProjectIncomplete && !isEditing ? 'ring-2 ring-yellow-400 animate-pulse bg-yellow-400/20' : ''}`}
                    title={isProjectIncomplete && !isEditing ? "Clique aqui para completar o cadastro (Campos Obrigat├│rios)" : "Editar Projeto"}
                  >
                    <Edit size={14} />
                  </button>
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
                Vis├úo Geral
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
          <button
            onClick={() => navigate(`/tasks/new?project=${projectId}&client=${project.clientId}`)}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl font-bold flex items-center gap-2 transition-all backdrop-blur-md"
          >
            <Plus size={18} /> Nova Tarefa
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-5">

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
                        .sort((a, b) => {
                          const getStatusPriority = (status?: string) => {
                            switch (status) {
                              case 'In Progress': return 1;
                              case 'Testing': return 2;
                              case 'Todo': return 3;
                              case 'Review': return 4;
                              case 'Done': return 5;
                              default: return 6;
                            }
                          };

                          const priorityA = getStatusPriority(a.status);
                          const priorityB = getStatusPriority(b.status);

                          if (priorityA !== priorityB) return priorityA - priorityB;

                          const dateA = new Date(a.scheduledStart || 0).getTime();
                          const dateB = new Date(b.scheduledStart || 0).getTime();
                          return dateA - dateB;
                        })
                        .map(task => {
                          const taskReported = timesheetEntries
                            .filter(e => e.taskId === task.id)
                            .reduce((sum, e) => sum + (Number(e.totalHours) || 0), 0);

                          const pStart = project.startDate ? new Date(project.startDate) : new Date();
                          const pEnd = project.estimatedDelivery ? new Date(project.estimatedDelivery) : pStart;
                          const projectDuration = Math.max(1, Math.ceil((pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24)));

                          const tStart = task.scheduledStart ? new Date(task.scheduledStart) : new Date();
                          const tEnd = task.estimatedDelivery ? new Date(task.estimatedDelivery) : tStart;
                          const taskDuration = Math.max(1, Math.ceil((tEnd.getTime() - tStart.getTime()) / (1000 * 60 * 60 * 24)));

                          const weight = (hasTimeline && projectDuration > 0)
                            ? (taskDuration / projectDuration) * 100
                            : 0;

                          const isDateOut = (tStart < pStart || tEnd > pEnd);
                          const taskEntries = timesheetEntries.filter(entry => entry.taskId === task.id && entry.date);
                          const firstEntryDate = taskEntries.length > 0
                            ? new Date(Math.min(...taskEntries.map(e => new Date(e.date).getTime())))
                            : null;

                          const realStartStr = task.actualStart
                            ? new Date(task.actualStart + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                            : firstEntryDate?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

                          const realEndStr = task.actualDelivery
                            ? new Date(task.actualDelivery + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                            : null;

                          const startDate = task.scheduledStart ? new Date(task.scheduledStart + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '--/--';
                          const deliveryDate = task.estimatedDelivery ? new Date(task.estimatedDelivery + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;

                          const taskSoldHours = project.horas_vendidas > 0 ? (weight / 100) * project.horas_vendidas : 0;

                          const isHourOverrun = taskSoldHours > 0 && taskReported > taskSoldHours;
                          const isDelayed = task.status !== 'Done' && (
                            (task.estimatedDelivery && new Date(task.estimatedDelivery + 'T23:59:59') < new Date()) ||
                            (task.actualDelivery && new Date(task.actualDelivery + 'T23:59:59') < new Date())
                          );


                          const hasDates = task.scheduledStart && task.estimatedDelivery;

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
                                  {formatDecimalToTime(taskReported)}<span className="text-[9px] opacity-10 font-bold ml-0.5">/{formatDecimalToTime(taskSoldHours)}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[8px] font-bold">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={`px-1 py-px rounded uppercase tracking-wider shrink-0 ${task.status === 'Done' ? 'bg-emerald-500/10 text-emerald-500' :
                                    task.status === 'Testing' ? 'bg-purple-500/10 text-purple-500' :
                                      isDelayed ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                                    }`}>
                                    {task.status === 'Todo' ? 'Pr├®-Projeto' :
                                      task.status === 'Review' ? 'An├ílise' :
                                        task.status === 'In Progress' ? 'Andamento' :
                                          task.status === 'Testing' ? 'Teste' : 'Conclu├¡do'}
                                  </span>
                                  <span className={`px-1 py-px rounded shrink-0 ${task.progress === 100 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                    {task.progress}%
                                  </span>
                                  <span className="opacity-20 tabular-nums truncate">
                                    {startDate} ÔåÆ {deliveryDate || '--/--'}
                                  </span>
                                </div>

                                <div className="flex gap-1 shrink-0">
                                  {isHourOverrun && <span className="text-[7px] font-black bg-red-500/5 text-red-500/60 px-1 rounded uppercase border border-red-500/10">Excedido</span>}
                                  {isDateOut && <span className="text-[7px] font-black bg-amber-500/5 text-amber-500/60 px-1 rounded uppercase border border-amber-500/10">Fora</span>}
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
                        const delta = (performance?.weightedProgress || 0) - (performance?.plannedProgress || 0);
                        const hourOverrun = hasHours && (performance?.consumedHours || 0) > project.horas_vendidas;

                        if (!hasTimeline) {
                          return (
                            <div className="flex flex-col items-center justify-center py-4 opacity-30">
                              <Calendar size={20} className="mb-2" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Aguardando Timeline</span>
                            </div>
                          );
                        }

                        // Tolerance of 1% for "On Track"
                        const health = hourOverrun ? { label: 'Custo Excedido', color: 'text-red-500', bg: 'bg-red-500' } :
                          delta >= -1 ? { label: 'No Prazo', color: 'text-emerald-500', bg: 'bg-emerald-500' } :
                            delta >= -10 ? { label: 'Atraso Leve', color: 'text-amber-500', bg: 'bg-amber-500' } :
                              { label: 'Em Atraso', color: 'text-red-500', bg: 'bg-red-500' };

                        return (
                          <div className="flex flex-col items-center justify-center py-1">
                            <div className={`w-3 h-3 rounded-full ${health.bg} animate-pulse shadow-[0_0_12px_rgba(0,0,0,0.1)] mb-2`} />
                            <span className={`text-xl font-black uppercase tracking-tighter ${health.color}`}>{health.label}</span>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Desvio: {delta > 0 ? '+' : ''}{Math.round(delta)}%</span>
                              {hourOverrun && <span className="text-[7px] font-black text-red-500 uppercase">Efici├¬ncia Negativa</span>}
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    <h4 className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: 'var(--muted)' }}>Progresso vs Plano</h4>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                          <span style={{ color: 'var(--text)' }}>Plano</span>
                          <span style={{ color: 'var(--info)' }}>{hasTimeline ? Math.round(performance?.plannedProgress || 0) : '--'}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
                          <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${hasTimeline ? (performance?.plannedProgress || 0) : 0}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                          <span style={{ color: 'var(--text)' }}>Real</span>
                          <span style={{ color: 'var(--success)' }}>{hasTimeline ? Math.round(performance?.weightedProgress || 0) : '--'}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
                          <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(100, (hasTimeline ? performance?.weightedProgress : 0) || 0)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Finan├ºas (Visible only to Admin) */}
                  {isAdmin && (
                    <div className="p-5 rounded-[32px] border shadow-sm relative transition-all hover:shadow-md h-[350px] flex flex-col" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>

                      <h4 className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>Finan├ºas</h4>
                      {isEditing ? (
                        <div className="space-y-4">
                          <div>
                            <label className="text-[9px] font-bold uppercase mb-1 block" style={{ color: 'var(--muted)' }}>Valor Total Venda (R$)</label>
                            <input
                              type="number"
                              value={formData.valor_total_rs || ''}
                              onChange={e => setFormData({ ...formData, valor_total_rs: e.target.value === '' ? 0 : Number(e.target.value) })}
                              className={`text-xs p-2 rounded w-full border outline-none font-bold transition-colors ${!formData.valor_total_rs ? 'bg-yellow-500/10 border-yellow-500/50' : ''}`}
                              style={{ backgroundColor: formData.valor_total_rs ? 'var(--bg)' : undefined, borderColor: formData.valor_total_rs ? 'var(--border)' : undefined, color: 'var(--text)' }}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold uppercase mb-1 block" style={{ color: 'var(--muted)' }}>Horas Vendidas</label>
                            <input
                              type="number"
                              value={formData.horas_vendidas || ''}
                              onChange={e => setFormData({ ...formData, horas_vendidas: e.target.value === '' ? 0 : Number(e.target.value) })}
                              className={`text-xs p-2 rounded w-full border outline-none font-bold transition-colors ${!formData.horas_vendidas ? 'bg-yellow-500/10 border-yellow-500/50' : ''}`}
                              style={{ backgroundColor: formData.horas_vendidas ? 'var(--bg)' : undefined, borderColor: formData.horas_vendidas ? 'var(--border)' : undefined, color: 'var(--text)' }}
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-6">
                            {/* FINANCEIRO: CONSUMO DE BUDGET */}
                            <div className="group">
                              <div className="flex justify-between items-baseline mb-2">
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">Custo Projetado</span>
                                  <div className="flex items-baseline gap-2 mt-0.5">
                                    <span className={`text-lg font-black tabular-nums tracking-tighter ${((performance?.committedCost || 0) > (project.valor_total_rs || 0)) ? 'text-red-500' : 'text-[var(--text)]'}`}>
                                      {performance?.committedCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                    <span className="text-[10px] font-bold opacity-20 tracking-tight">
                                      de {Number(project.valor_total_rs || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  {hasBudget && (
                                    <span className={`text-sm font-black tabular-nums ${((performance?.committedCost || 0) > (project.valor_total_rs || 0)) ? 'text-red-500' : 'text-emerald-500'}`}>
                                      {Math.round(((performance?.committedCost || 0) / (project.valor_total_rs || 1)) * 100)}%
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="h-1.5 w-full rounded-full overflow-hidden bg-[var(--bg)] shadow-inner border border-[var(--border)] relative">
                                <div
                                  className={`h-full transition-all duration-1000 ${((performance?.committedCost || 0) / (project.valor_total_rs || 1)) > 1 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]'}`}
                                  style={{ width: `${Math.min(100, ((performance?.committedCost || 0) / (project.valor_total_rs || 1)) * 100)}%` }}
                                />
                              </div>

                              <div className="flex justify-between items-center mt-2">
                                <span className={`text-[8px] font-black uppercase tracking-widest ${((project.valor_total_rs || 0) - (performance?.committedCost || 0)) > 0 ? 'text-emerald-500/50' : 'text-red-500/50'}`}>
                                  {((project.valor_total_rs || 0) - (performance?.committedCost || 0)) > 0
                                    ? `Saldo: ${((project.valor_total_rs || 0) - (performance?.committedCost || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                                    : `D├®ficit: ${Math.abs((project.valor_total_rs || 0) - (performance?.committedCost || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                                </span>
                              </div>
                            </div>

                            {/* OPERACIONAL: CONSUMO DE HORAS */}
                            <div className="group pt-2">
                              <div className="flex justify-between items-baseline mb-2">
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">Horas Apontadas</span>
                                  <div className="flex items-baseline gap-2 mt-0.5">
                                    <span className={`text-lg font-black tabular-nums tracking-tighter ${((performance?.consumedHours || 0) > (project.horas_vendidas || 0)) ? 'text-red-500' : 'text-[var(--text)]'}`}>
                                      {formatDecimalToTime(performance?.consumedHours || 0)}
                                    </span>
                                    <span className="text-[10px] font-bold opacity-20 tracking-tight">
                                      de {project.horas_vendidas || 0}h
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  {hasHours && (
                                    <span className={`text-sm font-black tabular-nums ${((performance?.consumedHours || 0) > (project.horas_vendidas || 0)) ? 'text-red-500' : 'text-purple-500'}`}>
                                      {Math.round(((performance?.consumedHours || 0) / (project.horas_vendidas || 1)) * 100)}%
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="h-1.5 w-full rounded-full overflow-hidden bg-[var(--bg)] shadow-inner border border-[var(--border)] relative">
                                <div
                                  className={`h-full transition-all duration-1000 ${((performance?.consumedHours || 0) / (project.horas_vendidas || 1)) > 1 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.3)]'}`}
                                  style={{ width: `${Math.min(100, ((performance?.consumedHours || 0) / (project.horas_vendidas || 1)) * 100)}%` }}
                                />
                              </div>

                              <div className="flex justify-between items-center mt-2">
                                {((project.horas_vendidas || 0) - (performance?.consumedHours || 0)) > 0 ? (
                                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500/50">
                                    Dispon├¡veis: {formatDecimalToTime((project.horas_vendidas || 0) - (performance?.consumedHours || 0))}
                                  </span>
                                ) : (
                                  <span className="text-[8px] font-black uppercase tracking-widest text-red-500/50">
                                    Horas Excedidas
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                        </>
                      )}
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="p-5 rounded-[32px] border shadow-sm relative transition-all hover:shadow-md h-[350px] flex flex-col" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <h4 className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Timeline</h4>
                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <label className="text-[9px] font-black uppercase mb-1 block" style={{ color: 'var(--muted)' }}>In├¡cio Planejado</label>
                          <input
                            type="date"
                            value={formData.startDate}
                            onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                            className={`text-xs p-2 rounded w-full border outline-none font-bold transition-colors ${!formData.startDate ? 'bg-yellow-500/10 border-yellow-500/50' : ''}`}
                            style={{ backgroundColor: formData.startDate ? 'var(--bg)' : undefined, borderColor: formData.startDate ? 'var(--border)' : undefined, color: 'var(--text)' }}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase mb-1 block" style={{ color: 'var(--muted)' }}>Entrega Planejada</label>
                          <input
                            type="date"
                            value={formData.estimatedDelivery}
                            onChange={e => setFormData({ ...formData, estimatedDelivery: e.target.value })}
                            className={`text-xs p-2 rounded w-full border outline-none font-bold transition-colors ${!formData.estimatedDelivery ? 'bg-yellow-500/10 border-yellow-500/50 text-[var(--text)]' : 'bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)]'}`}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col justify-between space-y-8 py-2">
                        <div className="space-y-8">
                          <div className="grid grid-cols-2 gap-8">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>In├¡cio Planejado</p>
                              <p className="text-sm font-black" style={{ color: 'var(--text)' }}>
                                {project.startDate ? project.startDate.split('T')[0].split('-').reverse().join('/') : '--'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>In├¡cio Real</p>
                              <p className={`text-sm font-black ${performance?.realStartDate ? 'text-emerald-500' : 'opacity-30'}`}>
                                {performance?.realStartDate ? performance.realStartDate.toLocaleDateString('pt-BR') : '--'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-8">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Entrega Planejada</p>
                              <p className={`text-sm font-black tabular-nums ${performance?.projection && performance.projection.getTime() < new Date(project.estimatedDelivery).getTime() ? 'text-emerald-500' : 'text-[var(--primary)]'}`}>
                                {project.estimatedDelivery ? project.estimatedDelivery.split('T')[0].split('-').reverse().join('/') : '?'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Fim Real</p>
                              <p className={`text-sm font-black ${performance?.realEndDate ? 'text-purple-500' : 'opacity-30'}`}>
                                {performance?.realEndDate ? performance.realEndDate.toLocaleDateString('pt-BR') : '--'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {performance?.projection && performance.weightedProgress > 0 && performance.weightedProgress < 100 && (
                          <div className={`p-5 rounded-[24px] bg-[var(--bg)] border border-dashed transition-all w-full mt-auto ${((performance?.consumedHours || 0) > (project.horas_vendidas || 0) && project.horas_vendidas > 0) ? 'border-red-500/30' : 'border-emerald-500/30'}`}>
                            <p className={`text-[9px] font-black uppercase mb-2 ${((performance?.consumedHours || 0) > (project.horas_vendidas || 0) && project.horas_vendidas > 0) ? 'text-red-500' : 'text-emerald-500'}`}>Previs├úo p/ Velocidade</p>
                            <p className={`text-xl font-black ${((performance?.consumedHours || 0) > (project.horas_vendidas || 0) && project.horas_vendidas > 0) ? 'text-red-500' : 'text-emerald-500'}`}>
                              {performance.projection.toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        )}
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
                        {/* Gest├úo e Estrutura */}
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
                                      className={`w-full p-1 rounded vertical-select text-[10px] font-bold outline-none mt-1 border transition-colors ${!formData.clientId ? 'bg-yellow-500/10 border-yellow-500/50' : 'border-transparent'}`}
                                      style={{ color: 'var(--text)' }}
                                    >
                                      <option value="">Selecione...</option>
                                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                  ) : <p className="text-xs font-black truncate" style={{ color: 'var(--text)' }}>{clients.find(c => c.id === project.clientId)?.name || '--'}</p>}
                                </div>
                                <div className="w-px h-5 bg-[var(--border)] opacity-20" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[7px] font-bold opacity-50 uppercase">Parceiro</p>
                                  {isEditing ? (
                                    <select
                                      value={formData.partnerId}
                                      onChange={e => setFormData({ ...formData, partnerId: e.target.value })}
                                      className={`w-full p-1 rounded vertical-select text-[10px] font-bold outline-none mt-1 border transition-colors ${!formData.partnerId ? 'bg-yellow-500/10 border-yellow-500/50' : 'border-transparent'}`}
                                      style={{ color: 'var(--text)' }}
                                    >
                                      <option value="">Selecione...</option>
                                      <option value="direto">Direto (Sem Parceiro)</option>
                                      {clients.filter(c => c.tipo_cliente === 'parceiro').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                  ) : <p className="text-xs font-black truncate" style={{ color: 'var(--text)' }}>{clients.find(c => c.id === project.partnerId)?.name || 'Nic-Labs'}</p>}
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
                                  className={`w-full p-1.5 rounded-lg text-xs font-bold border transition-colors ${!formData.responsibleNicLabsId ? 'bg-yellow-500/10 border-yellow-500/50' : 'border-transparent'}`}
                                  style={{ color: 'var(--text)' }}
                                >
                                  <option value="">Selecione...</option>
                                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                              ) : <p className="text-xs font-black" style={{ color: 'var(--text)' }}>{users.find(u => u.id === project.responsibleNicLabsId)?.name || '--'}</p>}
                            </div>

                            <div>
                              <p className="text-[8px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                                <Target size={10} className="text-blue-500" /> Respons├ível Cliente
                              </p>
                              {isEditing ? (
                                <input
                                  value={formData.managerClient}
                                  onChange={e => setFormData({ ...formData, managerClient: e.target.value })}
                                  className={`w-full p-1.5 rounded-lg text-xs font-bold border transition-colors ${!formData.managerClient?.trim() ? 'bg-yellow-500/10 border-yellow-500/50' : 'border-transparent'}`}
                                  style={{ color: 'var(--text)' }}
                                />
                              ) : <p className="text-xs font-black" style={{ color: 'var(--text)' }}>{project.managerClient || '--'}</p>}
                            </div>
                          </div>
                        </div>

                        {/* Feriados no Per├¡odo */}
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

                        {/* Aus├¬ncias no Per├¡odo */}
                        <div className="p-4 rounded-[24px] border border-dashed flex flex-col" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
                          <p className="text-[8px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                            <Clock size={10} className="text-indigo-500" /> Aus├¬ncias (Time)
                          </p>
                          <div className="space-y-1.5 flex-1 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                            {projectAbsences.length > 0 ? projectAbsences.map(a => {
                              const user = users.find(u => u.id === String(a.userId));
                              return (
                                <div key={a.id} className="p-2 rounded-xl border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                                  <div className="flex justify-between items-start mb-0.5">
                                    <p className="text-[10px] font-black uppercase truncate pr-2" style={{ color: 'var(--text)' }}>{user?.name?.split(' ')[0] || '---'}</p>
                                    <span className={`text-[7px] font-black uppercase px-1 rounded-sm ${a.type === 'f├®rias' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}>{a.type}</span>
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
                      {(isEditing || project.description) && (
                        <div>
                          <p className="text-[10px] font-black uppercase mb-3" style={{ color: 'var(--muted)' }}>Vis├úo de Escopo</p>
                          {isEditing ? <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full h-32 p-4 rounded-2xl border outline-none text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} /> : <p className="text-sm leading-relaxed italic p-5 rounded-2xl border" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>{project.description}</p>}
                        </div>
                      )}
                      {isEditing && (
                        <div className="mt-8 pt-8 border-t flex justify-end gap-3" style={{ borderColor: 'var(--bg)' }}>
                          <button onClick={() => setIsEditing(false)} className="px-6 py-2 rounded-xl font-bold text-sm" style={{ color: 'var(--muted)' }}>Cancelar</button>
                          <button onClick={handleSaveProject} disabled={loading} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-purple-500/20">{loading ? 'Salvando...' : <><Save size={16} /> Salvar Altera├º├Áes</>}</button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* SA├ÜDE QUALITATIVA */}
                    {(isEditing || project.weeklyStatusReport || project.gapsIssues) && (
                      <div className="p-6 rounded-[32px] border shadow-sm space-y-4" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text)' }}><StickyNote size={16} className="text-amber-500" /> Status e Andamento</h3>
                        <div className="space-y-4">
                          {(isEditing || project.weeklyStatusReport) && (
                            <div>
                              <p className="text-[9px] font-black uppercase mb-1" style={{ color: 'var(--muted)' }}>Resumo da Semana</p>
                              {isEditing ? (
                                <textarea value={formData.weeklyStatusReport} onChange={e => setFormData({ ...formData, weeklyStatusReport: e.target.value })} className="w-full h-20 p-2 rounded text-xs border" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} placeholder="O que aconteceu esta semana?" />
                              ) : <p className="text-xs border-l-2 pl-3 py-1 rounded-r-lg" style={{ borderColor: 'var(--warning)', backgroundColor: 'var(--bg)', color: 'var(--text-2)' }}>{project.weeklyStatusReport}</p>}
                            </div>
                          )}
                          {(isEditing || project.gapsIssues) && (
                            <div>
                              <p className="text-[9px] font-black uppercase mb-1" style={{ color: 'var(--muted)' }}>Problemas e Bloqueios</p>
                              {isEditing ? (
                                <textarea value={formData.gapsIssues} onChange={e => setFormData({ ...formData, gapsIssues: e.target.value })} className="w-full h-20 p-2 rounded text-xs border" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} placeholder="Ex: Acesso bloqueado, falta de doc..." />
                              ) : <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{project.gapsIssues}</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="p-6 rounded-[32px] border shadow-sm" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text)' }}>
                          <Users size={16} className="text-purple-500" /> Equipe Alocada
                        </h3>
                      </div>
                      <div className="space-y-3">
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
                                <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl border transition-all" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--bg)' }}>
                                  <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderWidth: 1 }}>
                                    {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] font-black" style={{ color: 'var(--primary)' }}>{u.name.substring(0, 2).toUpperCase()}</div>}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-bold truncate" style={{ color: 'var(--text)' }}>{u.name}</p>
                                    <div className="flex items-center gap-2">
                                      <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--primary)' }}>{u.cargo || 'Consultor'}</p>
                                    </div>

                                    <div className="mt-2 pt-2 border-t border-dashed flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                                      <div>
                                        {(() => {
                                          const reported = timesheetEntries
                                            .filter(e => e.projectId === projectId && e.userId === u.id)
                                            .reduce((sum, e) => sum + (Number(e.totalHours) || 0), 0);
                                          return (
                                            <div className="flex items-center gap-3">
                                              <p className="text-[7px] font-black uppercase opacity-40">Apontado</p>
                                              <p className="text-[12px] font-black" style={{ color: 'var(--text)' }}>{formatDecimalToTime(reported)}</p>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : null;
                            })}

                            {/* EX-COLABORADORES (Com horas mas sem v├¡nculo atual) */}
                            {(() => {
                              const currentMemberIds = new Set(projectMembers.filter(pm => String(pm.id_projeto) === projectId).map(pm => String(pm.id_colaborador)));
                              const formerMembersWithHours = Array.from(new Set(
                                timesheetEntries
                                  .filter(e => e.projectId === projectId && !currentMemberIds.has(String(e.userId)))
                                  .map(e => String(e.userId))
                              )).map(userId => users.find(u => String(u.id) === userId)).filter(Boolean);

                              if (formerMembersWithHours.length === 0) return null;

                              return (
                                <div className="mt-6 space-y-3">
                                  <p className="text-[9px] font-black uppercase tracking-widest opacity-40 px-2">Hist├│rico de Contribui├º├úo</p>
                                  {formerMembersWithHours.map(u => u && (
                                    <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl border border-dashed transition-all opacity-60 grayscale-[0.5]" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
                                      <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderWidth: 1 }}>
                                        {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] font-black" style={{ color: 'var(--muted)' }}>{u.name.substring(0, 2).toUpperCase()}</div>}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-bold truncate" style={{ color: 'var(--text)' }}>{u.name}</p>
                                        <div className="flex items-center gap-2">
                                          <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{u.cargo || 'Consultor (Antigo)'}</p>
                                        </div>

                                        <div className="mt-2 pt-2 border-t border-dashed flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
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

                    {(isEditing || project.docLink) && (
                      <div className="p-6 rounded-[32px] border shadow-sm" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}><FileText size={16} /> Documenta├º├úo</h3>
                        {isEditing ? (
                          <div className="space-y-3">
                            <input value={formData.docLink} onChange={e => setFormData({ ...formData, docLink: e.target.value })} className="w-full text-[11px] p-2 rounded border outline-none" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} placeholder="Link do Sharepoint/OneDrive" />
                          </div>
                        ) : (
                          <a href={project.docLink} target="_blank" className="flex items-center justify-between p-3 rounded-2xl border transition-all" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)', borderColor: 'var(--info)' }}>
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
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase" style={{ color: 'var(--muted)' }}>Filtrar por Status:</span>
                    <div className="flex bg-white/5 p-1 rounded-xl gap-1">
                      {[
                        { label: 'Todos', value: 'Todos' },
                        { label: 'Pr├®-Projeto', value: 'Todo' },
                        { label: 'An├ílise', value: 'Review' },
                        { label: 'Andamento', value: 'In Progress' },
                        { label: 'Teste', value: 'Testing' },
                        { label: 'Conclu├¡do', value: 'Done' }
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
                        isAdmin={isAdmin}
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
                            alert('Complete as informa├º├Áes obrigat├│rias do projeto (Finan├ºas, Timeline, Respons├íveis e Equipe) antes de criar tarefas.');
                            return;
                          }
                          navigate(`/tasks/new?project=${projectId}&client=${project.clientId}`);
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
          </AnimatePresence >

        </div >
      </div >

      <ConfirmationModal
        isOpen={!!itemToDelete}
        title={itemToDelete?.force ? "ÔÜá´©Å EXCLUS├âO CR├ìTICA (PROJETO COM DADOS)" : "Confirmar Exclus├úo"}
        message={
          itemToDelete?.force ? (
            <div className="space-y-4">
              <p className="text-red-500 font-black">
                Este projeto possui tarefas e possivelmente horas apontadas. A exclus├úo for├ºada remover├í permanentemente TODO o hist├│rico do projeto!
              </p>
              {currentUser?.role !== 'system_admin' ? (
                <p className="text-xs p-3 bg-red-500/10 rounded-lg text-red-600 font-bold border border-red-500/20">
                  Bloqueado: Apenas o Administrador do Sistema pode realizar a exclus├úo for├ºada de projetos com dados.
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
          ) : "Esta a├º├úo ├® definitiva. Deseja continuar?"
        }
        confirmText={itemToDelete?.force ? "EXCLUIR TUDO" : "Confirmar"}
        onConfirm={async () => {
          if (itemToDelete?.type === 'project') {
            // Valida├º├Áes de seguran├ºa para delete for├ºado
            if (itemToDelete.force) {
              if (currentUser?.role !== 'system_admin') {
                alert('Apenas Administradores do Sistema podem excluir projetos com dados ativos.');
                return;
              }
              if (deleteConfirmText !== project?.name) {
                alert('O nome do projeto digitado est├í incorreto.');
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
    </div >
  );
};

// SUBCOMPONENT
const ProjectTaskCard: React.FC<{ project: any, task: any, users: any[], timesheetEntries: any[], isAdmin: boolean, onClick: () => void }> = ({ project, task, users, timesheetEntries, isAdmin, onClick }) => {
  const dev = users.find(u => u.id === task.developerId);
  const actualHours = timesheetEntries.filter(e => e.taskId === task.id).reduce((sum, e) => sum + e.totalHours, 0);

  const distributedHours = useMemo(() => {
    if (!project || !project.startDate || !project.estimatedDelivery || !task.scheduledStart || !task.estimatedDelivery) {
      return 0;
    }

    const pStart = new Date(project.startDate).getTime();
    const pEnd = new Date(project.estimatedDelivery).getTime();
    const pDuration = pEnd - pStart;

    const tStart = new Date(task.scheduledStart).getTime();
    const tEnd = new Date(task.estimatedDelivery).getTime();
    const tDuration = tEnd - tStart;

    if (pDuration <= 0 || tDuration <= 0) return 0;
    const weight = (tDuration / pDuration);
    return weight * (project.horas_vendidas || 0);
  }, [project, task]);

  const statusMap: Record<string, { label: string, color: string, bg: string }> = {
    'Todo': { label: 'Pr├®-Projeto', color: 'text-slate-500', bg: 'bg-slate-500/10' },
    'In Progress': { label: 'Andamento', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    'Review': { label: 'An├ílise', color: 'text-yellow-600', bg: 'bg-yellow-500/10' },
    'Testing': { label: 'Teste', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    'Done': { label: 'Conclu├¡do', color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
  };

  const statusInfo = statusMap[task.status] || { label: task.status, color: 'text-slate-400', bg: 'bg-slate-400/10' };

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.01 }}
      onClick={onClick}
      className="cursor-pointer p-6 rounded-[32px] border transition-all relative overflow-hidden group shadow-sm hover:shadow-xl"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-600 opacity-0 group-hover:opacity-100 transition-all" />

      <div className="flex justify-between items-center mb-6">
        <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${statusInfo.bg} ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
        {task.priority === 'Critical' && (
          <div className="flex items-center gap-1.5 text-[9px] font-black text-red-500 uppercase tracking-tighter animate-pulse">
            <ShieldAlert size={14} /> CR├ìTICO
          </div>
        )}
      </div>

      <h3 className="font-bold text-lg leading-tight mb-8 line-clamp-2 min-h-[50px] group-hover:text-purple-600 transition-colors" style={{ color: 'var(--text)' }}>
        {task.title}
      </h3>

      <div className="space-y-6">
        <div>
          <div className="flex justify-between text-[10px] font-black uppercase mb-2" style={{ color: 'var(--muted)' }}>
            <span className="tracking-widest">Evolu├º├úo</span>
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

        <div className="flex items-center justify-between pt-6 border-t" style={{ borderColor: 'var(--bg)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden border-2 shadow-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--surface)' }}>
              {dev?.avatarUrl ? <img src={dev.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-black uppercase" style={{ color: 'var(--muted)' }}>{task.developer?.substring(0, 2) || '??'}</div>}
            </div>
            <div>
              <p className="text-[11px] font-bold" style={{ color: 'var(--text)' }}>{task.developer || 'Sem resp.'}</p>
              <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Respons├ível</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <span className="text-sm font-black tabular-nums" style={{ color: 'var(--text)' }}>{formatDecimalToTime(actualHours)}</span>
              {isAdmin && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold opacity-40" style={{ color: 'var(--muted)' }}>
                    / {formatDecimalToTime(distributedHours)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProjectDetailView;
