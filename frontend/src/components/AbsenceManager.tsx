import React, { useState, useMemo, useEffect } from 'react';
import { useDataController } from '@/controllers/useDataController';
import { useAuth } from '@/contexts/AuthContext';
import { Absence, User } from '@/types';
import { Calendar, Plus, Trash2, Edit2, AlertCircle, Info, CheckCircle, Clock, Plane, Stethoscope, Palmtree, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from './ConfirmationModal';
import { addBusinessDays } from '@/utils/capacity';

interface AbsenceManagerProps {
    targetUserId?: string;
    targetUserName?: string;
    initialAbsenceId?: string | null;
    onClose?: () => void;
}

const AbsenceManager: React.FC<AbsenceManagerProps> = ({ targetUserId, targetUserName, initialAbsenceId, onClose }) => {
    const { currentUser, isAdmin } = useAuth();
    const { absences, users, createAbsence, updateAbsence, deleteAbsence, tasks, updateTask, projectMembers, holidays } = useDataController();
    const [isAdding, setIsAdding] = useState(false);
    const [editingAbsenceId, setEditingAbsenceId] = useState<string | null>(null);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // Context determines whose absences we manage
    const effectiveUserId = targetUserId || currentUser?.id;
    const effectiveUserName = targetUserName || (effectiveUserId === currentUser?.id ? 'Minhas' : 'do Colaborador');

    // Form states
    const [type, setType] = useState<Absence['type']>('férias');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [observations, setObservations] = useState('');
    const [period, setPeriod] = useState<Absence['period']>('integral');
    const [endTime, setEndTime] = useState('');
    const [loading, setLoading] = useState(false);

    // Filter absences for the effective user
    const myAbsences = useMemo(() => {
        if (!effectiveUserId) return [];
        return absences.filter(a => a.userId === effectiveUserId).sort((a, b) => b.startDate.localeCompare(a.startDate));
    }, [absences, effectiveUserId]);

    // Externally triggered edit
    useEffect(() => {
        if (initialAbsenceId) {
            const absence = absences.find(a => a.id === initialAbsenceId);
            if (absence) {
                handleEdit(absence);
            }
        }
    }, [initialAbsenceId, absences]);

    // Check for task collisions (tasks active during absence)
    const collidingTasks = useMemo(() => {
        if (!startDate || !endDate || !effectiveUserId) return [];

        return tasks.filter(t => {
            if (t.developerId !== effectiveUserId) return false;
            if (t.status === 'Done') return false;

            const taskEnd = t.estimatedDelivery;
            const taskStart = t.scheduledStart || taskEnd;

            return (taskStart <= endDate && taskEnd >= startDate);
        });
    }, [tasks, startDate, endDate, effectiveUserId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!effectiveUserId) return;

        try {
            setLoading(true);
            const payload: Partial<Absence> = {
                userId: effectiveUserId,
                type,
                startDate,
                endDate,
                status: isAdmin ? 'aprovada_gestao' : 'sugestao',
                observations,
                period,
                endTime: endTime ? endTime : undefined
            };

            if (editingAbsenceId) {
                await updateAbsence(editingAbsenceId, payload);
            } else {
                await createAbsence(payload);
            }

            if (onClose) onClose();
            setIsAdding(false);
            setEditingAbsenceId(null);
            resetForm();
        } catch (error) {
            console.error(error);
            alert('Erro ao registrar ausência.');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (absence: Absence) => {
        setEditingAbsenceId(absence.id);
        setType(absence.type);
        setStartDate(absence.startDate);
        setEndDate(absence.endDate);
        setObservations(absence.observations || '');
        setPeriod(absence.period || 'integral');
        setEndTime(absence.endTime || '');
        setIsAdding(true);
    };

    const resetForm = () => {
        setType('férias');
        setStartDate('');
        setEndDate('');
        setObservations('');
        setPeriod('integral');
        setEndTime('');
        setEditingAbsenceId(null);
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        try {
            setLoading(true);
            await deleteAbsence(itemToDelete);
            setItemToDelete(null);
        } catch (error) {
            alert('Erro ao excluir.');
        } finally {
            setLoading(false);
        }
    };

    const getTypeIcon = (t: Absence['type']) => {
        switch (t) {
            case 'férias': return <Palmtree className="w-4 h-4" />;
            case 'atestado': return <Stethoscope className="w-4 h-4" />;
            case 'day-off': return <Clock className="w-4 h-4" />;
            default: return <Calendar className="w-4 h-4" />;
        }
    };

    const getTypeColor = (t: Absence['type']) => {
        switch (t) {
            case 'férias': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
            case 'atestado': return 'bg-rose-500/10 text-rose-600 border-rose-200';
            case 'day-off': return 'bg-blue-500/10 text-blue-600 border-blue-200';
            default: return 'bg-slate-500/10 text-slate-600 border-slate-200';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-black text-[var(--text)]">
                        {targetUserId ? `Ausências: ${targetUserName}` : 'Minhas Ausências'}
                    </h2>
                    <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">
                        {editingAbsenceId ? 'Editando registro existente' : 'Gerenciamento de férias, atestados e folgas'}
                    </p>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-[var(--primary)] text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-purple-500/20"
                    >
                        <Plus size={16} /> Agendar
                    </button>
                )}
            </div>

            <AnimatePresence mode="wait">
                {isAdding ? (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="p-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
                        key="form"
                    >
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-[var(--muted)] mb-2">Tipo de Ausência</label>
                                    <select
                                        value={type}
                                        onChange={(e) => {
                                            const newType = e.target.value as Absence['type'];
                                            setType(newType);
                                            if (newType === 'day-off' && startDate) {
                                                setEndDate(startDate);
                                            }
                                        }}
                                        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[var(--primary)] outline-none"
                                        required
                                    >
                                        <option value="férias">Férias</option>
                                        <option value="atestado">Atestado Médico</option>
                                        <option value="day-off">Day-off / Folga</option>
                                        <option value="feriado_local">Feriado Local</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-[var(--muted)] mb-2">Data Início</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => {
                                            setStartDate(e.target.value);
                                            if (type === 'day-off') {
                                                setEndDate(e.target.value);
                                            }
                                        }}
                                        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[var(--primary)] outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-[var(--muted)] mb-2">Data Fim</label>
                                    <div className="space-y-2">
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            disabled={type === 'day-off'}
                                            className={`w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[var(--primary)] outline-none ${type === 'day-off' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            required
                                        />
                                        {endDate && (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                                                <ArrowRight size={12} className="text-emerald-500" />
                                                <span className="text-[10px] font-black text-emerald-600 uppercase">
                                                    Retorno em: {new Date(addBusinessDays(endDate, 1, holidays) + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-[var(--muted)] mb-2">Período</label>
                                    <select
                                        value={period}
                                        onChange={(e) => setPeriod(e.target.value as any)}
                                        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[var(--primary)] outline-none"
                                    >
                                        <option value="integral">Dia Integral</option>
                                        <option value="manha">Manhã (08:00 - 12:00)</option>
                                        <option value="tarde">Tarde (13:00 - 18:00)</option>
                                        <option value="noite">Noite (18:00 - 22:00)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-[var(--muted)] mb-2">Hora Fim (No último dia)</label>
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[var(--primary)] outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-[var(--muted)] mb-2">Observações</label>
                                <textarea
                                    value={observations}
                                    onChange={(e) => setObservations(e.target.value)}
                                    placeholder="Ex: Férias do período aquisitivo 2024..."
                                    className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[var(--primary)] outline-none h-24"
                                />
                            </div>

                            {collidingTasks.length > 0 && (
                                <div className="p-5 rounded-3xl bg-amber-500/5 border border-amber-500/20">
                                    <div className="flex items-center gap-3 mb-4 text-amber-600">
                                        <AlertCircle size={20} />
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-tight">Vínculos Ativos no Período</p>
                                            <p className="text-[10px] font-bold opacity-70">
                                                {targetUserId ? `Redirecione as tarefas de ${targetUserName} antes das férias` : 'Sugerimos redirecionar estas tarefas antes das férias'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {collidingTasks.map(t => (
                                            <div key={t.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 rounded-2xl border border-amber-200 dark:border-amber-500/30 shadow-sm gap-4" style={{ backgroundColor: 'var(--surface)' }}>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-black truncate" style={{ color: 'var(--text)' }}>{t.title}</p>
                                                    <p className="text-[9px] font-bold text-amber-600 uppercase">Entrega: {new Date(t.estimatedDelivery).toLocaleDateString()}</p>
                                                </div>

                                                <div className="flex items-center gap-2 w-full md:w-auto">
                                                    <select
                                                        onChange={async (e) => {
                                                            const newDevId = e.target.value;
                                                            if (!newDevId || newDevId === 'keep') return;
                                                            if (window.confirm(`Deseja realmente passar a tarefa "${t.title}" para este colaborador?`)) {
                                                                await updateTask(t.id, { developerId: newDevId });
                                                                alert('Tarefa redirecionada com sucesso!');
                                                            }
                                                        }}
                                                        className="flex-1 md:w-40 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                                        style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text)' }}
                                                    >
                                                        <option value="keep">Manter comigo (Não redirecionar)</option>
                                                        <optgroup label="Colaboradores do Projeto">
                                                            {(() => {
                                                                const projectUserIds = (projectMembers || [])
                                                                    .filter(pm => String(pm.id_projeto) === String(t.projectId))
                                                                    .map(pm => String(pm.id_colaborador));

                                                                return users
                                                                    .filter(u => u.active !== false && u.id !== effectiveUserId && projectUserIds.includes(u.id))
                                                                    .map(u => (
                                                                        <option key={u.id} value={u.id}>{u.name}</option>
                                                                    ));
                                                            })()}
                                                        </optgroup>
                                                    </select>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* MENSAGENS DE VALIDAÇÃO DE REGRA DE NEGÓCIO */}
                            {type === 'férias' && startDate && (
                                <div className="space-y-2">
                                    {/* Regra de 30 dias */}
                                    {(() => {
                                        const thirtyDaysFromNow = new Date();
                                        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
                                        const selectedDate = new Date(startDate + 'T00:00:00');
                                        if (selectedDate < thirtyDaysFromNow) {
                                            return (
                                                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] font-black text-amber-600 uppercase">
                                                    <AlertCircle size={14} />
                                                    Atenção: Solicitações devem ser enviadas com pelo menos 30 dias de antecedência.
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {/* Regra de Divisão */}
                                    <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[10px] font-black text-blue-600 uppercase">
                                        <Info size={14} />
                                        Lembrete: As férias podem ser divididas em até 3 períodos (um mín. 14d, outros mín. 5d).
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (onClose) onClose();
                                        setIsAdding(false);
                                        resetForm();
                                    }}
                                    className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-[var(--muted)] hover:bg-[var(--surface-2)] transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-[var(--primary)] text-white px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Salvando...' : editingAbsenceId ? 'Salvar Alterações' : 'Confirmar Agendamento'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4"
                        key="list"
                    >
                        {myAbsences.length === 0 ? (
                            <div className="md:col-span-2 py-12 flex flex-col items-center justify-center bg-[var(--surface)] rounded-[32px] border-2 border-dashed border-[var(--border)] opacity-60">
                                <Calendar size={48} className="text-[var(--muted)] mb-4" />
                                <p className="text-sm font-bold text-[var(--muted)]">Nenhum registro encontrado.</p>
                            </div>
                        ) : (
                            myAbsences.map(absence => (
                                <motion.div
                                    layout
                                    key={absence.id}
                                    className="p-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase ${getTypeColor(absence.type)}`}>
                                            {getTypeIcon(absence.type)}
                                            {absence.type}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleEdit(absence)}
                                                className="p-2 text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all"
                                                title="Editar"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => setItemToDelete(absence.id)}
                                                className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                title="Excluir"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1">
                                                <p className="text-[9px] font-black uppercase text-[var(--muted)] mb-1">Início</p>
                                                <p className="text-sm font-black text-[var(--text)]">{new Date(absence.startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                            </div>
                                            <div className="w-px h-8 bg-[var(--border)]" />
                                            <div className="flex-1 text-right">
                                                <p className="text-[9px] font-black uppercase text-[var(--muted)] mb-1">Fim</p>
                                                <p className="text-sm font-black text-[var(--text)]">{new Date(absence.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                            </div>
                                        </div>

                                        {(absence.period && absence.period !== 'integral') && (
                                            <div className="flex justify-between text-[10px] font-black uppercase text-[var(--primary)] mt-1">
                                                <span>Período: {absence.period}</span>
                                                {absence.endTime && <span>Até: {absence.endTime} (no último dia)</span>}
                                            </div>
                                        )}

                                        {absence.observations && (
                                            <div className="p-3 rounded-2xl bg-[var(--surface-2)] text-[11px] font-medium text-[var(--text-2)] leading-relaxed italic border border-[var(--border)]">
                                                {absence.observations}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                                            <span className={`text-[9px] font-black uppercase flex items-center gap-1.5 ${absence.status === 'sugestao' ? 'text-amber-500' :
                                                absence.status === 'aprovada_gestao' ? 'text-blue-500' :
                                                    absence.status === 'aprovada_rh' ? 'text-emerald-500' :
                                                        absence.status === 'finalizada_dp' ? 'text-purple-500' :
                                                            'text-slate-500'
                                                }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${absence.status === 'sugestao' ? 'bg-amber-500' :
                                                    absence.status === 'aprovada_gestao' ? 'bg-blue-500' :
                                                        absence.status === 'aprovada_rh' ? 'bg-emerald-500' :
                                                            absence.status === 'finalizada_dp' ? 'bg-purple-500' :
                                                                'bg-slate-500'
                                                    }`} />
                                                {absence.status.replace('_', ' ')}
                                            </span>

                                            {(new Date(absence.startDate) <= new Date() && new Date(absence.endDate) >= new Date()) && (
                                                <span className="text-[9px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-md animate-bounce">EM CURSO</span>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <ConfirmationModal
                isOpen={!!itemToDelete}
                title="Excluir Registro"
                message="Tem certeza que deseja cancelar esta ausência?"
                onConfirm={handleDelete}
                onCancel={() => setItemToDelete(null)}
                confirmColor="red"
                disabled={loading}
            />
        </div>
    );
};

export default AbsenceManager;
