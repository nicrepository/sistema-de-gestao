// components/TeamMemberDetail.tsx - Reestruturado: Resumo Topo + Edição Principal
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useDataController } from '@/controllers/useDataController';
import { Task, Role } from '@/types';
import { User as UserIcon, Mail, Briefcase, Shield, Edit, Save, Trash2, ArrowLeft, CheckCircle, Clock, AlertCircle, Calendar, Zap, Info, LayoutGrid, ChevronRight } from 'lucide-react';
import OrganizationalStructureSelector from './OrganizationalStructureSelector';
import ConfirmationModal from './ConfirmationModal';
import { getRoleDisplayName, formatDecimalToTime, getStatusDisplayName, formatDateBR } from '@/utils/normalizers';
import { supabase } from '@/services/supabaseClient';

import TimesheetCalendar from './TimesheetCalendar';
import AbsenceManager from './AbsenceManager';
import * as CapacityUtils from '@/utils/capacity';

const InfoTooltip: React.FC<{ title: string; content: string }> = ({ title, content }) => (
   <div className="group relative pr-1">
      <Info className="w-3.5 h-3.5 text-[var(--muted)] opacity-20 hover:opacity-100 transition-all cursor-help" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 shadow-2xl">
         <p className="font-black uppercase mb-1 border-b border-white/10 pb-1">{title}</p>
         <p className="font-medium leading-relaxed text-slate-300">{content}</p>
         <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
      </div>
   </div>
);

type ViewTab = 'details' | 'projects' | 'tasks' | 'delayed' | 'completed' | 'ponto' | 'absences';

const TeamMemberDetail: React.FC = () => {
   const { userId } = useParams<{ userId: string }>();
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();
   const { users, tasks, projects, projectMembers, timesheetEntries, deleteUser, absences, holidays, clients, taskMemberAllocations } = useDataController();

   // --- CAPACITY MONTH CONTROL ---
   const [capacityMonth, setCapacityMonth] = useState(() => {
      const now = new Date();
      return now.toISOString().slice(0, 7); // YYYY-MM
   });

   const changeMonth = (delta: number) => {
      const [year, month] = capacityMonth.split('-').map(Number);
      const newDate = new Date(year, month - 1 + delta, 1);
      const newMonthStr = newDate.toISOString().slice(0, 7);
      setCapacityMonth(newMonthStr);
   };

   // Get initial tab from URL query parameter, default to 'details'
   const initialTab = (searchParams.get('tab') as ViewTab) || 'details';
   const [activeTab, setActiveTab] = useState<ViewTab>(initialTab);
   const [deleteModalOpen, setDeleteModalOpen] = useState(false);
   const [showBreakdown, setShowBreakdown] = useState<'planned' | 'continuous' | null>(null);

   const user = users.find(u => u.id === userId);

   // --- FORM STATE ---
   const [loading, setLoading] = useState(false);
   const [isEditing, setIsEditing] = useState(false);
   const [formData, setFormData] = useState({
      name: '',
      email: '',
      cargo: '',
      nivel: '',
      role: 'developer' as Role,
      active: true,
      avatarUrl: '',
      torre: '',
      hourlyCost: 0,
      dailyAvailableHours: 8,
      monthlyAvailableHours: 160
   });

   useEffect(() => {
      if (user) {
         document.title = `${user.name} | Gestão de Equipe`;
         setFormData({
            name: user.name,
            email: user.email,
            cargo: user.cargo || '',
            nivel: user.nivel || '',
            role: user.role,
            active: user.active !== false,
            avatarUrl: user.avatarUrl || '',
            torre: user.torre || '',
            hourlyCost: user.hourlyCost || 0,
            dailyAvailableHours: user.dailyAvailableHours || 8,
            monthlyAvailableHours: user.monthlyAvailableHours || 160
         });
      }
      return () => {
         document.title = 'Sistema de Gestão';
      };
   }, [user]);

   const capData = useMemo(() => {
      if (!user) return null;
      // Usar valores do formulário para feedback em tempo real no dashboard superior
      const simulatedUser = {
         ...user,
         dailyAvailableHours: Number(String(formData.dailyAvailableHours).replace(',', '.')) || 0
      };
      return CapacityUtils.getUserMonthlyAvailability(simulatedUser, capacityMonth, projects, projectMembers, timesheetEntries, tasks, holidays);
   }, [user, capacityMonth, projects, projectMembers, timesheetEntries, tasks, holidays, formData.dailyAvailableHours]);

   const releaseDate = useMemo(() => {
      if (!user) return null;
      const simulatedUser = {
         ...user,
         dailyAvailableHours: Number(String(formData.dailyAvailableHours).replace(',', '.')) || 0
      };
      return CapacityUtils.calculateIndividualReleaseDate(simulatedUser, projects, projectMembers, timesheetEntries, tasks, holidays);
   }, [user, projects, projectMembers, timesheetEntries, tasks, holidays, formData.dailyAvailableHours]);

   const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name || !formData.email) {
         alert('Por favor, preencha nome e email.');
         return;
      }
      setLoading(true);
      try {
         const payload = {
            NomeColaborador: formData.name,
            email: formData.email,
            Cargo: formData.cargo,
            nivel: formData.nivel,
            role: formData.role,
            ativo: formData.active,
            avatar_url: formData.avatarUrl,
            torre: formData.torre,
            custo_hora: Number(String(formData.hourlyCost).replace(',', '.')),
            horas_disponiveis_dia: Number(String(formData.dailyAvailableHours).replace(',', '.')),
            horas_disponiveis_mes: Number(String(formData.monthlyAvailableHours).replace(',', '.'))
         };

         const { error } = await supabase
            .from('dim_colaboradores')
            .update(payload)
            .eq('ID_Colaborador', Number(userId));

         if (error) throw error;
         alert('Dados atualizados com sucesso!');
         setIsEditing(false);
      } catch (error: any) {
         console.error(error);
         alert('Erro ao salvar: ' + error.message);
      } finally {
         setLoading(false);
      }
   };

   // --- HELPERS ---
   const getDelayDays = (task: Task) => (task.daysOverdue ?? 0);


   const handleNumberChange = (field: keyof typeof formData, value: string) => {
      const cleanValue = value.replace(/[^0-9.,]/g, '');
      setFormData(prev => ({ ...prev, [field]: cleanValue }));
   };

   const handleDeleteUser = async () => {
      if (user && deleteUser) {
         await deleteUser(user.id);
         navigate('/admin/team');
      }
   };

   if (!user) return <div className="p-4 text-xs font-bold text-slate-500">Colaborador não encontrado.</div>;

   const linkedProjectIds = projectMembers.filter(pm => String(pm.id_colaborador) === user.id).map(pm => String(pm.id_projeto));
   const userProjects = projects.filter(p => linkedProjectIds.includes(p.id) && p.active !== false);

   const userTasks = tasks
      .filter(t => {
         const isDone = t.status === 'Done';
         if (isDone) return false;

         const isResponsible = t.developerId === user.id;
         const isCollaborator = t.collaboratorIds && t.collaboratorIds.includes(user.id);
         const isActiveInProject = linkedProjectIds.includes(String(t.projectId));

         if (!isResponsible && !(isCollaborator && isActiveInProject)) return false;

         // Verificar se a tarefa cai no mês selecionado
         const startDate = `${capacityMonth}-01`;
         const [year, month] = capacityMonth.split('-').map(Number);
         const lastDay = new Date(year, month, 0).getDate();
         const endDate = `${capacityMonth}-${String(lastDay).padStart(2, '0')}`;

         const p = projects.find(proj => proj.id === t.projectId);
         const effectiveStart = t.scheduledStart || t.actualStart || p?.startDate || startDate;
         const effectiveEnd = t.estimatedDelivery || p?.estimatedDelivery || endDate;

         const intStart = effectiveStart > startDate ? effectiveStart : startDate;
         const intEnd = effectiveEnd < endDate ? effectiveEnd : endDate;

         return (intStart <= intEnd && intStart <= endDate && intEnd >= startDate);
      })
      .sort((a, b) => {
         const dateA = a.estimatedDelivery ? new Date(a.estimatedDelivery).getTime() : 9999999999999;
         const dateB = b.estimatedDelivery ? new Date(b.estimatedDelivery).getTime() : 9999999999999;
         return dateA - dateB;
      });
   const delayedTasks = tasks
      .filter(t => {
         if (t.status === 'Done' || t.status === 'Review') return false;
         const isResponsible = t.developerId === user.id;
         const isCollaborator = t.collaboratorIds && t.collaboratorIds.includes(user.id);
         if (!isResponsible && !isCollaborator) return false;

         const now = new Date();
         now.setHours(12, 0, 0, 0);
         const delivery = t.estimatedDelivery ? new Date(t.estimatedDelivery + 'T12:00:00') : null;
         return (delivery && now > delivery) || (t.daysOverdue && t.daysOverdue > 0);
      })
      .sort((a, b) => {
         const delayA = a.daysOverdue || 0;
         const delayB = b.daysOverdue || 0;
         return delayB - delayA;
      });

   const completedTasks = tasks
      .filter(t => {
         const isDone = t.status === 'Done';
         if (!isDone) return false;

         const isResponsible = t.developerId === user.id;
         const isCollaborator = t.collaboratorIds && t.collaboratorIds.includes(user.id);
         const isActiveInProject = linkedProjectIds.includes(String(t.projectId));

         if (!isResponsible && !(isCollaborator && isActiveInProject)) return false;

         // Verificar se a tarefa cai no mês selecionado (mesmo critério de horas alocadas)
         const startDate = `${capacityMonth}-01`;
         const [year, month] = capacityMonth.split('-').map(Number);
         const lastDay = new Date(year, month, 0).getDate();
         const endDate = `${capacityMonth}-${String(lastDay).padStart(2, '0')}`;

         const p = projects.find(proj => proj.id === t.projectId);
         const effectiveStart = t.scheduledStart || t.actualStart || p?.startDate || startDate;
         const effectiveEnd = t.actualDelivery || t.estimatedDelivery || p?.estimatedDelivery || endDate;

         const intStart = effectiveStart > startDate ? effectiveStart : startDate;
         const intEnd = effectiveEnd < endDate ? effectiveEnd : endDate;

         return (intStart <= intEnd && intStart <= endDate && intEnd >= startDate);
      })
      .sort((a, b) => {
         const dateA = a.actualDelivery ? new Date(a.actualDelivery).getTime() : 0;
         const dateB = b.actualDelivery ? new Date(b.actualDelivery).getTime() : 0;
         return dateB - dateA;
      });

   return (
      <div className="h-full flex flex-col bg-[var(--bg)] overflow-hidden">
         {/* CABEÇALHO SUPERIOR - COM PROFUNDIDADE */}
         <div className="px-8 py-3.5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface)] sticky top-0 z-20 shadow-sm">
            <div className="flex items-center gap-4">
               <button type="button" onClick={() => navigate(-1)} className="p-1.5 hover:bg-[var(--surface-2)] rounded-lg transition-colors text-[var(--muted)]">
                  <ArrowLeft className="w-5 h-5" />
               </button>
               <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)] border border-[var(--border)] shadow-sm overflow-hidden flex items-center justify-center text-sm font-black text-[var(--primary)]">
                  {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" /> : user.name.substring(0, 2).toUpperCase()}
               </div>
               <div>
                  <h1 className="text-base font-black text-[var(--text)] tracking-tight leading-tight">{user.name}</h1>
                  <div className="flex items-center gap-2 mt-0.5">
                     <span className="text-[9px] font-black uppercase tracking-tight px-1.5 py-0.5 rounded bg-[var(--primary)] text-white">{user.cargo || 'Operacional'}</span>
                     <span className="text-[var(--muted)] opacity-30">•</span>
                     <span className="text-[11px] font-bold text-[var(--text-2)]">{getRoleDisplayName(user.role)}</span>
                  </div>
               </div>
            </div>

            <div className="flex items-center gap-3">
               {activeTab === 'details' && (
                  <button
                     type="button"
                     onClick={() => setIsEditing(!isEditing)}
                     className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${isEditing ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-900 dark:bg-slate-700 text-white hover:bg-black'}`}
                  >
                     {isEditing ? 'Cancelar Edição' : 'Editar Perfil'}
                  </button>
               )}
            </div>
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* SUB-NAVEGAÇÃO - ESTILO TABS */}
            <div className="flex gap-2 border-b border-[var(--border)] sticky top-0 z-10 bg-[var(--bg)]/60 backdrop-blur-xl px-8 pt-2">
               {[
                  { id: 'details', label: 'Dashboard', icon: LayoutGrid },
                  { id: 'projects', label: 'Projetos', count: userProjects.length },
                  { id: 'tasks', label: 'Tarefas', count: userTasks.length },
                  { id: 'completed', label: 'Concluídos', count: completedTasks.length },
                  { id: 'delayed', label: 'Atrasados', count: delayedTasks.length },
                  { id: 'ponto', label: 'Presença', icon: Clock },
                  { id: 'absences', label: 'Ausências', icon: AlertCircle }
               ].map(tab => (
                  <button
                     key={tab.id}
                     type="button"
                     onClick={() => setActiveTab(tab.id as ViewTab)}
                     className={`px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative group ${activeTab === tab.id ? 'text-[var(--primary)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
                        }`}
                  >
                     <div className="relative z-10 flex items-center gap-2">
                        {tab.label}
                        {(tab.count !== null && tab.count !== undefined) && (
                           <span className={`px-1.5 py-0.5 rounded-lg text-[9px] font-black transition-all ${tab.id === 'completed' && tab.count > 0
                              ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                              : tab.id === 'delayed' && tab.count > 0
                                  ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                                  : activeTab === tab.id ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'bg-[var(--surface-2)]'
                              }`}>
                              {tab.count}
                           </span>
                        )}
                     </div>

                     {activeTab === tab.id && (
                        <motion.div
                           layoutId="activeTabPill"
                           className="absolute inset-0 bg-[var(--surface)] rounded-t-2xl border-x border-t border-[var(--border)] z-0"
                           transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                     )}

                     {activeTab === tab.id && (
                        <motion.div
                           layoutId="activeTabUnderline"
                           className="absolute bottom-[-2px] left-0 right-0 h-[2px] bg-[var(--primary)] z-20"
                        />
                     )}
                  </button>
               ))}
            </div>

            <div className="p-6">
               {activeTab === 'details' && (
                  <div className="max-w-4xl mx-auto space-y-6">
                     {/* RESUMO DE CAPACIDADE */}
                     {user && (
                        <div className="ui-card p-8 border border-[var(--border)] relative overflow-hidden bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)]">
                           <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-[var(--border)] pb-6">
                              <div>
                                 <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-1" style={{ color: 'var(--muted)' }}>
                                    <Zap className="w-4 h-4 text-[var(--primary)]" /> Ocupação e Fluxo
                                 </h3>
                                 <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Métricas de Alocação do Colaborador</p>
                              </div>

                              {/* Navegação de Mês */}
                              <div className="flex items-center gap-4 bg-white/40 dark:bg-black/20 p-2 rounded-2xl border border-[var(--border)]">
                                 <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-[var(--surface-hover)] rounded-xl transition-all text-[var(--text)]">
                                    <ChevronRight className="w-5 h-5 rotate-180" />
                                 </button>
                                 <span className="text-xs font-black font-mono uppercase min-w-[140px] text-center" style={{ color: 'var(--text)' }}>
                                    {new Date(capacityMonth + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                 </span>
                                 <button onClick={() => changeMonth(1)} className="p-2 hover:bg-[var(--surface-hover)] rounded-xl transition-all text-[var(--text)]">
                                    <ChevronRight className="w-5 h-5" />
                                 </button>
                              </div>
                           </div>

                           {capData && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                                 {/* Status Card */}
                                 <div className="p-5 rounded-3xl bg-white border border-[var(--border)] shadow-sm">
                                    <div className="flex items-center justify-between mb-1.5">
                                       <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest opacity-60">Status de Carga</p>
                                       <InfoTooltip title="Ocupação Total" content="Soma das horas de projetos Planejados + Contínuos em relação à sua meta mensal." />
                                    </div>
                                    <div className="flex items-end gap-2">
                                       <span className={`text-2xl font-black tabular-nums transition-colors ${capData.status === 'Sobrecarregado' ? 'text-red-500' : capData.status === 'Alto' ? 'text-amber-500' : 'text-emerald-500'}`}>
                                          {Math.round(capData.occupancyRate)}%
                                       </span>
                                       <div className={`mb-1.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${capData.status === 'Sobrecarregado' ? 'bg-red-500/10 text-red-500' : capData.status === 'Alto' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                          {capData.status}
                                       </div>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                                       <div
                                          className={`h-full transition-all duration-1000 ${capData.status === 'Sobrecarregado' ? 'bg-red-500' : capData.status === 'Alto' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                          style={{ width: `${Math.min(100, capData.occupancyRate)}%` }}
                                       />
                                    </div>
                                 </div>

                                 {/* Planejado Card */}
                                 <div
                                    onClick={() => setShowBreakdown('planned')}
                                    className="p-5 rounded-3xl bg-white border border-[var(--border)] shadow-sm cursor-pointer hover:border-[var(--primary)] hover:scale-[1.02] transition-all group/card"
                                 >
                                    <div className="flex items-center justify-between mb-1.5">
                                       <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest opacity-60">Planejado (Prioritário)</p>
                                       <div className="flex items-center gap-2">
                                          <span className="text-[8px] font-bold text-[var(--primary)] bg-[var(--primary-light)] px-1.5 py-0.5 rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity">Ver Detalhes</span>
                                          <InfoTooltip title="Prioridade 1" content="Total de horas destinadas a tarefas de projetos do tipo Planejado (Forecast restante distribuído pelos dias úteis)." />
                                       </div>
                                    </div>
                                    <p className="text-2xl font-black text-blue-600 font-mono">
                                       {formatDecimalToTime(capData.plannedHours)}<span className="text-xs ml-0.5 opacity-40">h</span>
                                    </p>
                                    <p className="text-[9px] font-bold text-[var(--muted)] uppercase mt-2">
                                       Soma diária no mês
                                    </p>
                                 </div>

                                 {/* Continuo Card */}
                                 <div
                                    onClick={() => setShowBreakdown('continuous')}
                                    className="p-5 rounded-3xl bg-white border border-[var(--border)] shadow-sm cursor-pointer hover:border-amber-400 hover:scale-[1.02] transition-all group/card"
                                 >
                                    <div className="flex items-center justify-between mb-1.5">
                                       <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest opacity-60">Contínuo (Reserva)</p>
                                       <div className="flex items-center gap-2">
                                          <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity">Ver Detalhes</span>
                                          <InfoTooltip title="Prioridade 2" content="Horas alocadas para projetos Contínuos ou Reserva Estratégica (50% da capacidade se não houver planejado)." />
                                       </div>
                                    </div>
                                    <p className="text-2xl font-black text-amber-500 font-mono">
                                       {formatDecimalToTime(capData.continuousHours)}<span className="text-xs ml-0.5 opacity-40">h</span>
                                    </p>
                                    <p className="text-[9px] font-bold text-[var(--muted)] uppercase mt-2">
                                       Média disponível p/ ciclo
                                    </p>
                                 </div>

                                 {/* Saldo/Buffer Card */}
                                 <div className="p-5 rounded-3xl bg-white border border-[var(--border)] shadow-sm">
                                    <div className="flex items-center justify-between mb-1.5">
                                       <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest opacity-60">Disponível p/ Planejado</p>
                                       <InfoTooltip title="Buffer" content="Capacidade livre que pode ser utilizada para novas tarefas planejadas sem comprometer a reserva contínua." />
                                    </div>
                                    <p className="text-2xl font-black text-emerald-500 font-mono">
                                       {formatDecimalToTime(capData.balance)}<span className="text-xs ml-0.5 opacity-40">h</span>
                                    </p>
                                    <p className="text-[9px] font-bold text-[var(--muted)] uppercase mt-2">
                                       Capacidade Residual
                                    </p>
                                 </div>

                                 {/* Release Date Card */}
                                 <div
                                    onClick={() => setActiveTab('tasks')}
                                    className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl cursor-pointer hover:scale-[1.02] transition-all group relative overflow-hidden"
                                 >
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all">
                                       <Zap className="w-12 h-12 text-purple-500" />
                                    </div>
                                    <div className="flex items-center justify-between mb-1.5 relative z-10">
                                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disponível Em</p>
                                       <InfoTooltip
                                          title="Previsão de Liberação"
                                          content="Ideal: Foco total (100% cap). Realista: Considera alocação operacional padrão (50% cap)."
                                       />
                                    </div>

                                    <div className="relative z-10">
                                       <div className="flex items-center gap-2">
                                          <p className={`text-xl font-black font-mono transition-all ${releaseDate?.isSaturated ? 'text-red-500' : releaseDate?.realistic ? 'text-purple-400' : 'text-slate-600'}`}>
                                             {releaseDate?.realistic || 'N/A'}
                                          </p>
                                          {releaseDate?.isSaturated && (
                                             <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-500 text-white animate-pulse">SOBRECARGA</span>
                                          )}
                                       </div>
                                       <div className="flex items-center gap-2 mt-1">
                                          <span className={`text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-tighter ${releaseDate?.isSaturated ? 'bg-red-500/20 text-red-400' : 'bg-purple-500/20 text-purple-400'}`}>Realista</span>
                                          {releaseDate && releaseDate.ideal !== releaseDate.realistic && (
                                             <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                                                Ideal: <span className="text-slate-400">{releaseDate.ideal}</span>
                                             </span>
                                          )}
                                       </div>
                                    </div>

                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-all" />
                                 </div>
                              </div>
                           )}

                           {/* NOVO: MAPA DE OCUPAÇÃO DIÁRIA (HEATMAP STYLE) */}
                           <div className="mt-10 pt-8 border-t border-[var(--border)]">
                              <div className="flex items-center justify-between mb-6">
                                 <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Mapa de Alocação Diária</h4>
                                    <p className="text-[9px] font-bold text-[var(--muted)] opacity-50 uppercase mt-0.5">Visão granular do fluxo de trabalho</p>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5">
                                       <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                       <span className="text-[8px] font-black uppercase text-[var(--muted)]">Planejado</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                       <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                                       <span className="text-[8px] font-black uppercase text-[var(--muted)]">Contínuo</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                       <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                       <span className="text-[8px] font-black uppercase text-[var(--muted)]">Buffer</span>
                                    </div>
                                 </div>
                              </div>

                              <div className="flex flex-wrap gap-2 pb-2">
                                 {(() => {
                                    const startDate = `${capacityMonth}-01`;
                                    const [year, month] = capacityMonth.split('-').map(Number);
                                    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

                                    const daily = CapacityUtils.simulateUserDailyAllocation(
                                       user.id, startDate, endDate, projects, tasks, projectMembers, timesheetEntries, holidays || [], Number(String(formData.dailyAvailableHours).replace(',', '.')) || 8
                                    );

                                    return daily.map(day => {
                                       const total = day.plannedHours + day.continuousHours;
                                       const isOverloaded = total > day.capacity;

                                       return (
                                          <div key={day.date} className="group relative">
                                             <div
                                                className={`w-10 h-10 rounded-xl border flex flex-col items-center justify-center transition-all cursor-default overflow-hidden ${isOverloaded ? 'ring-2 ring-red-500/20' : ''
                                                   }`}
                                                style={{
                                                   backgroundColor: 'var(--bg)',
                                                   borderColor: isOverloaded ? '#ef4444' : 'var(--border)'
                                                }}
                                             >
                                                {/* Heatmap Bars */}
                                                <div className="w-full h-full flex flex-col">
                                                   <div className="flex-1 bg-blue-500/80" style={{ height: `${(day.plannedHours / Math.max(1, day.capacity)) * 100}%`, flex: 'none' }} />
                                                   <div className="flex-1 bg-amber-400/80" style={{ height: `${(day.continuousHours / Math.max(1, day.capacity)) * 100}%`, flex: 'none' }} />
                                                   <div className="flex-1 bg-emerald-400/20" style={{ height: `${(day.bufferHours / Math.max(1, day.capacity)) * 100}%`, flex: 'none' }} />
                                                </div>

                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                   <span className="text-[10px] font-black tabular-nums group-hover:hidden" style={{ color: isOverloaded ? '#ef4444' : 'var(--text)' }}>
                                                      {day.date.split('-')[2]}
                                                   </span>
                                                   <span className="text-[7px] font-black hidden group-hover:block uppercase" style={{ color: isOverloaded ? '#ef4444' : 'var(--text)' }}>
                                                      {total}h
                                                   </span>
                                                </div>
                                             </div>

                                             {/* Tooltip Detalhado */}
                                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-3 bg-slate-950 text-white rounded-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 shadow-2xl scale-90 group-hover:scale-100">
                                                <p className="text-[9px] font-black text-center mb-2 border-b border-white/10 pb-1">
                                                   {new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()}
                                                </p>
                                                <div className="space-y-1.5">
                                                   <div className="flex justify-between items-center text-[8px] font-bold">
                                                      <span className="text-blue-400">PLANEJADO:</span>
                                                      <span>{day.plannedHours}h</span>
                                                   </div>
                                                   <div className="flex justify-between items-center text-[8px] font-bold">
                                                      <span className="text-amber-400">CONTÍNUO:</span>
                                                      <span>{day.continuousHours}h</span>
                                                   </div>
                                                   <div className="flex justify-between items-center text-[8px] font-bold border-t border-white/5 pt-1.5 mt-1.5">
                                                      <span className="text-emerald-400">BUFFER:</span>
                                                      <span>{day.bufferHours}h</span>
                                                   </div>
                                                   <div className={`flex justify-between items-center text-[9px] font-black pt-1 ${isOverloaded ? 'text-red-500' : 'text-white'}`}>
                                                      <span>TOTAL:</span>
                                                      <span>{total}h</span>
                                                   </div>
                                                </div>
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-950"></div>
                                             </div>
                                          </div>
                                       );
                                    });
                                 })()}
                              </div>
                           </div>
                        </div>
                     )}

                     <div className="ui-card p-6">
                        <div className="flex items-center gap-3 mb-8">
                           <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)] flex items-center justify-center text-[var(--primary)]">
                              <UserIcon className="w-5 h-5" />
                           </div>
                           <div>
                              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text)]">Dados Cadastrais</h3>
                              <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-wider">Informações básicas e acesso ao sistema</p>
                           </div>
                        </div>

                        <form onSubmit={handleSave} className="space-y-8">
                           <fieldset disabled={!isEditing} className="disabled:opacity-100 space-y-8">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Nome Completo</label>
                                    <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] font-bold focus:ring-2 focus:ring-[var(--primary)]/20 outline-none transition-all disabled:bg-transparent disabled:px-0 disabled:border-none disabled:text-base" required />
                                 </div>

                                 <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Email Profissional</label>
                                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] font-bold focus:ring-2 focus:ring-[var(--primary)]/20 outline-none transition-all disabled:bg-transparent disabled:px-0 disabled:border-none disabled:text-base" required />
                                 </div>

                                 <div className="col-span-full pt-8 border-t border-[var(--border)]">
                                    <div className="flex items-center gap-2 mb-6">
                                       <LayoutGrid className="w-4 h-4 text-[var(--primary)]" />
                                       <h3 className="text-[11px] font-black text-[var(--text)] uppercase tracking-widest">Enquadramento Funcional</h3>
                                    </div>

                                    <OrganizationalStructureSelector
                                       initialCargo={formData.cargo}
                                       initialLevel={formData.nivel}
                                       initialTorre={formData.torre}
                                       isEditing={isEditing}
                                       onChange={({ cargo, nivel, torre }) => setFormData(prev => ({ ...prev, cargo, nivel, torre }))}
                                    />
                                 </div>

                                 <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Nível de Acesso</label>
                                    <select
                                       value={formData.role}
                                       onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                                       disabled={!isEditing}
                                       className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] font-bold focus:ring-2 focus:ring-[var(--primary)]/20 outline-none disabled:bg-transparent disabled:px-0 disabled:border-none disabled:appearance-none disabled:text-[var(--primary)]"
                                    >
                                       <option value="developer">Operacional / Consultor</option>
                                       <option value="tech_lead">Tech Lead / Liderança</option>
                                       <option value="pmo">Planejamento / PMO</option>
                                       <option value="executive">Gestão Executiva / Executivo</option>
                                       <option value="system_admin">Administrador TI (System Admin)</option>
                                       <option value="ceo">Diretoria Geral / CEO</option>
                                    </select>
                                 </div>
                              </div>

                              <div className="border-t border-[var(--border)] pt-8 space-y-6">
                                 <h4 className="text-[11px] font-black uppercase text-[var(--text)] tracking-widest flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-500" /> Custos e Metas Meta (Restrito)</h4>
                                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-1.5">
                                       <label className="block text-[10px] font-black text-[var(--muted)] uppercase">Custo Hora (IDL)</label>
                                       <div className="relative">
                                          {!isEditing && <span className="text-emerald-600 font-black">R$ {formData.hourlyCost}</span>}
                                          {isEditing && (
                                             <>
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">R$</span>
                                                <input type="text" value={formData.hourlyCost || ''} onChange={(e) => handleNumberChange('hourlyCost', e.target.value)} placeholder="0,00" className="w-full pl-10 pr-4 py-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-sm text-emerald-600 font-black focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                                             </>
                                          )}
                                       </div>
                                    </div>
                                    <div className="space-y-1.5">
                                       <label className="block text-[10px] font-black text-[var(--muted)] uppercase">Hrs Meta Dia</label>
                                       <input type="text" value={formData.dailyAvailableHours || ''} onChange={(e) => handleNumberChange('dailyAvailableHours', e.target.value)} placeholder="0" className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] font-bold focus:ring-2 focus:ring-[var(--primary)]/20 outline-none disabled:bg-transparent disabled:px-0 disabled:border-none" />
                                    </div>
                                    <div className="space-y-1.5">
                                       <label className="block text-[10px] font-black text-[var(--muted)] uppercase">Hrs Meta Mês</label>
                                       {(() => {
                                          const currentMonth = capacityMonth;
                                          const bizDays = CapacityUtils.getWorkingDaysInMonth(currentMonth, holidays || []);

                                          // Subtrair ausências aprovadas do colaborador que caem em dias úteis
                                          const userAbsences = absences.filter(a =>
                                             String(a.userId) === String(userId) &&
                                             (a.status === 'aprovada_gestao' || a.status === 'aprovada_rh' || a.status === 'finalizada_dp')
                                          );

                                          let absenceDays = 0;
                                          userAbsences.forEach(abs => {
                                             const start = abs.startDate > `${currentMonth}-01` ? abs.startDate : `${currentMonth}-01`;
                                             const [year, month] = currentMonth.split('-').map(Number);
                                             const lastDay = new Date(year, month, 0).toISOString().split('T')[0];
                                             const end = abs.endDate < lastDay ? abs.endDate : lastDay;

                                             if (start <= end) {
                                                absenceDays += CapacityUtils.getWorkingDaysInRange(start, end, holidays || []);
                                             }
                                          });

                                          const totalWorkingDays = Math.max(0, bizDays - absenceDays);
                                          const today = new Date();
                                          const todayStr = today.toISOString().split('T')[0];
                                          const isCurrentMonth = todayStr.startsWith(currentMonth);
                                          const [year, month] = currentMonth.split('-').map(Number);
                                          const lastDay = new Date(year, month, 0).toISOString().split('T')[0];

                                          const residualStart = isCurrentMonth ? todayStr : `${currentMonth}-01`;
                                          const residualBizDays = CapacityUtils.getWorkingDaysInRange(residualStart, lastDay, holidays || []);

                                          let residualAbsenceDays = 0;
                                          userAbsences.forEach(abs => {
                                             const end = abs.endDate < lastDay ? abs.endDate : lastDay;
                                             const rStart = abs.startDate > residualStart ? abs.startDate : residualStart;
                                             if (rStart <= end) {
                                                residualAbsenceDays += CapacityUtils.getWorkingDaysInRange(rStart, end, holidays || []);
                                             }
                                          });

                                          const finalResidualDays = Math.max(0, residualBizDays - residualAbsenceDays);
                                          const dailyMeta = Number(formData.dailyAvailableHours) || 0;

                                          const calculatedTotal = dailyMeta * totalWorkingDays;
                                          const calculatedResidual = dailyMeta * finalResidualDays;

                                          return (
                                             <div className="space-y-1">
                                                <div className="w-full px-4 py-3 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] font-black flex justify-between items-center">
                                                   <span>{formatDecimalToTime(calculatedTotal)}</span>
                                                   {isCurrentMonth && (
                                                      <span className="text-[10px] bg-purple-500/10 text-purple-600 px-2 py-1 rounded-lg font-black uppercase tracking-tight">
                                                         RESTAM: {formatDecimalToTime(calculatedResidual)}
                                                      </span>
                                                   )}
                                                </div>
                                                <p className="text-[8px] font-bold uppercase opacity-40 mt-1">
                                                   REF: {new Date(capacityMonth + '-02').toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()} |
                                                   TOTAL: {totalWorkingDays} DIAS | {isCurrentMonth ? `SALDO: ${finalResidualDays} DIAS ÚTEIS` : ''}
                                                </p>
                                             </div>
                                          );
                                       })()}
                                    </div>
                                 </div>
                              </div>

                              <div className="border-t border-[var(--border)] pt-8 space-y-6">
                                 <h4 className="text-[11px] font-black uppercase text-[var(--text)] tracking-widest flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-[var(--primary)]" /> Gestão de Status e Acesso
                                 </h4>

                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* TOGGLE: PARTICIPAR DO FLUXO */}
                                    <div className={`p-4 rounded-2xl border transition-all ${formData.torre !== 'N/A' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-500/5 border-slate-500/20'}`}>
                                       <div className="flex items-center justify-between mb-4">
                                          <div className="flex items-center gap-3">
                                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${formData.torre !== 'N/A' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
                                                <Zap className="w-4 h-4" />
                                             </div>
                                             <div>
                                                <p className="text-[10px] font-black uppercase text-[var(--muted)] tracking-widest">Operacional</p>
                                                <p className="text-xs font-black text-[var(--text)]">Participação no Fluxo</p>
                                             </div>
                                          </div>
                                          {isEditing && (
                                             <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, torre: prev.torre === 'N/A' ? '' : 'N/A' }))}
                                                className={`w-12 h-6 rounded-full relative transition-all ${formData.torre !== 'N/A' ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                             >
                                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${formData.torre !== 'N/A' ? 'left-7' : 'left-1'}`} />
                                             </button>
                                          )}
                                       </div>
                                       <div className="flex items-center justify-between">
                                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${formData.torre !== 'N/A' ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'}`}>
                                             {formData.torre !== 'N/A' ? 'Ativo no Board' : 'Oculto no Board'}
                                          </span>
                                       </div>
                                    </div>

                                    {/* TOGGLE: STATUS DA CONTA (DESLIGAR) */}
                                    <div className={`p-4 rounded-2xl border transition-all ${formData.active ? 'bg-blue-500/5 border-blue-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                                       <div className="flex items-center justify-between mb-4">
                                          <div className="flex items-center gap-3">
                                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${formData.active ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'}`}>
                                                <Shield className="w-4 h-4" />
                                             </div>
                                             <div>
                                                <p className="text-[10px] font-black uppercase text-[var(--muted)] tracking-widest">Controle de Acesso</p>
                                                <p className="text-xs font-black text-[var(--text)]">Desligar Colaborador</p>
                                             </div>
                                          </div>
                                          {isEditing && (
                                             <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, active: !prev.active }))}
                                                className={`w-12 h-6 rounded-full relative transition-all ${formData.active ? 'bg-blue-500' : 'bg-red-500'}`}
                                             >
                                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${formData.active ? 'left-7' : 'left-1'}`} />
                                             </button>
                                          )}
                                       </div>
                                       <div className="flex items-center justify-between">
                                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${formData.active ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'}`}>
                                             {formData.active ? 'Conta Habilitada' : 'CONTA DESLIGADA'}
                                          </span>
                                       </div>
                                    </div>
                                 </div>

                                 {isEditing && (
                                    <div className="pt-6 border-t border-[var(--border)] flex items-center justify-between gap-6">
                                       <div className="flex flex-col">
                                          <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Ações Irreversíveis</p>
                                          <p className="text-[11px] text-[var(--muted)] font-medium">Cuidado ao remover registros permanentes.</p>
                                       </div>
                                       <div className="flex items-center gap-3">
                                          <button type="button" onClick={() => setDeleteModalOpen(true)} className="px-6 py-3 text-red-500 hover:bg-red-500/5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border border-red-500/20 hover:border-red-500">Excluir Colaborador</button>
                                          <button type="submit" className="px-8 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-[var(--primary)]/20 transition-all flex items-center gap-2">
                                             <Save className="w-4 h-4" /> Salvar Alterações
                                          </button>
                                       </div>
                                    </div>
                                 )}
                              </div>
                           </fieldset>
                        </form>
                     </div>
                  </div>
               )}

               {activeTab === 'projects' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {userProjects.map(p => {
                        const userProjectTasks = tasks.filter(t => t.projectId === p.id && (t.developerId === user.id || t.collaboratorIds?.includes(user.id)));
                        const userEstimated = userProjectTasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
                        const userReported = timesheetEntries
                           .filter(e => e.projectId === p.id && e.userId === user.id)
                           .reduce((sum, e) => sum + (Number(e.totalHours) || 0), 0);
                        const remaining = Math.max(0, userEstimated - userReported);

                        return (
                           <div onClick={() => navigate(`/admin/projects/${p.id}`)} key={p.id} className="cursor-pointer ui-card p-6 group space-y-4">
                              <div className="flex items-center justify-between">
                                 <span className="text-[9px] px-2 py-1 rounded-md bg-[var(--surface-2)] uppercase font-black text-[var(--muted)]">{p.status}</span>
                                 <ChevronRight className="w-4 h-4 text-[var(--muted)] opacity-30 group-hover:translate-x-1 group-hover:text-[var(--primary)] transition-all" />
                              </div>

                              <h4 className="font-black text-[var(--text)] text-sm group-hover:text-[var(--primary)] transition-colors line-clamp-2">{p.name}</h4>

                              <div className="pt-4 border-t border-[var(--border)] space-y-3">
                                 <div className="flex justify-between items-end">
                                    <p className="text-[10px] uppercase font-black text-[var(--muted)]">Minha Alocação</p>
                                    <p className="text-xs font-black text-[var(--text)]">{formatDecimalToTime(userReported)} <span className="text-[var(--muted)] font-bold text-[10px]">/ {userEstimated}h</span></p>
                                 </div>
                                 <div className="w-full h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                                    <div
                                       className={`h-full transition-all ${userReported > userEstimated ? 'bg-red-500' : 'bg-emerald-500'}`}
                                       style={{ width: `${Math.min(100, userEstimated > 0 ? (userReported / userEstimated) * 100 : 0)}%` }}
                                    />
                                 </div>
                                 <div className="flex justify-between text-[9px] font-bold">
                                    <span style={{ color: userReported > userEstimated ? 'var(--danger)' : 'var(--success)' }}>
                                       {Math.round(userEstimated > 0 ? (userReported / userEstimated) * 100 : 0)}% Consumido
                                    </span>
                                    <span style={{ color: 'var(--muted)' }}>
                                       Restam {formatDecimalToTime(remaining)}
                                    </span>
                                 </div>
                              </div>
                           </div>
                        );
                     })}
                     {userProjects.length === 0 && (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-[var(--border)] rounded-2xl">
                           <p className="text-xs font-black text-[var(--muted)] uppercase tracking-widest">Nenhum projeto vinculado a este usuário.</p>
                        </div>
                     )}
                  </div>
               )}

               {activeTab === 'tasks' && (
                  <div className="space-y-4 max-w-4xl mx-auto">
                     <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={{
                           visible: { transition: { staggerChildren: 0.05 } }
                        }}
                        className="space-y-3"
                     >
                        {userTasks.map((t) => {
                           const client = clients.find(c => String(c.id) === String(t.clientId));
                           const teamIds = Array.from(new Set([t.developerId, ...(t.collaboratorIds || [])])).filter(Boolean);
                           const responsible = users.find(u => String(u.id) === String(t.developerId));
                           const teamNames = teamIds
                              .map(id => users.find(u => String(u.id) === String(id))?.name?.toUpperCase())
                              .filter(Boolean)
                              .join(', ');

                           const alloc = taskMemberAllocations.find(a => String(a.taskId) === String(t.id) && String(a.userId) === String(user?.id));
                           let allocatedHours = 0;
                           if (alloc && alloc.reservedHours > 0) {
                              allocatedHours = alloc.reservedHours;
                           } else {
                              const hasAnyAllocationInTask = taskMemberAllocations.some(a => String(a.taskId) === String(t.id) && a.reservedHours > 0);
                              if (!hasAnyAllocationInTask) {
                                 allocatedHours = (Number(t.estimatedHours) || 0) / (teamIds.length || 1);
                              }
                           }

                           // --- CÁLCULO MENSAL NO MÊS SELECIONADO ---
                           const startDate = `${capacityMonth}-01`;
                           const [year, month] = capacityMonth.split('-').map(Number);
                           const lastDay = new Date(year, month, 0).getDate();
                           const endDate = `${capacityMonth}-${String(lastDay).padStart(2, '0')}`;
                           const p = projects.find(proj => proj.id === t.projectId);
                           const effectiveStart = t.scheduledStart || t.actualStart || p?.startDate || startDate;
                           const effectiveEnd = t.actualDelivery || t.estimatedDelivery || p?.estimatedDelivery || endDate;

                           const userAbsences = absences.filter(a => String(a.userId) === String(user.id) && a.status === 'aprovada_gestao');
                           const totalTaskDays = CapacityUtils.getWorkingDaysInRange(effectiveStart, effectiveEnd, holidays, userAbsences) || 1;
                           const hoursPerDay = allocatedHours / totalTaskDays;

                           const intStart = effectiveStart > startDate ? effectiveStart : startDate;
                           const intEnd = effectiveEnd < endDate ? effectiveEnd : endDate;

                           let monthlyAllocatedHours = 0;
                           if (intStart <= intEnd && intStart <= endDate && intEnd >= startDate) {
                              const bizDaysInMonth = CapacityUtils.getWorkingDaysInRange(intStart, intEnd, holidays, userAbsences);
                              monthlyAllocatedHours = bizDaysInMonth * hoursPerDay;
                           }

                           const monthlyReportedHours = timesheetEntries.reduce((sum, entry) => {
                              if (String(entry.taskId) === String(t.id) && String(entry.userId) === String(user.id)) {
                                 if (entry.date.startsWith(capacityMonth)) {
                                    return sum + (Number(entry.totalHours) || 0);
                                 }
                              }
                              return sum;
                           }, 0);

                           const reportedHours = timesheetEntries.reduce((sum, entry) => {
                              if (String(entry.taskId) === String(t.id) && String(entry.userId) === String(user.id)) {
                                 return sum + (Number(entry.totalHours) || 0);
                              }
                              return sum;
                           }, 0);

                           const now = new Date();
                           now.setHours(12, 0, 0, 0);
                           const delivery = t.estimatedDelivery ? new Date(t.estimatedDelivery + 'T12:00:00') : null;
                           const isOverdue = delivery ? now > delivery : false;

                           return (
                              <motion.div
                                 variants={{
                                    hidden: { opacity: 0, y: 10 },
                                    visible: { opacity: 1, y: 0 }
                                 }}
                                 whileHover={{ scale: 1.005 }}
                                 onClick={() => navigate(`/tasks/${t.id}`)}
                                 key={t.id}
                                 className="relative cursor-pointer bg-[#0c0c14] border border-white/5 p-4 rounded-[16px] mb-3 flex gap-5 items-center group transition-all"
                              >
                                 {/* LOGO EMPRESA */}
                                 <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center p-2.5 shrink-0 shadow-lg">
                                    {client?.logoUrl ? (
                                       <img src={client.logoUrl} alt={client.name} className="w-full h-full object-contain" />
                                    ) : (
                                       <LayoutGrid className="w-8 h-8 text-slate-200" />
                                    )}
                                 </div>

                                 {/* CONTEUDO */}
                                 <div className="flex-1 min-w-0">
                                    {/* HEADER: TITULO + HORAS + PROGRESSO (TEXTO) */}
                                    <div className="flex items-center justify-between mb-1.5">
                                       <div className="flex items-center gap-3">
                                          <h4 className="text-white font-black text-[15px] tracking-tight truncate max-w-lg">
                                             {t.title}
                                          </h4>
                                          <div className="flex items-center gap-2">
                                             <div className="bg-[#1a1625] px-3 py-1 rounded-full flex gap-1.5 items-center border border-white/5" title="Horas no Mês Selecionado">
                                                <span className="text-[11px] font-black text-slate-400 font-mono">{formatDecimalToTime(monthlyReportedHours)}h</span>
                                                <span className="text-[11px] text-white/5">/</span>
                                                <span className="text-[11px] font-black text-purple-500 font-mono">{formatDecimalToTime(monthlyAllocatedHours)}h</span>
                                             </div>
                                             <div className="hidden sm:flex bg-blue-500/10 px-3 py-1 rounded-full flex gap-1.5 items-center border border-blue-500/20" title="Horas Totais da Tarefa">
                                                <span className="text-[10px] font-bold text-blue-400 font-mono">Total {formatDecimalToTime(reportedHours)}h / {formatDecimalToTime(allocatedHours)}h</span>
                                             </div>
                                          </div>
                                       </div>
                                       <span className="text-purple-600 font-black text-[13px] font-mono">{t.progress}%</span>
                                    </div>

                                    {/* STATUS BADGE */}
                                    <div className="mb-4">
                                       <span className="bg-blue-600 text-[10px] font-black text-white px-3 py-1 rounded-md uppercase tracking-widest shadow-lg shadow-blue-500/20">
                                          {getStatusDisplayName(t.status)}
                                       </span>
                                    </div>

                                    {/* INFO ROW: PERIODO | RESPONSÁVEL | EQUIPE */}
                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-4">
                                       <div className="flex items-center gap-2">
                                          <Calendar className="w-3.5 h-3.5 opacity-30" />
                                          <span>PERÍODO: <span className="text-slate-300">{formatDateBR(t.scheduledStart || t.actualStart)} - {formatDateBR(t.estimatedDelivery)}</span></span>
                                       </div>
                                       <div className="flex items-center gap-2">
                                          <UserIcon className="w-3.5 h-3.5 opacity-30" />
                                          <span>RESPONSÁVEL: <span className="text-slate-300">{responsible?.name?.toUpperCase()}</span></span>
                                       </div>
                                       <div className="h-3 w-[1px] bg-white/10 hidden xl:block" />
                                       <div className="flex items-center gap-1 min-w-0">
                                          <span>EQUIPE: <span className="text-slate-300 truncate">{teamNames}</span></span>
                                       </div>
                                    </div>

                                    {/* FOOTER: AVATARES + ALERTA + PROGRESS BAR */}
                                    <div className="flex items-center justify-between">
                                       <div className="flex items-center gap-4">
                                          <div className="flex -space-x-2.5">
                                             {teamIds.slice(0, 8).map(id => {
                                                const collabo = users.find(u => String(u.id) === String(id));
                                                return (
                                                   <div key={id} className="w-7 h-7 rounded-full border-2 border-[#0c0c14] overflow-hidden bg-slate-800 shadow-xl">
                                                      {collabo?.avatarUrl ? <img src={collabo.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[7px] font-black text-white/30 uppercase">{collabo?.name?.substring(0, 1)}</div>}
                                                   </div>
                                                );
                                             })}
                                          </div>

                                          {isOverdue && (
                                             <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-red-500/5 border border-red-500/20 text-red-500 shadow-2xl">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.15em]">Tarefa Atrasada</span>
                                             </div>
                                          )}
                                       </div>

                                       <div className="w-64 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 group-hover:border-white/10 transition-all">
                                          <div
                                             className="h-full bg-purple-600/10"
                                             style={{ width: '100%' }}
                                          >
                                             <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${t.progress}%` }}
                                                transition={{ duration: 1.5, ease: "circOut" }}
                                                className="h-full bg-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.35)]"
                                             />
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                              </motion.div>
                           );
                        })}
                     </motion.div>
                     {userTasks.length === 0 && (
                        <motion.div
                           initial={{ opacity: 0 }}
                           animate={{ opacity: 1 }}
                           className="py-16 text-center border-2 border-dashed border-[var(--border-muted)] rounded-[32px] bg-[var(--surface-2)]/30 backdrop-blur-sm"
                        >
                           <LayoutGrid className="w-8 h-8 mx-auto text-[var(--muted)] opacity-20 mb-3" />
                           <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.2em] opacity-40">Nenhuma tarefa atribuída</p>
                        </motion.div>
                     )}
                  </div>
               )}

                               {activeTab === 'delayed' && (
                   <div className="space-y-4 max-w-4xl mx-auto">
                      <motion.div
                         initial="hidden"
                         animate="visible"
                         variants={{
                            visible: { transition: { staggerChildren: 0.05 } }
                         }}
                         className="space-y-3"
                      >
                         {delayedTasks.map((t) => {
                            const client = clients.find(c => String(c.id) === String(t.clientId));
                            const teamIds = Array.from(new Set([t.developerId, ...(t.collaboratorIds || [])])).filter(Boolean);
                            const responsible = users.find(u => String(u.id) === String(t.developerId));
                            const teamNames = teamIds
                               .map(id => users.find(u => String(u.id) === String(id))?.name?.toUpperCase())
                               .filter(Boolean)
                               .join(', ');

                            const reportedHours = timesheetEntries.reduce((sum, entry) => {
                               if (String(entry.taskId) === String(t.id) && String(entry.userId) === String(user.id)) {
                                  return sum + (Number(entry.totalHours) || 0);
                               }
                               return sum;
                            }, 0);

                            return (
                               <motion.div
                                  variants={{
                                     hidden: { opacity: 0, y: 10 },
                                     visible: { opacity: 1, y: 0 }
                                  }}
                                  whileHover={{ scale: 1.005 }}
                                  onClick={() => navigate(`/tasks/${t.id}`)}
                                  key={t.id}
                                  className="relative cursor-pointer bg-red-500/[0.02] border border-red-500/10 p-4 rounded-[16px] mb-3 flex gap-5 items-center group transition-all"
                               >
                                  <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center p-2.5 shrink-0 shadow-lg">
                                     {client?.logoUrl ? (
                                        <img src={client.logoUrl} alt={client.name} className="w-full h-full object-contain" />
                                     ) : (
                                        <LayoutGrid className="w-8 h-8 text-slate-200" />
                                     )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                     <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-3">
                                           <h4 className="text-white font-black text-[15px] tracking-tight truncate max-w-lg">
                                              {t.title}
                                           </h4>
                                           <div className="bg-red-500/10 px-3 py-1 rounded-full flex gap-1.5 items-center border border-red-500/20">
                                              <span className="text-[10px] font-bold text-red-500 font-mono">Total {formatDecimalToTime(reportedHours)}h / {formatDecimalToTime(t.estimatedHours || 0)}h</span>
                                           </div>
                                        </div>
                                        <span className="text-red-500 font-black text-[13px] font-mono">{t.progress}%</span>
                                     </div>

                                     <div className="mb-4 flex items-center gap-2">
                                        <span className="bg-red-600 text-[10px] font-black text-white px-3 py-1 rounded-md uppercase tracking-widest">
                                           {getStatusDisplayName(t.status)}
                                        </span>
                                        <span className="text-[10px] font-black text-red-500 px-2 py-1 rounded-md bg-red-500/10 uppercase tracking-widest">
                                           {t.daysOverdue} dias de atraso
                                        </span>
                                     </div>

                                     <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-4">
                                        <div className="flex items-center gap-2">
                                           <Calendar className="w-3.5 h-3.5 opacity-30" />
                                           <span>PRAZO VENCIDO: <span className="text-red-400">{formatDateBR(t.estimatedDelivery)}</span></span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                           <UserIcon className="w-3.5 h-3.5 opacity-30" />
                                           <span>RESPONSÁVEL: <span className="text-slate-300">{responsible?.name?.toUpperCase()}</span></span>
                                        </div>
                                     </div>

                                     <div className="flex items-center justify-between">
                                        <div className="flex -space-x-2.5">
                                           {teamIds.slice(0, 8).map(id => {
                                              const collabo = users.find(u => String(u.id) === String(id));
                                              return (
                                                 <div key={id} className="w-7 h-7 rounded-full border-2 border-[#0c0c14] overflow-hidden bg-slate-800 shadow-xl">
                                                    {collabo?.avatarUrl ? <img src={collabo.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[7px] font-black text-white/30 uppercase">{collabo?.name?.substring(0, 1)}</div>}
                                                 </div>
                                              );
                                           })}
                                        </div>

                                        <div className="w-64 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                           <div className="h-full bg-red-600/10" style={{ width: '100%' }}>
                                              <motion.div
                                                 initial={{ width: 0 }}
                                                 animate={{ width: `${t.progress}%` }}
                                                 transition={{ duration: 1.5 }}
                                                 className="h-full bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.35)]"
                                              />
                                           </div>
                                        </div>
                                     </div>
                                  </div>
                               </motion.div>
                            );
                         })}
                      </motion.div>
                      {delayedTasks.length === 0 && (
                         <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-16 text-center border-2 border-dashed border-[var(--border-muted)] rounded-[32px] bg-[var(--surface-2)]/30 backdrop-blur-sm"
                         >
                            <AlertCircle className="w-8 h-8 mx-auto text-emerald-500 opacity-20 mb-3" />
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] opacity-40">Nenhuma tarefa em atraso</p>
                         </motion.div>
                      )}
                   </div>
                )}

{activeTab === 'completed' && (
                  <motion.div
                     initial="hidden"
                     animate="visible"
                     variants={{
                        visible: { transition: { staggerChildren: 0.05 } }
                     }}
                     className="space-y-3 max-w-4xl mx-auto"
                  >
                     {completedTasks.map(t => {
                        const client = clients.find(c => String(c.id) === String(t.clientId));
                        const reportedHours = timesheetEntries.reduce((sum, entry) => {
                           if (String(entry.taskId) === String(t.id) && String(entry.userId) === String(user.id)) {
                              return sum + (Number(entry.totalHours) || 0);
                           }
                           return sum;
                        }, 0);
                        return (
                           <motion.div
                              variants={{
                                 hidden: { opacity: 0, x: -10 },
                                 visible: { opacity: 1, x: 0 }
                              }}
                              whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
                              onClick={() => navigate(`/tasks/${t.id}`)}
                              key={t.id}
                              className="cursor-pointer glass-effect p-3 rounded-[24px] hover:bg-emerald-500/[0.03] hover:border-emerald-500/30 transition-all flex justify-between items-center group shadow-sm border border-emerald-500/10 overflow-hidden relative"
                           >
                              <div className="absolute left-0 top-0 w-1 h-full bg-emerald-500/40" />

                              <div className="flex items-center gap-4 min-w-0">
                                 <div className="w-11 h-11 rounded-2xl bg-emerald-500/5 flex items-center justify-center text-emerald-500 shrink-0 border border-emerald-500/10 overflow-hidden shadow-inner">
                                    {client?.logoUrl ? (
                                       <img src={client.logoUrl} alt={client.name} className="w-full h-full object-contain p-2" />
                                    ) : (
                                       <CheckCircle className="w-5 h-5" />
                                    )}
                                 </div>
                                 <div className="min-w-0">
                                    <h4 className="font-black text-emerald-900 dark:text-emerald-400 text-[13px] truncate uppercase tracking-tight mb-1 group-hover:text-emerald-600 transition-colors">
                                       {t.title}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                       <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                          <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                          <span className="text-[8px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Entregue: {formatDateBR(t.actualDelivery || t.estimatedDelivery)}</span>
                                       </div>
                                       <span className="text-[7px] font-bold text-emerald-400/50 uppercase tracking-widest">ID: #{t.id}</span>
                                    </div>
                                 </div>
                              </div>
                              <div className="flex items-center gap-3 pr-2">
                                 <div className="text-right hidden sm:block">
                                    <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest opacity-40">Reportado</p>
                                    <p className="text-[10px] font-black text-emerald-900/60 dark:text-emerald-400/60 uppercase">
                                       {formatDecimalToTime(reportedHours)}h
                                    </p>
                                 </div>
                                 <ChevronRight className="w-5 h-5 text-emerald-300 group-hover:text-emerald-600 transition-all group-hover:translate-x-1 shrink-0" />
                              </div>
                           </motion.div>
                        );
                     })}
                     {completedTasks.length === 0 && (
                        <motion.div
                           initial={{ opacity: 0, scale: 0.95 }}
                           animate={{ opacity: 1, scale: 1 }}
                           className="text-center py-16 bg-slate-500/5 rounded-[32px] border-2 border-dashed border-slate-500/20 backdrop-blur-sm"
                        >
                           <div className="w-14 h-14 bg-slate-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-500/20 shadow-lg">
                              <CheckCircle className="w-7 h-7 text-slate-500" />
                           </div>
                           <p className="text-slate-700 dark:text-slate-400 font-black text-xs uppercase tracking-[0.2em]">Nenhuma Tarefa Concluída</p>
                           <p className="text-[10px] text-slate-600/60 dark:text-slate-500/40 font-bold mt-1.5 italic">Ainda não há tarefas finalizadas.</p>
                        </motion.div>
                     )}
                  </motion.div>
               )}

               {activeTab === 'ponto' && (
                  <div className="ui-card p-6">
                     <TimesheetCalendar userId={user.id} embedded={true} />
                  </div>
               )}

               {activeTab === 'absences' && (
                  <div className="ui-card p-6">
                     <AbsenceManager targetUserId={user.id} targetUserName={user.name} />
                  </div>
               )}
            </div>
         </div>

         <ConfirmationModal
            isOpen={deleteModalOpen}
            title="Excluir Colaborador"
            message={`Tem certeza que deseja remover permanentemente "${user.name}"? Esta ação não pode ser desfeita.`}
            onConfirm={handleDeleteUser}
            onCancel={() => setDeleteModalOpen(false)}
         />
         {showBreakdown && capData && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
               <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20"
               >
                  <div className={`p-8 ${showBreakdown === 'planned' ? 'bg-blue-600' : 'bg-amber-500'} text-white`}>
                     <div className="flex items-center justify-between">
                        <div>
                           <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Distribuição de Carga</p>
                           <h3 className="text-2xl font-black">{showBreakdown === 'planned' ? 'Projetos Planejados' : 'Projetos Contínuos'}</h3>
                        </div>
                        <button onClick={() => setShowBreakdown(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                           <LayoutGrid className="w-5 h-5 rotate-45" />
                        </button>
                     </div>

                     <div className="mt-6 p-4 bg-white/10 rounded-2xl backdrop-blur-md">
                        <p className="text-[10px] font-bold opacity-80 uppercase mb-1">Total no Mês</p>
                        <p className="text-3xl font-black font-mono">
                           {formatDecimalToTime(showBreakdown === 'planned' ? capData.plannedHours : capData.continuousHours)}h
                        </p>
                     </div>
                  </div>

                  <div className="p-8 max-h-[60vh] overflow-y-auto">
                     <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest mb-6 opacity-40">Origem das Horas</p>

                     <div className="space-y-4">
                        {(showBreakdown === 'planned' ? capData.breakdown.planned : capData.breakdown.continuous).map((item, idx) => (
                           <div key={item.id} className="flex items-center justify-between p-4 rounded-3xl bg-[var(--surface)] border border-[var(--border)] group hover:border-[var(--primary)] transition-all">
                              <div className="flex items-center gap-4">
                                 <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs ${showBreakdown === 'planned' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                    {idx + 1}
                                 </div>
                                 <div>
                                    <p className="font-black text-[var(--text)] text-sm group-hover:text-[var(--primary)] transition-colors">{item.name}</p>
                                    <p className="text-[10px] font-bold text-[var(--muted)] uppercase">ID: {item.id}</p>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <p className="font-black text-[var(--text)] font-mono">{formatDecimalToTime(item.hours)}h</p>
                                 <p className="text-[9px] font-bold text-[var(--muted)]">Calculado</p>
                              </div>
                           </div>
                        ))}

                        {(showBreakdown === 'planned' ? capData.breakdown.planned : capData.breakdown.continuous).length === 0 && (
                           <div className="text-center py-12 opacity-30">
                              <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                              <p className="font-black uppercase text-xs">Nenhum projeto identificado</p>
                           </div>
                        )}
                     </div>
                  </div>

                  <div className="p-8 bg-slate-50 border-t border-[var(--border)] flex justify-end">
                     <button
                        onClick={() => setShowBreakdown(null)}
                        className="px-8 py-3 bg-white border border-[var(--border)] text-[var(--text)] rounded-2xl font-black text-xs uppercase hover:bg-white hover:border-[var(--primary)] transition-all active:scale-95 shadow-sm"
                     >
                        Fechar
                     </button>
                  </div>
               </motion.div>
            </div>
         )}
      </div >
   );
};

export default TeamMemberDetail;
