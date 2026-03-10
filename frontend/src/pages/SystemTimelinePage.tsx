import React, { useState, useEffect, useMemo } from 'react';
import { auditService, AuditLog } from '../services/auditService';
import { useDataController } from '../controllers/useDataController';
import {
    Search, Calendar, ArrowRight, Info, CheckCircle2,
    PlusCircle, FolderPlus, Clock, Palmtree, Eye,
    Activity, TrendingUp, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserNotification {
    id: string;
    date: Date;
    userId: string;
    userName: string;
    message: string;
    details?: string;
    type: 'success' | 'warning' | 'info' | 'error';
    icon: any;
    badgeColor: string;
    logData?: AuditLog;
    clientLogo?: string;
}

export const SystemTimelinePage: React.FC = () => {
    const { users, clients, projects, timesheetEntries, loading: dataLoading } = useDataController();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);

    // Filtros
    const [clientSearch, setClientSearch] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [clientFilter, setClientFilter] = useState('');

    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    const fetchLogs = async () => {
        setLoadingLogs(true);
        try {
            let df = dateFrom || undefined;
            let dt = dateTo || undefined;

            if (monthFilter && !dateFrom) {
                const parts = monthFilter.split('-');
                const y = Number.parseInt(parts[0]);
                const m = Number.parseInt(parts[1]);
                df = `${monthFilter}-01`;
                dt = new Date(y, m, 0).toISOString().split('T')[0];
            }

            const data = await auditService.fetchAuditLogs({
                user_id: userFilter || undefined,
                date_from: df,
                date_to: dt,
                limit: 200
            });
            setLogs(data);
        } catch (error) {
            console.error('Erro ao buscar logs:', error);
        } finally {
            setLoadingLogs(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [monthFilter, dateFrom, dateTo, userFilter, clientFilter]);

    // Todos os usuários (sem filtrar ADMIN_ROLES)
    const collaborators = useMemo(() => {
        return users;
    }, [users]);

    const collaboratorIds = useMemo(() => {
        return new Set(collaborators.map(u => String(u.id)));
    }, [collaborators]);

    const getTaskNotification = (log: AuditLog, locationStr: string) => {
        const action = log.action.toUpperCase();
        const tName = log.new_data?.tarefa || log.old_data?.tarefa || log.new_data?.title || log.old_data?.title || 'uma tarefa';
        const pId = log.new_data?.projeto_id || log.old_data?.projeto_id || log.new_data?.ID_Projeto || log.old_data?.ID_Projeto;
        const foundProject = projects.find(p => String(p.id) === String(pId));
        const pName = foundProject ? foundProject.name : (log.new_data?.project_name || log.old_data?.project_name || pId || 'um projeto');

        if (action === 'UPDATE') {
            if (log.new_data?.status === 'Done' && log.old_data?.status !== 'Done') {
                return {
                    message: `concluiu a tarefa "${tName}" no projeto "${pName}"`,
                    type: 'success' as const, icon: CheckCircle2, badgeColor: 'bg-emerald-100 text-emerald-700'
                };
            }
            if (log.old_data?.status !== log.new_data?.status && log.old_data?.status && log.new_data?.status) {
                return {
                    message: `alterou o status de ${log.old_data.status} para ${log.new_data.status} ${locationStr}`,
                    icon: Activity, badgeColor: 'bg-cyan-100 text-cyan-700'
                };
            }
            if (log.old_data?.progress !== log.new_data?.progress && log.old_data?.progress !== undefined && log.new_data?.progress !== undefined) {
                return {
                    message: `alterou o progresso de ${log.old_data.progress}% para ${log.new_data.progress}% ${locationStr}`,
                    icon: TrendingUp, badgeColor: 'bg-blue-100 text-blue-700'
                };
            }
            return { message: `atualizou informações ${locationStr}`, icon: Activity, badgeColor: 'bg-slate-100 text-slate-600' };
        }
        if (action === 'CREATE') {
            return {
                message: `criou a tarefa "${tName}" no projeto "${pName}"`,
                icon: PlusCircle, badgeColor: 'bg-blue-100 text-blue-700'
            };
        }
        return null;
    };

    const getLogNotification = (log: AuditLog) => {
        const action = log.action.toUpperCase();
        const entity = log.entity.toLowerCase();
        let clientLogo = '';

        const clientIdRaw = log.new_data?.client_id || log.new_data?.cliente_id || log.old_data?.client_id || log.old_data?.cliente_id;
        if (clientIdRaw) {
            const c = clients.find(cl => String(cl.id) === String(clientIdRaw));
            if (c?.name) clientLogo = c.name.substring(0, 2).toUpperCase();
        } else if (log.new_data?.client_name) {
            clientLogo = String(log.new_data.client_name).substring(0, 2).toUpperCase();
        }

        if (entity === 'fato_tarefas') {
            const tName = log.new_data?.tarefa || log.old_data?.tarefa || log.new_data?.title || log.old_data?.title || 'uma tarefa';
            const pId = log.new_data?.projeto_id || log.old_data?.projeto_id || log.new_data?.ID_Projeto || log.old_data?.ID_Projeto;
            const foundProject = projects.find(p => String(p.id) === String(pId));
            const pName = foundProject ? foundProject.name : (log.new_data?.project_name || log.old_data?.project_name || pId || 'um projeto');

            const foundClient = foundProject ? clients.find(c => String(c.id) === String(foundProject.clientId)) : null;
            const cName = foundClient ? foundClient.name : (log.new_data?.client_name || log.old_data?.client_name || '');

            const loc = `na tarefa "${tName}", projeto "${pName}"${cName ? `, cliente ${cName}` : ''}`;
            const res = getTaskNotification(log, loc);
            return res ? { ...res, type: res.type || 'info' as const, clientLogo } : null;
        }
        if (entity === 'dim_projetos' && action === 'CREATE') {
            const pName = log.new_data?.name || log.new_data?.title || 'um projeto';
            const cName = log.new_data?.client_name || '';
            return {
                message: `criou o projeto "${pName}"${cName ? ` para o cliente ${cName}` : ''}`,
                icon: FolderPlus, badgeColor: 'bg-purple-100 text-purple-700', type: 'info' as const, clientLogo
            };
        }
        if (entity === 'ausencias' && action === 'CREATE') {
            return { message: 'agendou uma ausência', type: 'warning' as const, icon: Palmtree, badgeColor: 'bg-amber-100 text-amber-700', clientLogo };
        }
        if (entity === 'horas_trabalhadas' && action === 'CREATE') {
            return { message: 'realizou um apontamento de horas', icon: Clock, badgeColor: 'bg-indigo-100 text-indigo-700', type: 'info' as const, clientLogo };
        }
        if (entity === 'membros_projeto' || entity.includes('project_members')) {
            const assId = log.new_data?.user_id || log.new_data?.id_colaborador;
            const assU = users.find(u => String(u.id) === String(assId));
            return {
                message: `adicionou ${assU ? assU.name : 'um colaborador'} a um projeto`,
                icon: Users, badgeColor: 'bg-slate-100 text-slate-700', type: 'info' as const, clientLogo
            };
        }
        return null;
    };

    // Notification Feed
    const notifications = useMemo(() => {
        const feed: UserNotification[] = [];
        logs.forEach(log => {
            const res = getLogNotification(log);
            if (!res) return;
            const foundUser = users.find(u => String(u.id) === String(log.user_id));
            const resolvedUserName = foundUser ? foundUser.name : (log.user_name && isNaN(Number(log.user_name)) ? log.user_name : 'Usuário Desconhecido');

            feed.push({
                id: `log-${log.id}`,
                date: new Date(log.created_at),
                userId: String(log.user_id),
                userName: resolvedUserName,
                message: res.message,
                details: '',
                type: res.type,
                icon: res.icon,
                badgeColor: res.badgeColor,
                logData: log,
                clientLogo: res.clientLogo
            });
        });

        // Aplicar filtros
        let filtered = feed;

        if (clientSearch) {
            const lowerSearch = clientSearch.toLowerCase();
            filtered = filtered.filter(f =>
                f.message.toLowerCase().includes(lowerSearch) ||
                (f.logData?.new_data && JSON.stringify(f.logData.new_data).toLowerCase().includes(lowerSearch))
            );
        }

        if (clientFilter) {
            filtered = filtered.filter(f => {
                const cid = f.logData?.new_data?.client_id || f.logData?.old_data?.client_id || f.logData?.new_data?.cliente_id;
                return String(cid) === String(clientFilter);
            });
        }

        if (monthFilter) {
            filtered = filtered.filter(f => {
                if (!f.date) return false;
                const parts = monthFilter.split('-');
                const y = Number.parseInt(parts[0]);
                const m = Number.parseInt(parts[1]);
                return f.date.getFullYear() === y && (f.date.getMonth() + 1) === m;
            });
        }

        // Ordenar decrescente (mais recentes primeiro)
        filtered.sort((a, b) => b.date.getTime() - a.date.getTime());

        return filtered;
    }, [logs, clients, users, clientSearch, clientFilter, monthFilter]);

    // Agrupar notificações por dia
    const groupedNotifications = useMemo(() => {
        const groups: { [key: string]: typeof notifications } = {};
        notifications.forEach(n => {
            const dateKey = n.date.toISOString().split('T')[0]; // YYYY-MM-DD
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(n);
        });
        // Ordenar as chaves de forma reversa (dias mais recentes primeiro)
        return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
    }, [notifications]);

    const isLoading = dataLoading || loadingLogs;

    return (
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
            {/* Header */}
            <div className="px-8 py-10 relative overflow-hidden bg-slate-900 text-white">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-blue-500/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/30">
                            <Activity className="w-8 h-8 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Monitoramento de Atividades</h1>
                            <p className="mt-1 text-lg opacity-80" style={{ color: 'var(--text-3)' }}>
                                Acompanhe em tempo real as movimentações e ações realizadas pelos colaboradores no sistema.
                            </p>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                        <select
                            value={userFilter}
                            onChange={(e) => setUserFilter(e.target.value)}
                            className="py-2.5 px-4 border rounded-xl text-sm focus:outline-none focus:border-blue-600/50 cursor-pointer shadow-sm min-w-[180px] transition-all"
                            style={{ backgroundColor: 'var(--surface-3)', borderColor: 'var(--border)', color: 'var(--text)' }}
                        >
                            <option value="">Colaborador</option>
                            {collaborators.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>

                        <select
                            value={clientFilter}
                            onChange={(e) => setClientFilter(e.target.value)}
                            className="py-2.5 px-4 border rounded-xl text-sm focus:outline-none focus:border-blue-600/50 cursor-pointer shadow-sm min-w-[180px] transition-all"
                            style={{ backgroundColor: 'var(--surface-3)', borderColor: 'var(--border)', color: 'var(--text)' }}
                        >
                            <option value="">Cliente</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>

                        <div className="flex items-center p-1 rounded-xl border shadow-sm transition-all focus-within:border-blue-600/50" style={{ backgroundColor: 'var(--surface-3)', borderColor: 'var(--border)' }}>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors group">
                                <Calendar className="w-4 h-4 text-blue-500 font-semibold" />
                                <span className="text-[10px] font-semibold tracking-wider uppercase opacity-80" style={{ color: 'var(--text-3)' }}>Mês / Período:</span>

                                <input
                                    title="Mês"
                                    type="month"
                                    className="bg-transparent focus:outline-none text-xs w-[100px] cursor-pointer"
                                    style={{ color: 'var(--text)' }}
                                    value={monthFilter}
                                    onChange={(e) => {
                                        setMonthFilter(e.target.value);
                                        setDateFrom('');
                                        setDateTo('');
                                    }}
                                />

                                <div className="w-px h-3 mx-1" style={{ backgroundColor: 'var(--border)' }} />

                                <div className="flex items-center gap-1.5">
                                    <input
                                        title="Início"
                                        type="date"
                                        className="bg-transparent focus:outline-none text-xs w-[100px] cursor-pointer"
                                        style={{ color: 'var(--text)' }}
                                        value={dateFrom}
                                        onChange={(e) => {
                                            setDateFrom(e.target.value);
                                            setMonthFilter('');
                                        }}
                                    />
                                    <ArrowRight className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                                    <input
                                        title="Fim"
                                        type="date"
                                        className="bg-transparent focus:outline-none text-xs w-[100px] cursor-pointer"
                                        style={{ color: 'var(--text)' }}
                                        value={dateTo}
                                        onChange={(e) => {
                                            setDateTo(e.target.value);
                                            setMonthFilter('');
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="relative flex-1 min-w-[200px] max-w-[300px] ml-auto">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Busca detalhada..."
                                value={clientSearch}
                                onChange={(e) => setClientSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-blue-600/50 transition-all shadow-sm"
                                style={{ backgroundColor: 'var(--surface-3)', borderColor: 'var(--border)', color: 'var(--text)' }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 px-8 py-8 h-full" style={{ backgroundColor: 'var(--bg)' }}>
                {/* Timeline */}
                <div className="max-w-4xl mx-auto relative">
                    <div className="absolute left-[29px] top-0 bottom-0 w-px" style={{ backgroundColor: 'var(--border)' }} />

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            <p className="font-medium" style={{ color: 'var(--text-muted)' }}>Sincronizando atividades...</p>
                        </div>
                    ) : groupedNotifications.length === 0 ? (
                        <div className="text-center py-20 rounded-2xl border border-dashed shadow-sm" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                            <Info className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
                            <p className="text-lg font-medium" style={{ color: 'var(--text-muted)' }}>Nenhuma atividade registrada.</p>
                            <p className="mt-2" style={{ color: 'var(--text-3)' }}>Os colaboradores não realizaram ações correspondentes aos filtros.</p>
                        </div>
                    ) : (
                        <div className="space-y-12">
                            {groupedNotifications.map(([dateKey, notifs]) => {
                                // Data Header Formatting
                                const parts = dateKey.split('-');
                                const dDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                                const isToday = new Date().toISOString().split('T')[0] === dateKey;

                                return (
                                    <div key={dateKey} className="relative">
                                        {/* Date separator */}
                                        <div className="sticky top-4 z-20 mb-8 flex justify-center">
                                            <div
                                                className={`px-5 py-2 rounded-full border shadow-sm font-bold text-sm tracking-wide 
                                                                ${isToday ? 'bg-blue-600 border-blue-600 text-white' : 'uppercase'}`}
                                                style={isToday ? {} : { backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                            >
                                                {isToday ? 'Hoje' : dDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            {notifs.map((notif, idx) => (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -20, y: 10 }}
                                                    animate={{ opacity: 1, x: 0, y: 0 }}
                                                    transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                                                    key={notif.id}
                                                    className="relative pl-20 group"
                                                >
                                                    {/* Timeline Node Icon */}
                                                    <div className={`absolute left-0 top-3 w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm z-10 
                                                                                    ${notif.badgeColor} border-4 group-hover:scale-110 transition-transform duration-300`}
                                                        style={{ borderColor: 'var(--bg)' }}>
                                                        <notif.icon className="w-6 h-6" />
                                                    </div>

                                                    {notif.clientLogo && (
                                                        <div title="Cliente associado" className="absolute left-[20px] top-[74px] w-5 h-5 border rounded flex items-center justify-center text-[9px] font-bold z-10 shadow-sm leading-none pt-0.5"
                                                            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                                                            {notif.clientLogo.substring(0, 2).toUpperCase()}
                                                        </div>
                                                    )}

                                                    {/* Card */}
                                                    <div className="p-6 rounded-2xl shadow-sm border hover:shadow-md transition-all group-hover:border-blue-400"
                                                        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>
                                                                    <Clock className="w-3 h-3" />
                                                                    {notif.date.toLocaleString('pt-BR', {
                                                                        hour: '2-digit', minute: '2-digit'
                                                                    })}
                                                                </div>

                                                                <div className="text-lg leading-relaxed">
                                                                    <span className="font-bold" style={{ color: 'var(--text)' }}>{notif.userName}</span>
                                                                    {' '}
                                                                    <span className="font-medium" style={{ color: 'var(--text-muted)' }}>{notif.message}</span>
                                                                    {' '}
                                                                    {notif.details && notif.details !== 'Pendente' && (
                                                                        <span className="font-bold" style={{ color: 'var(--text)' }}>"{notif.details}"</span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {notif.logData && (
                                                                <button
                                                                    onClick={() => setSelectedLog(notif.logData || null)}
                                                                    className="flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-semibold text-sm shrink-0 shadow-sm outline-none"
                                                                    style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                    Detalhes
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Detalhes */}
            <AnimatePresence>
                {selectedLog && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200"
                        >
                            <div className="px-8 py-6 border-b flex items-center justify-between" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl bg-blue-100 text-blue-600`}>
                                        <Eye className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Dados Técnicos da Alteração</h3>
                                        <p className="font-medium" style={{ color: 'var(--text-muted)' }}>
                                            {users.find(u => String(u.id) === String(selectedLog.user_id))?.name || (selectedLog.user_name && isNaN(Number(selectedLog.user_name)) ? selectedLog.user_name : 'Usuário')} registrou esta ação
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedLog(null)}
                                    className="w-10 h-10 flex items-center justify-center rounded-full transition-all text-2xl font-light"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    ×
                                </button>
                            </div>

                            <div className="flex-1 overflow-auto p-8" style={{ backgroundColor: 'var(--bg)' }}>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="flex flex-col h-full">
                                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                                            <div className="w-2 h-2 rounded-full bg-slate-400" />
                                            Estado Anterior
                                        </h4>
                                        <div className="flex-1 bg-slate-900 rounded-2xl p-6 overflow-auto min-h-[400px] border border-slate-800 shadow-xl font-mono">
                                            <pre className="text-sm text-slate-400 leading-relaxed break-all whitespace-pre-wrap">
                                                {selectedLog.old_data && Object.keys(selectedLog.old_data).length > 0 ? JSON.stringify(selectedLog.old_data, null, 2) : '// Sem dados anteriores ou criação'}
                                            </pre>
                                        </div>
                                    </div>

                                    <div className="flex flex-col h-full">
                                        <h4 className="text-sm font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2 mb-4">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            Nova Versão
                                        </h4>
                                        <div className="flex-1 bg-slate-900 rounded-2xl p-6 overflow-auto min-h-[400px] border border-slate-800 shadow-xl font-mono">
                                            <pre className="text-sm text-emerald-400/90 leading-relaxed break-all whitespace-pre-wrap">
                                                {selectedLog.new_data && Object.keys(selectedLog.new_data).length > 0 ? JSON.stringify(selectedLog.new_data, null, 2) : '// Operação de deleção ou nulo'}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="px-8 py-5 border-t bg-white flex justify-end" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                                <button
                                    onClick={() => setSelectedLog(null)}
                                    className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all hover:scale-105 active:scale-95 shadow-md"
                                >
                                    Fechar Detalhes
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
