// components/TeamList.tsx - Adaptado para Router
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataController } from '@/controllers/useDataController';
import { User, Task, TimesheetEntry } from '@/types';
import { Briefcase, Mail, CheckSquare, ShieldCheck, User as UserIcon, Search, Trash2, AlertCircle, CheckCircle, Plus, ChevronUp, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from './ConfirmationModal';
import { getRoleDisplayName } from '@/utils/normalizers';
import { getUserStatus } from '@/utils/userStatus';

const TeamList: React.FC = () => {
  const navigate = useNavigate();
  const { users, tasks, projects, clients, timesheetEntries, deleteUser, loading, absences } = useDataController();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCargo, setSelectedCargo] = useState<'Todos' | string>('Todos');
  const [showInactive, setShowInactive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Livre' | 'Ocupado' | 'Estudando' | 'Atrasado' | 'Ausente' | 'Fora do Fluxo'>('Todos');

  // Deletion state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Back to Top Logic
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setShowBackToTop(scrollTop > 300);
    sessionStorage.setItem('teamList_scrollPosition', String(scrollTop));
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // State Persistence - Initial Load
  useEffect(() => {
    const savedSearch = sessionStorage.getItem('teamList_searchTerm');
    const savedCargo = sessionStorage.getItem('teamList_selectedCargo');
    const savedInactive = sessionStorage.getItem('teamList_showInactive');
    const savedStatus = sessionStorage.getItem('teamList_statusFilter');

    if (savedSearch) setSearchTerm(savedSearch);
    if (savedCargo) setSelectedCargo(savedCargo);
    if (savedInactive) setShowInactive(savedInactive === 'true');
    if (savedStatus) setStatusFilter(savedStatus as any);
  }, []);

  // Scroll Restoration - Separate effect to wait for loading
  useEffect(() => {
    if (!loading && scrollRef.current) {
      const savedScroll = sessionStorage.getItem('teamList_scrollPosition');
      if (savedScroll) {
        const timer = setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = parseInt(savedScroll, 10);
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [loading]);

  useEffect(() => {
    sessionStorage.setItem('teamList_searchTerm', searchTerm);
    sessionStorage.setItem('teamList_selectedCargo', selectedCargo);
    sessionStorage.setItem('teamList_showInactive', String(showInactive));
    sessionStorage.setItem('teamList_statusFilter', statusFilter);
  }, [searchTerm, selectedCargo, showInactive, statusFilter]);

  // Helpers
  const isTaskDelayed = (task: Task): boolean => {
    return (task.daysOverdue ?? 0) > 0;
  };

  // Filter Logic
  const visibleUsers = useMemo(() => {
    return showInactive
      ? users.filter((u: User) => u.active === false)
      : users.filter((u: User) => u.active !== false);
  }, [users, showInactive]);

  const cargoOptions = useMemo(() => {
    return Array.from(new Set(visibleUsers.map((user: User) => user.cargo || 'Sem cargo informado')));
  }, [visibleUsers]);

  // Memo para identificar desenvolvedores com atrasos
  const lateDevelopers = useMemo(() => {
    const devMap = new Map<string, { user: User; count: number }>();
    tasks.forEach((t: Task) => {
      if (isTaskDelayed(t) && t.developerId) {
        const u = users.find((user: User) => user.id === t.developerId);
        if (u) {
          const existing = devMap.get(t.developerId) || { user: u, count: 0 };
          devMap.set(t.developerId, { ...existing, count: existing.count + 1 });
        }
      }
    });
    return Array.from(devMap.values()).sort((a, b) => b.count - a.count);
  }, [tasks, users]);

  const filteredUsers = useMemo(() => {
    return visibleUsers.filter((user: User) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());

      const cargoValue = user.cargo || 'Sem cargo informado';
      const matchesCargo = selectedCargo === 'Todos' || cargoValue === selectedCargo;

      const status = getUserStatus(user, tasks, projects, clients, absences);
      const statusLabel = status.label;

      // "Fora do Fluxo" só deve ser mostrado se o filtro for especificamente ele
      if (statusLabel === 'Fora do Fluxo' && statusFilter !== 'Fora do Fluxo') {
        return false;
      }

      let matchesStatus = true;
      if (statusFilter !== 'Todos') {
        if (statusFilter === 'Ausente') {
          // Filtra por qualquer tipo de ausência (Férias, Atestado, etc.)
          const absenceTypes = ['Férias', 'Atestado', 'Day Off', 'Feriado Local'];
          matchesStatus = absenceTypes.includes(statusLabel);
        } else {
          matchesStatus = statusLabel === statusFilter;
        }
      }

      return matchesSearch && matchesCargo && matchesStatus;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [visibleUsers, searchTerm, selectedCargo, statusFilter, tasks, projects, clients, absences]);


  const getUserMissingDays = (userId: string) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let workDaysCount = 0;
    const foundDays = new Set<string>();

    const userEntries = timesheetEntries.filter((e: TimesheetEntry) =>
      e.userId === userId &&
      new Date(e.date).getMonth() === currentMonth &&
      new Date(e.date).getFullYear() === currentYear
    );

    userEntries.forEach((e: TimesheetEntry) => foundDays.add(e.date));

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    for (let d = new Date(firstDayOfMonth); d <= yesterday; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day >= 1 && day <= 5) workDaysCount++; // Mon-Fri
    }

    const workedDays = userEntries.map((e: TimesheetEntry) => e.date).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).length;
    // Simplificação: apenas dias passados vs entradas únicas. 
    // Lógica completa requereria verificar feriados e map exato.

    return Math.max(0, workDaysCount - workedDays);
  };

  const handleDeleteClick = (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (userToDelete) {
      try {
        // Se o controller tiver metodo deleteUser (precisa adicionar se não tiver)
        if (deleteUser) {
          await deleteUser(userToDelete.id);
        } else {
          alert("Funcionalidade de exclusão não implementada no controller ainda.");
        }
      } catch (e) {
        alert("Erro ao excluir usuário");
      }
    }
    setDeleteModalOpen(false);
    setUserToDelete(null);
  };

  return (
    <div className="h-full flex flex-col rounded-2xl shadow-sm border overflow-hidden"
      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
      <div className="px-6 py-5 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 z-10"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex flex-col md:flex-row justify-between items-center w-full gap-6">
          {/* Lado Esquerdo: Título e Filtros de Status */}
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
              {showInactive ? 'Colaboradores Desligados' : 'Equipe'}
            </h1>

            {!showInactive && (
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] shadow-inner">
                {[
                  { id: 'Todos', label: 'Todos', color: 'var(--primary)' },
                  { id: 'Livre', label: 'Livres', color: '#10b981' },
                  { id: 'Estudando', label: 'Estudando', color: '#3b82f6' },
                  { id: 'Ocupado', label: 'Ocupados', color: '#f59e0b' },
                  { id: 'Atrasado', label: 'Atrasados', color: '#ef4444' },
                  { id: 'Ausente', label: 'Ausentes', color: '#f97316' },
                  { id: 'Fora do Fluxo', label: 'Fora do Fluxo', color: '#64748b' }
                ].map((f) => {
                  const isActive = statusFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setStatusFilter(f.id as any)}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? 'shadow-md text-white' : 'text-[var(--textMuted)] hover:text-[var(--text)]'
                        }`}
                      style={{
                        backgroundColor: isActive ? f.color : 'transparent',
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lado Direito: Filtros de Cargo, Busca e Botão Adicionar */}
          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-48">
              <select
                value={selectedCargo}
                onChange={(e) => setSelectedCargo(e.target.value)}
                className="w-full appearance-none pl-4 pr-10 py-2 rounded-xl border focus:ring-2 focus:ring-[var(--ring)] outline-none text-sm shadow-sm"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)'
                }}
              >
                <option value="Todos">Todos os cargos</option>
                {cargoOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <Briefcase className="absolute right-3 top-2.5 w-4 h-4 pointer-events-none" style={{ color: 'var(--muted)' }} />
            </div>

            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-4 pr-10 py-2 border rounded-xl focus:ring-2 focus:ring-[var(--ring)] outline-none text-sm shadow-sm"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)'
                }}
              />
              {searchTerm ? (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-2.5 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <Search className="absolute right-3 top-2.5 w-4 h-4" style={{ color: 'var(--muted)' }} />
              )}
            </div>

            {!showInactive && (
              <button
                onClick={() => navigate('/admin/team/new')}
                className="px-6 py-2 text-white rounded-xl font-bold text-sm shadow flex items-center gap-2 transition-colors whitespace-nowrap"
                style={{ backgroundColor: 'var(--primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary)'}
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* NOVO: Lista de Avatares Atrasados */}
      <AnimatePresence>
        {statusFilter === 'Atrasado' && lateDevelopers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-6 py-4 flex items-center gap-4 bg-red-500/5 border-b border-red-500/20 overflow-hidden"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Em Atraso</span>
              <span className="text-xs text-slate-400 font-bold">{lateDevelopers.length} Colaboradores</span>
            </div>
            <div className="h-8 w-px bg-[var(--border)] mx-2" />
            <div className="flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar-thin">
              {lateDevelopers.map(({ user, count }) => {
                const isSelected = searchTerm === user.name;
                return (
                  <button
                    key={user.id}
                    onClick={() => setSearchTerm(prev => prev === user.name ? '' : user.name)}
                    className={`flex-shrink-0 relative group ${isSelected ? 'scale-110' : 'opacity-70 hover:opacity-100 hover:scale-105'} transition-all duration-300`}
                    title={isSelected ? "Limpar filtro" : `Filtrar por ${user.name}`}
                  >
                    <div className={`w-12 h-12 rounded-full border-2 p-0.5 transition-all duration-300 ${isSelected ? 'border-red-500 ring-2 ring-red-500/30' : 'border-red-500/30 group-hover:border-red-500'}`}>
                      <div className="w-full h-full rounded-full overflow-hidden bg-[var(--surface-2)]">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null; // Prevent infinite loop
                              target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=f8fafc&color=475569`;
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm font-black text-white bg-gradient-to-br from-red-600 to-amber-600">
                            {user.name.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Badge de Contador */}
                    <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[var(--bg)] shadow-lg">
                      {count}
                    </div>
                    {isSelected && (
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-500 text-[8px] px-1.5 py-0.5 rounded text-white whitespace-nowrap z-20 font-bold">
                        FILTRADO
                      </div>
                    )}
                    <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 transition-opacity bg-black text-[9px] px-1.5 py-0.5 rounded text-white whitespace-nowrap z-10 ${isSelected ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                      {user.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Filter Bar removido do topo para ficar ao lado do título */}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 custom-scrollbar"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--primary)' }}></div>
              <p className="animate-pulse" style={{ color: 'var(--muted)' }}>Carregando equipe...</p>
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--muted)' }}>
            <div className="text-center">
              <UserIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">Nenhum colaborador encontrado</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredUsers.map(user => {
              const userAllTasks = tasks.filter(t => t.developerId === user.id);
              const userActiveTasks = userAllTasks.filter(t => t.status !== 'Done');
              const delayedTasks = userActiveTasks.filter(isTaskDelayed);

              return (
                <div
                  key={user.id}
                  className="p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col relative overflow-hidden"
                  data-status={getUserStatus(user, tasks, projects, clients, absences).label.toLowerCase()}
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)'
                  }}
                  onMouseEnter={(e) => {
                    const status = e.currentTarget.getAttribute('data-status');
                    e.currentTarget.style.borderColor = status === 'atrasado' ? '#ef4444' : 'var(--primary)';
                    e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }}
                  onClick={() => navigate(`/admin/team/${user.id}`)}
                >
                  {(() => {
                    const status = getUserStatus(user, tasks, projects, clients, absences);
                    const statusLabel = status.label;
                    const accentColor = status.color;
                    const accentBg = `${status.color}1A`; // 0.1 opacity

                    return (
                      <>
                        <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: accentColor }} />
                        <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[9px] font-black uppercase tracking-widest text-white shadow-lg z-20"
                          style={{ backgroundColor: accentColor }}> {/* Mantém fundo sólido para destaque no topo */}
                          {statusLabel}
                        </div>

                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundColor: accentColor }} />

                        <div className="flex items-center gap-4 mb-4 relative z-10">
                          <div className="w-14 h-14 rounded-full flex items-center justify-center border-2 shadow-sm overflow-hidden font-bold text-xl"
                            style={{
                              backgroundColor: 'var(--surface-2)',
                              color: 'var(--text)',
                              borderColor: accentColor
                            }}>
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt={user.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.onerror = null;
                                  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=f8fafc&color=475569`;
                                }}
                              />
                            ) : (
                              user.name.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base font-bold truncate" style={{ color: 'var(--text)' }}>{user.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase shadow-sm border`}
                                style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)', borderColor: 'rgba(76, 29, 149, 0.1)' }}>
                                {user.cargo || 'Operacional'}
                              </span>
                              <p className="text-xs font-semibold truncate" style={{ color: 'var(--muted)' }}>{getRoleDisplayName(user.role)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm mb-4 relative z-10" style={{ color: 'var(--text)' }}>
                          <div className="flex items-center gap-2 text-xs">
                            <Mail className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
                            <span className="truncate text-slate-400">{user.email}</span>
                          </div>

                          <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider mt-2">
                            {delayedTasks.length > 0 && (
                              <span className="px-2.5 py-1 rounded-full border flex items-center gap-1 shadow-sm"
                                style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                                <AlertCircle className="w-3 h-3" /> {delayedTasks.length} atrasos
                              </span>
                            )}
                            <span className="px-2.5 py-1 rounded-full border flex items-center gap-1 shadow-sm"
                              style={{
                                backgroundColor: accentBg,
                                color: accentColor,
                                borderColor: `${accentColor}44`
                              }}>
                              {statusLabel === 'Livre' ? <CheckCircle className="w-3 h-3" /> : <Briefcase className="w-3 h-3" />}
                              {userActiveTasks.length} tarefas
                            </span>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Actions removed as requested */}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Back to Top Button */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            onClick={scrollToTop}
            className="absolute bottom-8 right-8 z-[100] w-12 h-12 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all border border-white/10"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'white'
            }}
            title="Voltar ao topo"
          >
            <ChevronUp className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        title="Excluir Colaborador"
        message={`Tem certeza que deseja remover "${userToDelete?.name}"?`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModalOpen(false)}
        disabled={loading}
      />
    </div>
  );
};

export default TeamList;
