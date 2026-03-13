// components/ProjectForm.tsx - Adaptado para Router e Project Members
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useDataController } from '@/controllers/useDataController';
import { useAuth } from '@/contexts/AuthContext';
import { Save, Users, Briefcase, Calendar, Info, Zap, DollarSign, Target, Shield, Layout, Clock, ChevronDown, LayoutGrid, AlertCircle, FileSpreadsheet, ExternalLink, CheckSquare, User, ArrowLeft, Check, CalendarDays } from 'lucide-react';
import BackButton from './shared/BackButton';
import { getUserStatus } from '@/utils/userStatus';
import * as CapacityUtils from '@/utils/capacity';
import { getProjectStatusByTimeline } from '@/utils/projectStatus';
import CalendarPicker from './CalendarPicker';

const ProjectForm: React.FC = () => {
  const { projectId, clientId: routeClientId } = useParams<{ projectId?: string; clientId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();

  // Incluindo funções de membros do projeto
  const {
    clients,
    projects,
    users,
    tasks,
    projectMembers, // Para dependência
    createProject,
    updateProject,
    getProjectMembers,
    addProjectMember,
    removeProjectMember,
    timesheetEntries,
    absences
  } = useDataController();

  const isEdit = !!projectId;
  const project = projectId ? projects.find(p => p.id === projectId) : null;

  // Cliente pode vir da rota ou query param
  const initialClientId = routeClientId || searchParams.get('clientId') || project?.clientId || '';

  const [name, setName] = useState('');
  const [clientId, setClientId] = useState(initialClientId);
  const [partnerId, setPartnerId] = useState('');
  const [status, setStatus] = useState('Não Iniciado');
  const [description, setDescription] = useState('');
  const [managerClient, setManagerClient] = useState('');
  const [responsibleNicLabsId, setResponsibleNicLabsId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [startDateReal, setStartDateReal] = useState('');
  const [endDateReal, setEndDateReal] = useState('');
  const [risks, setRisks] = useState('');
  const [successFactor, setSuccessFactor] = useState('');
  const [criticalDate, setCriticalDate] = useState('');
  const [docLink, setDocLink] = useState('');
  const [gapsIssues, setGapsIssues] = useState('');
  const [importantConsiderations, setImportantConsiderations] = useState('');
  const [weeklyStatusReport, setWeeklyStatusReport] = useState('');

  const [valorTotalRs, setValorTotalRs] = useState(0);
  const [horasVendidas, setHorasVendidas] = useState(0);
  const [torre, setTorre] = useState('');

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [memberAllocations, setMemberAllocations] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  // balanceAllocations removido conforme nova regra (cálculos nas tarefas)

  // Carregar dados iniciais
  useEffect(() => {
    if (project) {
      setName(project.name);
      setClientId(project.clientId);
      setPartnerId(project.partnerId || '');
      setStatus(project.status || 'Não Iniciado');
      setDescription(project.description || '');
      setManagerClient(project.managerClient || '');
      setResponsibleNicLabsId(project.responsibleNicLabsId || '');
      setStartDate(project.startDate || '');
      setEstimatedDelivery(project.estimatedDelivery || '');
      setStartDateReal(project.startDateReal || '');
      setEndDateReal(project.endDateReal || '');
      setRisks(project.risks || '');
      setSuccessFactor(project.successFactor || '');
      setCriticalDate(project.criticalDate || '');
      setDocLink(project.docLink || '');
      setGapsIssues(project.gapsIssues || '');
      setImportantConsiderations(project.importantConsiderations || '');
      setWeeklyStatusReport(project.weeklyStatusReport || '');

      setValorTotalRs(project.valor_total_rs || 0);
      setHorasVendidas(project.horas_vendidas || 0);
      setTorre(project.torre || '');
    }
  }, [project]);

  // Cálculo automático do prazo removido conforme nova regra de negócio (horas nas tarefas)

  // Carregar membros separadamente para garantir sincronia
  useEffect(() => {
    if (isEdit && projectId && projectMembers.length > 0) {
      const currentProjectMembers = projectMembers.filter(pm => String(pm.id_projeto) === projectId);
      const selectedIds = currentProjectMembers.map(m => String(m.id_colaborador));
      setSelectedUsers(selectedIds);

      const initialAllocations: Record<string, number> = {};
      let totalSum = 0;
      currentProjectMembers.forEach(m => {
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
    }
  }, [isEdit, projectId, projectMembers]);

  // Validação obrigatória conforme nova regra de negócio
  const isProjectIncomplete = !name.trim() || !startDate || !estimatedDelivery || !horasVendidas || horasVendidas <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isProjectIncomplete) {
      alert('Por favor, preencha todos os campos obrigatórios: Nome, Data de Início, Entrega Estimada e Horas Vendidas (> 0).');
      return;
    }

    // --- NOVA VALIDAÇÃO: Tarefas fora do intervalo do projeto ---
    if (isEdit && isAdmin) {
      const pTasks = tasks.filter(t => String(t.projectId) === String(projectId));
      const projStart = new Date(startDate + 'T00:00:00');
      const projEnd = new Date(estimatedDelivery + 'T23:59:59');

      const outOfRangeTasks = pTasks.filter(task => {
        if ((task as any).deleted_at) return false;
        const tStart = task.scheduledStart ? new Date(task.scheduledStart + 'T00:00:00') : null;
        const tEnd = task.estimatedDelivery ? new Date(task.estimatedDelivery + 'T23:59:59') : null;

        const isStartInvalid = tStart && tStart < projStart;
        const isEndInvalid = tEnd && tEnd > projEnd;
        return isStartInvalid || isEndInvalid;
      });

      if (outOfRangeTasks.length > 0) {
        const taskList = outOfRangeTasks.slice(0, 3).map(t => t.title).join(', ');
        const more = outOfRangeTasks.length > 3 ? ` e mais ${outOfRangeTasks.length - 3}` : '';
        alert(`Não é possível encurtar o período do projeto pois existem ${outOfRangeTasks.length} tarefas fora do novo intervalo (${startDate} a ${estimatedDelivery}).\n\nExemplos: ${taskList}${more}.\n\nPor favor, ajuste as datas das tarefas antes de salvar.`);
        return;
      }
    }

    try {
      setLoading(true);
      let targetProjectId = projectId;

      // 1. Salvar/Criar Projeto
      const projectData = {
        name,
        clientId,
        partnerId: partnerId || undefined,
        description,
        managerClient,
        responsibleNicLabsId: responsibleNicLabsId || undefined,
        startDate: startDate || undefined,
        estimatedDelivery: estimatedDelivery || undefined,
        startDateReal: startDateReal || undefined,
        endDateReal: endDateReal || undefined,
        status: getProjectStatusByTimeline({
          startDate,
          estimatedDelivery,
          startDateReal,
          endDateReal
        } as any),
        risks,
        successFactor,
        criticalDate: criticalDate || undefined,
        docLink,
        gaps_issues: gapsIssues,
        important_considerations: importantConsiderations,
        weekly_status_report: weeklyStatusReport,

        valor_total_rs: valorTotalRs,
        horas_vendidas: horasVendidas,
        torre: torre,
        active: true
      };

      if (isEdit && projectId) {
        await updateProject(projectId, projectData);
      } else {
        targetProjectId = await createProject(projectData);
      }

      // 2. Atualizar Membros (apenas se tiver ID de projeto válido)
      if (targetProjectId) {
        // Membros que já estavam no banco
        const initialMembers = isEdit ? getProjectMembers(targetProjectId) : [];

        // Adicionar/Atualizar selecionados - Agora sempre 100% (apenas um flag de "está no projeto")
        for (const userId of selectedUsers) {
          await addProjectMember(targetProjectId, userId, 100);
        }

        // Remover excluídos (apenas em edição)
        if (isEdit) {
          const toRemove = initialMembers.filter(uid => !selectedUsers.includes(uid));
          for (const userId of toRemove) {
            await removeProjectMember(targetProjectId, userId);
          }
        }
      }

      alert(isEdit ? 'Projeto atualizado com sucesso!' : 'Projeto criado com sucesso!');

      // Navegar de volta
      if (isEdit) {
        navigate(`/admin/projects/${targetProjectId}`);
      } else {
        navigate(`/admin/clients/${clientId}`);
      }

    } catch (error: any) {
      console.error('Erro ao salvar projeto:', error);
      alert(`Erro: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const [memberSearch, setMemberSearch] = useState('');
  const filteredUsers = useMemo(() => {
    return (users || [])
      .filter(u => {
        const status = getUserStatus(u, tasks, projects, clients, absences);
        const isForaDoFluxo = status.label === 'Fora do Fluxo';

        const isAlreadySelected = selectedUsers.includes(u.id) || u.id === responsibleNicLabsId;

        return u.active !== false &&
          (!isForaDoFluxo || isAlreadySelected) &&
          (u.name.toLowerCase().includes(memberSearch.toLowerCase()) || (u.cargo || '').toLowerCase().includes(memberSearch.toLowerCase()));
      })
      .sort((a, b) => {
        const aSelected = selectedUsers.includes(a.id) || a.id === responsibleNicLabsId;
        const bSelected = selectedUsers.includes(b.id) || b.id === responsibleNicLabsId;

        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [users, memberSearch, selectedUsers, responsibleNicLabsId, tasks, projects, clients, absences]);

  return (
    <div className="h-full flex flex-col bg-[var(--bg)] overflow-hidden">
      {/* HEADER - Replicating ProjectDetailView Style */}
      <div className="px-8 py-6 bg-gradient-to-r from-[#1e1b4b] to-[#4c1d95] shadow-lg flex items-center justify-between text-white z-20">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate(-1)}
            disabled={loading}
            className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              {isEdit ? 'Editar Projeto' : 'Novo Projeto'}
            </h1>
            <div className="flex items-center gap-2 mt-1 opacity-60">
              <span className="text-xs font-medium uppercase tracking-tighter">Fluxo de Cadastro Premium</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl font-bold text-xs transition-all hover:bg-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            CANCELAR
          </button>
          <button
            onClick={handleSubmit}
            className="px-8 py-2.5 bg-white text-indigo-950 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xl hover:bg-indigo-50 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
            disabled={loading}
          >
            <Save className="w-4 h-4 shadow-sm" />
            {loading ? 'SALVANDO...' : 'SALVAR PROJETOS'}
          </button>
        </div>
      </div>

      {/* Main Content Area - Replicating Dashboard Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <fieldset disabled={loading} className="border-none p-0 m-0 max-w-7xl mx-auto space-y-6">

          {/* TOP ROW: 4 KPI-STYLE CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

            {/* Card 1: Identidade */}
            <div className="p-6 rounded-[32px] border shadow-sm flex flex-col h-[350px]" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--muted)' }}>Identificação</h4>
                <Briefcase size={14} className="text-purple-500" />
              </div>
              <div className="space-y-4 flex-1">
                <div>
                  <label className="text-[9px] font-black uppercase mb-1 block opacity-60">Nome do Projeto *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full px-3 py-2 text-sm font-bold border rounded-xl outline-none transition-all ${!name.trim() ? 'bg-amber-200 border-amber-400 text-amber-900 placeholder:text-amber-700/50' : 'bg-[var(--bg)] border-[var(--border)]'}`}
                    style={{ color: !name.trim() ? undefined : 'var(--text)' }}
                    placeholder="Nome do Projeto"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase mb-1 block opacity-60">Torre / Vertical</label>
                  <input
                    type="text"
                    value={torre}
                    onChange={(e) => setTorre(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-bold border rounded-xl bg-[var(--bg)] border-[var(--border)] outline-none"
                    style={{ color: 'var(--text)' }}
                    placeholder="Ex: Consultoria"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase mb-1 block opacity-60">Status (Automático via Timeline)</label>
                  <div className="w-full px-3 py-2 text-sm font-black border rounded-xl bg-purple-500/5 border-purple-500/20 text-purple-600 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                    {getProjectStatusByTimeline({
                      startDate,
                      estimatedDelivery,
                      startDateReal,
                      endDateReal
                    } as any)}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Responsáveis */}
            <div className="p-6 rounded-[32px] border shadow-sm flex flex-col h-[350px]" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--muted)' }}>Gestão</h4>
                <Shield size={14} className="text-emerald-500" />
              </div>
              <div className="space-y-4 flex-1">
                <div>
                  <label className="text-[9px] font-black uppercase mb-1 block opacity-60">Gestor Interno *</label>
                  <select
                    value={responsibleNicLabsId}
                    onChange={(e) => setResponsibleNicLabsId(e.target.value)}
                    className={`w-full px-3 py-2 text-xs font-bold border rounded-xl outline-none transition-all ${!responsibleNicLabsId ? 'bg-amber-200 border-amber-400 text-amber-900' : 'bg-[var(--bg)] border-[var(--border)]'}`}
                    style={{ color: !responsibleNicLabsId ? undefined : 'var(--text)' }}
                  >
                    <option value="">Selecione...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase mb-1 block opacity-60">Responsável Cliente *</label>
                  <input
                    type="text"
                    value={managerClient}
                    onChange={(e) => setManagerClient(e.target.value)}
                    className={`w-full px-3 py-2 text-sm font-bold border rounded-xl outline-none transition-all ${!managerClient.trim() ? 'bg-amber-200 border-amber-400 text-amber-900 placeholder:text-amber-700/50' : 'bg-[var(--bg)] border-[var(--border)]'}`}
                    style={{ color: !managerClient.trim() ? undefined : 'var(--text)' }}
                    placeholder="Nome na Empresa"
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Financeiro */}
            <div className="p-6 rounded-[32px] border shadow-sm flex flex-col h-[350px]" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--muted)' }}>Finanças</h4>
                <DollarSign size={14} className="text-amber-500" />
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase mb-1 block opacity-60">Valor Total Venda (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-30">R$</span>
                    <input
                      type="number"
                      value={valorTotalRs || ''}
                      onChange={(e) => setValorTotalRs(Number(e.target.value))}
                      className={`w-full pl-8 pr-3 py-4 text-xl font-black border rounded-2xl outline-none transition-all tabular-nums bg-[var(--bg)] border-[var(--border)]`}
                      style={{ color: 'var(--text)' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase mb-1 block opacity-60">Horas Vendidas (Budget) *</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                    <input
                      type="number"
                      required
                      value={horasVendidas || ''}
                      onChange={(e) => setHorasVendidas(Number(e.target.value))}
                      className={`w-full pl-9 pr-3 py-4 text-xl font-black border rounded-2xl outline-none transition-all tabular-nums ${!horasVendidas ? 'bg-amber-200 border-amber-400 text-amber-900 placeholder:text-amber-700/50' : 'bg-[var(--bg)] border-[var(--border)]'}`}
                      style={{ color: !horasVendidas ? undefined : 'var(--text)' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4: Timeline */}
            <div className="p-6 rounded-[32px] border shadow-sm flex flex-col h-[350px]" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--muted)' }}>Timeline</h4>
                <Calendar size={14} className="text-blue-500" />
              </div>
              <div className="space-y-4">
                <div className="p-4 rounded-2xl border border-dashed" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}>
                  <label className="text-[9px] font-black uppercase mb-2 block text-blue-500">Planejado (Ini / Fim) *</label>
                  <div className="space-y-3 relative">
                    <div className="relative">
                      <div className="flex items-center justify-between p-2 rounded-lg border transition-all" style={{ backgroundColor: !startDate ? 'rgba(251, 191, 36, 0.2)' : 'transparent', borderColor: !startDate ? 'rgba(251, 191, 36, 0.5)' : 'var(--border)' }}>
                        <input
                          type="date"
                          required
                          value={startDate}
                          onChange={e => setStartDate(e.target.value)}
                          className="bg-transparent outline-none font-bold text-xs w-full cursor-pointer"
                          style={{ color: !startDate ? undefined : 'var(--text)' }}
                          onClick={(e) => { e.preventDefault(); setShowStartCalendar(!showStartCalendar); setShowEndCalendar(false); }}
                        />
                        <CalendarDays className="w-4 h-4 opacity-40 cursor-pointer hover:opacity-100 transition-opacity" onClick={() => { setShowStartCalendar(!showStartCalendar); setShowEndCalendar(false); }} />
                      </div>

                      {showStartCalendar && (
                        <CalendarPicker
                          selectedDate={startDate}
                          onSelectDate={(date) => {
                            setStartDate(date);
                          }}
                          onClose={() => setShowStartCalendar(false)}
                        />
                      )}
                    </div>

                    <div className="relative">
                      <div className="flex items-center justify-between p-2 rounded-lg border transition-all" style={{ backgroundColor: !estimatedDelivery ? 'rgba(251, 191, 36, 0.2)' : 'transparent', borderColor: !estimatedDelivery ? 'rgba(251, 191, 36, 0.5)' : 'var(--border)' }}>
                        <input
                          type="date"
                          required
                          value={estimatedDelivery}
                          onChange={e => setEstimatedDelivery(e.target.value)}
                          className="bg-transparent outline-none font-bold text-xs w-full cursor-pointer"
                          style={{ color: !estimatedDelivery ? undefined : 'var(--text)' }}
                          onClick={(e) => { e.preventDefault(); setShowEndCalendar(!showEndCalendar); setShowStartCalendar(false); }}
                        />
                        <CalendarDays className="w-4 h-4 opacity-40 cursor-pointer hover:opacity-100 transition-opacity" onClick={() => { setShowEndCalendar(!showEndCalendar); setShowStartCalendar(false); }} />
                      </div>

                      {showEndCalendar && (
                        <CalendarPicker
                          selectedDate={estimatedDelivery}
                          onSelectDate={(date) => {
                            setEstimatedDelivery(date);
                          }}
                          onClose={() => setShowEndCalendar(false)}
                        />
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-2xl border border-dotted" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}>
                  <label className="text-[9px] font-black uppercase mb-2 block opacity-40">Realizado</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={startDateReal} onChange={e => setStartDateReal(e.target.value)} className="text-[9px] font-bold p-1 bg-transparent border-b border-[var(--border)] outline-none" style={{ color: 'var(--text)' }} />
                    <input type="date" value={endDateReal} onChange={e => setEndDateReal(e.target.value)} className="text-[9px] font-bold p-1 bg-transparent border-b border-[var(--border)] outline-none" style={{ color: 'var(--text)' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM ROW: DETAILS & SQUAD */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Structural Details Card (2/3 width) */}
            <div className="lg:col-span-2 p-6 rounded-[32px] border shadow-sm space-y-6" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-500">
                <Info size={14} /> Detalhes Estruturais
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase mb-2 block opacity-60">Cliente *</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl font-bold outline-none transition-all ${!clientId ? 'bg-amber-200 border-amber-400 text-amber-900' : 'bg-[var(--bg)] border-[var(--border)]'}`}
                    style={{ color: !clientId ? undefined : 'var(--text)' }}
                    disabled={isEdit}
                  >
                    <option value="">Selecione...</option>
                    {clients.filter(c => c.active !== false && c.tipo_cliente !== 'parceiro').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase mb-2 block opacity-60">Parceiro (Opcional)</label>
                  <select
                    value={partnerId}
                    onChange={(e) => setPartnerId(e.target.value)}
                    className="w-full px-4 py-3 border rounded-xl font-bold bg-[var(--bg)] border-[var(--border)] outline-none"
                    style={{ color: 'var(--text)' }}
                  >
                    <option value="">Direto (Sem Parceiro)</option>
                    {clients.filter(c => c.active !== false && c.tipo_cliente === 'parceiro').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[var(--border)]">
                <div>
                  <p className="text-[10px] font-black uppercase mb-3 opacity-40">Escopo e Documentação</p>
                  <div className="space-y-4">
                    <input
                      type="url"
                      value={docLink}
                      onChange={e => setDocLink(e.target.value)}
                      placeholder="Link da Documentação Principal"
                      className="w-full px-3 py-2 text-xs border rounded-lg bg-[var(--bg)] border-[var(--border)] outline-none"
                      style={{ color: 'var(--text)' }}
                    />
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Descrição do Escopo..."
                      className="w-full h-32 px-4 py-3 text-xs border rounded-2xl bg-[var(--bg)] border-[var(--border)] outline-none resize-none"
                      style={{ color: 'var(--text)' }}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase mb-3 text-amber-500">Status Report / Gaps</p>
                  <div className="space-y-4">
                    <textarea
                      value={weeklyStatusReport}
                      onChange={e => setWeeklyStatusReport(e.target.value)}
                      placeholder="Resumo da Semana (Update)"
                      className="w-full h-20 px-4 py-3 text-[11px] border rounded-xl bg-[var(--bg)] border-[var(--border)] outline-none resize-none"
                      style={{ color: 'var(--text)' }}
                    />
                    <textarea
                      value={gapsIssues}
                      onChange={e => setGapsIssues(e.target.value)}
                      placeholder="Problemas e Bloqueios..."
                      className="w-full h-20 px-4 py-3 text-[11px] border rounded-xl bg-[var(--bg)] border-[var(--border)] outline-none resize-none text-red-500"
                      style={{ borderColor: 'var(--border)' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Squad Selection Card (1/3 width) */}
            <div className="p-6 rounded-[32px] border shadow-sm flex flex-col h-full" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-500">
                  <Users size={14} /> Equipe Alocada
                </div>
                <div className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 text-[8px] font-black">
                  {selectedUsers.length} MEMBROS
                </div>
              </div>

              <div className="relative mb-4">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                <input
                  type="text"
                  placeholder="Buscar colaborador..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-medium border rounded-xl bg-[var(--bg)] border-[var(--border)] outline-none"
                  style={{ color: 'var(--text)' }}
                />
              </div>

              <div className={`flex-1 overflow-y-auto custom-scrollbar space-y-1 p-1 pr-2 rounded-2xl transition-colors min-h-[400px] ${selectedUsers.length === 0 ? 'bg-orange-500/5 border border-orange-500/30' : 'bg-[var(--bg)] border-[var(--border)]'}`}>
                {filteredUsers.map(user => {
                  const isSelected = selectedUsers.includes(user.id) || user.id === responsibleNicLabsId;
                  const isManager = user.id === responsibleNicLabsId;

                  return (
                    <label
                      key={user.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-purple-500/30 bg-purple-500/5 shadow-sm shadow-purple-500/10' : 'border-transparent hover:bg-[var(--surface-hover)]'} ${isManager ? 'opacity-80' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isManager}
                        onChange={(e) => {
                          if (isManager) return;
                          if (e.target.checked) setSelectedUsers(prev => [...prev, user.id]);
                          else setSelectedUsers(prev => prev.filter(id => id !== user.id));
                        }}
                        className="sr-only"
                      />
                      {/* Selection Indicator Square with Check Mark */}
                      <div className={`w-5 h-5 rounded-[4px] flex items-center justify-center transition-all ${isSelected ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'bg-white/10 border border-white/10 shadow-inner'}`}>
                        {isSelected && <Check size={12} className="text-white" strokeWidth={4} />}
                      </div>

                      <div className={`w-8 h-8 rounded-lg overflow-hidden border transition-all ${isSelected ? 'border-purple-500 scale-105 shadow-sm shadow-purple-500/20' : 'border-[var(--border)]'}`}>
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[var(--surface-2)] font-black text-[10px] text-[var(--text-secondary)]">
                            {user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-bold truncate transition-colors ${isSelected ? 'text-purple-500' : 'text-[var(--text)]'} uppercase`}>
                          {user.name}
                          {isManager && <span className="ml-2 text-[7px] bg-yellow-400 text-black px-1 rounded">GESTOR</span>}
                        </p>
                        <p className="text-[8px] font-black uppercase opacity-30 tracking-widest truncate">{user.cargo || 'Membro'}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  );
};

export default ProjectForm;
