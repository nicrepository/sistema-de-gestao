// components/TimesheetForm.tsx - Adaptado para Router
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDataController } from '@/controllers/useDataController';
import { TimesheetEntry } from '@/types';
import { ALL_ADMIN_ROLES } from '@/constants/roles';
import { ArrowLeft, Save, Clock, Trash2, User as UserIcon, Briefcase, CheckSquare, Calendar, AlertCircle } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { useUnsavedChangesPrompt } from '@/hooks/useUnsavedChangesPrompt';
import { formatDecimalToTime } from '@/utils/normalizers';
import TimePicker from './TimePicker';

const TimesheetForm: React.FC = () => {
  const { entryId } = useParams<{ entryId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  const { users, clients, projects, tasks, timesheetEntries, createTimesheet, updateTimesheet, deleteTimesheet, updateTask } = useDataController();

  const isNew = !entryId || entryId === 'new';
  const initialEntry = !isNew ? timesheetEntries.find(e => e.id === entryId) : null;
  const preSelectedDate = searchParams.get('date');
  const preSelectedUserId = searchParams.get('userId');
  const preSelectedTaskId = searchParams.get('taskId');
  const preSelectedProjectId = searchParams.get('projectId');
  const preSelectedClientId = searchParams.get('clientId');
  const user = currentUser;


  const isEditing = !!initialEntry;

  const [formData, setFormData] = useState<Partial<TimesheetEntry>>({
    clientId: '',
    projectId: '',
    taskId: '',
    date: preSelectedDate || new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '18:00',
    description: '',
    userId: user?.id,
    userName: user?.name,
    lunchDeduction: true
  });

  const [taskProgress, setTaskProgress] = useState<number>(0);
  const [deductLunch, setDeductLunch] = useState(true);
  const [loading, setLoading] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<TimesheetEntry | null>(null);
  const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false);
  const [availabilityWarning, setAvailabilityWarning] = useState('');
  const { isDirty, showPrompt, markDirty, requestBack, discardChanges, continueEditing } = useUnsavedChangesPrompt();

  // Validate time - now accepts full 24h range
  const validateAndSetTime = (field: 'startTime' | 'endTime', val: string) => {
    markDirty();
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  // Init form
  useEffect(() => {
    if (initialEntry) {
      setFormData(initialEntry);
      if (initialEntry.lunchDeduction !== undefined) {
        setDeductLunch(initialEntry.lunchDeduction);
      }
    } else if (isAdmin && preSelectedUserId) {
      const targetUser = users.find(u => u.id === preSelectedUserId);
      if (targetUser) {
        setFormData(prev => ({
          ...prev,
          userId: targetUser.id,
          userName: targetUser.name,
          lunchDeduction: true
        }));
      }
    } else if (user) {
      // SMART DEFAULT: Find existing entries for this user on this day to suggest a start time
      const targetDate = preSelectedDate || new Date().toISOString().split('T')[0];
      const targetUserId = preSelectedUserId || user.id;

      const dayEntries = timesheetEntries
        .filter(e => e.date === targetDate && e.userId === targetUserId)
        .sort((a, b) => (b.endTime || '').localeCompare(a.endTime || ''));

      const lastEndTime = dayEntries.length > 0 ? dayEntries[0].endTime : '09:00';
      const suggestedEnd = lastEndTime === '18:00' ? '18:00' : (lastEndTime > '18:00' ? lastEndTime : '18:00');

      setFormData(prev => ({
        ...prev,
        userId: targetUserId,
        userName: isAdmin ? (users.find(u => u.id === targetUserId)?.name || user.name) : user.name,
        clientId: preSelectedClientId || prev.clientId,
        projectId: preSelectedProjectId || prev.projectId,
        taskId: preSelectedTaskId || prev.taskId,
        date: targetDate,
        startTime: lastEndTime,
        endTime: suggestedEnd,
        lunchDeduction: dayEntries.length === 0 // Default to true only for the first entry of the day
      }));
    }
  }, [initialEntry, user, isAdmin, preSelectedUserId, users, preSelectedClientId, preSelectedProjectId, preSelectedTaskId, preSelectedDate, timesheetEntries]);

  // Update progress when task changes
  useEffect(() => {
    if (formData.taskId) {
      const selectedTask = tasks.find(t => t.id === formData.taskId);
      if (selectedTask) {
        setTaskProgress(selectedTask.progress || 0);
      }
    }
  }, [formData.taskId, tasks]);

  // Helpers
  const calculateTotalHours = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    if (diffMinutes < 0) diffMinutes += 24 * 60;
    return Number((diffMinutes / 60).toFixed(2));
  };

  const calculateTimeDisplay = (start: string, end: string, deduct: boolean) => {
    if (!start || !end) return '0h 0min';
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    if (diffMinutes < 0) diffMinutes += 24 * 60;
    if (deduct) diffMinutes = Math.max(0, diffMinutes - 60);

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return minutes > 0 ? `${hours}h${minutes.toString().padStart(2, '0')}` : `${hours}h`;
  };

  // Determine the display hours: if we have both times, calculate. Otherwise, use what's in the DB (formData.totalHours).
  const hasTimes = !!formData.startTime && !!formData.endTime;

  const totalHours = hasTimes
    ? calculateTotalHours(formData.startTime!, formData.endTime!)
    : (formData.totalHours || 0);

  const adjustedTotalHours = hasTimes && deductLunch ? Math.max(0, totalHours - 1) : totalHours;

  const timeDisplay = hasTimes
    ? calculateTimeDisplay(formData.startTime!, formData.endTime!, deductLunch)
    : formatDecimalToTime(formData.totalHours || 0);

  // Get entries for the same day and user
  const entriesForDay = React.useMemo(() => {
    const targetUserId = formData.userId || user?.id;
    const targetDate = formData.date;
    if (!targetUserId || !targetDate) return [];

    return timesheetEntries.filter(e =>
      e.userId === targetUserId &&
      e.date === targetDate &&
      e.id !== initialEntry?.id // Exclude current entry if editing
    ).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [timesheetEntries, formData.userId, formData.date, user?.id, initialEntry?.id]);

  // Debug: log entries for day
  React.useEffect(() => {
    console.log('📅 Apontamentos do dia:', {
      date: formData.date,
      userId: formData.userId || user?.id,
      total: entriesForDay.length,
      entries: entriesForDay
    });
  }, [entriesForDay, formData.date, formData.userId, user?.id]);

  // Check for time conflicts
  const hasTimeConflict = React.useMemo(() => {
    if (!formData.startTime || !formData.endTime) return false;

    const newStart = formData.startTime;
    const newEnd = formData.endTime;

    return entriesForDay.some(entry => {
      const existingStart = entry.startTime;
      const existingEnd = entry.endTime;

      // Check if ranges overlap
      return (newStart < existingEnd && newEnd > existingStart);
    });
  }, [entriesForDay, formData.startTime, formData.endTime]);

  // Calculate total hours for the day
  const totalHoursForDay = React.useMemo(() => {
    return entriesForDay.reduce((sum, e) => sum + (e.totalHours || 0), 0) + adjustedTotalHours;
  }, [entriesForDay, adjustedTotalHours]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId || !formData.projectId || !formData.taskId || !formData.date || !formData.startTime || !formData.endTime) {
      alert("Por favor, preencha todos os campos obrigatórios (Cliente, Projeto, Tarefa, Data e Horários).");
      return;
    }

    // Descrição agora é opcional — sem limite de caracteres


    // Check for time conflicts
    if (hasTimeConflict) {
      alert("Conflito de horário! Você já tem um apontamento neste período. Por favor, ajuste o horário.");
      return;
    }

    const selectedTask = tasks.find(t => t.id === formData.taskId);
    const isTaskCurrentlyDone = selectedTask?.status === 'Done' || selectedTask?.actualDelivery != null;
    const willBeCompleted = !isTaskCurrentlyDone && taskProgress === 100;

    const entry: TimesheetEntry = {
      id: initialEntry?.id || crypto.randomUUID(),
      userId: formData.userId || user?.id || '',
      userName: formData.userName || user?.name || '',
      clientId: formData.clientId!,
      projectId: formData.projectId!,
      taskId: formData.taskId!,
      date: formData.date!,
      startTime: formData.startTime!,
      endTime: formData.endTime!,
      totalHours: adjustedTotalHours,
      description: formData.description,
      lunchDeduction: deductLunch,
    };

    // Simplified availability and hours checks (requested by user to remove limits)
    // We can still keep the checks for visual signaling if needed, but not block the save.

    // Non-blocking warning logic for dashboard could be here, but for now we just proceed to save.

    if (willBeCompleted) {
      setPendingSave(entry);
      setCompletionModalOpen(true);
      return;
    }

    await saveEntry(entry, selectedTask && !isTaskCurrentlyDone ? taskProgress : undefined);
  };

  const saveEntry = async (entry: TimesheetEntry, progressToUpdate?: number) => {
    setLoading(true);
    try {
      // Update task progress if needed
      if (progressToUpdate !== undefined && entry.taskId) {
        await updateTask(entry.taskId, { progress: progressToUpdate });
      }

      if (isNew) {
        await createTimesheet(entry);
        alert("Apontamento criado com sucesso!");
      } else {
        await updateTimesheet(entry);
        alert("Apontamento atualizado!");
      }

      discardChanges();
      navigate(-1);
    } catch (error: any) {
      alert("Erro ao salvar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCompletion = async () => {
    if (!pendingSave) return;
    // Mark as Done (100%)
    if (pendingSave.taskId) {
      await updateTask(pendingSave.taskId, { progress: 100, status: 'Done', actualDelivery: new Date().toISOString() });
    }
    await saveEntry(pendingSave);
    setCompletionModalOpen(false);
    setPendingSave(null);
  };

  const handleDelete = async () => {
    if (!initialEntry) return;
    setLoading(true);
    try {
      await deleteTimesheet(initialEntry.id);
      setDeleteModalOpen(false);
      navigate(-1);
    } catch (e) {
      alert("Erro ao excluir.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = useCallback(() => {
    const canGoBack = requestBack();
    if (canGoBack) navigate(-1);
  }, [requestBack, navigate]);

  // Filter Logic
  const { projectMembers } = useDataController();

  const availableProjectsIds = React.useMemo(() => {
    const targetUserId = formData.userId || currentUser?.id;
    if (!targetUserId) return [];

    // Se o usuário alvo for um Admin (diretoria/gestor), talvez ele deva ver tudo,
    // mas a regra solicitada é restritiva ao vínculo.
    // Vamos verificar se o usuário alvo tem cargo de gestão/admin.
    const targetUser = users.find(u => u.id === targetUserId);
    const targetIsAdmin = ALL_ADMIN_ROLES.includes(targetUser?.role?.toLowerCase() || '');

    if (targetIsAdmin) return projects.map(p => p.id);

    // Projetos onde o usuário alvo é membro oficial
    const memberProjectIds = projectMembers
      .filter(pm => String(pm.id_colaborador) === String(targetUserId))
      .map(pm => String(pm.id_projeto));

    // Projetos que contêm tarefas vinculadas ao usuário alvo
    const taskProjectIds = tasks
      .filter(t => t.developerId === targetUserId || t.collaboratorIds?.includes(targetUserId))
      .map(t => t.projectId);

    // Projetos que contêm apontamentos do usuário alvo (Histórico)
    const timesheetProjectIds = timesheetEntries
      .filter(e => e.userId === targetUserId)
      .map(e => e.projectId);

    // Combinar todos e remover duplicatas
    return [...new Set([...memberProjectIds, ...taskProjectIds, ...timesheetProjectIds])];
  }, [projectMembers, tasks, timesheetEntries, formData.userId, currentUser, projects, users]);

  const availableProjects = projects.filter(p =>
    availableProjectsIds.includes(p.id) &&
    (!formData.clientId || p.clientId === formData.clientId)
  );

  const availableClientIds = React.useMemo(() => {
    const targetUserId = formData.userId || currentUser?.id;
    if (!targetUserId) return [];

    const targetUser = users.find(u => u.id === targetUserId);
    const activeRoles = ALL_ADMIN_ROLES;
    const normalizedRole = String(targetUser?.role || '').trim().toLowerCase().replace(/\s+/g, '_');
    const targetIsAdmin = activeRoles.includes(normalizedRole);

    if (targetIsAdmin) return clients.map(c => c.id);

    const isOperational = targetUser?.torre !== 'N/A';

    if (!isOperational && !targetIsAdmin) {
      // Se não for operacional e não for admin, vê apenas projetos internos (ex: Nic-Labs)
      return clients
        .filter(c => c.name.toLowerCase().includes('nic-labs'))
        .map(c => c.id);
    }

    const userProjects = projects.filter(p => availableProjectsIds.includes(p.id));
    return [...new Set(userProjects.map(p => p.clientId))];
  }, [clients, projects, availableProjectsIds, formData.userId, currentUser, users]);

  const filteredClients = clients.filter(c => availableClientIds.includes(c.id));
  const filteredProjects = availableProjects;

  // Filtrar tarefas: mostrar apenas as vinculadas ao usuário (exceto para admin)
  const filteredTasks = tasks.filter(t => {
    // Primeiro filtro: deve pertencer ao projeto selecionado (se houver)
    if (formData.projectId && t.projectId !== formData.projectId) return false;

    // Filtro de status: Apenas "Não Iniciado", "Iniciado", "Pendente" e "Teste"
    // E remover tarefas sem título ou inválidas
    const validStatus = ['Todo', 'In Progress', 'Review', 'Testing'].includes(t.status || '');
    const validTitle = t.title && t.title !== '(Sem título)' && t.title.trim() !== '';

    // Se a tarefa for a que já está salva neste lançamento, permite que ela apareça mesmo se concluída
    if (formData.taskId && t.id === formData.taskId) return true;

    // Permite que todas as tarefas, inclusive concluídas (Done), apareçam na lista para apontamentos/edições atrasadas 
    // ou seja, se for Done, o validStatus seria falso, mas vamos permitir caso seja o desejado pelo cliente
    if (!validStatus && t.status !== 'Done') return false;
    if (!validTitle) return false;

    // Se for admin, mostra todas as tarefas do projeto que passaram no filtro de status
    if (isAdmin) return true;

    // Para usuários normais: mostrar apenas tarefas onde ele é desenvolvedor ou colaborador
    const isTaskDeveloper = String(t.developerId) === String(user?.id);
    const isTaskCollaborator = (t.collaboratorIds || []).some(id => String(id) === String(user?.id));

    return isTaskDeveloper || isTaskCollaborator;
  });

  const isTaskLogMode = !!preSelectedTaskId;
  const canEnterTime = !!formData.clientId && !!formData.projectId && !!formData.taskId;
  const currentTaskTitle = tasks.find(t => t.id === formData.taskId)?.title;

  const currentProject = projects.find(p => p.id === formData.projectId);
  const isTrainingProject = currentProject && currentProject.name &&
    (currentProject.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('treinamento') ||
      currentProject.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('capacitacao'));

  const targetUser = users.find(u => u.id === formData.userId);
  const isPmoTower = targetUser?.torre?.toLowerCase() === 'pmo';

  if (!user) return <div className="p-8">Usuário não identificado</div>;

  return (
    <div className="h-full flex flex-col rounded-2xl shadow-md border overflow-hidden" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
      {/* Compact Header */}
      <div className="px-6 py-3 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] border-b flex items-center justify-between sticky top-0 z-20 shadow-sm shrink-0"
        style={{ borderColor: 'white/10' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            disabled={loading}
            className="p-1.5 rounded-full transition-colors hover:bg-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="leading-tight">
            {isTaskLogMode ? (
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Apontando em</span>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" />
                  {currentTaskTitle || 'Tarefa Selecionada'}
                </h1>
              </div>
            ) : (
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                {isEditing ? '✏️ Editar' : '➕ Novo'} Apontamento
              </h1>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {entriesForDay.length > 0 && (
            <div className="hidden md:flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/20">
              <Clock className="w-3.5 h-3.5 text-white/80" />
              <div className="flex flex-col leading-tight">
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/60">Já apontado hoje</span>
                <span className="text-sm font-black text-white">
                  {formatDecimalToTime(entriesForDay.reduce((sum, e) => sum + (e.totalHours || 0), 0))}
                  <span className="ml-1 opacity-50 font-normal">/ {(users.find(u => u.id === (formData.userId || user?.id))?.dailyAvailableHours || 8)}h</span>
                </span>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            {isEditing && (
              <button
                onClick={() => setDeleteModalOpen(true)}
                disabled={loading}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 font-bold shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3 h-3" />
                Excluir
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={loading || !canEnterTime}
              className="bg-white hover:bg-slate-50 text-[var(--primary)] px-4 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-2 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-3 h-3" />
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        <fieldset disabled={loading} className="border-none p-0 m-0 h-full flex flex-col contents">
          <div className={`grid gap-4 h-full ${isTaskLogMode ? 'grid-cols-1 max-w-xl mx-auto w-full' : 'grid-cols-1 lg:grid-cols-2'}`}>

            {/* Left Column: Project Info (Hidden in Task Log Mode) */}
            {!isTaskLogMode && (
              <div className="flex flex-col gap-4 min-h-0">
                <div className="p-5 rounded-xl border shadow-sm flex-1 flex flex-col gap-4 overflow-y-auto" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                    <UserIcon className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                    <h2 className="font-bold text-sm uppercase tracking-wider">Projeto & Dados</h2>
                  </div>

                  <div className="space-y-3 flex-1 flex flex-col">
                    {/* Collaborator */}
                    <div>
                      <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70" style={{ color: 'var(--muted)' }}>Colaborador</label>
                      {isAdmin ? (
                        <select
                          value={formData.userId || ''}
                          onChange={(e) => {
                            const u = users.find(user => user.id === e.target.value);
                            markDirty();
                            setFormData({ ...formData, userId: u?.id || '', userName: u?.name || '' });
                          }}
                          disabled={isEditing}
                          className="w-full p-2.5 border rounded-lg outline-none font-medium text-sm focus:ring-1 focus:ring-[var(--ring)] disabled:opacity-70 disabled:cursor-not-allowed"
                          style={{ backgroundColor: isEditing ? 'var(--surface-2)' : 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                        >
                          <option value="">Selecione...</option>
                          {users.filter(u => u.active !== false || u.id === formData.userId).map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="w-full p-2.5 border rounded-lg font-bold text-sm opacity-80"
                          style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--muted)' }}>
                          {formData.userName || ''}
                        </div>
                      )}
                    </div>

                    {/* Client & Project Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70" style={{ color: 'var(--muted)' }}>Cliente *</label>
                        <select
                          value={formData.clientId}
                          onChange={(e) => { markDirty(); setFormData({ ...formData, clientId: e.target.value, projectId: '', taskId: '' }); }}
                          disabled={isEditing}
                          className="w-full p-2.5 border rounded-lg outline-none font-bold text-sm transition-all focus:ring-1 focus:ring-[var(--ring)] disabled:opacity-70 disabled:cursor-not-allowed"
                          style={{ backgroundColor: isEditing ? 'var(--surface-2)' : 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                        >
                          <option value="">Selecione...</option>
                          {filteredClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70" style={{ color: 'var(--muted)' }}>Projeto *</label>
                        <select
                          value={formData.projectId}
                          onChange={(e) => { markDirty(); setFormData({ ...formData, projectId: e.target.value, taskId: '' }); }}
                          disabled={!formData.clientId || isEditing}
                          className="w-full p-2.5 border rounded-lg outline-none font-bold text-sm transition-all focus:ring-1 focus:ring-[var(--ring)] disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: isEditing ? 'var(--surface-2)' : 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                        >
                          <option value="">Selecione...</option>
                          {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Task */}
                    <div>
                      <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70" style={{ color: 'var(--muted)' }}>Tarefa *</label>
                      <select
                        value={formData.taskId}
                        onChange={(e) => { markDirty(); setFormData({ ...formData, taskId: e.target.value }); }}
                        disabled={!formData.projectId || isEditing}
                        className="w-full p-2.5 border rounded-lg outline-none font-bold text-sm transition-all focus:ring-1 focus:ring-[var(--ring)] disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: isEditing ? 'var(--surface-2)' : 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                      >
                        <option value="">Selecione a tarefa...</option>
                        {filteredTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                      </select>
                    </div>

                    {/* Notes in Standard Mode */}
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold flex items-center gap-2 uppercase tracking-wider opacity-70" style={{ color: 'var(--muted)' }}>
                          <AlertCircle className="w-3 h-3" /> {(isTrainingProject || isPmoTower) ? 'Status (Opcional)' : 'Status (Mín. 120 carac.) *'}
                        </label>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${(isTrainingProject || isPmoTower) || ((formData.description?.length || 0) >= 120) ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                          {formData.description?.length || 0} {(isTrainingProject || isPmoTower) ? '' : '/ 120'}
                        </span>
                      </div>
                      <textarea
                        value={formData.description || ''}
                        onChange={(e) => { markDirty(); setFormData({ ...formData, description: e.target.value }); }}
                        className="w-full p-3 border rounded-xl outline-none resize-none font-medium text-sm transition-all flex-1 focus:ring-1 focus:ring-[var(--primary)] border-[var(--border)]"
                        style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}
                        placeholder="Descreva a atividade realizada (opcional)..."
                      />
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* Right Column: Time Info */}
            <div className="relative flex flex-col min-h-0">
              {!canEnterTime && !isTaskLogMode && (
                <div className="absolute inset-0 z-10 backdrop-blur-sm bg-[var(--bg)]/50 flex flex-col items-center justify-center text-center p-6 border rounded-xl border-dashed" style={{ borderColor: 'var(--border)' }}>
                  <div className="w-12 h-12 rounded-full bg-[var(--surface-2)] flex items-center justify-center mb-3">
                    <Clock className="w-6 h-6 text-[var(--muted)]" />
                  </div>
                  <h3 className="font-bold text-[var(--text)]">Aguardando Dados</h3>
                  <p className="text-sm text-[var(--muted)] max-w-xs mt-1">Selecione um cliente, projeto e tarefa para liberar o apontamento de horas.</p>
                </div>
              )}

              <div className={`p-5 rounded-xl border shadow-sm flex flex-col gap-4 overflow-y-auto h-full ${!canEnterTime && !isTaskLogMode ? 'opacity-40 pointer-events-none' : ''}`} style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                {isTaskLogMode && (
                  // Minimal Project Info Header for Task Mode
                  <div className="flex items-center gap-2 pb-2 mb-2 border-b border-dashed" style={{ borderColor: 'var(--border)' }}>
                    <Briefcase className="w-3 h-3 text-[var(--muted)]" />
                    <span className="text-xs font-bold text-[var(--muted)]">
                      {clients.find(c => c.id === formData.clientId)?.name}
                      <span className="mx-1">/</span>
                      {projects.find(p => p.id === formData.projectId)?.name}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                  <Clock className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  <h2 className="font-bold text-sm uppercase tracking-wider">Horário & Jornada</h2>
                </div>

                <div className="space-y-4 flex-1">
                  <div>
                    <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70" style={{ color: 'var(--muted)' }}>Data *</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => { markDirty(); setFormData({ ...formData, date: e.target.value }); }}
                      className="w-full p-2.5 border rounded-lg outline-none font-bold text-sm shadow-sm focus:ring-1 focus:ring-[var(--ring)]"
                      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <TimePicker
                      label="Início *"
                      icon={<Clock className="w-3 h-3 text-emerald-500" />}
                      value={formData.startTime || '09:00'}
                      onChange={(val) => validateAndSetTime('startTime', val)}
                    />
                    <TimePicker
                      label="Fim *"
                      icon={<Clock className="w-3 h-3 text-red-500" />}
                      value={formData.endTime || '18:00'}
                      onChange={(val) => validateAndSetTime('endTime', val)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        markDirty();
                        setFormData(prev => ({ ...prev, startTime: '08:00', endTime: '17:00' }));
                      }}
                      className="flex-1 py-2 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border hover:bg-[var(--surface-hover)] hover:shadow-sm"
                      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--muted)' }}
                    >
                      Turno 1 (08-17)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        markDirty();
                        setFormData(prev => ({ ...prev, startTime: '08:30', endTime: '17:30' }));
                      }}
                      className="flex-1 py-2 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border hover:bg-[var(--surface-hover)] hover:shadow-sm"
                      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--muted)' }}
                    >
                      Turno 2 (08:30-17:30)
                    </button>
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
                    onClick={() => { setDeductLunch(!deductLunch); markDirty(); }}>
                    <input
                      type="checkbox"
                      checked={deductLunch}
                      onChange={() => { }}
                      className="w-4 h-4 rounded text-[var(--primary)] pointer-events-none"
                    />
                    <span className="text-xs font-bold select-none" style={{ color: 'var(--text)' }}>Descontar 1h de almoço</span>
                  </div>

                  {/* Total & Progress */}
                  <div className="flex justify-between items-center p-4 rounded-xl border shadow-inner mt-2"
                    style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                    <div className="flex flex-col">
                      <span className="font-extrabold text-[10px] uppercase tracking-widest opacity-50" style={{ color: 'var(--text)' }}>Total deste lançamento:</span>
                      <span className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>
                        {deductLunch ? '(Considerando 1h de almoço)' : '(Sem desconto de almoço)'}
                      </span>
                    </div>
                    <div className={`text-4xl font-black transition-all ${adjustedTotalHours > 14 ? 'text-red-500 scale-110' : ''}`} style={{ color: adjustedTotalHours > 14 ? undefined : 'var(--primary)' }}>
                      {timeDisplay}
                    </div>
                  </div>

                  {/* Horários já apontados no dia */}
                  <div className="mt-3 p-3 rounded-xl border" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-dashed" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                          Horários já apontados hoje
                        </span>
                      </div>
                      {entriesForDay.length > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/20">
                          <span className="text-[10px] font-bold text-[var(--primary)]">
                            {formatDecimalToTime(entriesForDay.reduce((sum, e) => sum + (e.totalHours || 0), 0))}
                            <span className="ml-1 opacity-50 font-normal text-[8px]">/ {(users.find(u => u.id === (formData.userId || user?.id))?.dailyAvailableHours || 8)}h Meta</span>
                          </span>
                        </div>
                      )}
                    </div>
                    {entriesForDay.length > 0 ? (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                        {entriesForDay.map(entry => {
                          const project = projects.find(p => p.id === entry.projectId);
                          const task = tasks.find(t => t.id === entry.taskId);
                          return (
                            <div key={entry.id} className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-[var(--primary)] px-2 py-0.5 rounded bg-[var(--primary)]/10">
                                  {formatDecimalToTime(entry.totalHours)}
                                </span>
                                <div className="text-[11px] font-bold text-[var(--text)] truncate flex-1 min-w-[100px]">
                                  {task?.title || 'Tarefa'}
                                </div>
                                <div className="flex items-center gap-1 shrink-0 text-[10px] font-mono">
                                  <span className="font-bold text-emerald-600">{entry.startTime}</span>
                                  <span className="text-[var(--muted)]">→</span>
                                  <span className="font-bold text-red-600">{entry.endTime}</span>
                                </div>
                              </div>
                              <div className="text-[9px] text-[var(--muted)] truncate mt-1 ml-1">
                                {project?.name || 'Projeto'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-[10px] text-[var(--muted)] opacity-50">
                        Nenhum horário apontado ainda hoje
                      </div>
                    )}
                  </div>

                  {formData.taskId && (
                    <div className="pt-2">
                      <div className="flex justify-between items-end mb-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider opacity-70" style={{ color: 'var(--muted)' }}>Progresso</label>
                        <span className="text-xs font-black" style={{ color: 'var(--primary)' }}>{taskProgress}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={taskProgress}
                        onChange={(e) => { markDirty(); setTaskProgress(Number(e.target.value)); }}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
                        style={{ backgroundColor: 'var(--border)' }}
                      />
                    </div>
                  )}

                  {/* Notes in Task Mode (moved from left column) */}
                  {isTaskLogMode && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold flex items-center gap-2 uppercase tracking-wider opacity-70" style={{ color: 'var(--muted)' }}>
                          <AlertCircle className="w-3 h-3" /> Status (Opcional)
                        </label>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500">
                          {formData.description?.length || 0} carac.
                        </span>
                      </div>
                      <textarea
                        value={formData.description || ''}
                        onChange={(e) => { markDirty(); setFormData({ ...formData, description: e.target.value }); }}
                        className="w-full p-3 border rounded-xl outline-none resize-none font-medium text-sm transition-all h-32 focus:ring-1 focus:ring-[var(--primary)] border-[var(--border)]"
                        style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}
                        placeholder="Descreva a atividade realizada (opcional)..."
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </fieldset>
      </div>

      <ConfirmationModal
        isOpen={completionModalOpen}
        title="Concluir Tarefa?"
        message="A tarefa atingiu 100% de progresso. Deseja marcá-la como concluída e salvar?"
        onConfirm={handleConfirmCompletion}
        onCancel={() => { setCompletionModalOpen(false); setPendingSave(null); }}
        disabled={loading}
      />
      <ConfirmationModal
        isOpen={deleteModalOpen}
        title="Excluir Apontamento"
        message="Confirmar exclusão?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteModalOpen(false)}
        disabled={loading}
      />
      <ConfirmationModal
        isOpen={warningModalOpen}
        title="Jornada Excessiva!"
        message="Você apontou mais de 11 horas neste registro. Isso é incomum. Deseja realmente salvar?"
        confirmText="Sim, Salvar"
        cancelText="Revisar"
        onConfirm={async () => {
          if (pendingSave) {
            setWarningModalOpen(false);
            await saveEntry(pendingSave, tasks.find(t => t.id === pendingSave.taskId)?.progress);
            setPendingSave(null);
          }
        }}
        onCancel={() => { setWarningModalOpen(false); setPendingSave(null); }}
      />
      <ConfirmationModal
        isOpen={availabilityModalOpen}
        title="Limite de Disponibilidade"
        message={availabilityWarning}
        confirmText="Salvar Mesmo Assim"
        cancelText="Revisar"
        onConfirm={async () => {
          if (pendingSave) {
            setAvailabilityModalOpen(false);
            await saveEntry(pendingSave, tasks.find(t => t.id === pendingSave.taskId)?.progress);
            setPendingSave(null);
          }
        }}
        onCancel={() => { setAvailabilityModalOpen(false); setPendingSave(null); }}
      />
      {showPrompt && (
        <ConfirmationModal
          isOpen={true}
          title="Descartar alterações?"
          message="Você tem alterações não salvas. Deseja continuar editando ou descartar?"
          confirmText="Continuar editando"
          cancelText="Descartar alterações"
          onConfirm={continueEditing}
          onCancel={() => { discardChanges(); handleBack(); }}
        />
      )}
    </div>
  );
};

export default TimesheetForm;
