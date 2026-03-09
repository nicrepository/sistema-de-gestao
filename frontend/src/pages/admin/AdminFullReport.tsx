// src/pages/admin/AdminFullReport.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    exportReportExcel,
    fetchReportPreview,
    ReportPreviewResponse,
} from '@/services/reportApi';
import { useData } from '@/contexts/DataContext';
import {
    FileSpreadsheet,
    Search,
    Filter,
    Calendar as CalendarIcon,
    Users,
    Briefcase,
    Clock,
    Loader2,
    RefreshCw,
    Download,
    X,
    Check,
    ChevronDown,
    TrendingUp,
    BarChart3,
} from 'lucide-react';
import { ToastContainer, ToastType } from '@/components/Toast';
import { motion, AnimatePresence } from 'framer-motion';

// --- Helpers ---
function formatHours(hours: number) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${String(m).padStart(2, '0')}m`;
}

function todayISO() {
    return new Date().toISOString().split('T')[0];
}

function daysAgoISO(days: number) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
}

// --- Componente Principal ---
const AdminFullReport: React.FC = () => {
    const navigate = useNavigate();
    const { currentUser, isAdmin } = useAuth();
    const { clients: ctxClients, projects: ctxProjects, users: ctxUsers } = useData();

    // Estados de Filtros
    const [startDate, setStartDate] = useState(daysAgoISO(30));
    const [endDate, setEndDate] = useState(todayISO());
    const [selectedClients, setSelectedClients] = useState<number[]>([]);
    const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
    const [selectedCollaborators, setSelectedCollaborators] = useState<number[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

    // Estados da UI
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [reportData, setReportData] = useState<ReportPreviewResponse | null>(null);
    const [toasts, setToasts] = useState<{ id: string; message: string; type: ToastType }[]>([]);
    const [showFilters, setShowFilters] = useState(true);

    // Opções para os filtros
    const clientOptions = useMemo(() =>
        ctxClients.map(c => ({ id: Number(c.id), name: c.name })),
        [ctxClients]);

    const projectOptions = useMemo(() =>
        ctxProjects
            .filter(p => selectedClients.length === 0 || selectedClients.includes(Number(p.clientId)))
            .map(p => ({ id: Number(p.id), name: p.name, clientId: Number(p.clientId) })),
        [ctxProjects, selectedClients]);

    const collaboratorOptions = useMemo(() => {
        return ctxUsers
            .filter(u => u.active !== false)
            .map(u => ({ id: Number(u.id), name: u.name }));
    }, [ctxUsers]);

    const statusOptions = [
        { id: 'Não Iniciado', name: 'Não Iniciado' },
        { id: 'Iniciado', name: 'Iniciado' },
        { id: 'Pendente', name: 'Pendente' },
        { id: 'Concluído', name: 'Concluído' },
    ];

    const addToast = (message: string, type: ToastType) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

    // Validação de acesso
    useEffect(() => {
        if (!isAdmin) {
            navigate('/dashboard');
        }
    }, [currentUser, navigate, isAdmin]);

    // Carregar dados iniciais (Opcional: se quiser que carregue ao entrar, mantenha. O user disse que está aplicando antes do clique)
    /* useEffect(() => {
        handleApplyFilters();
    }, []); */

    const handleApplyFilters = async () => {
        setLoading(true);
        try {
            const resp = await fetchReportPreview({
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                clientIds: selectedClients.length ? selectedClients : undefined,
                projectIds: selectedProjects.length ? selectedProjects : undefined,
                collaboratorIds: selectedCollaborators.length ? selectedCollaborators : undefined,
                statuses: selectedStatuses.length ? selectedStatuses : undefined
            });
            setReportData(resp);
            addToast(`${resp.rows.length} registros carregados com sucesso!`, 'success');
        } catch (err) {
            console.error('Error loading report:', err);
            addToast('Erro ao carregar relatório. Verifique sua conexão.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const { blob, filename } = await exportReportExcel({
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                clientIds: selectedClients.length ? selectedClients : undefined,
                projectIds: selectedProjects.length ? selectedProjects : undefined,
                collaboratorIds: selectedCollaborators.length ? selectedCollaborators : undefined,
                statuses: selectedStatuses.length ? selectedStatuses : undefined,
                includeCost: true,
                includeHours: true,
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            addToast('Exportação concluída!', 'success');
        } catch (err) {
            console.error('Error exporting:', err);
            addToast('Erro ao exportar Excel.', 'error');
        } finally {
            setExporting(false);
        }
    };

    const handleClearFilters = () => {
        setStartDate(daysAgoISO(30));
        setEndDate(todayISO());
        setSelectedClients([]);
        setSelectedProjects([]);
        setSelectedCollaborators([]);
        setSelectedStatuses([]);
        setTimeout(() => handleApplyFilters(), 100);
    };

    // Estatísticas calculadas
    const stats = useMemo(() => {
        if (!reportData) return null;

        const totalHours = reportData.rows.reduce((acc, r) => acc + r.horas, 0);
        const uniqueProjects = new Set(reportData.rows.map(r => r.id_projeto)).size;
        const uniqueCollaborators = new Set(reportData.rows.map(r => r.id_colaborador)).size;
        const uniqueDays = new Set(reportData.rows.map(r => r.data_registro)).size;

        return { totalHours, uniqueProjects, uniqueCollaborators, uniqueDays };
    }, [reportData]);

    // Dados agrupados por projeto
    const projectSummary = useMemo(() => {
        if (!reportData) return [];

        const map = new Map();
        reportData.rows.forEach(r => {
            const key = r.id_projeto;
            if (!map.has(key)) {
                map.set(key, {
                    id: r.id_projeto,
                    name: r.projeto,
                    client: r.cliente,
                    hours: 0,
                    collaborators: new Set(),
                });
            }
            const proj = map.get(key);
            proj.hours += r.horas;
            proj.collaborators.add(r.colaborador);
        });

        return Array.from(map.values())
            .map(p => ({ ...p, collaborators: p.collaborators.size }))
            .sort((a, b) => b.hours - a.hours);
    }, [reportData]);

    return (
        <div className="flex flex-col min-h-screen font-sans p-6 lg:p-10 space-y-6" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
                        Relatórios
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                        Análise detalhada de horas e projetos
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-sm border"
                        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                    >
                        <Filter className="w-4 h-4" />
                        {showFilters ? 'Ocultar' : 'Mostrar'} Filtros
                    </button>
                </div>
            </header>

            {/* Filtros */}
            <AnimatePresence>
                {showFilters && (
                    <motion.section
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border rounded-3xl p-6 shadow-lg"
                        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Período */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                                        Período
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (startDate === '' && endDate === '') {
                                                setStartDate(daysAgoISO(30));
                                                setEndDate(todayISO());
                                            } else {
                                                setStartDate('');
                                                setEndDate('');
                                            }
                                        }}
                                        className="text-[10px] font-black uppercase text-purple-500 hover:bg-purple-500/10 px-2 py-1 rounded-lg transition-all"
                                    >
                                        Todo o período
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="relative group">
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border text-sm"
                                            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                                        />
                                    </div>
                                    <div className="relative group">
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border text-sm"
                                            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Clientes */}
                            <FilterMultiSelect
                                label="Clientes"
                                options={clientOptions}
                                selected={selectedClients}
                                onChange={setSelectedClients}
                            />

                            {/* Projetos */}
                            <FilterMultiSelect
                                label="Projetos"
                                options={projectOptions}
                                selected={selectedProjects}
                                onChange={setSelectedProjects}
                            />

                            {/* Colaboradores */}
                            <FilterMultiSelect
                                label="Colaboradores"
                                options={collaboratorOptions}
                                selected={selectedCollaborators}
                                onChange={setSelectedCollaborators}
                            />

                            {/* Status */}
                            <FilterMultiSelect
                                label="Status"
                                options={statusOptions}
                                selected={selectedStatuses}
                                onChange={setSelectedStatuses}
                            />
                        </div>

                        <div className="flex justify-between items-center mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                            <button
                                onClick={handleClearFilters}
                                className="text-xs font-bold uppercase tracking-wider hover:text-red-500 transition-colors"
                                style={{ color: 'var(--muted)' }}
                            >
                                Limpar Filtros
                            </button>
                            <button
                                onClick={handleApplyFilters}
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl text-white font-bold text-sm shadow-lg transition-all"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                Aplicar Filtros
                            </button>
                        </div>
                    </motion.section>
                )}
            </AnimatePresence>

            {/* Estatísticas */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={Clock} label="Total de Horas" value={formatHours(stats.totalHours)} color="blue" />
                    <StatCard icon={Briefcase} label="Projetos" value={stats.uniqueProjects.toString()} color="purple" />
                    <StatCard icon={Users} label="Colaboradores" value={stats.uniqueCollaborators.toString()} color="green" />
                    <StatCard icon={CalendarIcon} label="Dias Trabalhados" value={stats.uniqueDays.toString()} color="orange" />
                </div>
            )}

            {/* Resumo por Projeto */}
            {projectSummary.length > 0 && (
                <section className="border rounded-3xl overflow-hidden shadow-lg" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                        <h2 className="text-lg font-black uppercase tracking-tight" style={{ color: 'var(--text)' }}>
                            Resumo por Projeto
                        </h2>
                        <button
                            onClick={handleExportExcel}
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-xl text-white font-bold text-sm shadow-lg transition-all"
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                            Exportar Excel
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
                                <tr className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                                    <th className="px-6 py-4 text-left">Projeto</th>
                                    <th className="px-6 py-4 text-left">Cliente</th>
                                    <th className="px-6 py-4 text-center">Colaboradores</th>
                                    <th className="px-6 py-4 text-right">Total de Horas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                                {projectSummary.map((proj, idx) => (
                                    <tr key={idx} className="hover:bg-[var(--surface-hover)] transition-colors">
                                        <td className="px-6 py-4 font-bold" style={{ color: 'var(--text)' }}>{proj.name}</td>
                                        <td className="px-6 py-4 text-sm" style={{ color: 'var(--muted)' }}>{proj.client}</td>
                                        <td className="px-6 py-4 text-center font-bold text-sm" style={{ color: 'var(--text)' }}>{proj.collaborators}</td>
                                        <td className="px-6 py-4 text-right font-black" style={{ color: 'var(--text)' }}>{formatHours(proj.hours)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* Estado vazio */}
            {!loading && (!reportData || reportData.rows.length === 0) && (
                <div className="flex flex-col items-center justify-center py-20 border rounded-3xl" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <BarChart3 className="w-16 h-16 mb-4" style={{ color: 'var(--muted)' }} />
                    <p className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>Nenhum dado encontrado</p>
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>Ajuste os filtros e tente novamente</p>
                </div>
            )}

            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
    );
};

// --- Componentes Auxiliares ---
const StatCard = ({ icon: Icon, label, value, color }: { icon: any, label: string, value: string, color: string }) => {
    const colors = {
        blue: 'text-blue-500',
        purple: 'text-purple-500',
        green: 'text-green-500',
        orange: 'text-orange-500',
    };

    return (
        <div className="border rounded-2xl p-4 shadow-sm" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-2">
                <Icon className={`w-5 h-5 ${colors[color as keyof typeof colors]}`} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</span>
            </div>
            <div className="text-2xl font-black" style={{ color: 'var(--text)' }}>{value}</div>
        </div>
    );
};

const FilterMultiSelect = <T extends string | number>({ label, options, selected, onChange }: {
    label: string;
    options: { id: T; name: string }[];
    selected: T[];
    onChange: (val: T[]) => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (id: T) => {
        if (selected.includes(id)) {
            onChange(selected.filter(s => s !== id));
        } else {
            onChange([...selected, id]);
        }
    };

    const filteredOptions = options.filter(opt =>
        opt.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-2 relative" ref={containerRef}>
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                {label}
            </label>
            <button
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) setSearchTerm('');
                }}
                className="w-full px-3 py-2 rounded-xl border text-sm text-left flex justify-between items-center"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
            >
                <span className="truncate">
                    {selected.length === 0 ? `Todos` : `${selected.length} selecionado(s)`}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 w-full mt-1 border rounded-xl shadow-2xl p-2 max-h-80 flex flex-col overflow-hidden"
                        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                        {/* Search Input */}
                        <div className="p-2 border-b border-[var(--border)] mb-2">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Buscar..."
                                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs focus:ring-1 focus:ring-purple-500 transition-all outline-none"
                                    style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Options List */}
                        <div className="overflow-y-auto custom-scrollbar flex-1 max-h-60">
                            {filteredOptions.length === 0 ? (
                                <div className="p-4 text-center text-xs text-slate-400 italic">Nenhum resultado encontrado</div>
                            ) : (
                                filteredOptions.map(opt => (
                                    <div
                                        key={opt.id}
                                        onClick={() => toggleOption(opt.id)}
                                        className="flex items-center gap-2 p-2 hover:bg-[var(--surface-hover)] rounded-lg cursor-pointer transition-colors"
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selected.includes(opt.id) ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                                            {selected.includes(opt.id) && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{opt.name}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Actions */}
                        {selected.length > 0 && (
                            <div className="p-2 border-t border-[var(--border)] mt-2 flex justify-end">
                                <button
                                    onClick={() => onChange([])}
                                    className="text-[10px] font-bold uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors"
                                >
                                    Limpar Seleção
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminFullReport;
