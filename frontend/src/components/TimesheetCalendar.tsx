// components/TimesheetCalendar.tsx - Com Busca Dropdown
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDataController } from '@/controllers/useDataController';
import { useAuth } from '@/contexts/AuthContext';
import { User, Task, Project, Client, Absence, Holiday, TimesheetEntry } from '@/types';
import { TIMESHEET_VIEW_ALL_ROLES } from '@/constants/roles';
import {
  ChevronLeft, ChevronRight, Plus, Clock, TrendingUp, Trash2,
  Users, AlertTriangle, CheckCircle, Calendar,
  Search, ChevronDown, Check, Coffee, PartyPopper, Flag, Gift, Sparkles, Heart, Hammer, Palmtree, MapPin
} from 'lucide-react';
import { formatDecimalToTime } from '@/utils/normalizers';
import ConfirmationModal from './ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';

interface TimesheetCalendarProps {
  userId?: string;
  embedded?: boolean;
}

const TimesheetCalendar: React.FC<TimesheetCalendarProps> = ({ userId, embedded }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, isAdmin } = useAuth();
  const { timesheetEntries, deleteTimesheet, tasks, users, loading, clients, projects, absences, holidays, createAbsence, createTimesheet } = useDataController();

  const canViewOthers = useMemo(() =>
    !!currentUser && TIMESHEET_VIEW_ALL_ROLES.includes(currentUser.role),
    [currentUser]
  );

  const [isCloning, setIsCloning] = useState(false);

  // Safety checks
  const allEntries = timesheetEntries || [];
  const safeUsers = users || [];
  const safeTasks = tasks || [];
  const safeClients = clients || [];
  const safeProjects = projects || [];

  const queryMonth = searchParams.get('month');
  const queryYear = searchParams.get('year');
  const initialDate = useMemo(() => {
    if (queryMonth && queryYear) {
      return new Date(Number(queryYear), Number(queryMonth), 1);
    }
    return new Date();
  }, [queryMonth, queryYear]);

  const [currentDate, setCurrentDate] = useState(initialDate);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<TimesheetEntry | null>(null);


  // Use URL search param for userId if available, otherwise use prop or currentUser
  // Use URL search param for userId if available, otherwise use memory (localStorage), prop or currentUser
  const queryUserId = searchParams.get('userId');
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    if (queryUserId) return queryUserId;
    if (userId) return userId;
    return localStorage.getItem('timesheet_last_selected_user_id') || '';
  });

  // Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown clickable outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update selectedUserId and URL when selection or prop changes
  useEffect(() => {
    if (userId) {
      setSelectedUserId(userId);
    } else if (queryUserId) {
      setSelectedUserId(queryUserId);
    } else if (!selectedUserId || (currentUser && selectedUserId !== currentUser.id && !canViewOthers)) {
      // Prioritize current user if not authorized to view others and no specific user in URL
      const idToSet = (canViewOthers ? (localStorage.getItem('timesheet_last_selected_user_id') || currentUser?.id) : currentUser?.id) || '';
      if (idToSet) {
        setSelectedUserId(idToSet);
      }
    }
  }, [currentUser, userId, queryUserId, selectedUserId]);

  const handleUserSelect = (uid: string) => {
    setSelectedUserId(uid);
    localStorage.setItem('timesheet_last_selected_user_id', uid);
    setSearchParams(prev => {
      prev.set('userId', uid);
      return prev;
    }, { replace: true });
    setIsDropdownOpen(false);
    setSearchTerm('');
  };

  // Data Helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  const canGoNext =
    currentDate.getFullYear() < today.getFullYear() ||
    (currentDate.getFullYear() === today.getFullYear() && currentDate.getMonth() < today.getMonth());

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const daysInMonth = getDaysInMonth(year, month);
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();
  const firstDay = getFirstDayOfMonth(year, month);
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  // Helper de Feriados Nacionais (Brasil 2025/2026)
  // Helper de Feriados Dinâmicos (Vem do Banco + Lógica de Cores)
  const getHoliday = (d: number, m: number, y: number) => {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const h = (holidays || []).find((hf: Holiday) => {
      const start = hf.date;
      const end = hf.endDate || hf.date;
      return dateStr >= start && dateStr <= end;
    });

    if (!h) return null;

    const config: { [key: string]: { icon: any, color: string, bg: string } } = {
      'nacional': { icon: Flag, color: "#EF4444", bg: "rgba(239, 68, 68, 0.05)" },
      'corporativo': { icon: PartyPopper, color: "#8B5CF6", bg: "rgba(139, 92, 246, 0.05)" },
      'local': { icon: MapPin, color: "#10B981", bg: "rgba(16, 185, 129, 0.05)" }
    };

    const typeConfig = config[h.type] || config['nacional'];

    return {
      name: h.name,
      icon: typeConfig.icon,
      color: typeConfig.color,
      bg: typeConfig.bg,
      period: h.period,
      endTime: h.endTime,
      isLastDay: dateStr === (h.endDate || h.date)
    };
  };

  /* --- LÓGICA DE PENDÊNCIAS --- */
  const calculateDaysMissing = (uid: string) => {
    if (!uid) return 0;

    // Helper para formatar data local como YYYY-MM-DD
    const toLocalISO = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const usr = safeUsers.find((u: User) => u.id === uid);

    if (usr && (['ceo', 'diretoria', 'executive'].includes(usr.role?.toLowerCase() || '') || usr.torre?.toLowerCase() === 'pmo' || usr.torre === 'N/A')) {
      return 0; // Diretoria/Executivos/Fora do fluxo não possuem pendência de timesheet
    }

    const userEntries = allEntries.filter((e: TimesheetEntry) => {
      if (!e.date) return false;
      const dateStr = String(e.date);
      const [y, m] = dateStr.includes('-') ? dateStr.split('-').map(Number) : dateStr.split('/').reverse().map(Number);
      return String(e.userId) === String(uid) && (m - 1) === month && y === year;
    });

    const userAbsences = (absences || []).filter((a: Absence) => a.userId === uid);
    const workedDays = new Set(userEntries.map((e: TimesheetEntry) => e.date));

    let missing = 0;
    const todayStr = toLocalISO(new Date());

    // Começar do dia 1 do mês selecionado
    const checkDate = new Date(year, month, 1, 12, 0, 0);
    let limit = 0;

    while (checkDate.getMonth() === month && limit < 31) {
      limit++;
      const dStr = toLocalISO(checkDate);

      // NÃO conta hoje nem dias futuros como falta
      if (dStr >= todayStr) break;

      const dayOfWeek = checkDate.getDay();
      const isWorkDay = dayOfWeek >= 1 && dayOfWeek <= 5;
      const holiday = getHoliday(checkDate.getDate(), checkDate.getMonth(), checkDate.getFullYear());

      // Verificar se há ausência registrada para este dia
      const hasAbsence = userAbsences.some((a: Absence) => dStr >= a.startDate && dStr <= a.endDate);

      if (isWorkDay && !workedDays.has(dStr) && !holiday && !hasAbsence) {
        missing++;
      }

      checkDate.setDate(checkDate.getDate() + 1);
    }
    return missing;
  };

  // Processar usuários (apenas para quem tem permissão de ver outros)
  const processedUsers = useMemo(() => {
    if (!canViewOthers) return [];

    return safeUsers
      .map((u: User) => {
        const missing = calculateDaysMissing(u.id);
        const status = missing > 0 ? 'late' : 'ontime';
        return { ...u, missing, status };
      })
      .sort((a: any, b: any) => b.missing - a.missing);
  }, [safeUsers, allEntries, year, month, isAdmin, absences]);

  // Search Filter
  const searchedUsers = useMemo(() => {
    if (!searchTerm) return processedUsers;
    return processedUsers.filter((u: any) => u.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [processedUsers, searchTerm]);


  /* --- DADOS DO CALENDÁRIO --- */
  const targetUserId = canViewOthers ? (selectedUserId || currentUser?.id) : currentUser?.id;
  const targetUser = useMemo(() => safeUsers.find((u: User) => u.id === targetUserId), [safeUsers, targetUserId]);

  const currentEntries = useMemo(() => {
    if (!targetUserId) return [];
    return allEntries.filter((e: TimesheetEntry) => String(e.userId) === String(targetUserId));
  }, [allEntries, targetUserId]);

  const selectedUserStats = useMemo(() => {
    // 1. Filtrar lançamentos do mês/ano selecionados
    const monthEntries = currentEntries.filter((e: TimesheetEntry) => {
      if (!e.date) return false;
      const [y, m] = e.date.split('-').map(Number);
      return (m - 1) === month && y === year;
    });

    // 2. Calcular Saldo de Horas (Diferença de 8h/dia) - APENAS DIAS APONTADOS
    let balanceHours = 0;
    const entriesByDate = monthEntries.reduce((acc: { [key: string]: number }, curr: TimesheetEntry) => {
      const d = curr.date;
      acc[d] = (acc[d] || 0) + (curr.totalHours || 0);
      return acc;
    }, {} as { [key: string]: number });

    (Object.entries(entriesByDate) as [string, number][]).forEach(([dStr, dayTotal]) => {
      const parts = dStr.split('-');
      const checkDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const dayOfWeek = checkDate.getDay();
      const isWorkDay = dayOfWeek >= 1 && dayOfWeek <= 5;
      const holiday = getHoliday(checkDate.getDate(), checkDate.getMonth(), checkDate.getFullYear());

      const userDailyMeta = targetUser?.dailyAvailableHours || 8;

      if (isWorkDay && !holiday) {
        // Se trabalhou em dia útil, o saldo é a diferença para a meta do usuário
        balanceHours += (dayTotal - userDailyMeta);
      } else {
        // Se trabalhou em feriado ou fim de semana, TUDO é extra
        balanceHours += dayTotal;
      }
    });

    // 3. Pendências (Dias sem nenhum apontamento)
    let missing = 0;
    if (canViewOthers) {
      const u = processedUsers.find((u: any) => u.id === targetUserId);
      missing = u ? (u as any).missing : 0;
    } else {
      missing = calculateDaysMissing(currentUser?.id || '');
    }

    const totalHours = monthEntries.reduce((acc: number, curr: TimesheetEntry) => acc + (curr.totalHours || 0), 0);

    return { totalHours, balanceHours, missing };
  }, [currentEntries, year, month, targetUserId, processedUsers, isAdmin, currentUser, today, absences]);

  const handleDelete = async () => {
    if (entryToDelete) {
      try {
        await deleteTimesheet(entryToDelete.id);
      } catch (e) {
        alert("Erro ao excluir.");
      } finally {
        setDeleteModalOpen(false);
        setEntryToDelete(null);
      }
    }
  };

  const handleQuickDayOff = async (e: React.MouseEvent, date: string) => {
    e.stopPropagation();
    if (!targetUserId) return;
    if (window.confirm(`Deseja registrar um Day-off em ${new Date(date + 'T12:00:00').toLocaleDateString()}?`)) {
      try {
        await createAbsence({
          userId: targetUserId,
          type: 'day-off',
          startDate: date,
          endDate: date,
          status: 'aprovada_gestao',
          observations: 'Registrado via preenchimento rápido'
        });
        alert('Day-off registrado!');
      } catch (err) {
        alert('Erro ao registrar.');
      }
    }
  };

  const handleCloneDay = async (e: React.MouseEvent, date: string) => {
    e.stopPropagation();
    if (!targetUserId) return;

    const entries = currentEntries.filter((ent: TimesheetEntry) => ent.date === date);
    if (entries.length === 0) return;

    // Find next workday
    const d = new Date(date + 'T12:00:00');
    let next = new Date(d);
    next.setDate(next.getDate() + 1);
    while (next.getDay() === 0 || next.getDay() === 6 || getHoliday(next.getDate(), next.getMonth(), next.getFullYear())) {
      next.setDate(next.getDate() + 1);
    }
    const nextStr = next.toISOString().split('T')[0];

    if (window.confirm(`Clonar ${entries.length} lançamentos para ${next.toLocaleDateString()}?`)) {
      try {
        setIsCloning(true);
        for (const entry of entries) {
          await createTimesheet({
            ...entry,
            id: crypto.randomUUID(),
            date: nextStr
          });
        }
        alert('Lançamentos clonados com sucesso!');
      } catch (err) {
        alert('Erro ao clonar.');
      } finally {
        setIsCloning(false);
      }
    }
  };

  const updateDateParams = (date: Date) => {
    setSearchParams(prev => {
      prev.set('month', String(date.getMonth()));
      prev.set('year', String(date.getFullYear()));
      return prev;
    }, { replace: true });
  };

  const navPrevMonth = () => {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);
    updateDateParams(newDate);
  };

  const navNextMonth = () => {
    if (canGoNext) {
      const newDate = new Date(year, month + 1, 1);
      setCurrentDate(newDate);
      updateDateParams(newDate);
    }
  };


  return (
    <div className={`h-full flex flex-col ${embedded ? '' : 'p-6 md:p-8'} overflow-hidden gap-6`} style={{ backgroundColor: 'var(--bg)' }}>



      {/* 2. CALENDÁRIO */}
      <div className="flex-1 rounded-2xl shadow-sm border overflow-hidden flex flex-col min-h-0"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        <AnimatePresence mode="wait">
          {loading && allEntries.length === 0 ? (
            <motion.div
              key="full-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center min-h-[400px]"
            >
              <div className="text-center relative">
                <div className="absolute inset-0 bg-[var(--primary)] blur-3xl opacity-10 animate-pulse rounded-full" />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 border-4 border-t-transparent border-[var(--primary)] rounded-full mx-auto mb-6 shadow-lg shadow-[var(--primary)]/20"
                />
                <h3 className="text-lg font-black tracking-tight" style={{ color: 'var(--text)' }}>Sincronizando Dados</h3>
                <p className="text-xs font-medium mt-2 animate-pulse" style={{ color: 'var(--muted)' }}>
                  Aguarde um instante, estamos montando seu calendário...
                </p>
                <div className="flex justify-center gap-1 mt-6">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                      className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="calendar-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative"
            >
              {loading && allEntries.length > 0 && (
                <div className="absolute top-2 right-2 z-[2000] flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded-full shadow-xl animate-in fade-in slide-in-from-top-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--primary)] animate-ping" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Atualizando...</span>
                </div>
              )}
              {/* Header do Calendário Agora dentro do Scroll para não ficar fixo */}
              <div className="px-6 py-3 flex flex-col md:flex-row justify-between items-center gap-4 text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))' }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-black tracking-tight flex items-center gap-2">
                      {canViewOthers && <Users className="w-3.5 h-3.5 opacity-60" />}
                      {canViewOthers ? processedUsers.find((u: any) => u.id === targetUserId)?.name || 'Usuário' : 'Meus Lançamentos'}
                    </h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-black uppercase tracking-widest text-white/60">
                      <span className="flex items-center gap-1 text-white/90">
                        <Clock className="w-3 h-3 text-white/40" /> {formatDecimalToTime(selectedUserStats.totalHours)} no Mês
                      </span>
                      <span className="flex items-center gap-1 text-white/90">
                        {selectedUserStats.balanceHours >= 0 ? '+' : ''}{formatDecimalToTime(selectedUserStats.balanceHours)}
                        {selectedUserStats.balanceHours >= 0 ? ' Extra' : ' Débito'}
                      </span>
                      {selectedUserStats.missing > 0 && (
                        <span className="flex items-center gap-1 text-white/90">
                          <AlertTriangle className="w-3 h-3 text-white/50" /> {selectedUserStats.missing} Falta(s)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Search integrated in header for Authorized Users only */}
                  {canViewOthers && !embedded && (
                    <div className="relative" ref={dropdownRef}>
                      <div
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-1.5 rounded-xl cursor-pointer transition-all backdrop-blur-sm min-w-[200px]"
                      >
                        <Search className="w-3.5 h-3.5 text-white" />
                        <input
                          id="member-search"
                          name="member-search"
                          type="text"
                          autoComplete="off"
                          placeholder="Buscar membro..."
                          value={searchTerm}
                          onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); }}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-transparent border-none outline-none text-xs font-black text-white placeholder:!text-white/80 w-full"
                        />
                        <ChevronDown className={`w-3 h-3 text-white transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                      </div>

                      {isDropdownOpen && (
                        <div className="absolute top-full right-0 mt-2 w-72 border rounded-xl shadow-2xl max-h-[300px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200 z-[1001]"
                          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                          <div className="p-2 space-y-1">
                            {searchedUsers.length === 0 ? (
                              <div className="p-4 text-center text-xs italic" style={{ color: 'var(--muted)' }}>Nenhum colaborador...</div>
                            ) : (
                              searchedUsers.map((user: any) => (
                                <button
                                  key={user.id}
                                  onClick={() => handleUserSelect(user.id)}
                                  className="w-full flex items-center gap-3 p-2 rounded-lg transition-all group hover:bg-[var(--surface-2)]"
                                  style={{ backgroundColor: user.id === selectedUserId ? 'var(--surface-2)' : 'transparent' }}
                                >
                                  <div className="relative">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] border"
                                      style={{ backgroundColor: 'var(--surface-hover)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                                      {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full rounded-full object-cover" /> : user.name.charAt(0)}
                                    </div>
                                    {user.missing > 0 && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--surface)]" />}
                                  </div>
                                  <div className="text-left flex-1 min-w-0">
                                    <p className="text-xs font-bold truncate transition-colors group-hover:text-[var(--primary)]" style={{ color: user.id === selectedUserId ? 'var(--primary)' : 'var(--text)' }}>{user.name}</p>
                                    <p className={`text-[9px] font-black uppercase ${user.missing > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                      {user.missing > 0 ? `${user.missing} pendências` : 'OK'}
                                    </p>
                                  </div>
                                  {user.id === selectedUserId && <Check className="w-3 h-3" style={{ color: 'var(--primary)' }} />}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex bg-black/20 p-1 rounded-xl backdrop-blur-md border border-white/5">
                    <button onClick={navPrevMonth} className="p-1 hover:bg-white/10 rounded-lg text-white transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="px-2 font-black text-[11px] uppercase tracking-widest flex items-center min-w-[120px] justify-center text-white">{monthNames[month]} {year}</span>
                    <button
                      onClick={navNextMonth}
                      disabled={!canGoNext}
                      className={`p-1 rounded-lg text-white transition-colors ${canGoNext ? 'hover:bg-white/10' : 'opacity-20 cursor-not-allowed'}`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => navigate(`/timesheet/new?date=${new Date().toISOString().split('T')[0]}${targetUserId ? `&userId=${targetUserId}` : ''}`)}
                    className="bg-white px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0"
                    style={{ color: 'var(--primary)' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Lançar
                  </button>
                </div>
              </div>

              {/* Grid Days Header (Sticky) - Agora dentro do Scroll */}
              <div className="grid border-b flex-shrink-0 sticky top-0 z-10"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  gridTemplateColumns: 'minmax(0, 0.4fr) minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 0.4fr)'
                }}>
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((day, idx) => (
                  <div key={day} className={`py-3 text-center text-[11px] font-black tracking-widest`}
                    style={{ color: 'var(--text-2)' }}>
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid gap-[1px] border-b"
                style={{
                  backgroundColor: 'var(--border)',
                  borderColor: 'var(--border)',
                  gridTemplateColumns: 'minmax(0, 0.4fr) minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 0.4fr)',
                  gridAutoRows: 'minmax(100px, auto)'
                }}>
                {/* Empty Slots */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[100px]" style={{ backgroundColor: 'var(--surface-hover)', opacity: 0.3 }}></div>
                ))}

                {/* Days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const d = i + 1;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const dayEntries = currentEntries.filter((e: TimesheetEntry) => e.date === dateStr);

                  // Recalculate total hours to fix any inconsistencies
                  const totalDayHours = dayEntries.reduce((acc: number, entry: TimesheetEntry) => acc + (entry.totalHours || 0), 0);

                  const hasEntries = dayEntries.length > 0;
                  const isToday = new Date().toISOString().split('T')[0] === dateStr;
                  const todayStr = today.toISOString().split('T')[0];
                  const isPast = dateStr < todayStr;

                  const dayOfWeek = new Date(year, month, d).getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const holiday = getHoliday(d, month, year);
                  const HolidayIcon = holiday?.icon || Coffee;

                  const dayAbsence = (absences || []).find((a: Absence) => a.userId === targetUserId && dateStr >= a.startDate && dateStr <= a.endDate);
                  const isMissing = !hasEntries && !isWeekend && !holiday && !dayAbsence && isPast;

                  return (
                    <div
                      key={d}
                      onClick={() => navigate(`/timesheet/new?date=${dateStr}${targetUserId ? `&userId=${targetUserId}` : ''}`)}
                      className={`
                                        p-1.5 relative cursor-pointer min-h-[100px] transition-all group hover:z-10 hover:shadow-xl border-r border-b flex flex-col
                                    `}
                      style={{
                        backgroundColor: isToday ? 'var(--primary-soft)' : 'var(--surface)',
                        borderColor: 'var(--border)'
                      }}
                    >
                      {/* Header: Day Number and Hours Badge */}
                      <div className="flex justify-between items-start mb-1 h-6">
                        <span className={`text-[10px] font-black w-5 h-5 flex items-center justify-center rounded transition-colors`}
                          style={{
                            backgroundColor: isToday ? 'var(--primary)' : 'transparent',
                            color: isToday ? 'white' : 'var(--text)',
                          }}>
                          {d}
                        </span>
                        {hasEntries && (
                          <span className={`text-[11px] font-black text-white px-2.5 py-1 rounded-lg shadow-lg border border-white/10 leading-none transition-all hover:scale-110 ${totalDayHours > (targetUser?.dailyAvailableHours || 8) + 1
                            ? 'bg-amber-500' // Extra significativo
                            : totalDayHours >= (targetUser?.dailyAvailableHours || 8)
                              ? 'bg-emerald-600' // Meta atingida
                              : 'bg-blue-500' // Parcial
                            }`}>
                            {formatDecimalToTime(totalDayHours)}
                          </span>
                        )}
                      </div>

                      {/* Holiday Indicator */}
                      {holiday && (
                        <div className="flex-1 flex flex-col items-center justify-center py-2 text-center pointer-events-none opacity-50">
                          <HolidayIcon className="w-4 h-4 mb-1" style={{ color: 'var(--text)' }} />
                          <span className="text-[7px] font-black uppercase whitespace-normal leading-tight px-1" style={{ color: 'var(--text)' }}>
                            {holiday.name}
                          </span>
                          {(holiday.period && holiday.period !== 'integral') && (
                            <span className="text-[6px] font-black uppercase text-[var(--primary)] mt-0.5">
                              {holiday.period}
                              {(holiday.isLastDay && holiday.endTime) ? ` até ${holiday.endTime}` : ''}
                            </span>
                          )}
                          {(holiday.isLastDay && holiday.endTime && (!holiday.period || holiday.period === 'integral')) && (
                            <span className="text-[6px] font-black uppercase text-[var(--primary)] mt-0.5">
                              Até {holiday.endTime}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Absence Indicator */}
                      {dayAbsence && (
                        <div className="flex-1 flex flex-col items-center justify-center py-2 text-center pointer-events-none">
                          {dayAbsence.type === 'férias' ? <Palmtree className="w-4 h-4 mb-1 text-emerald-500" /> : <Clock className="w-4 h-4 mb-1 text-blue-500" />}
                          <span className={`text-[7px] font-black uppercase whitespace-normal leading-tight px-1 ${dayAbsence.type === 'férias' ? 'text-emerald-500' : 'text-blue-500'}`}>
                            {dayAbsence.type}
                          </span>
                          {(dayAbsence.period && dayAbsence.period !== 'integral') && (
                            <span className="text-[6px] font-black uppercase text-[var(--primary)] mt-0.5">
                              {dayAbsence.period}
                              {(dateStr === dayAbsence.endDate && dayAbsence.endTime) ? ` até ${dayAbsence.endTime}` : ''}
                            </span>
                          )}
                          {(dateStr === dayAbsence.endDate && dayAbsence.endTime && (!dayAbsence.period || dayAbsence.period === 'integral')) && (
                            <span className="text-[6px] font-black uppercase text-[var(--primary)] mt-0.5">
                              Até {dayAbsence.endTime}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        {dayEntries.map((entry: TimesheetEntry) => {
                          const task = safeTasks.find((t: Task) => t.id === entry.taskId);
                          const client = safeClients.find((c: Client) => c.id === entry.clientId);
                          const project = safeProjects.find((p: Project) => p.id === entry.projectId);

                          // Título Inteligente: Tarefa > Descrição > Projeto > "Horas Avulsas"
                          let displayTitle = task?.title;
                          if (!displayTitle) {
                            if (entry.description) displayTitle = entry.description;
                            else if (project) displayTitle = `${project.name} (S/ Tarefa)`;
                            else displayTitle = 'Horas Avulsas';
                          }

                          return (
                            <div
                              key={entry.id}
                              onClick={(e) => { e.stopPropagation(); navigate(`/timesheet/${entry.id}`); }}
                              className="border shadow-md rounded-xl px-3 py-2.5 text-[11px] transition-all flex flex-col items-start gap-1.5 group/item mb-2 hover:-translate-y-0.5"
                              style={{
                                backgroundColor: 'var(--surface)',
                                borderColor: 'var(--border)',
                                color: 'var(--text)',
                              }}
                              title={`${client?.name || 'Cliente?'} - ${project?.name || 'Projeto?'}\n${entry.description || ''}`}
                            >
                              <div className="flex w-full justify-between items-center gap-2">
                                <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                                  <span className={`px-2 py-1 rounded-md text-[10px] font-black text-white shrink-0 shadow-sm leading-none ${entry.totalHours >= 4 ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                                    {formatDecimalToTime(entry.totalHours)}
                                  </span>
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="truncate font-black leading-tight" style={{ color: 'var(--text)' }}>{displayTitle}</span>
                                    <span className="text-[9px] font-bold opacity-60" style={{ color: 'var(--text)' }}>
                                      {entry.startTime} - {entry.endTime}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEntryToDelete(entry); setDeleteModalOpen(true); }}
                                  className="opacity-0 group-hover/item:opacity-100 transition-opacity hover:text-red-500 shrink-0"
                                  style={{ color: 'var(--muted)' }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Client & Project Mini-Tags */}
                              <div className="flex flex-wrap gap-2 w-full overflow-hidden mt-0.5">
                                {client && (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg truncate max-w-[100px] border transition-colors shadow-sm"
                                    style={{
                                      backgroundColor: 'var(--surface-2)',
                                      borderColor: 'var(--border)',
                                      color: 'var(--text-2)'
                                    }}>
                                    {client.name}
                                  </span>
                                )}
                                {project && (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg truncate max-w-[100px] border transition-colors shadow-sm"
                                    style={{
                                      backgroundColor: 'var(--primary-soft)',
                                      borderColor: 'rgba(124, 58, 237, 0.2)',
                                      color: 'var(--primary)'
                                    }}>
                                    {project.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Trailing Empty Slots to maintain 6-row grid consistency (Total 42 slots) */}
                {Array.from({ length: 42 - (firstDay + daysInMonth) }).map((_, i) => (
                  <div key={`empty-end-${i}`} className="min-h-[100px]" style={{ backgroundColor: 'var(--surface-hover)', opacity: 0.1 }}></div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        title="Excluir Apontamento"
        message="Tem certeza que deseja excluir este registro?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </div>
  );
};

export default TimesheetCalendar;
