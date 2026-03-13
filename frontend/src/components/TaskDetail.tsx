import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDataController } from '@/controllers/useDataController';
import { Task, Status, Priority, Impact } from '@/types';
import {
  ArrowLeft, Save, Calendar, Clock, Users, StickyNote, CheckSquare, Plus, Trash2, X, CheckCircle, Activity, Zap, AlertTriangle, Briefcase, Info, Target, LayoutGrid, Shield, FileSpreadsheet, Crown, ExternalLink, Flag, Lock, Pencil, Search, ChevronDown, Check, CalendarRange
} from 'lucide-react';
import { useUnsavedChangesPrompt } from '@/hooks/useUnsavedChangesPrompt';
import ConfirmationModal from './ConfirmationModal';
import TransferResponsibilityModal from './TransferResponsibilityModal';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDecimalToTime } from '@/utils/normalizers';
import { getUserStatus } from '@/utils/userStatus';
import * as CapacityUtils from '@/utils/capacity';
import TaskWorkloadCalendar from './TaskWorkloadCalendar';
import * as allocationService from '@/services/allocationService';
import { ALL_ADMIN_ROLES } from '@/constants/roles';

const TaskDetail: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  const {
    tasks, clients, projects, users, projectMembers, timesheetEntries,
    createTask, updateTask, deleteTask, holidays, deleteTimesheet,
    taskMemberAllocations, setTaskMemberAllocations, absences, addProjectMember
  } = useDataController();
  const [memberSearch, setMemberSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const CARGO_RANK: Record<string, number> = {
    'ESTAGIARIO': 1, 'ESTAGIÁRIO': 1, 'ESTAGIARIA': 1, 'ESTAGIÁRIA': 1,
    'TRAINEE': 2,
    'JUNIOR': 3, 'JÚNIOR': 3,
    'PLENO': 4,
    'SENIOR': 5, 'SÊNIOR': 5,
    'ESPECIALISTA': 6,
    'LÍDER': 7, 'LEAD': 7,
    'COORDENADOR': 8, 'COORDENADORA': 8,
    'GERENTE': 9,
    'DIRETOR': 10, 'DIRETORA': 10,
    'CEO': 11, 'PRESIDENTE': 11
  };

  const getCargoRank = (cargo: string = '') => {
    const c = cargo.toUpperCase();
    for (const [key, rank] of Object.entries(CARGO_RANK)) {
      if (c.includes(key)) return rank;
    }
    return 0;
  };

  const isNew = !taskId || taskId === 'new';
  const task = !isNew ? tasks.find((t: any) => t.id === taskId) : undefined;

  // Query params for defaults
  const preSelectedClientId = searchParams.get('clientId') || searchParams.get('client');
  const preSelectedProjectId = searchParams.get('projectId') || searchParams.get('project');

  const getDefaultDate = () => {
    return '';
  };

  const [formData, setFormData] = useState<Partial<Task>>({
    title: '',
    status: 'Todo',
    progress: 0,
    estimatedDelivery: getDefaultDate(),
    description: '',
    clientId: preSelectedClientId || '',
    projectId: preSelectedProjectId || '',
    developer: '',
    developerId: '',
    notes: '',
    scheduledStart: '',
    actualStart: '',
    actualDelivery: '',
    priority: 'Medium',
    impact: 'Medium',
    risks: '',
    collaboratorIds: [],
    estimatedHours: 0,
    link_ef: '',
    is_impediment: false
  });

  const [editingMainHours, setEditingMainHours] = useState<string | null>(null);
  const [editingMemberHours, setEditingMemberHours] = useState<Record<string, string>>({});

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ force: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [shouldDeleteHours, setShouldDeleteHours] = useState(false);
  const [localTaskAllocations, setLocalTaskAllocations] = useState<Record<string, number>>({});
  const [hoursInput, setHoursInput] = useState('');

  const parseTimeToDecimal = (timeStr: string): number => {
    if (!timeStr) return 0;

    // Tratamento para o formato HH:MM (ex: 12:30 -> 12.5)
    if (timeStr.includes(':')) {
      const [h, m] = timeStr.split(':').map(n => parseInt(n, 10) || 0);
      return h + (m / 60);
    }

    let val = timeStr.trim().replace(',', '.');
    val = val.replace('h', '');

    // Caso 2: Tem ponto (Decimal 8.5)
    if (val.includes('.')) {
      return parseFloat(val) || 0;
    }

    // Caso 3: Apenas números
    if (/^\d{3,4}$/.test(val)) {
      if (val.length === 4 || (val.length === 3 && val.startsWith('0'))) {
        const h = parseInt(val.slice(0, val.length - 2), 10) || 0;
        const m = parseInt(val.slice(val.length - 2), 10) || 0;
        return h + (m / 60);
      }
    }

    return parseFloat(val) || 0;
  };

  const handleTimeMask = (val: string, maxDigits?: number) => {
    let digits = val.replace(/\D/g, '');
    const max = maxDigits || 6;
    if (digits.length > max) digits = digits.slice(0, max);

    if (digits.length === 0) return '';

    // Se tiver apenas 1 ou 2 dígitos, são as horas (esquerda para direita)
    if (digits.length <= 2) return digits;

    // De 3 a max dígitos: os últimos 2 são sempre minutos
    const mins = digits.slice(-2);
    const hrs = digits.slice(0, -2);
    return `${hrs}:${mins}`;
  };

  const suggestDistribution = () => {
    const limit = Number(formData.estimatedHours) || 0;
    const teamIds = Array.from(new Set([formData.developerId, ...(formData.collaboratorIds || [])])).filter(Boolean);
    if (teamIds.length === 0 || limit === 0) return;

    const perMember = limit / teamIds.length;
    const newAllocations: Record<string, number> = {};
    const newEditingHours: Record<string, string> = {};

    teamIds.forEach(id => {
      newAllocations[id] = perMember;
      const h = Math.floor(perMember);
      const m = Math.round((perMember - h) * 60);
      newEditingHours[id] = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    });

    setLocalTaskAllocations(newAllocations);
    setEditingMemberHours(newEditingHours);
    markDirty();
  };

  // Validação Reativa
  const isFieldMissing = (field: string) => {
    if (field === 'team') {
      const hasTeam = (formData.collaboratorIds && formData.collaboratorIds.length > 0) || !!formData.developerId;
      return !hasTeam;
    }
    if (field === 'developerId') {
      const hasTeam = (formData.collaboratorIds && formData.collaboratorIds.length > 0) || !!formData.developerId;
      return hasTeam && !formData.developerId;
    }
    const value = formData[field as keyof typeof formData];
    if (field === 'estimatedHours') return !value || Number(value) === 0;
    return !value;
  };

  const selectedClient = clients.find((c: any) => c.id === formData.clientId);
  const isNicLabs = selectedClient?.name?.toUpperCase().includes('NIC-LABS') || false;

  const hasError = (field: string) => {
    const mandatoryFields = ['projectId', 'clientId', 'title', 'developerId', 'team', 'scheduledStart', 'estimatedDelivery', 'estimatedHours'];
    if (mandatoryFields.includes(field)) return isFieldMissing(field);
    return false;
  };

  const clearError = (field: string) => { };

  const { isDirty, showPrompt, markDirty, requestBack, discardChanges, continueEditing } = useUnsavedChangesPrompt();


  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isInitialized && isDirty) return; // Não sobrescrever se o usuário já mexeu

    if (task) {
      setFormData({
        ...task,
        estimatedDelivery: task.estimatedDelivery?.split('T')[0] || getDefaultDate(),
        scheduledStart: task.scheduledStart,
        actualStart: task.actualStart,
        actualDelivery: task.actualDelivery,
        priority: task.priority || 'Medium',
        impact: task.impact || 'Medium',
        risks: task.risks || '',
        description: task.description || '',
        link_ef: task.link_ef || '',
        estimatedHours: task.estimatedHours || 0,
        is_impediment: !!task.is_impediment
      });
      setIsInitialized(true);
    } else if (isNew) {
      const qClient = preSelectedClientId as string || '';
      const qProject = preSelectedProjectId as string || '';
      const proj = qProject ? projects.find((p: any) => p.id === qProject) : null;
      const finalClient = qClient || (proj ? proj.clientId : '');

      setFormData((prev: any) => {
        const newData = {
          ...prev,
          clientId: finalClient || prev.clientId,
          projectId: qProject || prev.projectId,
        };

        // Auto-allocate if not admin and new task
        if (!isAdmin && currentUser) {
          newData.collaboratorIds = [currentUser.id];
          newData.developerId = currentUser.id;
        }

        return newData;
      });
      setIsInitialized(true);
    }
  }, [task, preSelectedClientId, preSelectedProjectId, projects, isNew, isAdmin, currentUser, isInitialized, isDirty]);

  // Sync hoursInput from formData ONLY for display when not editing
  useEffect(() => {
    if (formData.estimatedHours !== undefined && editingMainHours === null) {
      setHoursInput(formatDecimalToTime(Number(formData.estimatedHours)));
    }
  }, [formData.estimatedHours, editingMainHours]);

  useEffect(() => {
    // Só carrega as alocações da tarefa se não houver edição local em andamento (isDirty)
    if (!isNew && taskId && !isDirty) {
      const taskAllocations = taskMemberAllocations.filter((a: any) => a.taskId === taskId);
      const allocationMap: Record<string, number> = {};
      taskAllocations.forEach((a: any) => {
        allocationMap[a.userId] = a.reservedHours;
      });
      setLocalTaskAllocations(allocationMap);
    }
  }, [taskId, isNew, taskMemberAllocations, isDirty]);

  // Automatização de status removida a pedido do usuário: 
  // O status não deve mudar sozinho para 'Andamento' quando a data chegar.
  // Deve permanecer como estava e ser alterado apenas manualmente.

  const actualHoursSpent = useMemo(() => {
    if (isNew) return 0;
    return timesheetEntries
      .filter((entry: any) => entry.taskId === taskId)
      .reduce((sum: number, entry: any) => sum + (Number(entry.totalHours) || 0), 0);
  }, [timesheetEntries, taskId, isNew]);

  const actualStartDate = useMemo(() => {
    if (isNew || !taskId) return null;
    const taskHours = timesheetEntries.filter((e: any) => e.taskId === taskId);
    if (taskHours.length === 0) return null;
    // Usa T12:00:00 para evitar off-by-one de fuso horário
    return new Date(Math.min(...taskHours.map((e: any) => new Date(e.date + 'T12:00:00').getTime())));
  }, [timesheetEntries, taskId, isNew]);


  const taskWeight = useMemo(() => {
    const project = projects.find((p: any) => p.id === formData.projectId);
    if (!project || !(project.horas_vendidas > 0)) return { weight: 0 };

    const estimated = Number(formData.estimatedHours) || 0;
    const effectiveTaskHours = formData.status === 'Done' ? actualHoursSpent : estimated;

    const weight = (effectiveTaskHours / project.horas_vendidas) * 100;
    return { weight };
  }, [formData.projectId, formData.estimatedHours, formData.status, actualHoursSpent, projects]);

  const projectAvailableHours = useMemo(() => {
    const project = projects.find((p: any) => p.id === formData.projectId);
    if (!project || !(project.horas_vendidas > 0)) return null;

    const otherTasks = tasks.filter((t: any) => t.projectId === project.id && t.id !== taskId);

    const usedByOthers = otherTasks.reduce((sum: number, t: any) => {
      let taskReported = 0;
      if (t.status === 'Done') {
        taskReported = timesheetEntries
          .filter((e: any) => e.taskId === t.id)
          .reduce((s: number, e: any) => s + (Number(e.totalHours) || 0), 0);
      }
      const effective = t.status === 'Done' ? taskReported : (Number(t.estimatedHours) || 0);
      return sum + effective;
    }, 0);

    return project.horas_vendidas - usedByOthers;
  }, [formData.projectId, projects, tasks, taskId, timesheetEntries]);

  const isOwner = task && task.developerId === currentUser?.id;
  const isCollaborator = !isNew && task && task.collaboratorIds?.includes(currentUser?.id || '');
  const canEditEverything = isAdmin || isNew;
  const canEditProgressStatus = isAdmin || isOwner || isCollaborator || isNew;

  const teamMembers = useMemo(() => Array.from(new Set([formData.developerId, ...(formData.collaboratorIds || [])])).filter(Boolean), [formData.developerId, formData.collaboratorIds]);

  const currentTotalAllocated = useMemo(() => {
    const limit = Number(formData.estimatedHours) || 0;
    const currentAllocations = { ...localTaskAllocations };
    Object.entries(editingMemberHours).forEach(([uid, val]) => {
      currentAllocations[uid] = parseTimeToDecimal(val);
    });
    return teamMembers.reduce((sum, id) => sum + (currentAllocations[id] || 0), 0);
  }, [formData.estimatedHours, localTaskAllocations, editingMemberHours, teamMembers]);

  const getDelayDays = () => {
    if (formData.status === 'Done' || formData.status === 'Review' || !formData.estimatedDelivery) return 0;
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const parts = formData.estimatedDelivery.split('-');
    const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0, 0);
    return today > due ? Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  };
  const daysDelayed = getDelayDays();

  const missingFields = useMemo(() => {
    const fields = [];
    if (isFieldMissing('projectId')) fields.push('Projeto');
    if (isFieldMissing('clientId')) fields.push('Cliente');
    if (isFieldMissing('title')) fields.push('Título');
    if (isFieldMissing('developerId')) fields.push('Responsável');
    if (isFieldMissing('team')) fields.push('Equipe Alocada');
    if (isFieldMissing('scheduledStart')) fields.push('Data de Início');
    if (isFieldMissing('estimatedDelivery')) fields.push('Data de Entrega');
    if (isFieldMissing('estimatedHours')) fields.push('Horas Estimadas');
    return fields;
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];
    if (isFieldMissing('projectId')) errors.push('projectId');
    if (isFieldMissing('clientId')) errors.push('clientId');
    if (isFieldMissing('title')) errors.push('title');
    if (isFieldMissing('team')) errors.push('team');
    if (isFieldMissing('developerId')) errors.push('developerId');
    if (isFieldMissing('scheduledStart')) errors.push('scheduledStart');
    if (isFieldMissing('estimatedDelivery')) errors.push('estimatedDelivery');
    if (isFieldMissing('estimatedHours')) errors.push('estimatedHours');

    // Validação de soma das horas alocadas
    const limit = Number(formData.estimatedHours) || 0;
    if (currentTotalAllocated > limit + 0.01) {
      alert(`A soma das horas alocadas (${formatDecimalToTime(currentTotalAllocated)}) não pode ultrapassar o total da tarefa (${formatDecimalToTime(limit)}). Por favor, ajuste a distribuição da equipe.`);
      return;
    }

    if (errors.length > 0) {
      const missingFields = errors.map(e => {
        switch (e) {
          case 'projectId': return 'Projeto';
          case 'clientId': return 'Cliente';
          case 'title': return 'Título';
          case 'developerId': return 'Responsável';
          case 'team': return 'Equipe Alocada';
          case 'scheduledStart': return 'Data de Início';
          case 'estimatedDelivery': return 'Data de Entrega';
          case 'estimatedHours': return 'Horas Estimadas';
          default: return e;
        }
      });
      alert('Campos obrigatórios faltando: \n - ' + missingFields.join('\n - ') + ' \n\nPor favor, preencha os campos destacados em amarelo.');
      return;
    }

    // Validação de intervalo do projeto
    const project = projects.find((p: any) => String(p.id) === String(formData.projectId));
    if (project) {
      const parseSafeDate = (d: string | null | undefined) => {
        if (!d) return null;
        const s = d.split('T')[0];
        return new Date(s + 'T12:00:00').getTime();
      };

      const pStart = parseSafeDate(project.startDate);
      const pEnd = parseSafeDate(project.estimatedDelivery);
      const tStart = parseSafeDate(formData.scheduledStart);
      const tEnd = parseSafeDate(formData.estimatedDelivery);

      if (pStart && tStart && tStart < pStart) {
        alert(`A data de início da tarefa (${formData.scheduledStart}) não pode ser anterior ao início do projeto (${project.startDate}).`);
        return;
      }
      if (pEnd && tEnd && tEnd > pEnd) {
        alert(`A data de entrega da tarefa (${formData.estimatedDelivery}) não pode ser posterior à entrega do projeto (${project.estimatedDelivery}).`);
        return;
      }
    }

    try {
      setLoading(true);

      // --- SINCRONIZAÇÃO DE SEGURANÇA ---
      // Caso o usuário clique em salvar sem sair do campo de horas, forçamos o parse aqui.
      let finalEstimatedHours = formData.estimatedHours || 0;
      if (editingMainHours !== null) {
        finalEstimatedHours = parseTimeToDecimal(editingMainHours);
      }

      const finalAllocations = { ...localTaskAllocations };
      Object.entries(editingMemberHours).forEach(([uid, val]) => {
        finalAllocations[uid] = parseTimeToDecimal(val);
      });

      const payload: any = {
        ...formData,
        estimatedHours: finalEstimatedHours,
        progress: Number(formData.progress),
        notes: formData.notes,
        link_ef: formData.link_ef,
        is_impediment: formData.is_impediment
      };

      console.log("Saving task payload:", payload);
      if (payload.status === 'Done' && !formData.actualDelivery) payload.actualDelivery = new Date().toISOString().split('T')[0];

      let finalTaskId = taskId;
      if (isNew) {
        finalTaskId = String(await createTask(payload));
      } else if (taskId) {
        await updateTask(taskId, payload);
      }

      // Save member allocations
      if (finalTaskId) {
        // Link members to project if not already linked
        const teamIds = Array.from(new Set([payload.developerId, ...(payload.collaboratorIds || [])])).filter(Boolean);
        for (const uid of teamIds) {
          const isLinked = projectMembers.some(pm => String(pm.id_projeto) === String(formData.projectId) && String(pm.id_colaborador) === String(uid));
          if (!isLinked) {
            console.log(`Auto-linking member ${uid} to project ${formData.projectId}`);
            try {
              await addProjectMember(String(formData.projectId), String(uid), 100);
            } catch (err) {
              console.error(`Failed to auto-link member ${uid}:`, err);
            }
          }
        }

        // Se houver membros alocados mas nenhuma alocação explícita (tudo zero), salva o fallback distribuído.
        const hasAnyAllocation = Object.values(finalAllocations).some(val => val > 0);

        let allocationsToSave = [];
        if (!hasAnyAllocation && payload.estimatedHours > 0 && teamIds.length > 0) {
          const fallbackHours = payload.estimatedHours / teamIds.length;
          allocationsToSave = teamIds.map(uid => ({
            userId: String(uid),
            reservedHours: fallbackHours
          }));
        } else {
          allocationsToSave = Object.entries(finalAllocations).map(([userId, hours]) => ({
            userId,
            reservedHours: hours
          }));
        }
        // const savedAllocs = await allocationService.saveTaskAllocations(finalTaskId, allocationsToSave);
        await allocationService.saveTaskAllocations(finalTaskId, allocationsToSave);
        // Removido manual update: Realtime cuida disso
      }

      discardChanges();
      navigate(-1);
    } catch (error: any) {
      alert("Erro ao salvar: " + (error?.message || "Erro desconhecido"));
    } finally { setLoading(false); }
  };

  const taskHours = timesheetEntries.filter((e: any) => e.taskId === taskId);
  const totalTaskHours = taskHours.reduce((acc: number, current: any) => acc + current.totalHours, 0);

  const performDelete = async () => {
    if (!taskId || !deleteConfirmation) return;

    // Se houver horas e NÃO for system_admin ou admin, bloqueia no front também
    if (deleteConfirmation.force && !ALL_ADMIN_ROLES.includes(String(currentUser?.role || '').trim().toLowerCase())) {
      alert("Aviso: Como esta tarefa possui banco de horas vinculado, você não possui o nível de acesso à deleção forçada. Apenas o Administrador do Sistema pode excluir tarefas que já possuem horas apontadas.");
      setDeleteConfirmation(null);
      return;
    }

    // Validação de texto para exclusão forçada
    if (deleteConfirmation.force && deleteConfirmText !== task?.title) {
      alert("Para confirmar a exclusão com horas, você deve digitar o nome exato da tarefa.");
      return;
    }

    try {
      const force = deleteConfirmation.force;
      setDeleteConfirmation(null); // Fecha o modal imediatamente (Otimista)

      await deleteTask(taskId, force, shouldDeleteHours);
      discardChanges();
      navigate(-1);
    } catch (error: any) {
      if (error.message?.includes("horas apontadas") || error.message?.includes("seguinte erro: 400")) {
        setDeleteConfirmation({ force: true });
        setDeleteConfirmText('');
      } else if (error.message?.includes("403")) {
        alert("Acesso Negado: Apenas Administradores do Sistema podem excluir tarefas com horas.");
      } else {
        alert("Erro ao excluir: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = useCallback(() => {
    if (!requestBack()) return;

    if (window.history.length > 1) {
      navigate(-1);
    } else {
      const targetId = task?.projectId || formData.projectId;
      if (targetId) {
        navigate(`/admin/projects/${targetId}?tab=tasks`);
      } else {
        navigate('/admin/clients');
      }
    }
  }, [requestBack, navigate, task?.projectId, formData.projectId]);

  const responsibleUsers = useMemo(() => {
    return users.filter((u: any) => u.active !== false);
  }, [users]);

  const handleEditTimesheet = (id: string) => {
    navigate(`/timesheet/${id}`);
  };

  const handleDeleteTimesheet = async (id: string) => {
    if (window.confirm('Deseja excluir este apontamento?')) {
      try {
        await deleteTimesheet(id);
        alert('Apontamento excluído com sucesso!');
      } catch (e) {
        alert('Erro ao excluir apontamento.');
      }
    }
  };

  if (!isNew && !task) return <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Tarefa não encontrada.</div>;

  const taskProject = projects.find((p: any) => p.id === (task?.projectId || formData.projectId));
  const taskClient = clients.find((c: any) => c.id === (task?.clientId || formData.clientId || taskProject?.clientId));

  return (
    <div className="h-full flex flex-col bg-[var(--bg)] overflow-hidden">
      <div className="px-8 py-5 shadow-lg flex items-center justify-between text-white z-20 sticky top-0" style={{ background: 'var(--header-bg)' }}>
        <div className="flex items-center gap-4">
          {/* Botão Voltar com estilo explícito para garantir visibilidade */}
          <button
            type="button"
            onClick={handleBack}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all border border-white/20 text-white flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Voltar"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-bold flex items-center gap-3 leading-tight">
              {isNew ? 'Nova Tarefa' : (formData.title || 'Detalhes da Tarefa')}
              {daysDelayed > 0 && (
                <span className="flex items-center gap-1 text-[8px] px-2 py-0.5 rounded-full bg-red-500 text-white uppercase font-black animate-pulse align-middle shrink-0">
                  <AlertTriangle size={10} /> {daysDelayed}d atraso
                </span>
              )}
            </h1>
            <div className="flex items-center gap-1.5 mt-1 opacity-80">
              {taskProject && (
                <>
                  <span className="text-[10px] font-bold uppercase tracking-tight truncate max-w-[180px]">{taskProject.name}</span>
                  {taskClient && <span className="text-white/40">·</span>}
                </>
              )}
              {taskClient && (
                <span className="text-[10px] font-medium uppercase tracking-tight truncate max-w-[140px] text-white/70">{taskClient.name}</span>
              )}
              {!taskProject && !taskClient && (
                <span className="text-[10px] font-medium uppercase tracking-tight text-white/50">Nova Atividade</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isNew && (isAdmin || isOwner) && (
            <button
              onClick={() => {
                const hasHours = taskHours.length > 0;
                setDeleteConfirmation({ force: hasHours });
                setShouldDeleteHours(hasHours);
              }}
              className="px-4 py-2.5 rounded-xl font-bold text-xs text-red-100 hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <Trash2 size={16} /> EXCLUIR
            </button>
          )}
          <button type="button" onClick={handleBack} disabled={loading} className="px-5 py-2.5 rounded-xl font-bold text-xs transition-all hover:bg-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed">CANCELAR</button>
          <button onClick={handleSubmit} className="px-8 py-2.5 bg-white text-indigo-950 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xl hover:bg-indigo-50 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50" disabled={loading}>
            <Save className="w-4 h-4" /> {loading ? 'SALVANDO...' : 'SALVAR'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <form onSubmit={handleSubmit} className="max-w-7xl mx-auto space-y-6">
          <fieldset disabled={loading} className="border-none p-0 m-0 space-y-6">
            <AnimatePresence>
              {missingFields.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 bg-yellow-400/10 border border-yellow-400/50 rounded-2xl flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-yellow-400 flex items-center justify-center shrink-0 shadow-lg shadow-yellow-400/20">
                    <AlertTriangle size={18} className="text-black" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-yellow-500">Campos Obrigatórios Faltando</p>
                    <p className="text-[10px] font-bold opacity-70" style={{ color: 'var(--text)' }}>
                      Por favor, preencha: {missingFields.join(', ')}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {/* Card 1: Identificação */}
              <div className="p-4 rounded-[24px] border shadow-sm flex flex-col h-[290px] group hover:shadow-md transition-all duration-300" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--muted)' }}>Identificação</h4>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-500/10"><Briefcase size={12} className="text-purple-500" /></div>
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div>
                      <label className={`text-[9px] font-black uppercase mb-1 block opacity-60 ${hasError('title') ? 'text-yellow-500' : ''}`}>Nome da Tarefa *</label>
                      <input type="text" value={formData.title || ''} onChange={e => { setFormData({ ...formData, title: e.target.value }); markDirty(); }} className={`w-full px-3 py-1 text-xs font-bold border rounded-lg outline-none transition-all ${hasError('title') ? 'bg-yellow-400/20 border-yellow-400/50 shadow-[0_0_10px_rgba(250,204,21,0.1)]' : 'bg-[var(--bg)] border-[var(--border)]'}`} style={{ color: 'var(--text)' }} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase mb-1 block opacity-60">Status</label>
                      <select
                        value={formData.status || 'Todo'}
                        onChange={e => {
                          const newStatus = e.target.value as any;
                          let newProgress = formData.progress;
                          let newActualDelivery = formData.actualDelivery;
                          let newActualStart = formData.actualStart;

                          if (newStatus === 'Done') {
                            newProgress = 100;
                            if (!newActualDelivery) {
                              newActualDelivery = new Date().toISOString().split('T')[0];
                            }
                          } else if (newStatus === 'In Progress') {
                            if (!newActualStart) {
                              newActualStart = new Date().toISOString().split('T')[0];
                            }
                          }

                          setFormData({
                            ...formData,
                            status: newStatus,
                            progress: newProgress,
                            actualDelivery: newActualDelivery,
                            actualStart: newActualStart
                          });
                          markDirty();
                        }}
                        className="w-full px-3 py-1.5 text-xs font-bold border rounded-lg bg-[var(--bg)] border-[var(--border)] outline-none"
                        style={{ color: 'var(--text)' }}
                      >
                        <option value="Todo">Pré-Projeto</option>
                        <option value="Review">Análise</option>
                        <option value="In Progress">Andamento</option>
                        <option value="Testing">Teste</option>
                        <option value="Done">Concluído</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={() => { setFormData({ ...formData, is_impediment: !formData.is_impediment }); markDirty(); }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl border transition-all font-bold text-[9px] ${formData.is_impediment ? 'bg-orange-500/10 border-orange-500 text-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-transparent border-[var(--border)] opacity-60'}`}
                  >
                    <div className="flex items-center gap-2">
                      <Flag size={12} className={formData.is_impediment ? "fill-orange-500" : ""} />
                      IMPEDIMENTO
                    </div>
                    {formData.is_impediment && <span className="text-[7px] bg-orange-500 text-white px-1 py-0.5 rounded font-black">ATIVO</span>}
                  </button>
                </div>
              </div>

              {/* Card 2: Gestão */}
              <div className="p-4 rounded-[24px] border shadow-sm flex flex-col h-[290px] group hover:shadow-md transition-all duration-300" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--muted)' }}>Gestão</h4>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/10"><Shield size={12} className="text-emerald-500" /></div>
                </div>
                <div className="space-y-3 flex-1">
                  <div>
                    <label className={`text-[9px] font-black uppercase mb-1 flex items-center gap-2 opacity-60 ${hasError('developerId') ? 'text-yellow-500' : ''}`}>
                      <Crown size={10} className={formData.developerId ? "text-yellow-500" : ""} /> Responsável *
                    </label>
                    <select
                      value={formData.developerId || ''}
                      onChange={e => {
                        const selectedId = e.target.value;
                        const u = users.find(usr => usr.id === selectedId);
                        const oldResponsibleId = formData.developerId;

                        let updatedCollabs = [...(formData.collaboratorIds || [])];

                        // Mantém o antigo responsável na equipe como colaborador
                        if (oldResponsibleId && !updatedCollabs.includes(oldResponsibleId)) {
                          updatedCollabs.push(oldResponsibleId);
                        }

                        // Garante que o novo responsável também esteja na lista de colaboradores
                        if (selectedId && !updatedCollabs.includes(selectedId)) {
                          updatedCollabs.push(selectedId);
                        }

                        setFormData({
                          ...formData,
                          developerId: selectedId,
                          developer: u?.name || '',
                          collaboratorIds: updatedCollabs
                        });
                        markDirty();
                      }}
                      className={`w-full px-3 py-1 text-xs font-bold border rounded-lg outline-none transition-all ${hasError('developerId') ? 'bg-yellow-400/20 border-yellow-400/50 shadow-[0_0_10px_rgba(250,204,21,0.1)]' : 'bg-[var(--bg)] border-[var(--border)]'}`}
                      style={{ color: 'var(--text)' }}
                      disabled={!formData.projectId}
                    >
                      <option value="">Selecione...</option>
                      {responsibleUsers.map(u => <option key={u.id} value={u.id}>{u.name.split(' (')[0]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase mb-1 block opacity-60">Prioridade</label>
                    <select value={formData.priority || 'Medium'} onChange={e => { setFormData({ ...formData, priority: e.target.value as any }); markDirty(); }} className="w-full px-3 py-1 text-xs font-bold border rounded-lg bg-[var(--bg)] border-[var(--border)] outline-none" style={{ color: 'var(--text)' }}>
                      <option value="Low">Baixa</option>
                      <option value="Medium">Média</option>
                      <option value="High">Alta</option>
                      <option value="Critical">Crítica</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* CARD 3: ESFORÇO */}
              <div className="p-4 rounded-[24px] border shadow-sm flex flex-col justify-between h-[290px] group hover:shadow-md transition-all duration-300" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-indigo-500 font-black text-[10px] uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">
                      <Clock size={12} /> Esforço
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform"><Activity size={12} /></div>
                  </div>

                  <div className="space-y-3">
                    {/* Big Display for Hours Spent */}
                    <div className="flex items-center justify-between p-4 rounded-2xl border border-emerald-500/20 shadow-inner group/effort relative overflow-hidden" style={{ backgroundColor: 'rgba(16,185,129,0.08)' }}>
                      <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full -mr-8 -mt-8 group-hover/effort:scale-125 transition-transform duration-700" />
                      <div className="flex items-center gap-2.5 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                          <Clock size={18} />
                        </div>
                        <div className="flex flex-col">
                          <p className="text-[8px] font-black uppercase text-emerald-500/60 tracking-[0.2em] mb-0.5">Horas Apontadas (Total)</p>
                          <p className="text-2xl font-black tabular-nums text-emerald-500 leading-none">{formatDecimalToTime(actualHoursSpent)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Weight and Forecast Boxes */}
                    <div className="p-4 rounded-2xl bg-[var(--surface-hover)] border border-[var(--border)] shadow-sm">
                      <p className="text-[8px] font-black uppercase opacity-40 tracking-[0.2em] mb-1.5">Peso Projeto</p>
                      <p className="text-base font-black text-indigo-500 tabular-nums leading-none">{taskWeight.weight.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-center text-[9px] font-black uppercase opacity-40 tracking-widest px-1">
                    <span>Progresso ({formData.progress}%)</span>
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                      {formData.progress === 100 ? 'Concluído' : 'Em Execução'}
                    </div>
                  </div>
                  <div className="relative pt-0.5">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.progress || 0}
                      onChange={e => {
                        const newProgress = Number(e.target.value);
                        let newStatus = formData.status;
                        let newActualDelivery = formData.actualDelivery;
                        if (formData.status === 'Done' && newProgress < 100) { newStatus = 'In Progress'; newActualDelivery = ''; }
                        setFormData({ ...formData, progress: newProgress, status: newStatus, actualDelivery: newActualDelivery });
                        markDirty();
                      }}
                      className="w-full h-1 rounded-full appearance-none cursor-pointer accent-indigo-600 shadow-inner border border-transparent"
                      style={{ backgroundColor: 'var(--surface-3)' }}
                    />
                  </div>
                </div>
              </div>

              {/* CARD 4: TIMELINE */}
              <div className={`p-4 rounded-[24px] border shadow-sm flex flex-col justify-between min-h-[290px] group hover:shadow-md transition-all duration-300 ${hasError('timeline') ? 'bg-yellow-400/10 border-yellow-400/50 shadow-[0_0_15px_rgba(250,204,21,0.1)]' : ''}`} style={{ backgroundColor: hasError('timeline') ? undefined : 'var(--surface)', borderColor: hasError('timeline') ? undefined : 'var(--border)' }}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-blue-500 font-black text-[10px] uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">
                      <Calendar size={12} /> Timeline
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCalendar(!showCalendar)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${showCalendar ? 'bg-blue-600 text-white shadow-lg' : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'}`}
                      title="Ver Período/Carga Horária"
                    >
                      <CalendarRange size={12} />
                    </button>
                  </div>

                  <div className="space-y-3 relative" ref={calendarRef}>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        <span className="text-[9px] font-black uppercase text-blue-500 tracking-widest">Planejado</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className={`p-2.5 rounded-2xl border group/date focus-within:border-blue-500/50 transition-colors ${!formData.scheduledStart ? 'bg-yellow-400/20 border-yellow-400/50 shadow-[0_0_10px_rgba(250,204,21,0.1)]' : 'bg-[var(--surface-hover)] border-[var(--border)]'}`}>
                          <label className={`text-[8px] font-black uppercase tracking-[0.2em] mb-1 block group-focus-within/date:text-blue-500 transition-colors ${!formData.scheduledStart ? 'text-yellow-500' : 'opacity-40'}`}>Início *</label>
                          <input
                            type="date"
                            value={formData.scheduledStart || ''}
                            onChange={e => { setFormData({ ...formData, scheduledStart: e.target.value }); markDirty(); }}
                            className="w-full bg-transparent text-xs font-black text-[var(--text)] outline-none border-none p-0"
                          />
                        </div>
                        <div className={`p-2.5 rounded-2xl border group/date focus-within:border-blue-500/50 transition-colors ${!formData.estimatedDelivery ? 'bg-yellow-400/20 border-yellow-400/50 shadow-[0_0_10px_rgba(250,204,21,0.1)]' : 'bg-[var(--surface-hover)] border-[var(--border)]'}`}>
                          <label className={`text-[8px] font-black uppercase tracking-[0.2em] mb-1 block group-focus-within/date:text-blue-500 transition-colors ${!formData.estimatedDelivery ? 'text-yellow-500' : 'opacity-40'}`}>Entrega *</label>
                          <input
                            type="date"
                            value={formData.estimatedDelivery || ''}
                            onChange={e => { setFormData({ ...formData, estimatedDelivery: e.target.value }); markDirty(); }}
                            className="w-full bg-transparent text-xs font-black text-[var(--text)] outline-none border-none p-0"
                          />
                        </div>
                      </div>

                      {showCalendar && taskId && (
                        <div className="absolute top-0 left-0 w-full z-10">
                          <TaskWorkloadCalendar
                            taskId={taskId}
                            userId={formData.developerId || currentUser?.id || ''}
                            selectedDate={formData.scheduledStart || ''}
                            onSelectDate={(date) => {
                              // Aqui podemos decidir o que fazer ao selecionar uma data no TaskDetail
                              // Por padrão, talvez o usuário só queira ver. 
                              // Se clicarem, vamos assumir que querem mudar o início (ou nada)
                              // markDirty();
                              // setFormData(prev => ({ ...prev, scheduledStart: date }));
                            }}
                            onClose={() => setShowCalendar(false)}
                          />
                        </div>
                      )}

                      <div className={`p-3 rounded-2xl border group/fc focus-within:border-blue-500/50 transition-colors mt-2 ${!formData.estimatedHours ? 'bg-yellow-400/20 border-yellow-400/50 shadow-[0_0_10px_rgba(250,204,21,0.1)]' : 'bg-[var(--surface-hover)] border-[var(--border)]'}`}>
                        <label className={`text-[8px] font-black uppercase tracking-[0.2em] mb-1 block group-focus-within/fc:text-blue-500 transition-colors ${!formData.estimatedHours ? 'text-yellow-500' : 'opacity-40'}`}>Horas da Tarefa *</label>
                        <input
                          type="text"
                          value={editingMainHours !== null ? editingMainHours : (formData.estimatedHours ? formatDecimalToTime(formData.estimatedHours) : '')}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!/^[0-9:]*$/.test(val)) return;
                            setEditingMainHours(handleTimeMask(val));
                            markDirty();
                          }}
                          onBlur={() => {
                            if (editingMainHours !== null) {
                              const dec = parseTimeToDecimal(editingMainHours);
                              setFormData((prev: any) => ({ ...prev, estimatedHours: dec }));
                              setEditingMainHours(null);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                          }}
                          className="w-full bg-transparent text-[11px] font-black text-[var(--text)] outline-none tabular-nums p-0 border-none leading-none focus:text-blue-500 font-mono"
                          placeholder="00:00"
                        />
                        {projectAvailableHours !== null && (
                          <div className="mt-2.5 pt-2 border-t border-dashed border-blue-500/10 flex items-center justify-between">
                            <span className="text-[7.5px] font-black text-blue-500/50 uppercase tracking-widest whitespace-nowrap">Saldo Disp.</span>
                            <div className="flex items-baseline gap-1 whitespace-nowrap">
                              <span className="text-[10px] font-black text-blue-500/80 tabular-nums">{formatDecimalToTime(projectAvailableHours)}</span>
                              <span className="text-[7.5px] font-bold text-blue-500/50 uppercase">hs</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-dashed border-[var(--border)] mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[9px] font-black uppercase text-emerald-500 tracking-widest">Executado</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="px-2.5 py-1.5 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/10 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Zap size={10} className="text-emerald-500" />
                        <span className="text-[8px] font-bold text-emerald-600/60 uppercase">Início</span>
                      </div>
                      <span className="text-[10px] font-black" style={{ color: 'var(--text)' }}>{actualStartDate ? actualStartDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '...'}</span>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-xl bg-slate-500/5 border border-[var(--border)] flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <CheckSquare size={10} className="opacity-30" style={{ color: 'var(--text)' }} />
                        <span className="text-[8px] font-bold opacity-30 uppercase" style={{ color: 'var(--text)' }}>Entrega</span>
                      </div>
                      <span className="text-[10px] font-black ml-auto opacity-30" style={{ color: 'var(--text)' }}>{formData.actualDelivery ? new Date(formData.actualDelivery + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '...'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 p-6 rounded-[24px] border shadow-sm flex flex-col gap-6" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <LayoutGrid size={14} className="text-indigo-500" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Descrição da Atividade</h4>
                  </div>
                  <textarea
                    value={formData.description || ''}
                    onChange={e => { setFormData({ ...formData, description: e.target.value }); markDirty(); }}
                    className="w-full h-20 p-3 text-xs font-medium border rounded-xl bg-[var(--bg)] border-[var(--border)] outline-none transition-all focus:ring-1 focus:ring-indigo-500/30 leading-relaxed"
                    style={{ color: 'var(--text)' }}
                    placeholder="Instruções e detalhamento..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <StickyNote size={14} className="text-amber-500" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-500">Anotações Internas</h4>
                    </div>
                    <textarea
                      value={formData.notes || ''}
                      onChange={e => { setFormData({ ...formData, notes: e.target.value }); markDirty(); }}
                      className="w-full h-20 p-3 text-xs font-medium border rounded-xl bg-[var(--bg)] border-[var(--border)] outline-none transition-all focus:ring-1 focus:ring-amber-500/30 leading-relaxed"
                      style={{ color: 'var(--text)' }}
                      placeholder="Observações técnicas, credenciais..."
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet size={14} className="text-blue-500" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500">Link de Documentação</h4>
                      </div>
                      {formData.link_ef && (
                        <a
                          href={formData.link_ef.startsWith('http') ? formData.link_ef : `https://${formData.link_ef}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-blue-500 hover:underline flex items-center gap-1"
                        >
                          ABRIR <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="url"
                        value={formData.link_ef || ''}
                        onChange={e => { setFormData({ ...formData, link_ef: e.target.value }); markDirty(); }}
                        className="w-full px-4 py-1.5 pr-10 text-xs border rounded-xl bg-[var(--bg)] border-[var(--border)] outline-none transition-all focus:ring-1 focus:ring-blue-500/30 font-mono"
                        style={{ color: 'var(--text)' }}
                        placeholder="https://docs.google.com/..."
                      />
                      <Zap size={14} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 text-blue-500" />
                    </div>
                    <p className="mt-2 text-[10px] opacity-40 italic">Cole aqui o link direto para o documento ou repositório.</p>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-[24px] border shadow-sm flex flex-col max-h-[290px] transition-all duration-300 ${hasError('team') ? 'bg-yellow-400/10 border-yellow-400/50 shadow-[0_0_15px_rgba(250,204,21,0.1)]' : ''}`} style={{ backgroundColor: hasError('team') ? undefined : 'var(--surface)', borderColor: hasError('team') ? undefined : 'var(--border)' }}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                      <Users size={16} className="text-indigo-500" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2">
                        Equipe Alocada
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-[8px] font-black">
                          {Array.from(new Set([formData.developerId, ...(formData.collaboratorIds || [])])).filter(Boolean).length} MEMBROS
                        </span>
                      </h4>
                      {Array.from(new Set([formData.developerId, ...(formData.collaboratorIds || [])])).filter(Boolean).length > 1 && (
                        <button
                          type="button"
                          onClick={suggestDistribution}
                          className="mt-1 text-[7px] font-black uppercase bg-indigo-500/10 text-indigo-500 px-1.5 py-0.5 rounded-lg hover:bg-indigo-500/20 transition-all border border-indigo-500/20"
                        >
                          Sugerir Distribuição
                        </button>
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={() => setIsAddMemberOpen(true)} disabled={loading} className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"><Plus size={16} /></button>
                </div>

                {/* Progress bar alocação vs estimado */}
                {(() => {
                  const limit = Number(formData.estimatedHours) || 0;
                  if (limit === 0) return null;

                  let barColor = 'bg-indigo-500';
                  if (Math.abs(currentTotalAllocated - limit) < 0.01) barColor = 'bg-emerald-500';
                  else if (currentTotalAllocated > limit) barColor = 'bg-red-500 animate-pulse';
                  else barColor = 'bg-amber-500';

                  return (
                    <div className="mb-6 px-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black uppercase opacity-40">Reserva de Horas</span>
                        <span className={`text-[10px] font-black ${currentTotalAllocated > limit ? 'text-red-500' : 'text-[var(--text)]'}`}>
                          {formatDecimalToTime(currentTotalAllocated)} / {formatDecimalToTime(limit)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[var(--surface-2)] rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(100, (currentTotalAllocated / limit) * 100)}%` }}></div>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                  {Array.from(new Set([formData.developerId, ...(formData.collaboratorIds || [])]))
                    .filter(Boolean)
                    .map(id => {
                      const u = users.find(usr => usr.id === id);
                      if (!u) return null;


                      // Lógica de Disponibilidade no Período (Novo: Alinhado com Quadro de Capacidade)
                      const tStart = formData.scheduledStart || '';
                      const tEnd = formData.estimatedDelivery || '';
                      const todayStr = new Date().toISOString().split('T')[0];
                      const effectiveStart = tStart && tStart > todayStr ? tStart : todayStr;

                      // 1. Saldo no Período (Distribuído)
                      let periodAvailability = 0;
                      if (tEnd && effectiveStart <= tEnd) {
                        const availData = CapacityUtils.getUserAvailabilityInRange(
                          u, effectiveStart, tEnd, projects, projectMembers, timesheetEntries, tasks, holidays, taskMemberAllocations, absences
                        );
                        periodAvailability = availData.balance;
                      }

                      // 2. Saldo Mensal (Referência absoluta do Quadro de Capacidade)
                      const currentMonthStr = todayStr.substring(0, 7);
                      const monthlyData = CapacityUtils.getUserMonthlyAvailability(
                        u, currentMonthStr, projects, projectMembers, timesheetEntries, tasks, holidays, taskMemberAllocations, absences
                      );
                      const monthlyBalance = monthlyData.balance;

                      // REGRA DE ATRASO: Se a tarefa já passou da data de entrega, está atrasada e não concluída,
                      // mostramos o Saldo Disponível do Mês inteiro como salva-guarda.
                      if (tEnd && tEnd < todayStr && formData.status !== 'Done') {
                        periodAvailability = monthlyBalance;
                      }

                      const teamCount = Array.from(new Set([formData.developerId, ...(formData.collaboratorIds || [])])).filter(Boolean).length;

                      // Baseado no Esforço Operacional (Horas da Tarefa)
                      const totalTaskHours = Number(formData.estimatedHours) || 0;

                      // Se o membro já tem uma alocação local salva, usamos ela. Caso contrário é 0.
                      const currentForecast = localTaskAllocations[id] || 0;

                      const memberRealHours = taskHours.filter((h: any) => h.userId === id).reduce((sum: number, h: any) => sum + (Number(h.totalHours) || 0), 0);
                      const distributionPercent = totalTaskHours > 0 ? (currentForecast / totalTaskHours) * 100 : 0;
                      return (
                        <div key={id} className={`group/member relative flex flex-col p-3 rounded-2xl border transition-all ${id === formData.developerId ? 'bg-yellow-400/5 border-yellow-400/20' : 'bg-[var(--bg)] border-[var(--border)]'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg overflow-hidden border transition-all ${id === formData.developerId ? 'border-yellow-400' : 'border-[var(--border)]'}`}>
                              {u.avatarUrl ? (
                                <img src={u.avatarUrl} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-[var(--surface-2)] font-black text-[10px] text-[var(--text-secondary)] uppercase">
                                  {u.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] font-bold truncate uppercase ${id === formData.developerId ? 'text-yellow-500' : 'text-[var(--text)]'}`}>{u.name}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black uppercase opacity-30 tracking-widest">{u.cargo || 'Membro'}</span>
                                {id === formData.developerId && (
                                  <span className="text-[7px] font-black bg-yellow-400 text-black px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                    <Crown size={8} /> RESPONSÁVEL
                                  </span>
                                )}
                              </div>
                            </div>
                            {id !== formData.developerId && (
                              <button type="button" onClick={() => setFormData({ ...formData, collaboratorIds: formData.collaboratorIds?.filter(cid => cid !== id) })} className="p-1.5 text-red-500/30 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover/member:opacity-100"><X size={14} /></button>
                            )}
                          </div>

                          <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-[var(--border)] border-dashed">
                            {/* SALDO DISP. */}
                            <div className="flex flex-col">
                              <span className="text-[7px] font-black uppercase opacity-30 tracking-tighter">SD. DISP</span>
                              <span className={`text-[10px] font-bold tabular-nums ${periodAvailability < 0 ? 'text-red-500' : 'text-indigo-500'}`}>
                                {formData.status === 'Done' ? '--' : formatDecimalToTime(periodAvailability)}
                              </span>
                            </div>

                            {/* DISTRIBUIÇÃO */}
                            <div className="flex flex-col text-center">
                              <span className="text-[7px] font-black uppercase opacity-30 tracking-tighter">DISTRIBUÍDO</span>
                              <span className="text-[10px] font-bold text-amber-500 tabular-nums">
                                {distributionPercent.toFixed(1)}%
                              </span>
                            </div>

                            {/* ALOCADO input */}
                            <div className="flex flex-col text-center relative">
                              <span className="text-[7px] font-black uppercase opacity-30 tracking-tighter">ALOCADO</span>
                              <input
                                type="text"
                                value={editingMemberHours[id] !== undefined ? editingMemberHours[id] : (currentForecast > 0 ? formatDecimalToTime(currentForecast) : '')}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (!/^[0-9:]*$/.test(val)) return;

                                  // Sincroniza casas decimais com o tempo total da tarefa
                                  const mainTimeStr = formatDecimalToTime(Number(formData.estimatedHours) || 0);
                                  const maxDigits = Math.max(4, mainTimeStr.replace(/\D/g, '').length + 2); // Permite um pouco mais de precisão se necessário

                                  setEditingMemberHours(prev => ({ ...prev, [id]: handleTimeMask(val, maxDigits) }));
                                  markDirty();
                                }}
                                onBlur={() => {
                                  if (editingMemberHours[id] !== undefined) {
                                    const limit = Number(formData.estimatedHours) || 0;
                                    let dec = parseTimeToDecimal(editingMemberHours[id]);

                                    // Calcula quanto os OUTROS já ocuparam
                                    const otherAllocated = teamMembers
                                      .filter(mid => mid !== id)
                                      .reduce((sum, mid) => sum + (localTaskAllocations[mid] || 0), 0);

                                    // Se o novo valor ultrapassar o limite total, trava no máximo disponível (Sincronizado)
                                    if (otherAllocated + dec > limit + 0.001) {
                                      dec = Math.max(0, limit - otherAllocated);
                                      console.log(`Allocation capped at ${dec} for user ${id}`);
                                    }

                                    setLocalTaskAllocations((prev: any) => ({ ...prev, [id]: dec }));
                                    setEditingMemberHours((prev: any) => {
                                      const next = { ...prev };
                                      delete next[id];
                                      return next;
                                    });
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                }}
                                className={`text-[10px] font-black bg-yellow-400/20 border-2 border-dashed rounded-lg py-1 outline-none w-full text-center tabular-nums transition-all hover:bg-yellow-400/30 focus:bg-yellow-400/40 focus:border-yellow-400/60 shadow-inner ${currentForecast > 0 ? (currentTotalAllocated > (Number(formData.estimatedHours) || 0) + 0.01 ? 'border-red-500/50 text-red-600' : 'border-yellow-400/40 text-yellow-600') : 'border-yellow-400/20 text-yellow-600/40 hover:border-yellow-400/40'}`}
                                placeholder="00:00"
                              />
                            </div>

                            {/* APONTADO */}
                            <div className="flex flex-col text-right">
                              <span className="text-[7px] font-black uppercase opacity-30 tracking-tighter">APONTADO</span>
                              <span className={`text-[10px] font-black tabular-nums ${memberRealHours > currentForecast && currentForecast > 0 ? 'text-red-500' : memberRealHours > 0 ? 'text-emerald-500' : 'opacity-30'}`}>
                                {formatDecimalToTime(memberRealHours)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className="space-y-6 mt-6">

              {/* Timesheet Detail Section */}
              {
                !isNew && taskHours.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 rounded-[32px] border shadow-sm overflow-hidden"
                    style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-center justify-between mb-8 overflow-hidden">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shadow-inner">
                          <Clock size={24} className="text-emerald-500" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black uppercase tracking-widest text-emerald-500">Histórico de Apontamentos</h4>
                          <p className="text-[10px] font-bold opacity-40 uppercase tracking-tighter" style={{ color: 'var(--muted)' }}>Detalhamento das horas registradas nesta tarefa</p>
                        </div>
                      </div>
                      <div className="text-right bg-[var(--bg)] px-6 py-3 rounded-2xl border border-[var(--border)]">
                        <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Total Acumulado</p>
                        <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>
                          {formatDecimalToTime(actualHoursSpent)}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar-thin">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-[var(--border)]">
                            <th className="pb-4 px-4 text-[9px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--muted)' }}>Data</th>
                            <th className="pb-4 px-4 text-[9px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--muted)' }}>Colaborador</th>
                            <th className="pb-4 px-4 text-[9px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--muted)' }}>Horas</th>
                            <th className="pb-4 px-4 text-[9px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--muted)' }}>Descrição</th>
                            <th className="pb-4 px-4 text-[9px] font-black uppercase tracking-widest opacity-40 text-right" style={{ color: 'var(--muted)' }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {[...taskHours].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(entry => (
                            <tr key={entry.id} className="group hover:bg-[var(--surface-2)] transition-all">
                              <td className="py-5 px-4 whitespace-nowrap">
                                <span className="text-[11px] font-black" style={{ color: 'var(--border-strong)' }}>
                                  {new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                              </td>
                              <td className="py-5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-[var(--bg)] border border-[var(--border)] overflow-hidden flex items-center justify-center text-[11px] font-black shadow-sm">
                                    {users.find((u: any) => u.id === entry.userId)?.avatarUrl ? (
                                      <img src={users.find((u: any) => u.id === entry.userId)?.avatarUrl} className="w-full h-full object-cover" />
                                    ) : (
                                      <span style={{ color: 'var(--muted)' }}>{entry.userName?.substring(0, 2).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-bold m-0" style={{ color: 'var(--text)' }}>{entry.userName}</p>
                                    <p className="text-[8px] font-black uppercase tracking-widest opacity-30" style={{ color: 'var(--muted)' }}>Colaborador</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-5 px-4">
                                <div className="flex flex-col">
                                  <span className="text-sm font-black text-emerald-500 tabular-nums">{formatDecimalToTime(entry.totalHours)}</span>
                                  <div className="flex items-center gap-1 opacity-40 text-[9px] font-bold" style={{ color: 'var(--muted)' }}>
                                    <Clock size={8} />
                                    <span>{entry.startTime} - {entry.endTime}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-5 px-4 min-w-[300px]">
                                <div className="p-3 rounded-xl bg-[var(--bg)] border border-dashed border-[var(--border)] group-hover:border-[var(--primary-soft)] transition-colors">
                                  <p className="text-[11px] leading-relaxed opacity-80" style={{ color: 'var(--text)' }}>
                                    {entry.description || <span className="italic opacity-30">Sem descrição detalhada...</span>}
                                  </p>
                                </div>
                              </td>
                              <td className="py-5 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {(isAdmin || entry.userId === currentUser?.id) && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleEditTimesheet(entry.id)}
                                        className="p-2 rounded-lg hover:bg-emerald-500/10 text-emerald-500 transition-colors"
                                        title="Editar Apontamento"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteTimesheet(entry.id)}
                                        className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                                        title="Excluir Apontamento"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )
              }
            </div>
          </fieldset>
        </form>
      </div >

      <ConfirmationModal
        isOpen={!!deleteConfirmation}
        title={deleteConfirmation?.force ? "⚠️ EXCLUSÃO CRÍTICA (COM HORAS)" : "Excluir Tarefa"}
        message={
          deleteConfirmation?.force ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border surface-tinted-red">
                <p className="text-red-600 dark:text-red-400 font-black text-sm mb-2">
                  ATENÇÃO: Foram encontrados {taskHours.length} apontamentos ({totalTaskHours}h total).
                </p>
                <div className="max-h-32 overflow-y-auto space-y-2 mb-4 scrollbar-hide">
                  {taskHours.map((h: any) => (
                    <div key={h.id} className="text-[10px] flex justify-between items-center p-2 rounded-lg" style={{ backgroundColor: 'var(--surface-2)' }}>
                      <span className="font-bold">{new Date(h.date).toLocaleDateString()}</span>
                      <span className="opacity-70">{h.userName}</span>
                      <span className="font-black text-red-500">{h.totalHours}h</span>
                    </div>
                  ))}
                </div>

                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-red-200 dark:border-red-500/20 hover:border-red-500 transition-all" style={{ backgroundColor: 'var(--surface)' }}>
                  <input
                    type="checkbox"
                    checked={shouldDeleteHours}
                    onChange={e => setShouldDeleteHours(e.target.checked)}
                    className="w-4 h-4 rounded accent-red-600"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black uppercase">Excluir horas apontadas?</span>
                    <span className="text-[9px] opacity-60">Se desmarcado, as horas ficarão órfãs mas salvas no banco.</span>
                  </div>
                </label>
              </div>

              {!ALL_ADMIN_ROLES.includes(String(currentUser?.role || '').trim().toLowerCase()) ? (
                <div className="flex bg-amber-50 rounded-xl p-4 items-start gap-4 mb-3 shadow-inner">
                  <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-800">Aviso: Como esta tarefa possui banco de horas vinculado, você não possui o nível de acesso à deleção forçada.</p>
                    <p className="text-[10px] text-amber-700 mt-1">Apenas usuários com perfil de Administrador do Sistema, Administrador ou CEO podem realizar esta operação.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-bold opacity-50">Para habilitar, digite o nome da tarefa abaixo:</p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder={task?.title}
                    className="w-full p-3 rounded-xl border-2 border-red-500/30 outline-none focus:border-red-500 text-xs font-black bg-red-500/5 text-red-600"
                  />
                </div>
              )}
            </div>
          ) : "Deseja realmente excluir esta tarefa?"
        }
        confirmText={deleteConfirmation?.force ? "EXCLUIR TUDO" : "Excluir"}
        confirmColor="red"
        onConfirm={performDelete}
        onCancel={() => { setDeleteConfirmation(null); setDeleteConfirmText(''); setShouldDeleteHours(false); }}
        disabled={loading || !!(deleteConfirmation?.force && (!ALL_ADMIN_ROLES.includes(String(currentUser?.role || '').trim().toLowerCase()) || deleteConfirmText !== task?.title))}
      />

      {
        showPrompt && (
          <ConfirmationModal
            isOpen={true}
            title="Descartar alterações?"
            message="Existem alterações não salvas."
            confirmText="Ficar"
            cancelText="Sair"
            onConfirm={continueEditing}
            onCancel={() => { discardChanges(); navigate(-1); }}
          />
        )
      }

      {
        isAddMemberOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/50" onClick={() => { setIsAddMemberOpen(false); setMemberSearch(''); }}>
            <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-md p-6 flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-500 tracking-widest">
                  <Users size={14} /> Adicionar Colaborador
                </div>
                <div className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 text-[8px] font-black">
                  SELEÇÃO MÚLTIPLA
                </div>
              </div>

              <div className="relative mb-4">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                <input
                  type="text"
                  placeholder="Buscar colaborador..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-medium border rounded-xl bg-[var(--bg)] border-[var(--border)] outline-none text-white focus:border-purple-500/50 transition-colors"
                />
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 p-1 pr-2">
                {(() => {
                  const projectMemberIds = new Set(
                    projectMembers
                      .filter((pm: any) => String(pm.id_projeto) === String(formData.projectId))
                      .map((pm: any) => String(pm.id_colaborador))
                  );

                  const filtered = (users || [])
                    .filter((u: any) => {
                      const status = getUserStatus(u, tasks, projects, clients, absences);
                      const isForaDoFluxo = status.label === 'Fora do Fluxo';
                      const isAlreadySelected = formData.collaboratorIds?.includes(u.id) || u.id === formData.developerId;

                      // Colaboradores só veem membros do mesmo projeto
                      const isProjectMember = isAdmin || projectMemberIds.has(String(u.id));

                      return u.active !== false &&
                        isProjectMember &&
                        (!isForaDoFluxo || isAlreadySelected) &&
                        (u.name.toLowerCase().includes(memberSearch.toLowerCase()) || (u.cargo || '').toLowerCase().includes(memberSearch.toLowerCase()));
                    })
                    .sort((a, b) => {
                      const aSelected = formData.collaboratorIds?.includes(a.id) || a.id === formData.developerId;
                      const bSelected = formData.collaboratorIds?.includes(b.id) || b.id === formData.developerId;

                      if (aSelected && !bSelected) return -1;
                      if (!aSelected && bSelected) return 1;
                      return a.name.localeCompare(b.name);
                    });

                  return filtered.map((u: any) => {
                    const isSelected = formData.collaboratorIds?.includes(u.id) || u.id === formData.developerId;
                    const isDeveloper = u.id === formData.developerId;

                    return (
                      <button
                        key={u.id}
                        disabled={isDeveloper}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all group ${isSelected ? 'border-purple-500/30 bg-purple-500/5 shadow-sm shadow-purple-500/10' : 'border-transparent hover:bg-[var(--surface-hover)]'} ${isDeveloper ? 'opacity-80 cursor-default' : ''}`}
                        onClick={() => {
                          if (isDeveloper) return;
                          if (isSelected) {
                            setFormData((prev: any) => ({ ...prev, collaboratorIds: prev.collaboratorIds.filter((id: string) => id !== u.id) }));
                          } else {
                            setFormData((prev: any) => ({ ...prev, collaboratorIds: [...(prev.collaboratorIds || []), u.id] }));
                          }
                          markDirty();
                        }}
                      >
                        {/* Selection Indicator Square with Check Mark */}
                        <div className={`w-5 h-5 rounded-[4px] flex items-center justify-center transition-all ${isSelected ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'bg-white/10 border border-white/10 shadow-inner'}`}>
                          {isSelected && <Check size={12} className="text-white" strokeWidth={4} />}
                        </div>

                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-lg overflow-hidden border transition-all ${isSelected ? 'border-purple-500 scale-105 shadow-sm shadow-purple-500/20' : 'border-[var(--border)]'}`}>
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[var(--surface-2)] font-black text-[10px] text-[var(--text-secondary)] uppercase">
                              {u.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                            </div>
                          )}
                        </div>

                        {/* Texto */}
                        <div className="flex-1 text-left min-w-0">
                          <div className={`text-[11px] font-bold truncate uppercase transition-colors ${isSelected ? 'text-purple-500' : 'text-[var(--text)]'}`}>
                            {u.name}
                            {isDeveloper && <span className="ml-2 text-[7px] bg-yellow-400 text-black px-1 rounded">RESPONSÁVEL</span>}
                          </div>
                          <div className="text-[8px] font-black uppercase opacity-30 tracking-widest truncate">{u.cargo || 'Membro'}</div>
                        </div>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default TaskDetail;
