import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDataController } from '@/controllers/useDataController';
import { Task, Status, Priority, Impact } from '@/types';
import {
  ArrowLeft, Save, Calendar, Clock, Users, StickyNote, CheckSquare, Plus, Trash2, X, CheckCircle, Activity, Zap, AlertTriangle, Briefcase, Info, Target, LayoutGrid, Shield, FileSpreadsheet, Crown, ExternalLink, Flag
} from 'lucide-react';
import { useUnsavedChangesPrompt } from '@/hooks/useUnsavedChangesPrompt';
import ConfirmationModal from './ConfirmationModal';
import TransferResponsibilityModal from './TransferResponsibilityModal';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDecimalToTime } from '@/utils/normalizers';
import * as CapacityUtils from '@/utils/capacity';
import * as allocationService from '@/services/allocationService';

const TaskDetail: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  const {
    tasks, clients, projects, users, projectMembers, timesheetEntries,
    createTask, updateTask, deleteTask, holidays,
    taskMemberAllocations, setTaskMemberAllocations, absences
  } = useDataController();

  const isNew = !taskId || taskId === 'new';
  const task = !isNew ? tasks.find(t => t.id === taskId) : undefined;

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
    let val = timeStr.trim().replace(',', '.');
    val = val.replace('h', '');

    // Caso 1: Tem dois pontos (HH:MM)
    if (val.includes(':')) {
      const parts = val.split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return h + (m / 60);
    }

    // Caso 2: Tem ponto (Decimal 8.5)
    if (val.includes('.')) {
      return parseFloat(val) || 0;
    }

    // Caso 3: Apenas números
    // Se for um bloco compacto de 4 dígitos (ex: 0830, 2245), tratamos como HH:MM
    // Se for 3 dígitos mas começar com 0 (ex: 030), tratamos como HH:MM
    // Senão, tratamos como HORAS INTEIRAS (ex: 100 -> 100.0)
    if (/^\d{3,4}$/.test(val)) {
      if (val.length === 4 || (val.length === 3 && val.startsWith('0'))) {
        const h = parseInt(val.slice(0, val.length - 2), 10) || 0;
        const m = parseInt(val.slice(val.length - 2), 10) || 0;
        return h + (m / 60);
      }
    }

    return parseFloat(val) || 0;
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
    return !value;
  };

  const selectedClient = clients.find(c => c.id === formData.clientId);
  const isNicLabs = selectedClient?.name?.toUpperCase().includes('NIC-LABS') || false;

  const hasError = (field: string) => {
    const mandatoryFields = ['projectId', 'clientId', 'title', 'developerId', 'team'];
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
      const proj = qProject ? projects.find(p => p.id === qProject) : null;
      const finalClient = qClient || (proj ? proj.clientId : '');

      setFormData(prev => {
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
      const taskAllocations = taskMemberAllocations.filter(a => a.taskId === taskId);
      const allocationMap: Record<string, number> = {};
      taskAllocations.forEach(a => {
        allocationMap[a.userId] = a.reservedHours;
      });
      setLocalTaskAllocations(allocationMap);
    }
  }, [taskId, isNew, taskMemberAllocations, isDirty]);

  useEffect(() => {
    if (formData.status === 'In Progress' || formData.status === 'Review' || formData.status === 'Testing' || formData.status === 'Done') return;

    if (formData.scheduledStart) {
      const startParts = formData.scheduledStart.split('-');
      const start = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]));
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const newStatus: Status = today >= start ? 'In Progress' : 'Todo';
      if (formData.status !== newStatus) {
        setFormData(prev => ({ ...prev, status: newStatus }));
      }
    }
  }, [formData.scheduledStart, formData.status]);

  const actualHoursSpent = useMemo(() => {
    if (isNew) return 0;
    return timesheetEntries
      .filter(entry => entry.taskId === taskId)
      .reduce((sum, entry) => sum + (Number(entry.totalHours) || 0), 0);
  }, [timesheetEntries, taskId, isNew]);

  const actualStartDate = useMemo(() => {
    if (isNew || !taskId) return null;
    const taskHours = timesheetEntries.filter(e => e.taskId === taskId);
    if (taskHours.length === 0) return null;
    // Usa T12:00:00 para evitar off-by-one de fuso horário
    return new Date(Math.min(...taskHours.map(e => new Date(e.date + 'T12:00:00').getTime())));
  }, [timesheetEntries, taskId, isNew]);


  const taskWeight = useMemo(() => {
    const project = projects.find(p => p.id === formData.projectId);
    if (!project || !project.startDate || !project.estimatedDelivery) return { weight: 0 };

    const projectWorkingDays = CapacityUtils.getWorkingDaysInRange(project.startDate, project.estimatedDelivery, holidays);
    const taskWorkingDays = (formData.scheduledStart || formData.actualStart) && formData.estimatedDelivery
      ? CapacityUtils.getWorkingDaysInRange(formData.scheduledStart || formData.actualStart, formData.estimatedDelivery, holidays)
      : 0;

    const weight = projectWorkingDays > 0 ? (taskWorkingDays / projectWorkingDays) * 100 : 0;
    return { weight };
  }, [formData.scheduledStart, formData.actualStart, formData.estimatedDelivery, formData.projectId, projects, holidays]);

  const isOwner = task && task.developerId === currentUser?.id;
  const isCollaborator = !isNew && task && task.collaboratorIds?.includes(currentUser?.id || '');
  const canEditEverything = isAdmin || isNew;
  const canEditProgressStatus = isAdmin || isOwner || isCollaborator || isNew;

  const getDelayDays = () => {
    if (formData.status === 'Done' || formData.status === 'Review' || !formData.estimatedDelivery) return 0;
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const parts = formData.estimatedDelivery.split('-');
    const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0, 0);
    return today > due ? Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  };
  const daysDelayed = getDelayDays();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];
    if (isFieldMissing('projectId')) errors.push('projectId');
    if (isFieldMissing('clientId')) errors.push('clientId');
    if (isFieldMissing('title')) errors.push('title');
    if (isFieldMissing('team')) errors.push('team');
    if (isFieldMissing('developerId')) errors.push('developerId');

    if (errors.length > 0) {
      const missingFields = errors.map(e => {
        switch (e) {
          case 'projectId': return 'Projeto';
          case 'clientId': return 'Cliente';
          case 'title': return 'Título';
          case 'developerId': return 'Responsável';
          case 'team': return 'Equipe Alocada';
          default: return e;
        }
      });
      alert('Campos obrigatórios faltando: \n - ' + missingFields.join('\n - ') + ' \n\nPor favor, preencha os campos destacados em amarelo.');
      return;
    }

    // Validação de intervalo do projeto
    const project = projects.find(p => String(p.id) === String(formData.projectId));
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
        // Se houver membros alocados mas nenhuma alocação explícita (tudo zero), salva o fallback distribuído.
        const teamIds = Array.from(new Set([payload.developerId, ...(payload.collaboratorIds || [])])).filter(Boolean);
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
        const savedAllocs = await allocationService.saveTaskAllocations(finalTaskId, allocationsToSave);
        if (setTaskMemberAllocations) {
          setTaskMemberAllocations((prev: any[]) => {
            const others = prev.filter(a => String(a.taskId) !== String(finalTaskId));
            return [...others, ...savedAllocs];
          });
        }
      }

      discardChanges();
      navigate(-1);
    } catch (error: any) {
      alert("Erro ao salvar: " + (error?.message || "Erro desconhecido"));
    } finally { setLoading(false); }
  };

  const taskHours = timesheetEntries.filter(e => e.taskId === taskId);
  const totalTaskHours = taskHours.reduce((acc, current) => acc + current.totalHours, 0);

  const performDelete = async () => {
    if (!taskId || !deleteConfirmation) return;

    // Se houver horas e NÃO for system_admin, bloqueia no front também
    if (deleteConfirmation.force && currentUser?.role !== 'system_admin') {
      alert("Apenas o Administrador do Sistema pode excluir tarefas que já possuem horas apontadas.");
      setDeleteConfirmation(null);
      return;
    }

    // Validação de texto para exclusão forçada
    if (deleteConfirmation.force && deleteConfirmText !== task?.title) {
      alert("Para confirmar a exclusão com horas, você deve digitar o nome exato da tarefa.");
      return;
    }

    try {
      setLoading(true);
      await deleteTask(taskId, deleteConfirmation.force, shouldDeleteHours);
      discardChanges(); navigate(-1);
    } catch (error: any) {
      if (error.message?.includes("horas apontadas") || error.message?.includes("seguinte erro: 400")) {
        setDeleteConfirmation({ force: true });
        setDeleteConfirmText('');
      } else if (error.message?.includes("403")) {
        alert("Acesso Negado: Apenas Administradores do Sistema podem excluir tarefas com horas.");
        setDeleteConfirmation(null);
      } else {
        alert("Erro ao excluir: " + error.message);
      }
    } finally { setLoading(false); }
  };

  const handleBack = () => {
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
  };

  const responsibleUsers = useMemo(() => {
    if (!formData.projectId) return [];
    const membersIds = projectMembers.filter(pm => String(pm.id_projeto) === formData.projectId).map(pm => String(pm.id_colaborador));
    return users.filter(u => u.active !== false && (membersIds.includes(u.id) || u.id === formData.developerId));
  }, [users, projectMembers, formData.projectId, formData.developerId]);

  if (!isNew && !task) return <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Tarefa não encontrada.</div>;

  const taskProject = projects.find(p => p.id === (task?.projectId || formData.projectId));
  const taskClient = clients.find(c => c.id === (task?.clientId || formData.clientId || taskProject?.clientId));

  return (
    <div className="h-full flex flex-col bg-[var(--bg)] overflow-hidden">
      <div className="px-8 py-5 shadow-lg flex items-center justify-between text-white z-20" style={{ background: 'linear-gradient(to right, #1e1b4b, #4c1d95)' }}>
        <div className="flex items-center gap-4">
          {/* Botão Voltar com estilo explícito para garantir visibilidade */}
          <button
            type="button"
            onClick={handleBack}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all border border-white/20 text-white flex items-center justify-center shrink-0"
            title="Voltar"
          >
            <ArrowLeft size={18} />
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
            <div className="flex items-center gap-1.5 mt-1 opacity-60">
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
          <button type="button" onClick={() => navigate(-1)} className="px-5 py-2.5 rounded-xl font-bold text-xs transition-all hover:bg-white/10 text-white">CANCELAR</button>
          <button onClick={handleSubmit} className="px-8 py-2.5 bg-white text-indigo-950 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xl hover:bg-indigo-50 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50" disabled={loading}>
            <Save className="w-4 h-4" /> {loading ? 'SALVANDO...' : 'SALVAR'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <form onSubmit={handleSubmit} className="max-w-7xl mx-auto space-y-6">
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

                        if (newStatus === 'Done') {
                          newProgress = 100;
                          if (!newActualDelivery) {
                            newActualDelivery = new Date().toISOString().split('T')[0];
                          }
                        } else if (formData.status === 'Done') {
                          newActualDelivery = '';
                        }

                        setFormData({
                          ...formData,
                          status: newStatus,
                          progress: newProgress,
                          actualDelivery: newActualDelivery
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
                      let updatedCollabs = formData.collaboratorIds || [];
                      if (selectedId && !updatedCollabs.includes(selectedId)) updatedCollabs = [...updatedCollabs, selectedId];
                      setFormData({ ...formData, developerId: selectedId, developer: u?.name || '', collaboratorIds: updatedCollabs });
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
                  <div className="flex items-center justify-between bg-emerald-500/5 dark:bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 shadow-inner group/effort relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full -mr-8 -mt-8 group-hover/effort:scale-125 transition-transform duration-700" />
                    <div className="flex items-center gap-2.5 relative z-10">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <Clock size={18} />
                      </div>
                      <div className="flex flex-col">
                        <p className="text-[8px] font-black uppercase text-emerald-500/60 tracking-[0.2em] mb-0.5">Horas Apontadas (Total)</p>
                        <p className="text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-400 leading-none">{formatDecimalToTime(actualHoursSpent)}</p>
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
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-600 shadow-inner border border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* CARD 4: TIMELINE */}
            <div className="p-4 rounded-[24px] border shadow-sm flex flex-col justify-between h-[290px] group hover:shadow-md transition-all duration-300" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-blue-500 font-black text-[10px] uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">
                    <Calendar size={12} /> Timeline
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform"><LayoutGrid size={12} /></div>
                </div>

                <div className="space-y-3">
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
                      <div className="p-2.5 rounded-2xl bg-[var(--surface-hover)] border border-[var(--border)] group/date focus-within:border-blue-500/50 transition-colors">
                        <label className="text-[8px] font-black uppercase opacity-40 tracking-[0.2em] mb-1 block group-focus-within/date:text-blue-500 transition-colors">Entrega</label>
                        <input
                          type="date"
                          value={formData.estimatedDelivery || ''}
                          onChange={e => { setFormData({ ...formData, estimatedDelivery: e.target.value }); markDirty(); }}
                          className="w-full bg-transparent text-xs font-black text-[var(--text)] outline-none border-none p-0"
                        />
                      </div>
                    </div>

                    <div className={`p-3 rounded-2xl border group/fc focus-within:border-blue-500/50 transition-colors mt-2 ${!formData.estimatedHours ? 'bg-yellow-400/20 border-yellow-400/50 shadow-[0_0_10px_rgba(250,204,21,0.1)]' : 'bg-[var(--surface-hover)] border-[var(--border)] relative z-10'}`}>
                      <label className={`text-[8px] font-black uppercase tracking-[0.2em] mb-1 block group-focus-within/fc:text-blue-500 transition-colors ${!formData.estimatedHours ? 'text-yellow-500' : 'opacity-40'}`}>horas da tarefa *</label>
                      <input
                        type="text"
                        value={editingMainHours !== null ? editingMainHours : formatDecimalToTime(formData.estimatedHours || 0)}
                        onChange={(e) => {
                          const val = e.target.value;
                          // Allow numbers and decimal/time separators
                          if (!/^[0-9:.,]*$/.test(val)) return;
                          setEditingMainHours(val);
                          markDirty();
                        }}
                        onBlur={() => {
                          if (editingMainHours !== null) {
                            const dec = parseTimeToDecimal(editingMainHours);
                            setFormData(prev => ({ ...prev, estimatedHours: dec }));
                            setEditingMainHours(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        className="w-full bg-transparent text-[11px] font-black text-[var(--text)] outline-none tabular-nums p-0 border-none leading-none focus:text-blue-500 font-mono"
                        placeholder="00:00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-2 border-t border-dashed border-[var(--border)]">
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
                    <span className="text-[10px] font-black">{actualStartDate ? actualStartDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '...'}</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-xl bg-slate-500/5 border border-[var(--border)] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CheckSquare size={10} className="opacity-30" />
                      <span className="text-[8px] font-bold opacity-30 uppercase">Entrega</span>
                    </div>
                    <span className="text-[10px] font-black ml-auto opacity-30">{formData.actualDelivery ? new Date(formData.actualDelivery + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '...'}</span>
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
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-indigo-500" />
                  {/* Inclui o responsável principal no contador se ele existir */}
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-1">
                    Equipe ({Array.from(new Set([formData.developerId, ...(formData.collaboratorIds || [])])).filter(Boolean).length})
                    {(() => {
                      const limit = formData.estimatedHours || 0;
                      const hasAnyAllocation = Object.values(localTaskAllocations).some(val => val > 0);
                      const teamCount = Array.from(new Set([formData.developerId, ...(formData.collaboratorIds || [])])).filter(Boolean).length || 1;

                      let totalAllocated = 0;
                      if (!hasAnyAllocation && limit > 0) {
                        totalAllocated = limit; // Auto-distribuído
                      } else {
                        const teamIds = Array.from(new Set([formData.developerId, ...(formData.collaboratorIds || [])])).filter(Boolean);
                        totalAllocated = teamIds.reduce((sum, id) => sum + (localTaskAllocations[id] || 0), 0);
                      }

                      let statusClasses = 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500/80';
                      if (limit > 0) {
                        if (Math.abs(totalAllocated - limit) < 0.01) {
                          statusClasses = 'bg-emerald-500 text-white border-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.4)]';
                        } else if (totalAllocated > limit) {
                          statusClasses = 'bg-red-500 text-white border-red-600 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse';
                        } else {
                          statusClasses = 'bg-yellow-400 text-black border-yellow-500 shadow-[0_0_10px_rgba(250,204,21,0.3)] font-black';
                        }
                      }

                      return (
                        <span className={`ml-2 px-2 py-0.5 rounded-lg border font-mono text-[9px] transition-all duration-300 ${statusClasses}`}>
                          {formatDecimalToTime(totalAllocated)} / {formatDecimalToTime(limit)}
                        </span>
                      );
                    })()}
                  </h4>
                </div>
                <button type="button" onClick={() => setIsAddMemberOpen(true)} className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition-colors"><Plus size={14} /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {Array.from(new Set([formData.developerId, ...(formData.collaboratorIds || [])]))
                  .filter(Boolean)
                  .map(id => {
                    const u = users.find(usr => usr.id === id);
                    if (!u) return null;


                    // Lógica de Disponibilidade no Período
                    const tStart = formData.scheduledStart || '';
                    const tEnd = formData.estimatedDelivery || '';

                    // Início efetivo: máx(hoje, início da tarefa)
                    const todayStr = new Date().toISOString().split('T')[0];
                    const effectiveStart = tStart && tStart > todayStr ? tStart : todayStr;

                    const workingDaysInPeriod = CapacityUtils.getWorkingDaysInRange(effectiveStart, tEnd, holidays);
                    const dailyCap = u.dailyAvailableHours || 8;
                    const continuousCommitment = CapacityUtils.getUserContinuousCommitment(id, projects, projectMembers, dailyCap);

                    // Capacidade bruta no período (já descontando compromisso contínuo)
                    const grossAvailability = Math.max(0, dailyCap - continuousCommitment) * workingDaysInPeriod;

                    // Horas reservadas em OUTRAS tarefas que se sobrepõem a esse período
                    const otherTasksReserved = tasks
                      .filter(t =>
                        t.id !== (isNew ? undefined : taskId) &&
                        !t.deleted_at &&
                        t.status !== 'Done' &&
                        (String(t.developerId) === String(id) || t.collaboratorIds?.some(cid => String(cid) === String(id)))
                      )
                      .reduce((sum, t) => {
                        const otherStart = t.scheduledStart || t.actualStart || '';
                        const otherEnd = t.estimatedDelivery || '';
                        // Verifica se há sobreposição com o período desta tarefa
                        if (!otherEnd || (tEnd && otherStart > tEnd) || (effectiveStart && otherEnd < effectiveStart)) return sum;
                        // Busca horas apontadas pelo usuário na outra tarefa
                        const reportedOnOther = timesheetEntries
                          .filter(e => String(e.taskId) === String(t.id) && String(e.userId) === String(id))
                          .reduce((s, e) => s + (Number(e.totalHours) || 0), 0);

                        // Busca alocação específica desse membro nessa tarefa
                        let allocation = 0;
                        const alloc = taskMemberAllocations.find(a => String(a.taskId) === String(t.id) && String(a.userId) === String(id));
                        if (alloc) {
                          allocation = alloc.reservedHours;
                        } else {
                          // Fallback: divide igualmente entre membros
                          const teamSize = Array.from(new Set([t.developerId, ...(t.collaboratorIds || [])])).filter(Boolean).length || 1;
                          allocation = (Number(t.estimatedHours) || 0) / teamSize;
                        }

                        // Considera apenas o esforço restante
                        return sum + Math.max(0, allocation - reportedOnOther);
                      }, 0);

                    let periodAvailability = Math.max(0, grossAvailability - otherTasksReserved);

                    // REGRA DE ATRASO: Se a tarefa já passou da data de entrega, está atrasada e não concluída,
                    // mostramos o Saldo Disponível do Mês inteiro como salva-guarda, já que o período (dias úteis) zerou.
                    if (tEnd && tEnd < todayStr && formData.status !== 'Done') {
                      const currentMonthStr = todayStr.substring(0, 7);
                      const monthlyData = CapacityUtils.getUserMonthlyAvailability(
                        u, currentMonthStr, projects, projectMembers, timesheetEntries, tasks, holidays, taskMemberAllocations, absences
                      );
                      periodAvailability = monthlyData.balance;
                    }

                    const teamCount = Array.from(new Set([formData.developerId, ...(formData.collaboratorIds || [])])).filter(Boolean).length;

                    // Baseado no Esforço Operacional (Horas da Tarefa)
                    const totalTaskHours = Number(formData.estimatedHours) || 0;

                    // Se o membro já tem uma alocação local salva, usamos ela. Caso contrário, se há horas de tarefa mas nenhum membro tem reserva, dividimos igualmente.
                    const hasAnyAllocation = Object.values(localTaskAllocations).some(val => val > 0);
                    let currentForecast = localTaskAllocations[id] || 0;
                    if (!hasAnyAllocation && totalTaskHours > 0) {
                      currentForecast = totalTaskHours / teamCount;
                    }

                    const memberRealHours = taskHours.filter(h => h.userId === id).reduce((sum, h) => sum + (Number(h.totalHours) || 0), 0);
                    const distributionPercent = totalTaskHours > 0 ? (currentForecast / totalTaskHours) * 100 : 0;
                    return (
                      <div key={id} className="flex flex-col gap-1.5 p-3 rounded-xl border bg-[var(--bg)] border-[var(--border)] group/member relative">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[var(--surface-2)] flex items-center justify-center text-[10px] font-bold overflow-hidden shadow-sm">
                            {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover" /> : u.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-extrabold truncate uppercase" style={{ color: 'var(--text)' }}>{u.name.split(' (')[0]}</p>
                            <div className="flex items-center gap-2">
                              {id === formData.developerId ? (
                                <span className="text-[8px] font-black bg-yellow-400 text-black px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
                                  <Crown size={8} /> RESPONSÁVEL
                                </span>
                              ) : (
                                <span className="text-[8px] font-black bg-indigo-500/10 text-indigo-500 px-1.5 py-0.5 rounded">MEMBRO</span>
                              )}
                            </div>
                          </div>
                          {id !== formData.developerId && (
                            <button type="button" onClick={() => setFormData({ ...formData, collaboratorIds: formData.collaboratorIds?.filter(cid => cid !== id) })} className="p-1.5 text-red-500/30 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"><X size={12} /></button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 border-t border-[var(--border)] pt-2 border-dashed">
                          {/* Saldo Disponível no Período */}
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase opacity-40">Saldo Disp.</span>
                            {formData.status === 'Done' ? (
                              <span className="text-[10px] font-black text-[var(--muted)] opacity-50 tabular-nums">
                                --
                              </span>
                            ) : (
                              <span className={`text-[10px] font-black tabular-nums ${periodAvailability < currentForecast ? 'text-red-500' : 'text-indigo-500'}`}>
                                {formatDecimalToTime(periodAvailability)}
                              </span>
                            )}
                          </div>

                          {/* Distribuição de Carga */}
                          <div className="flex flex-col border-l border-[var(--border)] pl-3">
                            <span className="text-[9px] font-black uppercase opacity-40">Distribuição</span>
                            <span className="text-[10px] font-black text-amber-500 tabular-nums">
                              {distributionPercent.toFixed(1)}%
                            </span>
                          </div>

                          {/* Allocation Input */}
                          <div className="flex flex-col group/alloc">
                            <span className="text-[9px] font-black uppercase group-focus-within/alloc:text-blue-500 transition-colors">
                              <span className="opacity-40">Horas Tarefa</span>
                              <span className="opacity-20 ml-1">/ {formatDecimalToTime(totalTaskHours)}</span>
                            </span>
                            <div className="flex items-center">
                              <input
                                type="text"
                                value={editingMemberHours[id] !== undefined ? editingMemberHours[id] : formatDecimalToTime(currentForecast)}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (!/^[0-9:.,]*$/.test(val)) return;
                                  setEditingMemberHours(prev => ({ ...prev, [id]: val }));
                                  markDirty();
                                }}
                                onBlur={() => {
                                  if (editingMemberHours[id] !== undefined) {
                                    const dec = parseTimeToDecimal(editingMemberHours[id]);
                                    setLocalTaskAllocations(prev => ({ ...prev, [id]: dec }));
                                    setEditingMemberHours(prev => {
                                      const next = { ...prev };
                                      delete next[id];
                                      return next;
                                    });
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                }}
                                className="text-[10px] font-black text-blue-500 bg-transparent border-none outline-none p-0 w-12 tabular-nums"
                              />
                            </div>
                          </div>

                          {/* Real Execution */}
                          <div className="flex flex-col border-l border-[var(--border)] pl-3">
                            <span className="text-[9px] font-black uppercase opacity-40">Real Exec.</span>
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
                                  {users.find(u => u.id === entry.userId)?.avatarUrl ? (
                                    <img src={users.find(u => u.id === entry.userId)?.avatarUrl} className="w-full h-full object-cover" />
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )
            }
          </div>
        </form>
      </div >

      <ConfirmationModal
        isOpen={!!deleteConfirmation}
        title={deleteConfirmation?.force ? "⚠️ EXCLUSÃO CRÍTICA (COM HORAS)" : "Excluir Tarefa"}
        message={
          deleteConfirmation?.force ? (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-2xl border border-red-200 dark:border-red-500/20">
                <p className="text-red-600 dark:text-red-400 font-black text-sm mb-2">
                  ATENÇÃO: Foram encontrados {taskHours.length} apontamentos ({totalTaskHours}h total).
                </p>
                <div className="max-h-32 overflow-y-auto space-y-2 mb-4 scrollbar-hide">
                  {taskHours.map(h => (
                    <div key={h.id} className="text-[10px] flex justify-between items-center p-2 bg-white dark:bg-black/20 rounded-lg">
                      <span className="font-bold">{new Date(h.date).toLocaleDateString()}</span>
                      <span className="opacity-70">{h.userName}</span>
                      <span className="font-black text-red-500">{h.totalHours}h</span>
                    </div>
                  ))}
                </div>

                <label className="flex items-center gap-3 cursor-pointer p-3 bg-white dark:bg-black/20 rounded-xl border border-red-200 dark:border-red-500/10 hover:border-red-500 transition-all">
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

              {currentUser?.role !== 'system_admin' ? (
                <p className="text-xs p-3 bg-red-500/10 rounded-lg text-red-600 font-bold border border-red-500/20">
                  Bloqueado: Apenas o Administrador do Sistema pode realizar esta operação.
                </p>
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
        disabled={!!(deleteConfirmation?.force && (currentUser?.role !== 'system_admin' || deleteConfirmText !== task?.title))}
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/50" onClick={() => setIsAddMemberOpen(false)}>
            <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-xs font-black uppercase">Adicionar Colaborador</h4>
                <button onClick={() => setIsAddMemberOpen(false)}><X size={18} /></button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {users.filter(u => u.active !== false && projectMembers.some(pm => String(pm.id_projeto) === formData.projectId && String(pm.id_colaborador) === u.id) && u.id !== formData.developerId && !formData.collaboratorIds?.includes(u.id)).map(u => (
                  <button key={u.id} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--surface-hover)]" onClick={() => { setFormData({ ...formData, collaboratorIds: [...(formData.collaboratorIds || []), u.id] }); setIsAddMemberOpen(false); markDirty(); }}>
                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-2)] flex items-center justify-center font-bold text-xs">{u.name[0]}</div>
                    <div className="text-left font-bold text-xs uppercase">{u.name}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default TaskDetail;
