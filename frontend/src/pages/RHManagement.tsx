import React, { useState, useMemo } from 'react';
import { useDataController } from '@/controllers/useDataController';
import { useAuth } from '@/contexts/AuthContext';
import { Absence } from '@/types';
import {
    Calendar, Users as UsersIcon, Clock, CheckCircle, XCircle, AlertCircle,
    Search, UserPlus, Download, Trash2, ShieldCheck, CheckCheck,
    Landmark, Info, Plus, Flag, ArrowRight, RotateCcw, Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '@/components/ConfirmationModal';
import HolidayManager from '@/components/HolidayManager';
import AbsenceManager from '@/components/AbsenceManager';
import { addBusinessDays } from '@/utils/capacity';


const RHManagement: React.FC = () => {
    const { isAdmin, currentUser } = useAuth();
    const { absences, users, updateAbsence, deleteAbsence, holidays } = useDataController();

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | Absence['status']>('all');
    const [towerFilter, setTowerFilter] = useState('all');
    const [activeTab, setActiveTab] = useState<'requests' | 'calendar' | 'collaborators' | 'holidays'>('requests');
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    const [loading, setLoading] = useState(false);
    const [actionModal, setActionModal] = useState<{ id: string, type: 'approve' | 'reject' | 'delete' | 'revert' } | null>(null);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [editingAbsenceId, setEditingAbsenceId] = useState<string | null>(null);

    // Filters
    const filteredAbsences = useMemo(() => {
        return absences.filter(a => {
            const user = users.find(u => u.id === a.userId);
            const matchesSearch = user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                a.observations?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
            const matchesTower = towerFilter === 'all' || user?.torre === towerFilter;
            return matchesSearch && matchesStatus && matchesTower;
        }).sort((a, b) => b.startDate.localeCompare(a.startDate));
    }, [absences, users, searchTerm, statusFilter, towerFilter]);

    const handleAction = async () => {
        if (!actionModal) return;
        setLoading(true);
        try {
            const current = absences.find(a => a.id === actionModal.id);
            if (!current) return;

            if (actionModal.type === 'approve') {
                let nextStatus: Absence['status'] = current.status;
                if (current.status === 'sugestao') nextStatus = 'aprovada_gestao';
                else if (current.status === 'aprovada_gestao') nextStatus = 'aprovada_rh';
                else if (current.status === 'aprovada_rh') nextStatus = 'finalizada_dp';
                await updateAbsence(actionModal.id, { status: nextStatus });
            } else if (actionModal.type === 'reject') {
                await updateAbsence(actionModal.id, { status: 'rejeitado' });
            } else if (actionModal.type === 'revert') {
                await updateAbsence(actionModal.id, { status: 'sugestao' });
            } else if (actionModal.type === 'delete') {
                await deleteAbsence(actionModal.id);
            }
            setActionModal(null);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusStyle = (status: Absence['status']) => {
        switch (status) {
        case 'sugestao': return 'surface-tinted-amber text-amber-700 dark:text-amber-400 border';
        case 'aprovada_gestao': return 'surface-tinted-blue text-cyan-700 dark:text-cyan-400 border';
        case 'aprovada_rh': return 'surface-tinted-emerald text-emerald-700 dark:text-emerald-400 border';
        case 'finalizada_dp': return 'surface-tinted-purple text-purple-700 dark:text-purple-400 border';
        case 'rejeitado': return 'surface-tinted-red text-rose-700 dark:text-rose-400 border';
        default: return 'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]';
        }
    };

    const getStatusLabel = (status: Absence['status']) => {
        switch (status) {
            case 'sugestao': return '1. Sugestão';
            case 'aprovada_gestao': return '2. Gestão';
            case 'aprovada_rh': return '3. RH';
            case 'finalizada_dp': return '4. Lançada DP';
            case 'rejeitado': return 'Rejeitado';
            default: return status;
        }
    };

    const calculateDays = (start: string, end: string) => {
        const d1 = new Date(start + 'T00:00:00');
        const d2 = new Date(end + 'T00:00:00');
        const diff = d2.getTime() - d1.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
    };

    if (!isAdmin) return null;

    return (
        <div className="h-full flex bg-[var(--bg)] overflow-hidden">
            {/* SIDEBAR DE NAVEGAÇÃO LOCAL - PREMIUM */}
            <aside className="w-64 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col p-6 gap-8 hidden md:flex shrink-0">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-[var(--primary)] rounded-xl text-white shadow-lg shadow-purple-500/20">
                            <UsersIcon size={18} />
                        </div>
                        <h1 className="text-sm font-black text-[var(--text)] uppercase tracking-tighter leading-none">Gestão de RH</h1>
                    </div>
                    <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest pl-1">Férias & Ausências</p>
                </div>

                <nav className="flex flex-col gap-1.5 flex-1">
                    {[
                        { id: 'requests', label: 'Fluxo Aprovação', icon: Clock },
                        { id: 'calendar', label: 'Mapa Anual', icon: Calendar },
                        { id: 'collaborators', label: 'Saldos de Férias', icon: UserPlus },
                        { id: 'holidays', label: 'Feriados & Pontos', icon: Flag }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id as any)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-black uppercase transition-all ${activeTab === t.id ? 'bg-[var(--primary)] text-white shadow-xl shadow-purple-500/20' : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'}`}
                        >
                            <t.icon size={16} /> {t.label}
                        </button>
                    ))}
                </nav>

                <div className="p-4 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 mt-auto">
                    <p className="text-[9px] font-black text-indigo-500 uppercase mb-2">Resumo Pendências</p>
                    <div className="space-y-2">
                        {[
                            { status: 'sugestao', label: '1. Sugestões', color: 'bg-amber-400' },
                            { status: 'aprovada_gestao', label: '2. Gestão', color: 'bg-cyan-400' },
                            { status: 'aprovada_rh', label: '3. RH', color: 'bg-emerald-400' }
                        ].map(s => (
                            <div key={s.status} className="flex justify-between items-center text-[10px] font-black text-[var(--text)]">
                                <span className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${s.color}`} /> {s.label}
                                </span>
                                <span>{absences.filter(a => a.status === s.status).length}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </aside>

            {/* ÁREA DE CONTEÚDO PRINCIPAL */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* TOP BAR ACTION */}
                <header className="h-20 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <button className="md:hidden p-2 text-[var(--muted)]"><UsersIcon size={20} /></button>
                        <div>
                            <h2 className="text-xl font-black text-[var(--text)] leading-none italic">
                                {activeTab === 'requests' ? 'Pipeline de Aprovação' : activeTab === 'calendar' ? 'Visibilidade de Equipe' : activeTab === 'collaborators' ? 'Gestão de Saldos' : 'Configurações'}
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex flex-col text-right">
                            <p className="text-[10px] font-black text-[var(--muted)] uppercase leading-none mb-1">Status do Ciclo</p>
                            <p className="text-[11px] font-black text-emerald-500 uppercase leading-none">Ativo 2026</p>
                        </div>
                        <button
                            onClick={() => setShowRequestModal(true)}
                            className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase flex items-center gap-2 hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/20 active:scale-95"
                        >
                            <Plus size={16} /> Criar Solicitação
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
                    {activeTab === 'requests' && (
                        <div className="flex flex-col xl:flex-row gap-6 animate-in fade-in duration-500 h-full min-h-0">
                            {/* LEFT SIDE: LIST & FILTERS */}
                            <div className="flex-1 flex flex-col space-y-4 min-w-0">
                                <div className="bg-[var(--surface-2)] p-1.5 rounded-2xl border border-[var(--border)] flex flex-col md:flex-row items-center gap-3 shadow-sm">
                                    <div className="flex-1 flex items-center bg-[var(--surface)] rounded-xl px-3 py-2 gap-2 border border-[var(--border)] w-full">
                                        <Search size={14} className="text-[var(--muted)]" />
                                        <input
                                            type="text"
                                            placeholder="Procurar por nome ou observação..."
                                            className="bg-transparent border-none outline-none w-full text-[11px] font-black placeholder:text-[var(--muted)]"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-2 w-full md:w-auto">
                                        <select
                                            value={towerFilter}
                                            onChange={(e) => setTowerFilter(e.target.value)}
                                            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[9px] font-black outline-none uppercase min-w-[100px]"
                                        >
                                            <option value="all">TODAS TORRES</option>
                                            {Array.from(new Set(users.map(u => u.torre).filter(Boolean))).map(t => (
                                                <option key={t} value={t!}>{t!.toUpperCase()}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value as any)}
                                            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[9px] font-black outline-none uppercase min-w-[100px]"
                                        >
                                            <option value="all">TODOS STATUS</option>
                                            <option value="sugestao">1. Sugestão</option>
                                            <option value="aprovada_gestao">2. Gestão</option>
                                            <option value="aprovada_rh">3. RH</option>
                                            <option value="finalizada_dp">4. DP/PAGO</option>
                                        </select>
                                    </div>
                                    <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 border-l border-[var(--border)] ml-1">
                                        <span title="1. Sugestão" className="w-2.5 h-2.5 rounded bg-amber-400 border border-amber-600/20" />
                                        <span title="2. Gestão" className="w-2.5 h-2.5 rounded bg-cyan-400 border border-blue-600/20" />
                                        <span title="3. RH" className="w-2.5 h-2.5 rounded bg-emerald-400 border border-emerald-600/20" />
                                        <span title="4. DP" className="w-2.5 h-2.5 rounded bg-purple-400 border border-purple-600/20" />
                                    </div>
                                </div>

                                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
                                    <div className="grid grid-cols-12 gap-2 p-2.5 bg-[var(--surface-2)] border-b border-[var(--border)] text-[9px] font-black uppercase text-[var(--muted)] sticky top-0 z-10">
                                        <span className="col-span-3 border-r border-[var(--border)] pr-2">Colaborador / Tipo</span>
                                        <span className="col-span-2 border-r border-[var(--border)] pr-2 text-center">Período</span>
                                        <span className="col-span-1 border-r border-[var(--border)] pr-2 text-center">Dias</span>
                                        <span className="col-span-2 border-r border-[var(--border)] pr-2">Torre / Cargo</span>
                                        <span className="col-span-2 border-r border-[var(--border)] pr-2 text-center">Status</span>
                                        <span className="col-span-2 text-right pr-4">Ações</span>
                                    </div>
                                    <div className="divide-y divide-[var(--border)] overflow-y-auto custom-scrollbar">
                                        {filteredAbsences.map(a => {
                                            const user = users.find(u => u.id === a.userId);
                                            const days = calculateDays(a.startDate, a.endDate);
                                            return (
                                                <div key={a.id} className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-[var(--primary-soft)]/30 transition-colors group">
                                                    <div className="col-span-3 flex items-center gap-3 min-w-0">
                                                        <div className="w-8 h-8 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center font-black text-xs shrink-0">
                                                            {user?.name.charAt(0)}
                                                        </div>
                                                        <div className="truncate">
                                                            <p className="text-[11px] font-black text-[var(--text)] truncate">{user?.name}</p>
                                                            <p className="text-[8px] font-black text-[var(--muted)] uppercase">{a.type}</p>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2 text-[10px] font-black text-[var(--text)]">
                                                        <div className="flex flex-col">
                                                            <span>{new Date(a.startDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - {new Date(a.endDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                                            <span className="text-[8px] text-emerald-600 uppercase font-black">Retorno: {new Date(addBusinessDays(a.endDate, 1, holidays) + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-1 text-center font-black text-xs text-[var(--primary)] bg-[var(--primary-soft)]/50 py-1 rounded-lg border border-[var(--primary-soft)]">
                                                        {days}d
                                                    </div>
                                                    <div className="col-span-2 truncate text-[9px] font-black text-[var(--text)] uppercase">
                                                        {user?.torre || 'N/A'}
                                                    </div>
                                                    <div className="col-span-2">
                                                        <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase border shadow-sm block text-center truncate ${getStatusStyle(a.status)}`}>
                                                            {getStatusLabel(a.status)}
                                                        </span>
                                                    </div>
                                                    <div className="col-span-2 flex items-center justify-end gap-1.5 flex-wrap">
                                                        <button
                                                            onClick={() => {
                                                                setEditingAbsenceId(a.id);
                                                                setShowRequestModal(true);
                                                            }}
                                                            className="h-7 w-7 flex items-center justify-center bg-slate-50 text-slate-400 rounded-lg hover:bg-[var(--primary)] hover:text-white border border-slate-100"
                                                            title="Editar Solicitação"
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>

                                                        {a.status !== 'finalizada_dp' && a.status !== 'rejeitado' && (
                                                            <button onClick={() => setActionModal({ id: a.id, type: 'approve' })} className="h-7 px-3 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase hover:bg-emerald-500 transition-all">Avançar</button>
                                                        )}
                                                        {a.status === 'rejeitado' && (
                                                            <button onClick={() => setActionModal({ id: a.id, type: 'revert' })} className="h-7 w-7 flex items-center justify-center bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white border border-blue-200"><RotateCcw size={12} /></button>
                                                        )}
                                                        <button onClick={() => setActionModal({ id: a.id, type: 'delete' })} className="h-7 w-7 flex items-center justify-center bg-slate-50 text-slate-400 rounded-lg hover:bg-red-500 hover:text-white border border-slate-100 opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT SIDE: SIDEBAR */}
                            <div className="w-full xl:w-[340px] flex-shrink-0 flex flex-col gap-6">
                                {/* POLÍTICAS 2026 - Dark Theme as requested */}
                                <div className="bg-[#130E1F] border border-[#2A233C] rounded-[24px] p-6 shadow-xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                                        <ShieldCheck size={80} className="text-white" />
                                    </div>
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                            <Info size={14} />
                                        </div>
                                        <h3 className="text-[13px] font-bold tracking-widest text-[#EADDFF]">POLÍTICAS 2026</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {[
                                            { text: 'Solicite com 30d de antecedência', color: 'bg-amber-400' },
                                            { text: 'Um período deve ter 14d+', color: 'bg-cyan-400' },
                                            { text: 'Duração mínima de 5d fixos', color: 'bg-indigo-400' }
                                        ].map((rule, idx) => (
                                            <div key={idx} className="flex items-center gap-3 p-3 bg-[#1B1429]/80 rounded-xl border border-[#2A233C]/50">
                                                <div className={`w-1.5 h-1.5 rounded-full ${rule.color}`} />
                                                <span className="text-[11px] font-medium text-[#D0C6E6]">{rule.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}

                    {activeTab === 'calendar' && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[var(--surface)] p-4 rounded-[2rem] border border-[var(--border)] shadow-xl">
                                <div>
                                    <h3 className="text-sm font-black uppercase text-[var(--text)] tracking-[0.2em] italic">Mapa Anual de Disponibilidade</h3>
                                    <p className="text-[10px] font-bold text-[var(--muted)] uppercase">Visão completa do ciclo {currentYear}</p>
                                </div>
                                <div className="flex items-center gap-6 bg-[var(--surface-2)] px-6 py-3 rounded-2xl border border-[var(--border)]">
                                    <button onClick={() => setCurrentYear(currentYear - 1)} className="p-1 hover:bg-[var(--primary-soft)] rounded ring-1 ring-[var(--border)] transition-all cursor-pointer"><Clock size={14} /></button>
                                    <span className="text-sm font-black text-[var(--text)] px-4">{currentYear}</span>
                                    <button onClick={() => setCurrentYear(currentYear + 1)} className="p-1 hover:bg-[var(--primary-soft)] rounded ring-1 ring-[var(--border)] transition-all cursor-pointer"><Calendar size={14} /></button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(monthIdx => {
                                    const d = new Date(currentYear, monthIdx, 1);
                                    const monthAbsences = absences.filter(a => {
                                        const aStart = new Date(a.startDate + 'T00:00:00');
                                        const aEnd = new Date(a.endDate + 'T23:59:59');
                                        return (aStart.getFullYear() === currentYear && aStart.getMonth() === monthIdx) || (aEnd.getFullYear() === currentYear && aEnd.getMonth() === monthIdx);
                                    }).filter(a => a.status !== 'rejeitado');
                                    return (
                                        <div key={monthIdx} className="bg-[var(--surface)] border border-[var(--border)] rounded-[2.5rem] p-5 shadow-lg flex flex-col gap-3">
                                            <h4 className="text-[12px] font-black uppercase text-[var(--primary)] border-b pb-2 border-[var(--border)]">{d.toLocaleDateString('pt-BR', { month: 'long' })}</h4>
                                            <div className="space-y-1">
                                                {monthAbsences.map(a => (
                                                    <div key={a.id} className="flex justify-between items-center text-[9px] font-black bg-[var(--surface-2)]/50 p-1.5 rounded-lg">
                                                        <span className="truncate max-w-[80px]">{users.find(u => u.id === a.userId)?.name.split(' ')[0]}</span>
                                                        <span className="text-[8px] opacity-50">{new Date(a.startDate + 'T00:00:00').getDate()}/{monthIdx + 1} - {new Date(a.endDate + 'T00:00:00').getDate()}/{new Date(a.endDate + 'T00:00:00').getMonth() + 1}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'collaborators' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {users.filter(u => u.active !== false).map(user => {
                                const userAbsences = absences.filter(a => a.userId === user.id && a.type === 'férias' && a.status !== 'rejeitado');
                                const totalDays = userAbsences.reduce((acc, a) => acc + calculateDays(a.startDate, a.endDate), 0);
                                const percent = Math.min((totalDays / 30) * 100, 100);
                                return (
                                    <div key={user.id} className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-sm">
                                        <p className="text-[12px] font-black text-[var(--text)]">{user.name}</p>
                                        <div className="h-2 bg-[var(--bg-app)] rounded-full mt-2 overflow-hidden border border-[var(--border)]">
                                            <div className={`h-full ${percent > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${percent}%` }} />
                                        </div>
                                        <p className="text-[9px] font-black mt-1 text-[var(--muted)] uppercase">{totalDays} / 30 DIAS</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {activeTab === 'holidays' && (
                        <div className="flex-1 bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm p-4">
                            <HolidayManager />
                        </div>
                    )}

                    <footer className="mt-12 p-8 bg-[var(--surface)] border border-[var(--border)] rounded-[3rem] flex flex-col items-center text-center gap-4 relative overflow-hidden group shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="p-4 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] ring-4 ring-white dark:ring-slate-900 shadow-lg">
                            <ShieldCheck size={32} />
                        </div>
                        <div className="max-w-2xl relative">
                            <h4 className="text-sm font-black text-[var(--text)] uppercase tracking-[0.2em] mb-2 font-serif italic text-purple-600">Central de Conformidade & Suporte RH</h4>
                            <p className="text-[12px] font-bold text-[var(--text-2)] leading-relaxed">
                                Em caso de dúvidas sobre saldo de férias, período aquisitivo ou regras do processo corporativo, por favor, entre em contato com o departamento de RH através dos canais oficiais. Nosso time está à disposição para garantir seu descanso com segurança jurídica.
                            </p>
                        </div>
                        <div className="flex gap-4 mt-2">
                            <div className="px-4 py-1.5 bg-[var(--surface-2)] rounded-full text-[9px] font-black border border-[var(--border)] uppercase tracking-tighter shadow-sm">Regras de Retenção 2026</div>
                            <div className="px-4 py-1.5 bg-[var(--surface-2)] rounded-full text-[9px] font-black border border-[var(--border)] uppercase tracking-tighter shadow-sm">SLA de Atendimento: 48h</div>
                        </div>
                    </footer>
                </div>
            </main>

            <ConfirmationModal
                isOpen={!!actionModal}
                title={actionModal?.type === 'approve' ? 'Avançar Solicitação' : actionModal?.type === 'reject' ? 'Rejeitar Solicitação' : actionModal?.type === 'revert' ? 'Reverter Status' : 'Excluir Item'}
                message="Confirma esta operação? Esta ação poderá alterar o status do registro permanentemente."
                onConfirm={handleAction}
                onCancel={() => setActionModal(null)}
                confirmColor={actionModal?.type === 'approve' ? 'blue' : 'red'}
            />

            <AnimatePresence>
                {showRequestModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRequestModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-[var(--bg)] w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-[40px] shadow-2xl border border-[var(--border)] flex flex-col">
                            <div className="p-6 border-b flex justify-between items-center bg-[var(--surface-2)]">
                                <div className="flex flex-col">
                                    <h2 className="text-lg font-black uppercase text-[var(--text)]">
                                        {editingAbsenceId ? 'Editar Solicitação' : 'Nova Solicitação'}
                                    </h2>
                                    <p className="text-[10px] font-bold text-[var(--muted)] uppercase">Submeta ao fluxo de RH</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowRequestModal(false);
                                        setEditingAbsenceId(null);
                                    }}
                                    className="p-2 hover:bg-[var(--surface)] rounded-2xl text-[var(--muted)] shadow-sm"
                                >
                                    <XCircle size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[var(--bg)]">
                                <AbsenceManager
                                    targetUserId={editingAbsenceId ? absences.find(a => a.id === editingAbsenceId)?.userId : currentUser?.id}
                                    targetUserName={editingAbsenceId ? users.find(u => u.id === absences.find(ab => ab.id === editingAbsenceId)?.userId)?.name : currentUser?.name}
                                    initialAbsenceId={editingAbsenceId}
                                    onClose={() => {
                                        setShowRequestModal(false);
                                        setEditingAbsenceId(null);
                                    }}
                                />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RHManagement;
