import React, { useState, useMemo } from 'react';
import { useDataController } from '@/controllers/useDataController';
import { useAuth } from '@/contexts/AuthContext';
import { Holiday } from '@/types';
import { Calendar, Plus, Trash2, Edit2, Flag, PartyPopper, MapPin, Search, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from './ConfirmationModal';

const HolidayManager: React.FC = () => {
    const { isAdmin } = useAuth();
    const { holidays, createHoliday, updateHoliday, deleteHoliday, loading } = useDataController();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Form states
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [type, setType] = useState<Holiday['type']>('nacional');
    const [observations, setObservations] = useState('');
    const [period, setPeriod] = useState<Holiday['period']>('integral');
    const [endTime, setEndTime] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const filteredHolidays = useMemo(() => {
        return (holidays || [])
            .filter(h => h.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [holidays, searchTerm]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAdmin) return;

        try {
            setActionLoading(true);
            if (editingId) {
                await updateHoliday(editingId, { name, date, endDate, type, observations, period, endTime });
            } else {
                await createHoliday({ name, date, endDate, type, observations, period, endTime });
            }
            resetForm();
            setIsAdding(false);
            setEditingId(null);
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar feriado.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleEdit = (h: Holiday) => {
        setEditingId(h.id);
        setName(h.name);
        setDate(h.date);
        setEndDate(h.endDate || h.date);
        setType(h.type);
        setObservations(h.observations || '');
        setPeriod(h.period || 'integral');
        setEndTime(h.endTime || '');
        setIsAdding(true);
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        try {
            setActionLoading(true);
            await deleteHoliday(itemToDelete);
            setItemToDelete(null);
        } catch (error) {
            alert('Erro ao excluir.');
        } finally {
            setActionLoading(false);
        }
    };

    const resetForm = () => {
        setName('');
        setDate('');
        setEndDate('');
        setType('nacional');
        setObservations('');
        setPeriod('integral');
        setEndTime('');
    };

    // Exportar feriados para CSV
    const handleExportHolidays = () => {
        const csvRows = [];
        const headers = ['Nome', 'Data Início', 'Data Fim', 'Tipo', 'Período', 'Hora Fim', 'Observações'];
        csvRows.push(headers.join(','));

        (holidays || []).forEach(h => {
            const row = [
                h.name,
                h.date,
                h.endDate || h.date,
                h.type,
                h.period || 'integral',
                h.endTime || '',
                h.observations || ''
            ];
            csvRows.push(row.join(','));
        });

        const csvData = csvRows.join('\n');
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `feriados_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Importar feriados de CSV
    const handleImportHolidays = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const rows = text.split('\n').slice(1); // Skip header

                for (const row of rows) {
                    if (!row.trim()) continue;
                    const [name, date, endDate, type, period, endTime, observations] = row.split(',');
                    await createHoliday({
                        name: name.trim(),
                        date: date.trim(),
                        endDate: endDate.trim(),
                        type: type.trim() as Holiday['type'],
                        period: period.trim() as Holiday['period'],
                        endTime: endTime.trim(),
                        observations: observations.trim()
                    });
                }
                alert('Feriados importados com sucesso!');
            } catch (error) {
                console.error(error);
                alert('Erro ao importar feriados. Verifique o formato do arquivo.');
            }
        };
        reader.readAsText(file);
    };


    const getTypeIcon = (t: Holiday['type']) => {
        switch (t) {
            case 'nacional': return <Flag className="w-4 h-4" />;
            case 'corporativo': return <PartyPopper className="w-4 h-4" />;
            case 'local': return <MapPin className="w-4 h-4" />;
            default: return <Calendar className="w-4 h-4" />;
        }
    };

    const getTypeColor = (t: Holiday['type']) => {
        switch (t) {
            case 'nacional': return 'bg-rose-500/10 text-rose-600 border-rose-200';
            case 'corporativo': return 'bg-purple-500/10 text-purple-600 border-purple-200';
            case 'local': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
            default: return 'bg-slate-500/10 text-slate-600 border-slate-200';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-black text-[var(--text)]">Gestão de Feriados</h2>
                    <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">Calendário corporativo e feriados oficiais</p>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && !isAdding && (
                        <>
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleImportHolidays}
                                className="hidden"
                                id="import-holidays"
                            />
                            <label
                                htmlFor="import-holidays"
                                className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                            >
                                <Download size={16} className="rotate-180" /> Importar CSV
                            </label>
                            <button
                                onClick={handleExportHolidays}
                                className="bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-blue-500/20"
                            >
                                <Download size={16} /> Exportar CSV
                            </button>
                            <button
                                onClick={() => {
                                    const nextHolidays = [...filteredHolidays]
                                        .filter(h => new Date(h.date + 'T00:00:00') >= new Date())
                                        .slice(0, 10);

                                    const text = `📢 *Planejamento de Feriados e Recessos*\n\n` +
                                        nextHolidays.map(h => {
                                            const start = new Date(h.date + 'T12:00:00').toLocaleDateString('pt-BR');
                                            const period = h.period !== 'integral' ? ` (${h.period === 'manha' ? 'Manhã' : 'Tarde'})` : '';
                                            return `• *${start}*: ${h.name}${period}`;
                                        }).join('\n') +
                                        `\n\n_Favor planejar suas atividades considerando estas datas._`;

                                    navigator.clipboard.writeText(text);
                                    alert('Comunicado copiado para a área de transferência!');
                                }}
                                className="bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-amber-500/20"
                            >
                                <PartyPopper size={16} /> Gerar Comunicado
                            </button>
                            <button
                                onClick={() => { resetForm(); setIsAdding(true); }}
                                className="bg-[var(--primary)] text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-purple-500/20"
                            >
                                <Plus size={16} /> Novo Feriado
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] w-4 h-4" />
                <input
                    type="text"
                    placeholder="Buscar feriado..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none transition-all"
                />
            </div>

            <AnimatePresence mode="wait">
                {isAdding && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xl"
                    >
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Nome do Feriado</label>
                                    <input
                                        required
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none"
                                        placeholder="Ex: Natal"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Data Início</label>
                                    <input
                                        required
                                        type="date"
                                        value={date}
                                        onChange={(e) => {
                                            setDate(e.target.value);
                                            if (!endDate) setEndDate(e.target.value);
                                        }}
                                        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Data Fim</label>
                                    <input
                                        required
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Tipo</label>
                                    <select
                                        value={type}
                                        onChange={(e) => setType(e.target.value as any)}
                                        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none"
                                    >
                                        <option value="nacional">Nacional</option>
                                        <option value="corporativo">Corporativo (Day-off NIC)</option>
                                        <option value="local">Local / Estadual</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Período</label>
                                    <select
                                        value={period}
                                        onChange={(e) => setPeriod(e.target.value as any)}
                                        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none"
                                    >
                                        <option value="integral">Dia Integral</option>
                                        <option value="manha">Manhã (até 12:00)</option>
                                        <option value="tarde">Tarde (após 13:00)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Hora Fim (Neste dia)</label>
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Observações</label>
                                    <input
                                        type="text"
                                        value={observations}
                                        onChange={(e) => setObservations(e.target.value)}
                                        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none"
                                        placeholder="Opcional..."
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setIsAdding(false); setEditingId(null); resetForm(); }}
                                    className="px-6 py-2.5 rounded-xl text-xs font-black uppercase text-[var(--muted)] hover:bg-[var(--surface-2)] transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="bg-[var(--primary)] text-white px-8 py-2.5 rounded-xl text-xs font-black uppercase hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20"
                                >
                                    {actionLoading ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar Feriado'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredHolidays.map((h) => (
                    <motion.div
                        layout
                        key={h.id}
                        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex flex-col gap-4 hover:shadow-lg transition-all group"
                    >
                        <div className="flex justify-between items-start">
                            <div className={`p-2 rounded-xl border ${getTypeColor(h.type)}`}>
                                {getTypeIcon(h.type)}
                            </div>
                            {isAdmin && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleEdit(h)}
                                        className="p-1.5 hover:bg-[var(--surface-2)] rounded-lg text-[var(--muted)] hover:text-[var(--primary)] transition-all"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => setItemToDelete(h.id)}
                                        className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-300 hover:text-rose-500 transition-all"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="font-black text-sm text-[var(--text)]">{h.name}</h3>
                            <p className="text-xs font-bold text-[var(--primary)] uppercase mt-1">
                                {new Date(h.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                {h.endDate && h.endDate !== h.date && (
                                    <> - {new Date(h.endDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</>
                                )}
                                , {new Date(h.date + 'T12:00:00').getFullYear()}
                            </p>
                            {h.period && h.period !== 'integral' && (
                                <p className="text-[10px] font-black text-rose-500 uppercase mt-1">
                                    {h.period === 'manha' ? 'Período: Manhã' : 'Período: Tarde'}
                                    {h.endTime && ` (Até ${h.endTime})`}
                                </p>
                            )}
                            {h.observations && (
                                <p className="text-[10px] text-[var(--muted)] mt-2 italic">{h.observations}</p>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            {filteredHolidays.length === 0 && !loading && (
                <div className="text-center py-12 bg-[var(--surface-2)] rounded-3xl border border-dashed border-[var(--border)]">
                    <Calendar className="w-12 h-12 text-[var(--muted)] mx-auto mb-4 opacity-20" />
                    <p className="text-[var(--muted)] font-bold">Nenhum feriado encontrado.</p>
                </div>
            )}

            <ConfirmationModal
                isOpen={!!itemToDelete}
                title="Excluir Feriado"
                message="Tem certeza que deseja remover este feriado do calendário?"
                onConfirm={handleDelete}
                onCancel={() => setItemToDelete(null)}
                disabled={actionLoading}
            />
        </div>
    );
};

export default HolidayManager;
