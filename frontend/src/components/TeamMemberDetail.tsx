// components/TeamMemberDetail.tsx - Reestruturado: Resumo Topo + Edição Principal
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useDataController } from '../controllers/useDataController';
import { Project, Task, Role, TimesheetEntry, ProjectMember, Client, User, TaskMemberAllocation, Absence } from '../types';
import { User as UserIcon, Mail, Briefcase, Shield, Edit, Save, Trash2, ArrowLeft, CheckCircle, Clock, AlertCircle, Calendar, Zap, Info, LayoutGrid, ChevronRight, ChevronLeft, Target, MapPin } from 'lucide-react';
import OrganizationalStructureSelector from './OrganizationalStructureSelector';
import ConfirmationModal from './ConfirmationModal';
import { getRoleDisplayName, formatDecimalToTime, getStatusDisplayName, formatDateBR, parseTimeToDecimal } from '../utils/normalizers';

import TimesheetCalendar from './TimesheetCalendar';
import AbsenceManager from './AbsenceManager';
import * as CapacityUtils from '../utils/capacity';
import WorkingDaysModal from './WorkingDaysModal';
import { WorkingDayDetail } from '../utils/capacity';

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
      const monthParam = searchParams.get('month');
      if (monthParam) return monthParam;
      const now = new Date();
      return now.toISOString().slice(0, 7); // YYYY-MM
   });

   const changeMonth = (delta: number) => {
      const [year, month] = capacityMonth.split('-').map(Number);
      const newDate = new Date(year, month - 1 + delta, 1);
      const newMonthStr = newDate.toISOString().slice(0, 7);
      setCapacityMonth(newMonthStr);
      const newParams = new URLSearchParams(searchParams);
      newParams.set('month', newMonthStr);
      navigate(`?${newParams.toString()}`, { replace: true });
   };

   const setToday = () => {
      const now = new Date().toISOString().slice(0, 7);
      setCapacityMonth(now);
      const newParams = new URLSearchParams(searchParams);
      newParams.set('month', now);
      navigate(`?${newParams.toString()}`, { replace: true });
   };

   // Get initial tab from URL query parameter, default to 'details'
   const initialTab = (searchParams.get('tab') as ViewTab) || 'details';
   const [activeTab, setActiveTab] = useState<ViewTab>(initialTab);
   const [deleteModalOpen, setDeleteModalOpen] = useState(false);
   const [showBreakdown, setShowBreakdown] = useState<boolean>(false);

   const user = users.find((u: User) => u.id === userId);
   const currentUserEmail = localStorage.getItem('userEmail');
   const isMe = user?.email === currentUserEmail;

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
      hourlyCost: '0',
      dailyAvailableHours: '8',
      monthlyAvailableHours: '0'
   });

   const [workingDaysModal, setWorkingDaysModal] = useState<{
      isOpen: boolean;
      title: string;
      details: WorkingDayDetail[];
   }>({
      isOpen: false,
      title: '',
      details: []
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
         // Não forçamos modo manual por padrão, permitindo o cálculo dinâmico pelo calendário
         setMonthlyHoursMode('auto');
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
      const dailyMeta = Number(String(formData.dailyAvailableHours).replace(',', '.')) || 8;
      const userAbsences = (absences || []).filter((a: any) => String(a.userId) === String(userId));
      const [yearText, monthText] = capacityMonth.split('-');
      const yearNum = Number(yearText);
      const monthNum = Number(monthText);

      const monthStart = `${yearText}-${monthText}-01`;
      const lastDayDate = new Date(yearNum, monthNum, 0);
      const monthEnd = `${yearText}-${monthText}-${String(lastDayDate.getDate()).padStart(2, '0')}`;

      // Cálculo Infalível de Dias Brutos (Seg-Sex)
      let totalGrossWorkingDays = 0;
      const daysInMonth = lastDayDate.getDate();
      for (let i = 1; i <= daysInMonth; i++) {
         const day = new Date(yearNum, monthNum - 1, i).getDay();
         if (day !== 0 && day !== 6) totalGrossWorkingDays++;
      }

      const totalWorkingDays = CapacityUtils.getWorkingDaysInRange(monthStart, monthEnd, holidays || [], userAbsences, dailyMeta);
      const calculatedTotal = dailyMeta * totalWorkingDays;

      const heatmap = CapacityUtils.getWorkingDaysBreakdown(monthStart, monthEnd, holidays || [], userAbsences, dailyMeta);

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const isCurrentMonth = todayStr.startsWith(capacityMonth);
      const residualStart = (isCurrentMonth && todayStr > monthStart) ? todayStr : monthStart;

      const finalResidualDays = CapacityUtils.getWorkingDaysInRange(residualStart, monthEnd, holidays || [], userAbsences, dailyMeta);
      const calculatedResidual = dailyMeta * finalResidualDays;

      return { totalWorkingDays, totalGrossWorkingDays, calculatedTotal, heatmap, monthStart, monthEnd, userAbsences, dailyMeta, isCurrentMonth, residualStart, finalResidualDays, calculatedResidual };
   }, [capacityMonth, holidays, absences, userId, formData.dailyAvailableHours]);

   const openWorkingDaysBreakdown = (type: 'total' | 'residual') => {
      const { monthStart, monthEnd, userAbsences, dailyMeta, heatmap } = capacityStats;
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const isCurrentMonth = todayStr.startsWith(capacityMonth);
      const residualStart = (isCurrentMonth && todayStr > monthStart) ? todayStr : monthStart;

      const start = type === 'total' ? monthStart : residualStart;
      const end = monthEnd;
      const title = type === 'total' ? 'Total do Mês' : 'Saldo do Mês';

      const details = CapacityUtils.getWorkingDaysBreakdown(
         start,
         end,
         holidays || [],
         userAbsences,
         dailyMeta
      );

      setWorkingDaysModal({
         isOpen: true,
         title,
         details
      });
   };

   const capData = useMemo(() => {
      if (!user) return null;
      const simulatedUser = {
         ...user,
         dailyAvailableHours: Number(String(formData.dailyAvailableHours).replace(',', '.')) || 0,
         monthlyAvailableHours: monthlyHoursMode === 'auto' ? 0 : Number(String(formData.monthlyAvailableHours).replace(',', '.'))
      };
      return CapacityUtils.getUserMonthlyAvailability(simulatedUser, capacityMonth, projects, projectMembers, timesheetEntries, tasks, holidays, taskMemberAllocations, absences, users);
   }, [user, users, capacityMonth, projects, projectMembers, timesheetEntries, tasks, holidays, formData.dailyAvailableHours, formData.monthlyAvailableHours, monthlyHoursMode, absences, taskMemberAllocations]);

   const releaseDate = useMemo(() => {
      if (!user) return null;
      const simulatedUser = {
         ...user,
         dailyAvailableHours: Number(String(formData.dailyAvailableHours).replace(',', '.')) || 0
      };
      return CapacityUtils.calculateIndividualReleaseDate(simulatedUser, projects, projectMembers, timesheetEntries, tasks, holidays, taskMemberAllocations, absences, users);
   }, [user, users, projects, projectMembers, timesheetEntries, tasks, holidays, taskMemberAllocations, absences, formData.dailyAvailableHours]);

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
         setLoading(true);
         try {
            await deleteUser(user.id);
            setDeleteModalOpen(false);
            navigate('/admin/team');
         } catch (e: any) {
            console.error('Erro ao excluir colaborador:', e);
            alert('Erro ao excluir colaborador: ' + (e?.message || 'Tente novamente.'));
            setDeleteModalOpen(false);
         } finally {
            setLoading(false);
         }
      }
   };

   if (!user) return <div className="p-4 text-xs font-bold text-slate-500">Colaborador não encontrado.</div>;

   const linkedProjectIds = projectMembers.filter((pm: ProjectMember) => String(pm.id_colaborador) === user.id).map((pm: ProjectMember) => String(pm.id_projeto));
   
   // Filtrar projetos ativos no mês selecionado
   const userProjects = projects.filter((p: Project) => {
      if (!linkedProjectIds.includes(p.id) || p.active === false) return false;
      
      const monStart = `${capacityMonth}-01`;
      const [y, m] = capacityMonth.split('-').map(Number);
      const monEnd = new Date(y, m, 0).toISOString().split('T')[0];

      const pStart = p.startDate || '1900-01-01';
      const pEnd = p.estimatedDelivery || '2999-12-31';

      // Projeto ativo se houver interseção com o mês ou se não estiver concluído
      return (pStart <= monEnd && (pEnd >= monStart || p.status !== 'Done'));
   });

   const userTasks = tasks
      .filter((t: Task) => {
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

         const p = projects.find((proj: Project) => proj.id === t.projectId);
         const effectiveStart = t.scheduledStart || t.actualStart || p?.startDate || startDate;
         const effectiveEnd = t.estimatedDelivery || p?.estimatedDelivery || endDate;

         const intStart = effectiveStart > startDate ? effectiveStart : startDate;
         const intEnd = effectiveEnd < endDate ? effectiveEnd : endDate;

         return (intStart <= intEnd && intStart <= endDate && intEnd >= startDate);
      })
      .sort((a: Task, b: Task) => {
         const dateA = a.estimatedDelivery ? new Date(a.estimatedDelivery).getTime() : 9999999999999;
         const dateB = b.estimatedDelivery ? new Date(b.estimatedDelivery).getTime() : 9999999999999;
         return dateA - dateB;
      });
   const delayedTasks = tasks
      .filter((t: Task) => {
         if (t.status === 'Done' || t.status === 'Review') return false;
         const isResponsible = t.developerId === user.id;
         const isCollaborator = t.collaboratorIds && t.collaboratorIds.includes(user.id);
         if (!isResponsible && !isCollaborator) return false;

         const now = new Date();
         now.setHours(12, 0, 0, 0);
         const delivery = t.estimatedDelivery ? new Date(t.estimatedDelivery + 'T12:00:00') : null;
         return (delivery && now > delivery) || (t.daysOverdue && t.daysOverdue > 0);
      })
      .sort((a: Task, b: Task) => {
         const delayA = a.daysOverdue || 0;
         const delayB = b.daysOverdue || 0;
         return delayB - delayA;
      });

   const completedTasks = tasks
      .filter((t: Task) => {
         const isDone = t.status === 'Done';
         if (!isDone) return false;

         const isResponsible = t.developerId === user.id;
         const isCollaborator = t.collaboratorIds && t.collaboratorIds.includes(user.id);

         if (!isResponsible && !isCollaborator) return false;

         // Identificar apontamentos desta tarefa para o colaborador atual na vida toda
         const taskTimesheets = timesheetEntries.filter((e: TimesheetEntry) => String(e.taskId) === String(t.id) && String(e.userId) === String(user.id));
         const totalReportedOnTask = taskTimesheets.reduce((sum: number, e: TimesheetEntry) => sum + (Number(e.totalHours) || 0), 0);

         if (totalReportedOnTask > 0) {
            // Regra: Se a tarefa teve algum apontamento na vida, 
            // ela só aparece no mês caso tenha tido apontamento > 0 no MÊS SELECIONADO.
            const reportedInMonth = taskTimesheets
               .filter((e: TimesheetEntry) => e.date.startsWith(capacityMonth))
               .reduce((sum: number, e: TimesheetEntry) => sum + (Number(e.totalHours) || 0), 0);

            return reportedInMonth > 0;
         } else {
            // Regra Fallback: Se NUNCA teve nenhum apontamento, 
            // ela cai no mês em que o usuário preencheu a entrega programada ou real (preferencia real do front)
            const startDateText = `${capacityMonth}-01`;
            const [yearT, monthT] = capacityMonth.split('-').map(Number);
            const lastDayT = new Date(yearT, monthT, 0).getDate();
            const endDateText = `${capacityMonth}-${String(lastDayT).padStart(2, '0')}`;

            const proj = projects.find((p: Project) => p.id === t.projectId);
            const deliveryDate = t.actualDelivery || t.estimatedDelivery || proj?.estimatedDelivery || endDateText; // Fallback para manter consistencia

            return deliveryDate >= startDateText && deliveryDate <= endDateText;
         }
      })
      .sort((a: Task, b: Task) => {
         const dateA = a.actualDelivery ? new Date(a.actualDelivery).getTime() : 0;
         const dateB = b.actualDelivery ? new Date(b.actualDelivery).getTime() : 0;
         return dateB - dateA;
      });

   return (
      <div
         className="h-screen flex flex-col p-0 overflow-hidden"
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
               {user && (
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] overflow-hidden shadow-sm ring-2 ring-white/10 shrink-0">
                        {user.avatarUrl ? (
                           <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                           <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white font-black text-lg">
                              {user.name?.charAt(0)}
                           </div>
                        )}
                     </div>
                     <div className="max-w-[300px]">
                        <div className="flex items-center gap-2">
                           <h1 className="text-lg font-black text-[var(--text)] truncate">{user.name}</h1>
                           {user.active ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                           ) : (
                              <span className="text-[8px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-sm uppercase">Off</span>
                           )}
                        </div>
                        <p className="text-[10px] font-black text-[var(--primary)] uppercase tracking-widest truncate">
                           {user.cargo || 'Cargo não definido'}
                        </p>
                        <p className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest truncate opacity-50">
                           {getRoleDisplayName(user.role)}
                        </p>
                     </div>
                  </div>
               )}
            </div>

            <div className="flex items-center gap-3">
               <div className="hidden lg:flex flex-col items-end mr-6 pr-6 border-r border-[var(--border)]">
                  <p className="text-[8px] font-black text-[var(--muted)] uppercase tracking-widest mb-1 opacity-40">Capacidade Operacional</p>
                  <div className="flex items-center gap-2">
                     <div className="h-1.5 w-24 bg-[var(--surface-3)] rounded-full overflow-hidden">
                        <div
                           className={`h-full transition-all duration-1000 ${capData ? (capData.occupancyRate > 100 ? 'bg-red-500' : 'bg-emerald-500') : 'bg-slate-300'}`}
                           style={{ width: `${Math.min(100, capData?.occupancyRate || 0)}%` }}
                        />
                     </div>
                     <span className={`text-xs font-black ${capData ? (capData.occupancyRate > 100 ? 'text-red-500' : 'text-emerald-500') : 'text-slate-400'}`}>
                        {capData?.occupancyRate || 0}%
                     </span>
                  </div>
               </div>
               
               {user && (
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
            {/* SUB-NAVEGAÇÃO - ESTILO BARRA DE FERRAMENTAS INTEGRADA (OTIMIZADA) */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-b border-[var(--border)] sticky top-0 z-10 bg-[var(--bg)]/80 backdrop-blur-xl px-8 py-2 gap-4">
               {/* LADO ESQUERDO: ABAS DE NAVEGAÇÃO */}
               <div className="flex gap-0.5 overflow-x-auto no-scrollbar flex-1 w-full sm:w-auto">
                  {(() => {
                     const navItems = [
                        { id: 'details', label: 'Dashboard', icon: LayoutGrid },
                        { id: 'projects', label: 'Projetos', icon: Zap, count: userProjects.length },
                        { id: 'tasks', label: 'Tarefas', icon: Briefcase, count: userTasks.length },
                        { id: 'completed', label: 'Concluídos', icon: CheckCircle, count: completedTasks.length },
                        { id: 'delayed', label: 'Atrasos', icon: AlertCircle, count: delayedTasks.length },
                        { id: 'ponto', label: 'Presença', icon: Clock },
                        { id: 'absences', label: 'Ausências', icon: Mail }
                     ];
                     return navItems.map(tab => (
                        <button
                           key={tab.id}
                           type="button"
                           onClick={() => setActiveTab(tab.id as ViewTab)}
                           className={`group relative flex items-center gap-2.5 px-5 py-3 rounded-xl transition-all ${activeTab === tab.id
                              ? 'text-[var(--primary)]'
                              : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-soft)]'
                              }`}
                        >
                           <tab.icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${activeTab === tab.id ? 'text-[var(--primary)]' : 'opacity-40'}`} />
                           <span className="text-[11px] font-bold uppercase tracking-widest whitespace-nowrap">{tab.label}</span>
                           {tab.count !== undefined && tab.count > 0 && (
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md min-w-[18px] text-center ${activeTab === tab.id ? 'bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20 shadow-inner ring-1 ring-white/10' : 'bg-[var(--surface-3)] text-[var(--muted)] opacity-50'}`}>
                                 {tab.count}
                              </span>
                           )}
                           {activeTab === tab.id && (
                              <motion.div layoutId="tab-underline" className="absolute bottom-[-8px] left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent rounded-full shadow-[0_0_8px_var(--primary)]" />
                           )}
                        </button>
                     ));
                  })()}
               </div>
            </div>

            {activeTab === 'details' && (
               <div className="p-4 lg:p-6 space-y-4">
                  {/* METRICS - OTIMIZADO PARA SER EXTREMAMENTE COMPACTO */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                     {[
                        { 
                           label: 'Capacidade Total', 
                           value: formatDecimalToTime(capacityStats.calculatedTotal), 
                           sub: `${capacityStats.totalWorkingDays} dias úteis`, 
                           icon: Target, 
                           color: 'var(--primary)',
                           desc: 'Meta calculada no mês',
                           suffix: 'h'
                        },
                        { 
                           label: 'Total Alocado', 
                           value: formatDecimalToTime(capData?.allocated || 0), 
                           sub: `${Math.round(((capData?.allocated || 0) / (capacityStats.calculatedTotal || 1)) * 100)}% de ocupação`, 
                           icon: Zap, 
                           color: (capacityStats.calculatedTotal || 0) - (capData?.allocated || 0) < 0 ? 'var(--danger)' : 'var(--success)',
                           desc: 'Soma total da carteira',
                           alert: (capData?.allocated || 0) > capacityStats.calculatedTotal,
                           suffix: 'h'
                        },
                        { 
                           label: 'Distribuição de Carga', 
                           value: (capData?.breakdown.planned.length || 0) + (capData?.breakdown.continuous.length || 0), 
                           sub: 'Clique para detalhar origem', 
                           icon: Shield, 
                           color: '#8b5cf6',
                           onClick: () => setShowBreakdown(true),
                           desc: 'Ver projetos em carteira',
                           suffix: ' proj.'
                        },
                        { 
                           label: 'Saldo Real Mês', 
                           value: formatDecimalToTime((capacityStats.calculatedTotal || 0) - (capData?.allocated || 0)), 
                           sub: (capacityStats.calculatedTotal || 0) - (capData?.allocated || 0) < 0 ? 'Falta de capacidade' : 'Horas disponíveis livre', 
                           icon: Clock, 
                           color: (capacityStats.calculatedTotal || 0) - (capData?.allocated || 0) < 0 ? 'var(--danger)' : 'var(--success)',
                           desc: 'Balanço alocado vs meta',
                           suffix: 'h'
                        }
                     ].map((card, i) => (
                        <motion.div
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           transition={{ delay: i * 0.05 }}
                           key={card.label}
                           onClick={card.onClick}
                           className={`group relative p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm hover:shadow-md transition-all ${card.onClick ? 'cursor-pointer hover:border-[var(--primary)]' : ''} ${card.alert ? 'ring-2 ring-red-500/20 border-red-500/30' : ''}`}
                        >
                           <div className="flex items-start justify-between mb-1.5">
                              <div className="p-1.5 rounded-lg transition-colors" style={{ backgroundColor: `${card.color}10`, color: card.color }}>
                                 <card.icon className="w-4 h-4" />
                              </div>
                              {card.onClick && (
                                 <div className="bg-[var(--surface-2)] p-0.5 rounded-md opacity-30 group-hover:opacity-100 transition-opacity">
                                    <ChevronRight className="w-2.5 h-2.5 text-[var(--muted)]" />
                                 </div>
                              )}
                           </div>
                           <h4 className="text-[8px] font-black uppercase text-[var(--muted)] tracking-widest mb-0.5">{card.label}</h4>
                           <div className="flex items-baseline gap-1">
                              <span className={`text-lg font-black font-mono tracking-tight ${card.alert ? 'text-red-500' : ''}`} style={{ color: card.alert ? undefined : 'var(--text)' }}>
                                 {card.value}{card.suffix}
                              </span>
                           </div>
                           <p className="text-[8px] font-bold" style={{ color: card.color }}>{card.sub}</p>
                           {card.desc && <p className="text-[7px] text-[var(--muted)] uppercase font-black tracking-widest mt-1 opacity-50">{card.desc}</p>}
                        </motion.div>
                     ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                     {/* CALENDÁRIO DE OCUPAÇÃO - OTIMIZADO 7 COLUNAS */}
                     <div className="lg:col-span-12 xl:col-span-4 bg-[var(--surface)] border border-[var(--border)] rounded-[24px] p-4 shadow-sm overflow-hidden flex flex-col h-full min-h-[400px]">
                        <div className="flex flex-col gap-4 mb-4">
                           <div className="flex items-center justify-between">
                              <h3 className="text-[11px] font-black text-[var(--text)] uppercase tracking-wider flex items-center gap-1.5">
                                 <Calendar className="w-3.5 h-3.5 text-[var(--primary)]" /> Mapa de Alocação
                              </h3>
                              <div className="flex items-center bg-[var(--surface-2)] rounded-lg p-0.5 border border-[var(--border)]">
                                 <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-[var(--surface-3)] rounded-md text-[var(--muted)] hover:text-[var(--text)] transition-all">
                                    <ChevronLeft className="w-3 h-3" />
                                 </button>
                                 <button onClick={() => setToday()} className="px-2 py-0.5 text-[9px] font-black uppercase text-[var(--muted)] hover:text-[var(--primary)] transition-all">
                                    {new Date(capacityMonth + '-01').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')}
                                 </button>
                                 <button onClick={() => changeMonth(1)} className="p-1 hover:bg-[var(--surface-3)] rounded-md text-[var(--muted)] hover:text-[var(--text)] transition-all">
                                    <ChevronRight className="w-3 h-3" />
                                 </button>
                              </div>
                           </div>
                           
                           <div className="flex gap-3 justify-center">
                              <div className="flex items-center gap-1">
                                 <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                 <span className="text-[8px] font-black uppercase text-[var(--muted)]">Livre</span>
                              </div>
                              <div className="flex items-center gap-1">
                                 <div className="w-2 h-2 rounded-full bg-amber-500" />
                                 <span className="text-[8px] font-black uppercase text-[var(--muted)]">Ocupado</span>
                              </div>
                              <div className="flex items-center gap-1">
                                 <div className="w-2 h-2 rounded-full bg-red-500" />
                                 <span className="text-[8px] font-black uppercase text-[var(--muted)]">Ausência</span>
                              </div>
                           </div>
                        </div>

                        {/* GRID DO CALENDÁRIO */}
                        <div className="flex-1 grid grid-cols-7 gap-0.5">
                           {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(day => (
                              <div key={day} className="text-center py-2 text-[9px] font-black text-[var(--muted)] uppercase tracking-widest border-b border-[var(--border)] mb-1">
                                 {day}
                              </div>
                           ))}
                           
                           {(() => {
                              const [year, month] = capacityMonth.split('-').map(Number);
                              const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0 = Domingo
                              const daysInMonth = new Date(year, month, 0).getDate();
                              const monthStart = new Date(year, month - 1, 1);
                              const cells = [];

                              // Empty cells before the first day
                              for (let i = 0; i < firstDayOfMonth; i++) {
                                 cells.push(<div key={`empty-${i}`} className="aspect-square" />);
                              }

                              // Day cells
                              for (let day = 1; day <= daysInMonth; day++) {
                                 const dateStr = `${capacityMonth}-${String(day).padStart(2, '0')}`;
                                 const dayOfWeek = (firstDayOfMonth + day - 1) % 7;
                                 const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                 
                                 const occ = (capData?.dailyOccupancy || []).find((o: any) => o.date === dateStr);
                                 const allocated = occ?.totalOccupancy || 0;
                                 const totalMeta = capacityStats.dailyMeta;
                                 
                                 const isAbsence = capacityStats.userAbsences.some((a: any) => 
                                    dateStr >= (a.startDate || a.start_date) && dateStr <= (a.endDate || a.end_date)
                                 );
                                 
                                 // Determine color based on occupancy
                                 let bgColor = 'var(--surface-2)';
                                 let textColor = 'var(--text-muted)';
                                 let borderColor = 'var(--border)';
                                 let glow = '';

                                 if (isAbsence) {
                                    bgColor = 'rgba(239, 68, 68, 0.1)';
                                    textColor = '#ef4444';
                                    borderColor = 'rgba(239, 68, 68, 0.3)';
                                    glow = '0 0 10px rgba(239,68,68,0.1)';
                                 } else if (!isWeekend) {
                                    if (allocated > 0) {
                                       bgColor = 'rgba(245, 158, 11, 0.1)';
                                       textColor = '#f59e0b';
                                       borderColor = 'rgba(245, 158, 11, 0.3)';
                                    } else {
                                       bgColor = 'rgba(16, 185, 129, 0.05)';
                                       textColor = '#10b981';
                                       borderColor = 'rgba(16, 185, 129, 0.2)';
                                    }
                                 }

                                 cells.push(
                                    <div 
                                       key={day} 
                                       title={`${dateStr}: ${formatDecimalToTime(allocated)}h / ${formatDecimalToTime(totalMeta)}h`}
                                       className={`aspect-square flex flex-col items-center justify-center rounded-lg border transition-all text-xs font-black font-mono relative group ${isWeekend ? 'opacity-30 grayscale-[0.5]' : ''}`}
                                       style={{ backgroundColor: bgColor, color: textColor, borderColor: borderColor, boxShadow: glow }}
                                    >
                                       <span className="z-10">{day}</span>
                                       {!isWeekend && !isAbsence && allocated > 0 && (
                                          <div className="absolute bottom-1 w-1 h-1 rounded-full" style={{ backgroundColor: textColor }} />
                                       )}
                                       {/* TOOLTIP COMPACTO AO PASSAR O MOUSE */}
                                       <div className="absolute inset-0 bg-black/80 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 pointer-events-none">
                                          <span className="text-white text-[8px] font-black">{formatDecimalToTime(allocated)}h</span>
                                       </div>
                                    </div>
                                 );
                              }
                              return cells;
                           })()}
                        </div>
                        
                        <div className="mt-4 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                           <p className="text-[9px] font-bold text-[var(--muted)] uppercase leading-relaxed italic">
                             Sistema baseado em dias úteis, descontando feriados e ausências.
                           </p>
                        </div>
                     </div>

                     {/* FORMULÁRIO DE CADASTRO - COMPACTO E FUNCIONAL */}
                     <div className="lg:col-span-12 xl:col-span-8 bg-[var(--surface)] border border-[var(--border)] rounded-[24px] p-5 shadow-sm">
                        <form onSubmit={handleSave} className="space-y-4">
                           <fieldset className="space-y-4" disabled={loading}>
                              {/* IDENTIFICAÇÃO BÁSICA */}
                              <div className="space-y-4">
                                 <h4 className="text-[10px] font-black uppercase text-[var(--text)] tracking-widest flex items-center gap-1.5">
                                    <UserIcon className="w-3.5 h-3.5 text-[var(--primary)]" /> Registro de Identificação
                                 </h4>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                       <label className="block text-[9px] font-black text-[var(--muted)] uppercase">Nome Completo</label>
                                       <input
                                          type="text"
                                          value={formData.name || ''}
                                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                          className={`w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text)] font-bold outline-none transition-all ${isEditing ? 'bg-[var(--surface-2)] focus:ring-2 focus:ring-[var(--primary)]/20 shadow-inner' : 'bg-transparent border-transparent px-0 disabled:text-[var(--text)]'}`}
                                          disabled={!isEditing}
                                       />
                                    </div>
                                    <div className="space-y-1">
                                       <label className="block text-[9px] font-black text-[var(--muted)] uppercase">E-mail Corporativo</label>
                                       <input
                                          type="email"
                                          value={formData.email || ''}
                                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                          className={`w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text)] font-bold outline-none transition-all ${isEditing ? 'bg-[var(--surface-2)] focus:ring-2 focus:ring-[var(--primary)]/20 shadow-inner' : 'bg-transparent border-transparent px-0 disabled:text-[var(--text)]'}`}
                                          disabled={!isEditing}
                                       />
                                    </div>
                                 </div>
                              </div>

                              {/* ALINHAMENTO FUNCIONAL (COMPONENTIZADO) */}
                              <div className="space-y-4">
                                 <h4 className="text-[10px] font-black uppercase text-[var(--text)] tracking-widest flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-[var(--primary)]" /> Alinhamento Operacional
                                 </h4>
                                 <OrganizationalStructureSelector
                                    initialCargo={formData.cargo || ''}
                                    initialLevel={formData.nivel || ''}
                                    initialTorre={formData.torre || ''}
                                    existingCargos={Array.from(new Set(users.map((u: User) => u.cargo).filter((c: string | undefined): c is string => !!c)))}
                                    isEditing={isEditing}
                                    onChange={({ cargo, nivel, torre }: { cargo: string; nivel: string; torre: string }) => {
                                       setFormData(prev => ({ ...prev, cargo, nivel, torre }));
                                    }}
                                 />
                                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="space-y-1">
                                       <label className="block text-[9px] font-black text-[var(--muted)] uppercase">Nível Acesso</label>
                                       <select
                                          value={formData.role || ''}
                                          onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                                          className={`w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text)] font-bold outline-none transition-all appearance-none ${isEditing ? 'bg-[var(--surface-2)] focus:ring-2 focus:ring-[var(--primary)]/20 shadow-inner' : 'bg-transparent border-transparent px-0 disabled:text-[var(--text)]'}`}
                                          disabled={!isEditing}
                                       >
                                          <option value="user">Colaborador</option>
                                          <option value="admin">Administrador</option>
                                          <option value="manager">Gestor</option>
                                       </select>
                                    </div>
                                    <div className="space-y-1">
                                       <label className="block text-[9px] font-black text-[var(--muted)] uppercase">Custo Hora</label>
                                       <div className="relative">
                                          {!isEditing && <span className="text-emerald-600 font-black block py-2">R$ {formData.hourlyCost}</span>}
                                          {isEditing && (
                                             <div className="relative flex items-center">
                                                <span className="absolute left-3 text-emerald-600 font-bold text-xs">R$</span>
                                                <input
                                                   type="text"
                                                   value={formData.hourlyCost || ''}
                                                   onChange={(e) => handleNumberChange('hourlyCost', e.target.value)}
                                                   placeholder="0,00"
                                                   className="w-full pl-8 pr-3 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-sm text-emerald-600 font-black focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                                />
                                             </div>
                                          )}
                                       </div>
                                    </div>
                                    <div className="space-y-1">
                                       <label className="block text-[9px] font-black text-[var(--muted)] uppercase">Hrs Meta Dia</label>
                                       <div className={`w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text)] font-black flex justify-between items-center transition-all ${isEditing ? 'bg-[var(--surface-2)] focus-within:ring-2 focus-within:ring-[var(--primary)]/20 shadow-inner' : 'bg-transparent border-transparent px-0'}`}>
                                          <input
                                             type="text"
                                             value={formData.dailyAvailableHours || '8'}
                                             onChange={(e) => handleNumberChange('dailyAvailableHours', e.target.value)}
                                             disabled={!isEditing}
                                             className={`w-12 bg-transparent border-none outline-none font-black p-0 focus:ring-0 ${isEditing ? 'text-[var(--primary)]' : 'text-[var(--text)]'}`}
                                          />
                                          <span className="text-[8px] font-black uppercase opacity-40">H/Dia</span>
                                       </div>
                                    </div>
                                    <div className="space-y-1">
                                       <div className="flex items-center justify-between">
                                          <label className="block text-[9px] font-black text-[var(--muted)] uppercase">Hrs Meta Mês</label>
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
                                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase transition-all ${monthlyHoursMode === 'auto' ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}
                                             >
                                                {monthlyHoursMode === 'auto' ? 'Auto' : 'Fixa'}
                                             </button>
                                          )}
                                       </div>
                                       <div className={`w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text)] font-black flex justify-between items-center transition-all ${isEditing && monthlyHoursMode === 'manual' ? 'bg-[var(--surface-2)] focus-within:ring-2 focus-within:ring-[var(--primary)]/20 shadow-inner' : 'bg-transparent border-transparent px-0'}`}>
                                          <input
                                             type="text"
                                             value={monthlyHoursMode === 'auto' ? formatDecimalToTime(capacityStats.calculatedTotal).replace(':', '.') : (formData.monthlyAvailableHours ?? '')}
                                             onChange={(e) => handleNumberChange('monthlyAvailableHours', e.target.value)}
                                             disabled={!isEditing || monthlyHoursMode === 'auto'}
                                             className={`w-14 bg-transparent border-none outline-none font-black p-0 focus:ring-0 ${monthlyHoursMode === 'auto' ? 'text-[var(--text)] opacity-40' : 'text-[var(--primary)]'}`}
                                          />
                                          <span className="text-[8px] font-black uppercase opacity-40">H/Mês</span>
                                       </div>
                                    </div>
                                 </div>
                              </div>

                              {/* GESTÃO DE STATUS */}
                              <div className="pt-4 border-t border-[var(--border)] space-y-4">
                                 <h4 className="text-[10px] font-black uppercase text-[var(--text)] tracking-widest flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-[var(--primary)]" /> Governança
                                 </h4>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className={`p-3.5 rounded-xl border transition-all ${formData.torre !== 'N/A' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-500/5 border-slate-500/20'}`}>
                                       <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${formData.torre !== 'N/A' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-500/20 text-slate-500'}`}>
                                                <Zap className="w-4 h-4" />
                                             </div>
                                             <div>
                                                <p className="text-[9px] font-black uppercase text-[var(--muted)] opacity-60">Operacional</p>
                                                <p className="text-xs font-black text-[var(--text)]">Participar do Fluxo</p>
                                             </div>
                                          </div>
                                          {isEditing && (
                                             <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, torre: prev.torre === 'N/A' ? '' : 'N/A' }))}
                                                className={`w-10 h-5 rounded-full relative transition-all ${formData.torre !== 'N/A' ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                             >
                                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${formData.torre !== 'N/A' ? 'left-5.5' : 'left-0.5'}`} />
                                             </button>
                                          )}
                                       </div>
                                    </div>
                                    <div className={`p-3.5 rounded-xl border transition-all ${formData.active ? 'bg-blue-500/5 border-blue-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                                       <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${formData.active ? 'bg-blue-500/20 text-blue-500' : 'bg-red-500/20 text-red-500'}`}>
                                                <Shield className="w-4 h-4" />
                                             </div>
                                             <div>
                                                <p className="text-[9px] font-black uppercase text-[var(--muted)] opacity-60">Acesso</p>
                                                <p className="text-xs font-black text-[var(--text)]">Status da Conta</p>
                                             </div>
                                          </div>
                                          {isEditing && (
                                             <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, active: !prev.active }))}
                                                className={`w-10 h-5 rounded-full relative transition-all ${formData.active ? 'bg-blue-500' : 'bg-red-500'}`}
                                             >
                                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${formData.active ? 'left-5.5' : 'left-0.5'}`} />
                                             </button>
                                          )}
                                       </div>
                                    </div>
                                 </div>
                              </div>

                              {/* BOTÕES DE AÇÃO NO MODO EDIÇÃO */}
                              {isEditing && (
                                 <div className="flex items-center justify-end gap-2 pt-2">
                                    <button type="button" onClick={() => setDeleteModalOpen(true)} className="px-4 py-2 text-red-500 hover:bg-red-500/5 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all">Excluir</button>
                                    <button type="submit" className="px-6 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg font-black text-[9px] uppercase tracking-widest shadow-lg transition-all flex items-center gap-1.5">
                                       <Save className="w-3.5 h-3.5" /> Salvar
                                    </button>
                                 </div>
                              )}
                           </fieldset>
                        </form>
                     </div>
                  </div>
               </div>
            )}

               {activeTab === 'projects' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {userProjects.map((p: Project) => {
                        const userProjectTasks = tasks.filter((t: Task) => t.projectId === p.id && (t.developerId === user?.id || (t.collaboratorIds || []).includes(String(user?.id))));
                        const userEstimated = userProjectTasks.reduce((sum: number, t: Task) => sum + (Number(t.estimatedHours) || 0), 0);
                        const userReported = timesheetEntries
                           .filter((e: TimesheetEntry) => e.projectId === p.id && String(e.userId) === String(user?.id))
                           .reduce((sum: number, e: TimesheetEntry) => sum + (Number(e.totalHours) || 0), 0);
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
                        {userTasks.map((t: Task) => {
                           const client = clients.find((c: Client) => String(c.id) === String(t.clientId));
                           const teamIds = Array.from(new Set([t.developerId, ...(t.collaboratorIds || [])])).filter(Boolean) as string[];
                           const responsible = users.find((u: User) => String(u.id) === String(t.developerId));
                           const teamNames = teamIds
                              .map((id: string) => users.find((u: User) => String(u.id) === String(id))?.name?.toUpperCase())
                              .filter((name): name is string => Boolean(name))
                              .join(', ');

                           const taskInBreakdown = capData?.breakdown?.tasks?.find((tb: any) => String(tb.id) === String(t.id));
                           const monthlyAllocatedHours = taskInBreakdown?.hours || 0;
                           const monthlyReportedHours = taskInBreakdown?.reported || 0;

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
                                       <div className="flex -space-x-2.5">
                                          {teamIds.slice(0, 8).map((id: any) => {
                                             const collabo = users.find((u: User) => String(u.id) === String(id));
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
                        {delayedTasks.map((t: Task) => {
                           const client = clients.find((c: Client) => String(c.id) === String(t.clientId));
                           const teamIds = Array.from(new Set([t.developerId, ...(t.collaboratorIds || [])])).filter(Boolean);
                           const responsible = users.find((u: User) => String(u.id) === String(t.developerId));
                           const teamNames = teamIds
                              .map((id: any) => users.find((u: User) => String(u.id) === String(id))?.name?.toUpperCase())
                              .filter(Boolean)
                              .join(', ');

                           const alloc = taskMemberAllocations.find((a: TaskMemberAllocation) => String(a.taskId) === String(t.id) && String(a.userId) === String(user?.id));
                           const hasAnyAllocationInTask = taskMemberAllocations.some((a: TaskMemberAllocation) => String(a.taskId) === String(t.id) && a.reservedHours > 0);

                           let allocatedHours = 0;
                           if (alloc && alloc.reservedHours > 0) {
                              allocatedHours = alloc.reservedHours;
                           } else if (!hasAnyAllocationInTask) {
                              allocatedHours = (parseTimeToDecimal(String(t.estimatedHours || 0))) / (teamIds.length || 1);
                           } else {
                              const isMainDev = String(t.developerId) === String(user?.id);
                              if (isMainDev) {
                                 const totalAllocatedToOthers = taskMemberAllocations
                                    .filter((a: TaskMemberAllocation) => String(a.taskId) === String(t.id) && String(a.userId) !== String(user?.id))
                                    .reduce((sum: number, a: TaskMemberAllocation) => sum + (Number(a.reservedHours) || 0), 0);
                                 allocatedHours = Math.max(0, parseTimeToDecimal(String(t.estimatedHours || 0)) - totalAllocatedToOthers);
                              } else {
                                 allocatedHours = 0;
                              }
                           }

                           const reportedHours = timesheetEntries.reduce((sum: number, entry: TimesheetEntry) => {
                              if (String(entry.taskId) === String(t.id) && String(entry.userId) === String(user?.id)) {
                                 return sum + (Number(entry.totalHours) || 0);
                              }
                              return sum;
                           }, 0);

                           const monthlyReportedHours = timesheetEntries.reduce((sum: number, entry: TimesheetEntry) => {
                              if (String(entry.taskId) === String(t.id) && String(entry.userId) === String(user?.id)) {
                                 if (entry.date.startsWith(capacityMonth)) {
                                    return sum + (Number(entry.totalHours) || 0);
                                 }
                              }
                              return sum;
                           }, 0);

                           const p = projects.find((proj: any) => String(proj.id) === String(t.projectId));
                           const todayStr = new Date().toISOString().split('T')[0];
                           const [year, month] = capacityMonth.split('-').map(Number);
                           const lastDay = new Date(year, month, 0).getDate();
                           const endDate = `${capacityMonth}-${String(lastDay).padStart(2, '0')}`;
                           const nominalEnd = t.actualDelivery || t.estimatedDelivery || p?.estimatedDelivery || endDate;
                           const startDate = `${capacityMonth}-01`;
                           const effectiveEnd = (t.status !== 'Done' && nominalEnd < todayStr && nominalEnd >= startDate)
                              ? todayStr
                              : nominalEnd;
                           const effectiveStart = t.scheduledStart || t.actualStart || p?.startDate || startDate;

                           const totalTaskDays = CapacityUtils.getWorkingDaysInRange(effectiveStart, effectiveEnd, holidays || [], capacityStats.userAbsences, capacityStats.dailyMeta) || 1;
                           const hoursPerDay = allocatedHours / totalTaskDays;

                           const intStart = effectiveStart > startDate ? effectiveStart : startDate;
                           const intEnd = effectiveEnd < endDate ? effectiveEnd : endDate;

                           let monthlyAllocatedHours = 0;
                           if (t.status === 'Done') {
                              if (reportedHours > 0) {
                                 monthlyAllocatedHours = monthlyReportedHours;
                              } else {
                                 const deliveryDate = t.actualDelivery || t.estimatedDelivery || p?.estimatedDelivery || endDate;
                                 if (deliveryDate >= startDate && deliveryDate <= endDate) {
                                    monthlyAllocatedHours = allocatedHours;
                                 }
                              }
                           } else if (intStart <= intEnd && intStart <= endDate && intEnd >= startDate) {
                              const bizDaysInMonth = CapacityUtils.getWorkingDaysInRange(intStart, intEnd, holidays || [], capacityStats.userAbsences, capacityStats.dailyMeta);
                              monthlyAllocatedHours = bizDaysInMonth * hoursPerDay;
                           }

                           const now = new Date();
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
                                             const collabo = users.find((u: User) => String(u.id) === String(id));
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
                     {completedTasks.map((t: Task) => {
                        const client = clients.find((c: Client) => String(c.id) === String(t.clientId));
                        const isProjectManager = String(t.developerId) === String(user?.id);
                        const isAssigned = (t.collaboratorIds || []).includes(String(user?.id));
                        const projectTasks = tasks.filter((task: Task) => task.projectId === t.projectId);
                        const projectReportedHours = timesheetEntries
                           .filter((a: TimesheetEntry) => a.projectId === t.projectId)
                           .reduce((sum: number, entry: TimesheetEntry) => sum + (Number(entry.totalHours) || 0), 0);
                        const teamIds = Array.from(new Set([t.developerId, ...(t.collaboratorIds || [])])).filter(Boolean) as string[];
                        const alloc = taskMemberAllocations.find((a: TaskMemberAllocation) => String(a.taskId) === String(t.id) && String(a.userId) === String(user?.id));
                        const hasAnyAllocationInTask = taskMemberAllocations.some((a: TaskMemberAllocation) => String(a.taskId) === String(t.id) && a.reservedHours > 0);

                        let allocatedHours = 0;
                        if (alloc && alloc.reservedHours > 0) {
                           allocatedHours = alloc.reservedHours;
                        } else if (!hasAnyAllocationInTask) {
                           allocatedHours = (parseTimeToDecimal(String(t.estimatedHours || 0))) / (teamIds.length || 1);
                        } else {
                           const isMainDev = String(t.developerId) === String(user?.id);
                           if (isMainDev) {
                              const totalAllocatedToOthers = taskMemberAllocations
                                 .filter((a: TaskMemberAllocation) => String(a.taskId) === String(t.id) && String(a.userId) !== String(user?.id))
                                 .reduce((sum: number, a: TaskMemberAllocation) => sum + (Number(a.reservedHours) || 0), 0);
                              allocatedHours = Math.max(0, parseTimeToDecimal(String(t.estimatedHours || 0)) - totalAllocatedToOthers);
                           } else {
                              allocatedHours = 0;
                           }
                        }

                        const reportedOnTask = timesheetEntries.reduce((sum: number, entry: TimesheetEntry) => {
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
                        const projectData = projects.find((proj: Project) => proj.id === t.projectId);
                        const effectiveStart = t.scheduledStart || t.actualStart || projectData?.startDate || startDateBoundary;
                        const effectiveEnd = t.actualDelivery || t.estimatedDelivery || projectData?.estimatedDelivery || endDateBoundary;

                        const totalTaskDays = CapacityUtils.getWorkingDaysInRange(effectiveStart, effectiveEnd, holidays || [], capacityStats.userAbsences, capacityStats.dailyMeta) || 1;
                        const hoursPerDay = totalEffort / totalTaskDays;

                        const intStart = effectiveStart > startDateBoundary ? effectiveStart : startDateBoundary;
                        const intEnd = effectiveEnd < endDateBoundary ? effectiveEnd : endDateBoundary;

                        const monthlyReportedHours = timesheetEntries.reduce((sum: number, entry: TimesheetEntry) => {
                           if (String(entry.taskId) === String(t.id) && String(entry.userId) === String(user.id)) {
                              if (entry.date.startsWith(capacityMonth)) {
                                 return sum + (Number(entry.totalHours) || 0);
                              }
                           }
                           return sum;
                        }, 0);

                        const reportedTaskTotal = timesheetEntries.reduce((sum: number, entry: TimesheetEntry) => {
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
                              const deliveryDate = t.actualDelivery || t.estimatedDelivery || projectData?.estimatedDelivery || endDateBoundary;
                              if (deliveryDate >= startDateBoundary && deliveryDate <= endDateBoundary) {
                                 monthlyAllocatedHours = totalEffort;
                              }
                           }
                        } else if (intStart <= intEnd && intStart <= endDateBoundary && intEnd >= startDateBoundary) {
                           const bizDaysInMonth = CapacityUtils.getWorkingDaysInRange(intStart, intEnd, holidays || [], capacityStats.userAbsences, capacityStats.dailyMeta);
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
         <ConfirmationModal
            isOpen={deleteModalOpen}
            title="Excluir Colaborador"
            message={`Tem certeza que deseja remover permanentemente "${user.name}"? Esta ação não pode ser desfeita.`}
            onConfirm={handleDeleteUser}
            onCancel={() => setDeleteModalOpen(false)}
            disabled={loading}
         />

         {showBreakdown && capData && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md" style={{ backgroundColor: 'var(--overlay)' }}>
               <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="rounded-[32px] shadow-2xl w-full max-w-xl overflow-hidden border flex flex-col max-h-[90vh]"
                  style={{ backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--border)' }}
               >
                  <div className="p-8 bg-gradient-to-br from-[var(--primary)] to-indigo-700 text-white relative overflow-hidden shrink-0">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
                     <div className="flex items-center justify-between relative z-10">
                        <div>
                           <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Capacidade Operacional</p>
                           <h3 className="text-2xl font-black tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                              Distribuição de Carga
                           </h3>
                        </div>
                        <button onClick={() => setShowBreakdown(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                           <LayoutGrid className="w-5 h-5 rotate-45" />
                        </button>
                     </div>

                     <div className="mt-6 flex items-center gap-6 relative z-10">
                        <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 flex-1">
                           <p className="text-[9px] font-black opacity-60 uppercase tracking-widest mb-1">Total Alocado</p>
                           <p className="text-3xl font-black font-mono">
                              {formatDecimalToTime((capData.plannedHours || 0) + (capData.continuousHours || 0))}h
                           </p>
                        </div>
                        <div className="flex-1 flex flex-col justify-center gap-2">
                           <div className="flex items-center gap-2 text-xs font-bold text-white/80">
                              <Shield size={14} /> {capData.breakdown.planned.length} Projetos
                           </div>
                           <div className="flex items-center gap-2 text-xs font-bold text-white/80">
                              <Clock size={14} /> {capData.breakdown.continuous.length} Recorrentes
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="p-8 overflow-y-auto flex-1" style={{ backgroundColor: 'var(--surface)' }}>
                     <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest mb-4 opacity-50">Volume por Origem</p>

                     <div className="space-y-3">
                        {[
                           ...capData.breakdown.planned.map((p: any) => ({ ...p, type: 'Projeto Planejado', color: 'bg-blue-50 text-blue-600 border-blue-100', dot: 'bg-blue-500' })),
                           ...capData.breakdown.continuous.map((p: any) => ({ ...p, type: 'Reserva/Recorrente', color: 'bg-amber-50 text-amber-600 border-amber-100', dot: 'bg-amber-500' }))
                        ].sort((a, b) => b.hours - a.hours).map((item: any, idx: number) => (
                           <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] group hover:border-[var(--primary)] transition-all shadow-sm hover:shadow-md">
                              <div className="flex items-center gap-4">
                                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${item.color} border shadow-sm`}>
                                    {idx + 1}
                                 </div>
                                 <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                       <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`}></span>
                                       <p className="font-black text-[var(--text)] text-sm group-hover:text-[var(--primary)] transition-colors line-clamp-1">{item.name}</p>
                                    </div>
                                    <p className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest ml-3.5 opacity-70 flex items-center gap-1">
                                       <span className="opacity-50">ID: {item.id.slice(0,8)}...</span> • {item.type}
                                    </p>
                                 </div>
                              </div>
                              <div className="text-right shrink-0">
                                 <p className="font-black text-[var(--text)] font-mono text-base">{formatDecimalToTime(item.hours)}h</p>
                                 <p className="text-[8px] font-black uppercase tracking-widest text-[var(--muted)] opacity-50 mt-1">Alocado</p>
                              </div>
                           </div>
                        ))}

                        {capData.breakdown.planned.length === 0 && capData.breakdown.continuous.length === 0 && (
                           <div className="text-center py-16 opacity-30">
                              <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                              <p className="font-black uppercase text-xs tracking-widest">Nenhuma alocação registrada</p>
                           </div>
                        )}
                     </div>
                  </div>

                  <div className="p-6 border-t border-[var(--border)] flex justify-end shrink-0" style={{ backgroundColor: 'var(--surface-2)' }}>
                     <button
                        onClick={() => setShowBreakdown(false)}
                        className="px-8 py-3 bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)] rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm"
                     >
                        Fechar Janela
                     </button>
                  </div>
               </motion.div>
            </div>
         )}

         <WorkingDaysModal
            isOpen={workingDaysModal.isOpen}
            onClose={() => setWorkingDaysModal(prev => ({ ...prev, isOpen: false }))}
            title={workingDaysModal.title}
            details={workingDaysModal.details}
         />
      </div>
   );
};

export default TeamMemberDetail;
