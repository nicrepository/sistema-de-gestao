// components/TeamMemberDetail.tsx - Reestruturado: Resumo Topo + Edição Principal
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useDataController } from '@/controllers/useDataController';
import { Task, Role } from '@/types';
import { User as UserIcon, Mail, Briefcase, Shield, Edit, Save, Trash2, ArrowLeft, CheckCircle, Clock, AlertCircle, Calendar, Zap, Info, LayoutGrid, ChevronRight } from 'lucide-react';
import OrganizationalStructureSelector from './OrganizationalStructureSelector';
import ConfirmationModal from './ConfirmationModal';
import { getRoleDisplayName, formatDecimalToTime, getStatusDisplayName, formatDateBR, parseTimeToDecimal } from '@/utils/normalizers';

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
   const { users, tasks, projects, projectMembers, timesheetEntries, deleteUser, updateUser, absences, holidays, clients, taskMemberAllocations } = useDataController();

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
   const [monthlyHoursMode, setMonthlyHoursMode] = useState<'auto' | 'manual'>('auto');
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

   const scrollRef = React.useRef<HTMLDivElement>(null);

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
            monthlyAvailableHours: user.monthlyAvailableHours || 0
         });
         setMonthlyHoursMode((user.monthlyAvailableHours && user.monthlyAvailableHours > 0) ? 'manual' : 'auto');
      }

      // Restauração de Scroll
      if (scrollRef.current) {
         const savedScroll = sessionStorage.getItem(`teamMember_scroll_${userId}_${activeTab}`);
         if (savedScroll) {
            const timer = setTimeout(() => {
               if (scrollRef.current) scrollRef.current.scrollTop = parseInt(savedScroll, 10);
            }, 100);
            return () => clearTimeout(timer);
         }
      }

      return () => {
         document.title = 'Sistema de Gestão';
      };
   }, [user, userId, activeTab]);

   const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      sessionStorage.setItem(`teamMember_scroll_${userId}_${activeTab}`, e.currentTarget.scrollTop.toString());
   };

   const capacityStats = useMemo(() => {
      const currentMonth = capacityMonth;
      const bizDays = CapacityUtils.getWorkingDaysInMonth(currentMonth, holidays || []);
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
      const dailyMeta = Number(String(formData.dailyAvailableHours).replace(',', '.')) || 0;
      const calculatedTotal = dailyMeta * totalWorkingDays;

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
      const calculatedResidual = dailyMeta * finalResidualDays;

      return { totalWorkingDays, calculatedTotal, finalResidualDays, calculatedResidual, isCurrentMonth };
   }, [capacityMonth, holidays, absences, userId, formData.dailyAvailableHours]);

   const capData = useMemo(() => {
      if (!user) return null;
      // Usar valores do formulário para feedback em tempo real no dashboard superior
      const simulatedUser = {
         ...user,
         dailyAvailableHours: Number(String(formData.dailyAvailableHours).replace(',', '.')) || 0,
         monthlyAvailableHours: monthlyHoursMode === 'auto' ? 0 : Number(String(formData.monthlyAvailableHours).replace(',', '.'))
      };
      return CapacityUtils.getUserMonthlyAvailability(simulatedUser, capacityMonth, projects, projectMembers, timesheetEntries, tasks, holidays, taskMemberAllocations, absences);
   }, [user, capacityMonth, projects, projectMembers, timesheetEntries, tasks, holidays, formData.dailyAvailableHours, formData.monthlyAvailableHours, monthlyHoursMode]);

   const releaseDate = useMemo(() => {
      if (!user) return null;
      const simulatedUser = {
         ...user,
         dailyAvailableHours: Number(String(formData.dailyAvailableHours).replace(',', '.')) || 0
      };
      return CapacityUtils.calculateIndividualReleaseDate(simulatedUser, projects, projectMembers, timesheetEntries, tasks, holidays, taskMemberAllocations, absences);
   }, [user, projects, projectMembers, timesheetEntries, tasks, holidays, formData.dailyAvailableHours]);

   const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name || !formData.email) {
         alert('Por favor, preencha nome e email.');
         return;
      }
      setLoading(true);
      const payload = {
         name: formData.name,
         email: formData.email,
         cargo: formData.cargo,
         nivel: formData.nivel,
         role: formData.role,
         active: formData.active,
         avatarUrl: formData.avatarUrl,
         torre: formData.torre,
         hourlyCost: Number(String(formData.hourlyCost).replace(',', '.')),
         dailyAvailableHours: Number(String(formData.dailyAvailableHours).replace(',', '.')),
         monthlyAvailableHours: monthlyHoursMode === 'auto' ? 0 : Number(String(formData.monthlyAvailableHours).replace(',', '.'))
      };
      console.log('[TeamMemberDetail] Enviando payload:', payload);

      try {
         await updateUser(userId!, payload);

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

         if (!isResponsible && !isCollaborator) return false;

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

         if (!isResponsible && !isCollaborator) return false;

         // Identificar apontamentos desta tarefa para o colaborador atual na vida toda
         const taskTimesheets = timesheetEntries.filter(e => String(e.taskId) === String(t.id) && String(e.userId) === String(user.id));
         const totalReportedOnTask = taskTimesheets.reduce((sum, e) => sum + (Number(e.totalHours) || 0), 0);

         if (totalReportedOnTask > 0) {
            // Regra: Se a tarefa teve algum apontamento na vida, 
            // ela só aparece no mês caso tenha tido apontamento > 0 no MÊS SELECIONADO.
            const reportedInMonth = taskTimesheets
               .filter(e => e.date.startsWith(capacityMonth))
               .reduce((sum, e) => sum + (Number(e.totalHours) || 0), 0);

            return reportedInMonth > 0;
         } else {
            // Regra Fallback: Se NUNCA teve nenhum apontamento, 
            // ela cai no mês em que o usuário preencheu a entrega programada ou real (preferencia real do front)
            const startDate = `${capacityMonth}-01`;
            const [year, month] = capacityMonth.split('-').map(Number);
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${capacityMonth}-${String(lastDay).padStart(2, '0')}`;

            const p = projects.find(proj => proj.id === t.projectId);
            const deliveryDate = t.actualDelivery || t.estimatedDelivery || p?.estimatedDelivery || endDate; // Fallback para manter consistencia

            return deliveryDate >= startDate && deliveryDate <= endDate;
         }
      })
      .sort((a, b) => {
         const dateA = a.actualDelivery ? new Date(a.actualDelivery).getTime() : 0;
         const dateB = b.actualDelivery ? new Date(b.actualDelivery).getTime() : 0;
         return dateB - dateA;
      });

   return (
      <div
         ref={scrollRef}
         onScroll={handleScroll}
         className="h-full flex flex-col p-0 overflow-y-auto custom-scrollbar"
         style={{ backgroundColor: 'var(--bg)' }}
      >
         {/* CABEÇALHO SUPERIOR - COM PROFUNDIDADE */}
         <div className="px-8 py-3.5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface)] sticky top-0 z-20 shadow-sm">
            <div className="flex items-center gap-4">
               <button
                  type="button"
                  onClick={() => {
                     if (window.history.length > 1) {
                        navigate(-1);
                     } else {
                        navigate('/admin/team');
                     }
                  }}
                  className="p-1.5 hover:bg-[var(--surface-2)] rounded-lg transition-colors text-[var(--muted)]"
               >
                  <ArrowLeft className="w-5 h-5" />
               </button>
               <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)] border border-[var(--border)] shadow-sm overflow-hidden flex items-center justify-center text-sm font-black text-[var(--primary)]">
                  {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" /> : user.name.substring(0, 2).toUpperCase()}
               </div>
               <div>
                  <h1 className="text-base font-black text-[var(--text)] tracking-tight leading-tight">{user.name}</h1>
                  <div className="flex items-center gap-2 mt-0.5">
                     <span className="text-[9px] font-black uppercase tracking-tight px-2 py-0.5 rounded-lg bg-[var(--primary)] text-white shadow-sm">{user.role.toUpperCase().replace(/_/g, ' ')}</span>
                     <span className="text-[11px] font-bold text-[var(--text-2)]">{getRoleDisplayName(user.role)}</span>
                  </div>
               </div>
            </div>

            <div className="flex items-center gap-3">
               {activeTab === 'details' && (
                  <button
                     type="button"
                     onClick={() => setIsEditing(!isEditing)}
                     className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${isEditing ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-[var(--primary)] text-white hover:opacity-90'}`}
                  >
                     {isEditing ? 'Cancelar Edição' : 'Editar Perfil'}
                  </button>
               )}
            </div>
         </div>

         <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto custom-scrollbar"
         >
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
                              <div className="flex items-center gap-4 p-2 rounded-2xl border border-[var(--border)]" style={{ backgroundColor: 'var(--surface-2)' }}>
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
                                 <div className="p-5 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-sm">
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
                                    <div className="w-full h-1.5 bg-[var(--surface-3)] rounded-full mt-3 overflow-hidden">
                                       <div
                                          className={`h-full transition-all duration-1000 ${capData.status === 'Sobrecarregado' ? 'bg-red-500' : capData.status === 'Alto' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                          style={{ width: `${Math.min(100, capData.occupancyRate)}%` }}
                                       />
                                    </div>
                                 </div>

                                 {/* Planejado Card */}
                                 <div
                                    onClick={() => setShowBreakdown('planned')}
                                    className="p-5 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-sm cursor-pointer hover:border-[var(--primary)] hover:scale-[1.02] transition-all group/card"
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
                                    className="p-5 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-sm cursor-pointer hover:border-amber-400 hover:scale-[1.02] transition-all group/card"
                                 >
                                    <div className="flex items-center justify-between mb-1.5">
                                       <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest opacity-60">Reserva Técnica</p>
                                       <div className="flex items-center gap-2">
                                          <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity">Ver Detalhes</span>
                                          <InfoTooltip title="Prioridade 2" content="Horas alocadas para Projetos de Sustentação ou Reserva Estratégica (50% da capacidade se não houver planejado)." />
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
                                 <div className="p-5 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-sm">
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
                                    className="p-5 rounded-3xl bg-[var(--surface-elevated)] border border-[var(--border)] shadow-xl cursor-pointer hover:scale-[1.02] transition-all group relative overflow-hidden"
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
                                          <p className={`text-xl font-black font-mono transition-all`} style={{ color: releaseDate?.isSaturated ? 'var(--danger)' : releaseDate?.realistic ? 'var(--primary)' : 'var(--text-3)' }}>
                                             {releaseDate?.realistic || 'N/A'}
                                          </p>
                                          {releaseDate?.isSaturated && (
                                             <span className="text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse" style={{ backgroundColor: 'var(--danger)', color: 'white' }}>SOBRECARGA</span>
                                          )}
                                       </div>
                                       <div className="flex items-center gap-2 mt-1">
                                          <span className={`text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-tighter`} style={{ backgroundColor: releaseDate?.isSaturated ? 'var(--danger-bg)' : 'var(--primary-soft)', color: releaseDate?.isSaturated ? 'var(--danger)' : 'var(--primary)' }}>Realista</span>
                                          {releaseDate && releaseDate.ideal !== releaseDate.realistic && (
                                             <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                                                Ideal: <span className="text-[var(--text-3)]">{releaseDate.ideal}</span>
                                             </span>
                                          )}
                                       </div>
                                    </div>

                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-all" />
                                 </div>
                              </div>
                           )}

                           <div className="mt-10 pt-8 border-t border-[var(--border)]">
                              <div className="flex items-center justify-between mb-6">
                                 <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Mapa de Alocação Diária</h4>
                                    <p className="text-[9px] font-bold text-[var(--muted)] opacity-50 uppercase mt-0.5">Frequência e Ocupação Mensal</p>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5" title="Horas dedicadas a projetos com prazos definidos">
                                       <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: 'var(--status-occupied)' }}></div>
                                       <span className="text-[9px] font-black uppercase text-[var(--muted)]">Ocupado</span>
                                    </div>

                                    <div className="flex items-center gap-1.5" title="Horas disponíveis livre de alocações">
                                       <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: 'var(--status-free)' }}></div>
                                       <span className="text-[9px] font-black uppercase text-[var(--muted)]">Livre</span>
                                    </div>
                                    <div className="flex items-center gap-1.5" title="Dias de ausência">
                                       <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: 'var(--status-absent)' }}></div>
                                       <span className="text-[9px] font-black uppercase text-[var(--muted)]">Ausência</span>
                                    </div>
                                 </div>
                              </div>

                              <div className="flex flex-wrap gap-2 pb-2">
                                 {(() => {
                                    const startDate = `${capacityMonth}-01`;
                                    const [year, month] = capacityMonth.split('-').map(Number);
                                    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

                                    const daily = CapacityUtils.simulateUserDailyAllocation(
                                       user.id, startDate, endDate, projects, tasks, projectMembers, timesheetEntries, holidays || [], Number(String(formData.dailyAvailableHours).replace(',', '.')) || 8, absences
                                    );

                                    return daily.map(day => {
                                       const total = day.plannedHours;
                                       const isOverloaded = total > day.capacity;

                                       return (
                                          <div key={day.date} className="group relative">
                                             <div
                                                className={`w-10 h-10 rounded-xl border flex flex-col items-center justify-center transition-all cursor-default overflow-hidden ${isOverloaded ? 'ring-2 ring-red-500/20' : ''}`}
                                                style={{
                                                   backgroundColor: day.isAbsent ? 'var(--status-absent-bg)' : 'var(--bg)',
                                                   borderColor: isOverloaded ? 'var(--danger)' : (day.isAbsent ? 'var(--status-absent)' : 'var(--border)')
                                                }}
                                             >
                                                {/* Heatmap Bars */}
                                                {!day.isAbsent && (
                                                   <div className="w-full h-full flex flex-col">
                                                      <div style={{ height: `${(day.plannedHours / Math.max(1, day.capacity)) * 100}%`, flex: 'none', backgroundColor: 'var(--status-occupied)' }} />

                                                      <div style={{ height: `${(day.bufferHours / Math.max(1, day.capacity)) * 100}%`, flex: 'none', backgroundColor: 'var(--status-free-bg)' }} />
                                                   </div>
                                                )}

                                                {day.isAbsent && (
                                                   <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: 'var(--status-absent-bg)' }}>
                                                      <AlertCircle size={14} style={{ color: 'var(--status-absent)', opacity: 0.4 }} />
                                                   </div>
                                                )}

                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                   <span className="text-[10px] font-black tabular-nums group-hover:hidden" style={{ color: isOverloaded ? 'var(--danger)' : (day.isAbsent ? 'var(--status-absent)' : 'var(--text)') }}>
                                                      {day.date.split('-')[2]}
                                                   </span>
                                                   <span className="text-[7px] font-black hidden group-hover:block uppercase" style={{ color: isOverloaded ? 'var(--danger)' : (day.isAbsent ? 'var(--status-absent)' : 'var(--text)') }}>
                                                      {day.isAbsent ? day.absenceType || 'AUS' : `${total}h`}
                                                   </span>
                                                </div>
                                             </div>

                                             {/* Tooltip Detalhado */}
                                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-3 bg-slate-950 text-white rounded-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 shadow-2xl scale-90 group-hover:scale-100">
                                                <p className="text-[9px] font-black text-center mb-2 border-b border-white/10 pb-1">
                                                   {new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()}
                                                </p>
                                                <div className="space-y-1.5">
                                                   {day.isAbsent ? (
                                                      <div className="text-[9px] font-black text-orange-400 uppercase text-center py-1">
                                                         {day.absenceType || 'AUSÊNCIA'}
                                                      </div>
                                                   ) : (
                                                      <>
                                                         <div className="flex justify-between items-center text-[8px] font-bold">
                                                            <span style={{ color: 'var(--status-occupied)' }}>OCUPADO:</span>
                                                            <span>{day.plannedHours}h</span>
                                                         </div>

                                                         <div className="flex justify-between items-center text-[8px] font-bold border-t border-white/5 pt-1.5 mt-1.5">
                                                            <span style={{ color: 'var(--status-free)' }}>LIVRE:</span>
                                                            <span>{day.bufferHours}h</span>
                                                         </div>
                                                         <div className={`flex justify-between items-center text-[9px] font-black pt-1 ${isOverloaded ? 'text-[var(--danger)]' : 'text-white'}`}>
                                                            <span>CARGA TOTAL:</span>
                                                            <span>{total}h</span>
                                                         </div>
                                                      </>
                                                   )}
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
                                       <div className="flex items-center justify-between">
                                          <label className="block text-[10px] font-black text-[var(--muted)] uppercase">Hrs Meta Mês</label>
                                          {isEditing && (
                                             <button
                                                type="button"
                                                onClick={() => {
                                                   const newMode = monthlyHoursMode === 'auto' ? 'manual' : 'auto';
                                                   setMonthlyHoursMode(newMode);
                                                   if (newMode === 'manual') {
                                                      setFormData(prev => ({
                                                         ...prev,
                                                         monthlyAvailableHours: String(capacityStats.calculatedTotal).replace('.', ',')
                                                      }));
                                                   }
                                                }}
                                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${monthlyHoursMode === 'auto'
                                                   ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                                                   : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                   }`}
                                             >
                                                {monthlyHoursMode === 'auto' ? <Clock className="w-3 h-3" /> : <Edit className="w-3 h-3" />}
                                                {monthlyHoursMode === 'auto' ? 'Automático' : 'Manual'}
                                             </button>
                                          )}
                                       </div>
                                       <div className="space-y-1">
                                          <div className={`w-full px-4 py-3 border border-[var(--border)] rounded-xl text-sm text-[var(--text)] font-black flex justify-between items-center transition-all ${isEditing ? 'bg-[var(--surface-2)] focus-within:ring-2 focus-within:ring-[var(--primary)]/20' : 'bg-transparent border-transparent px-0'}`}>
                                             <input
                                                type="text"
                                                value={monthlyHoursMode === 'auto'
                                                   ? formatDecimalToTime(capacityStats.calculatedTotal).replace(':', '.')
                                                   : (formData.monthlyAvailableHours ?? '')}
                                                onChange={(e) => handleNumberChange('monthlyAvailableHours', e.target.value)}
                                                disabled={!isEditing || monthlyHoursMode === 'auto'}
                                                className="w-24 bg-transparent border-none outline-none font-black p-0 focus:ring-0 disabled:text-[var(--text)]"
                                             />
                                             {capacityStats.isCurrentMonth && (
                                                <span className="text-[10px] bg-purple-500/10 text-purple-600 px-2 py-1 rounded-lg font-black uppercase tracking-tight">
                                                   RESTAM: {formatDecimalToTime(capacityStats.calculatedResidual)}
                                                </span>
                                             )}
                                          </div>
                                          <p className="text-[8px] font-bold uppercase opacity-40 mt-1">
                                             REF: {new Date(capacityMonth + '-02').toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()} |
                                             TOTAL: {capacityStats.totalWorkingDays} DIAS | {capacityStats.isCurrentMonth ? `SALDO: ${capacityStats.finalResidualDays} DIAS ÚTEIS` : ''}
                                          </p>
                                       </div>
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
                           let baseAllocated = 0;
                           if (alloc && alloc.reservedHours > 0) {
                              baseAllocated = alloc.reservedHours;
                           } else {
                              const hasAnyAllocationInTask = taskMemberAllocations.some(a => String(a.taskId) === String(t.id) && a.reservedHours > 0);
                              if (!hasAnyAllocationInTask) {
                                 baseAllocated = (Number(t.estimatedHours) || 0) / (teamIds.length || 1);
                              }
                           }

                           const reportedOnTask = timesheetEntries.reduce((sum, entry) => {
                              if (String(entry.taskId) === String(t.id) && String(entry.userId) === String(user.id)) {
                                 return sum + (Number(entry.totalHours) || 0);
                              }
                              return sum;
                           }, 0);

                           let totalEffort = baseAllocated;
                           if (t.status === 'Done') {
                              totalEffort = reportedOnTask;
                           } else if (reportedOnTask > baseAllocated) {
                              totalEffort = reportedOnTask;
                           }

                           // --- CÁLCULO MENSAL NO MÊS SELECIONADO ---
                           const startDate = `${capacityMonth}-01`;
                           const todayStr = new Date().toISOString().split('T')[0];
                           const [year, month] = capacityMonth.split('-').map(Number);
                           const lastDay = new Date(year, month, 0).getDate();
                           const endDate = `${capacityMonth}-${String(lastDay).padStart(2, '0')}`;
                           const p = projects.find(proj => proj.id === t.projectId);
                           const nominalEnd = t.actualDelivery || t.estimatedDelivery || p?.estimatedDelivery || endDate;
                           const effectiveEnd = (t.status !== 'Done' && nominalEnd < todayStr && nominalEnd >= startDate)
                              ? todayStr
                              : nominalEnd;
                           const effectiveStart = t.scheduledStart || t.actualStart || p?.startDate || startDate;

                           const userAbsences = absences.filter(a => String(a.userId) === String(user.id) && a.status === 'aprovada_gestao');
                           const totalTaskDays = CapacityUtils.getWorkingDaysInRange(effectiveStart, effectiveEnd, holidays, userAbsences) || 1;
                           const hoursPerDay = totalEffort / totalTaskDays;

                           const intStart = effectiveStart > startDate ? effectiveStart : startDate;
                           const intEnd = effectiveEnd < endDate ? effectiveEnd : endDate;

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

                           let monthlyAllocatedHours = 0;
                           if (t.status === 'Done') {
                              if (reportedHours > 0) {
                                 monthlyAllocatedHours = monthlyReportedHours;
                              } else {
                                 const deliveryDate = t.actualDelivery || t.estimatedDelivery || p?.estimatedDelivery || endDate;
                                 if (deliveryDate >= startDate && deliveryDate <= endDate) {
                                    monthlyAllocatedHours = totalEffort;
                                 }
                              }
                           } else if (intStart <= intEnd && intStart <= endDate && intEnd >= startDate) {
                              const bizDaysInMonth = CapacityUtils.getWorkingDaysInRange(intStart, intEnd, holidays, userAbsences);
                              monthlyAllocatedHours = bizDaysInMonth * hoursPerDay;
                           }

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
                                 className="relative cursor-pointer border p-4 rounded-[16px] mb-3 flex gap-5 items-center group transition-all"
                                 style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
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
                                          <h4 className="font-black text-[15px] tracking-tight truncate max-w-lg" style={{ color: 'var(--text)' }}>
                                             {t.title}
                                          </h4>
                                          <div className="flex items-center gap-2">
                                             <div className="px-4 py-1.5 rounded-xl flex gap-4 items-center border shadow-inner" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }} title="Horas e Apontamentos do Mês Selecionado">
                                                <div className="flex flex-col items-start leading-tight">
                                                   <span className="text-[7px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Alocado (Mês)</span>
                                                   <span className="text-[12px] font-black text-purple-500 font-mono">{formatDecimalToTime(monthlyAllocatedHours)}h</span>
                                                </div>
                                                <div className="w-[1px] h-6" style={{ backgroundColor: 'var(--border)' }} />
                                                <div className="flex flex-col items-start leading-tight">
                                                   <span className="text-[7px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Apontado</span>
                                                   <span className="text-[12px] font-black text-blue-400 font-mono">{formatDecimalToTime(monthlyReportedHours)}h</span>
                                                </div>
                                             </div>
                                          </div>
                                       </div>
                                       <span className="font-black text-[13px] font-mono text-purple-500" style={{ color: 'var(--primary)' }}>{t.progress}%</span>
                                    </div>

                                    {/* STATUS BADGE */}
                                    <div className="mb-4">
                                       <span className="bg-blue-600 text-[10px] font-black text-white px-3 py-1 rounded-md uppercase tracking-widest shadow-lg shadow-blue-500/20">
                                          {getStatusDisplayName(t.status)}
                                       </span>
                                    </div>

                                    {/* INFO ROW: PERIODO | RESPONSÁVEL | EQUIPE */}
                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-bold uppercase tracking-tighter mb-4" style={{ color: 'var(--text-muted)' }}>
                                       <div className="flex items-center gap-2">
                                          <Calendar className="w-3.5 h-3.5 opacity-30" />
                                          <span>PERÍODO: <span style={{ color: 'var(--text)' }}>{formatDateBR(t.scheduledStart || t.actualStart)} - {formatDateBR(t.estimatedDelivery)}</span></span>
                                       </div>
                                       <div className="flex items-center gap-2">
                                          <UserIcon className="w-3.5 h-3.5 opacity-30" />
                                          <span>RESPONSÁVEL: <span style={{ color: 'var(--text)' }}>{responsible?.name?.toUpperCase()}</span></span>
                                       </div>
                                       <div className="h-3 w-[1px] hidden xl:block" style={{ backgroundColor: 'var(--border)' }} />
                                       <div className="flex items-center gap-1 min-w-0">
                                          <span>EQUIPE: <span className="truncate" style={{ color: 'var(--text)' }}>{teamNames}</span></span>
                                       </div>
                                    </div>

                                    {/* FOOTER: AVATARES + ALERTA + PROGRESS BAR */}
                                    <div className="flex items-center justify-between">
                                       <div className="flex items-center gap-4">
                                          <div className="flex -space-x-2.5">
                                             {teamIds.slice(0, 8).map(id => {
                                                const collabo = users.find(u => String(u.id) === String(id));
                                                return (
                                                   <div key={id} className="w-7 h-7 rounded-full border-2 overflow-hidden shadow-xl" style={{ borderColor: 'var(--surface)', backgroundColor: 'var(--surface-2)' }}>
                                                      {collabo?.avatarUrl ? <img src={collabo.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[7px] font-black uppercase" style={{ color: 'var(--text-muted)' }}>{collabo?.name?.substring(0, 1)}</div>}
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

                                       <div className="w-64 h-1.5 rounded-full overflow-hidden border transition-all" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
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
                                          <div className="bg-red-500/5 px-4 py-1.5 rounded-xl flex gap-4 items-center border border-red-500/20">
                                             <div className="flex flex-col items-start leading-tight">
                                                <span className="text-[7px] font-black text-red-500/50 uppercase tracking-widest">Alocado (Total)</span>
                                                <span className="text-[12px] font-black text-red-400 font-mono">{formatDecimalToTime(allocatedHours)}h</span>
                                             </div>
                                             <div className="w-[1px] h-6 bg-red-500/10" />
                                             <div className="flex flex-col items-start leading-tight">
                                                <span className="text-[7px] font-black text-red-500/50 uppercase tracking-widest">Apontado</span>
                                                <span className="text-[12px] font-black text-red-600 font-mono">{formatDecimalToTime(reportedHours)}h</span>
                                             </div>
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

                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-bold uppercase tracking-tighter mb-4" style={{ color: 'var(--text-muted)' }}>
                                       <div className="flex items-center gap-2">
                                          <Calendar className="w-3.5 h-3.5 opacity-30" />
                                          <span>PRAZO VENCIDO: <span className="text-red-400">{formatDateBR(t.estimatedDelivery)}</span></span>
                                       </div>
                                       <div className="flex items-center gap-2">
                                          <UserIcon className="w-3.5 h-3.5 opacity-30" />
                                          <span>RESPONSÁVEL: <span style={{ color: 'var(--text)' }}>{responsible?.name?.toUpperCase()}</span></span>
                                       </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                       <div className="flex -space-x-2.5">
                                          {teamIds.slice(0, 8).map(id => {
                                             const collabo = users.find(u => String(u.id) === String(id));
                                             return (
                                                <div key={id} className="w-7 h-7 rounded-full border-2 overflow-hidden shadow-xl" style={{ borderColor: 'var(--surface)', backgroundColor: 'var(--surface-2)' }}>
                                                   {collabo?.avatarUrl ? <img src={collabo.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[7px] font-black uppercase" style={{ color: 'var(--text-muted)' }}>{collabo?.name?.substring(0, 1)}</div>}
                                                </div>
                                             );
                                          })}
                                       </div>

                                       <div className="w-64 h-1.5 rounded-full overflow-hidden border" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
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
                        const teamIds = Array.from(new Set([t.developerId, ...(t.collaboratorIds || [])])).filter(Boolean);
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

                        const reportedOnTask = timesheetEntries.reduce((sum, entry) => {
                           if (String(entry.taskId) === String(t.id) && String(entry.userId) === String(user.id)) {
                              return sum + (Number(entry.totalHours) || 0);
                           }
                           return sum;
                        }, 0);

                        let totalEffort = allocatedHours;
                        if (t.status === 'Done') {
                           totalEffort = reportedOnTask;
                        } else if (reportedOnTask > allocatedHours) {
                           totalEffort = reportedOnTask;
                        }

                        const startDateBoundary = `${capacityMonth}-01`;
                        const [year, month] = capacityMonth.split('-').map(Number);
                        const lastDay = new Date(year, month, 0).getDate();
                        const endDateBoundary = `${capacityMonth}-${String(lastDay).padStart(2, '0')}`;
                        const p = projects.find(proj => proj.id === t.projectId);

                        const effectiveStart = t.scheduledStart || t.actualStart || p?.startDate || startDateBoundary;
                        const effectiveEnd = t.actualDelivery || t.estimatedDelivery || p?.estimatedDelivery || endDateBoundary;

                        const userAbsences = absences.filter(a => String(a.userId) === String(user.id) && a.status === 'aprovada_gestao');
                        const totalTaskDays = CapacityUtils.getWorkingDaysInRange(effectiveStart, effectiveEnd, holidays, userAbsences) || 1;
                        const hoursPerDay = totalEffort / totalTaskDays;

                        const intStart = effectiveStart > startDateBoundary ? effectiveStart : startDateBoundary;
                        const intEnd = effectiveEnd < endDateBoundary ? effectiveEnd : endDateBoundary;

                        const monthlyReportedHours = timesheetEntries.reduce((sum, entry) => {
                           if (String(entry.taskId) === String(t.id) && String(entry.userId) === String(user.id)) {
                              if (entry.date.startsWith(capacityMonth)) {
                                 return sum + (Number(entry.totalHours) || 0);
                              }
                           }
                           return sum;
                        }, 0);

                        const reportedTaskTotal = timesheetEntries.reduce((sum, entry) => {
                           if (String(entry.taskId) === String(t.id) && String(entry.userId) === String(user.id)) {
                              return sum + (Number(entry.totalHours) || 0);
                           }
                           return sum;
                        }, 0);

                        let monthlyAllocatedHours = 0;
                        if (t.status === 'Done') {
                           if (reportedTaskTotal > 0) {
                              monthlyAllocatedHours = monthlyReportedHours;
                           } else {
                              const deliveryDate = t.actualDelivery || t.estimatedDelivery || p?.estimatedDelivery || endDateBoundary;
                              if (deliveryDate >= startDateBoundary && deliveryDate <= endDateBoundary) {
                                 monthlyAllocatedHours = totalEffort;
                              }
                           }
                        } else if (intStart <= intEnd && intStart <= endDateBoundary && intEnd >= startDateBoundary) {
                           const bizDaysInMonth = CapacityUtils.getWorkingDaysInRange(intStart, intEnd, holidays, userAbsences);
                           monthlyAllocatedHours = bizDaysInMonth * hoursPerDay;
                        }
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
                                    <h4 className="font-black text-emerald-700 dark:text-emerald-400 text-[13px] truncate uppercase tracking-tight mb-1 group-hover:text-emerald-500 transition-colors">
                                       {t.title}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                       <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                          <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                          <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Entregue: {formatDateBR(t.actualDelivery || t.estimatedDelivery)}</span>
                                       </div>
                                       <span className="text-[7px] font-bold text-emerald-400/50 uppercase tracking-widest">ID: #{t.id}</span>
                                    </div>
                                 </div>
                              </div>
                              <div className="flex items-center gap-3 pr-2">
                                 <div className="bg-emerald-500/5 px-3 py-1.5 rounded-xl flex gap-3 items-center border border-emerald-500/10">
                                    <div className="flex flex-col items-start leading-tight border-r border-emerald-500/10 pr-3">
                                       <span className="text-[7px] font-black text-emerald-600/50 uppercase tracking-widest opacity-60">Alocado (Mês)</span>
                                       <span className="text-[10px] font-black text-emerald-600 font-mono">{formatDecimalToTime(monthlyAllocatedHours)}h</span>
                                    </div>
                                    <div className="flex flex-col items-start leading-tight">
                                       <span className="text-[7px] font-black text-emerald-600/50 uppercase tracking-widest opacity-60">Apontado</span>
                                       <span className="text-[10px] font-black text-emerald-500 font-mono">{formatDecimalToTime(monthlyReportedHours)}h</span>
                                    </div>
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
                           <p className="font-black text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>Nenhuma Tarefa Concluída</p>
                           <p className="text-[10px] font-bold mt-1.5 italic" style={{ color: 'var(--text-muted)' }}>Ainda não há tarefas finalizadas.</p>
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
         {
            showBreakdown && capData && (
               <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: 'var(--overlay)' }}>
                  <motion.div
                     initial={{ opacity: 0, scale: 0.9, y: 20 }}
                     animate={{ opacity: 1, scale: 1, y: 0 }}
                     className="rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden border"
                     style={{ backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--border)' }}
                  >
                     <div className={`p-8 ${showBreakdown === 'planned' ? 'bg-blue-600' : 'bg-amber-500'} text-white`}>
                        <div className="flex items-center justify-between">
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Distribuição de Carga</p>
                              <h3 className="text-2xl font-black">{showBreakdown === 'planned' ? 'Projetos Planejados' : 'Atividades de Reserva'}</h3>
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

                     <div className="p-8 max-h-[60vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface)' }}>
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

                     <div className="p-8 border-t border-[var(--border)] flex justify-end" style={{ backgroundColor: 'var(--surface-2)' }}>
                        <button
                           onClick={() => setShowBreakdown(null)}
                           className="px-8 py-3 border border-[var(--border)] text-[var(--text)] rounded-2xl font-black text-xs uppercase transition-all active:scale-95 shadow-sm"
                           style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                           onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                              e.currentTarget.style.borderColor = 'var(--primary)';
                           }}
                           onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--surface)';
                              e.currentTarget.style.borderColor = 'var(--border)';
                           }}
                        >
                           Fechar
                        </button>
                     </div>
                  </motion.div>
               </div>
            )
         }
      </div >
   );
};

export default TeamMemberDetail;
