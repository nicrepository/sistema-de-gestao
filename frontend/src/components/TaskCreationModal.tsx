
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDataController } from '@/controllers/useDataController';
import { Dialog } from '@headlessui/react';
import { X, Save, AlertCircle } from 'lucide-react';
import { Priority, Status } from '@/types';

interface TaskCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    preSelectedClientId?: string;
    preSelectedProjectId?: string;
}

export const TaskCreationModal: React.FC<TaskCreationModalProps> = ({ isOpen, onClose, preSelectedClientId, preSelectedProjectId }) => {
    const { clients, projects, users, projectMembers, createTask } = useDataController();
    const { currentUser, isAdmin } = useAuth();

    const [clientId, setClientId] = useState(preSelectedClientId || '');
    const [projectId, setProjectId] = useState(preSelectedProjectId || '');
    const [developerId, setDeveloperId] = useState('');
    const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
    const [isCollaboratorsOpen, setIsCollaboratorsOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [notes, setNotes] = useState('');
    const [link_ef, setLinkEf] = useState('');
    const [priority, setPriority] = useState<Priority>('Medium');
    const [status, setStatus] = useState<Status>('Todo');
    const [scheduledStart, setScheduledStart] = useState('');
    const [estimatedDelivery, setEstimatedDelivery] = useState('');
    const [estimatedHours, setEstimatedHours] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Reset fields when opening/closing or changing initial props
    useEffect(() => {
        if (isOpen) {
            // Se temos um projeto pré-selecionado, precisamos setar o cliente automaticamente
            let initialClientId = preSelectedClientId || '';

            if (preSelectedProjectId && !preSelectedClientId) {
                // Buscar o projeto para pegar o clientId
                const project = projects.find(p => p.id === preSelectedProjectId);
                if (project) {
                    initialClientId = project.clientId;
                }
            }

            setClientId(initialClientId);
            setProjectId(preSelectedProjectId || '');
            setTitle('');
            setDescription('');
            setNotes('');
            setLinkEf('');
            setPriority('Medium');
            setStatus('Todo');

            // Auto-allocate if not admin
            if (!isAdmin && currentUser) {
                setCollaboratorIds([currentUser.id]);
                setDeveloperId(currentUser.id);
            } else {
                setDeveloperId('');
                setCollaboratorIds([]);
            }

            // Set default dates: Start today, delivery +7 days
            const today = new Date();
            setScheduledStart(today.toISOString().split('T')[0]);

            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            setEstimatedDelivery(nextWeek.toISOString().split('T')[0]);
            setEstimatedHours('');

            setError('');
        }
    }, [isOpen, preSelectedClientId, preSelectedProjectId, currentUser, projects]);

    // Derived state for selects

    // Filter projects based on Client AND User Permissions
    const filteredProjects = projects.filter(p => {
        const matchesClient = p.clientId === clientId;
        const isActive = p.active !== false;

        // Permissão: Admin vê tudo, Colaborador vê apenas onde é membro
        const isMember = isAdmin || projectMembers.some(pm => String(pm.id_projeto) === String(p.id) && String(pm.id_colaborador) === String(currentUser?.id));

        return matchesClient && isActive && isMember;
    });

    // Filter Clients: Only show clients that have at least one accessible project
    const availableClients = clients.filter(c => {
        if (c.active === false) return false;
        if (isAdmin) return true;

        // Se não for admin, só mostra clientes que possuem projetos vinculados ao usuário
        const hasAccessibleProject = projects.some(p =>
            p.clientId === c.id &&
            p.active !== false &&
            projectMembers.some(pm => String(pm.id_projeto) === String(p.id) && String(pm.id_colaborador) === String(currentUser?.id))
        );

        return hasAccessibleProject;
    });



    const eligibleUsers = useMemo(() => {
        return projectId
            ? users.filter(u => u.active !== false && projectMembers.some(pm => String(pm.id_projeto) === String(projectId) && String(pm.id_colaborador) === String(u.id)))
            : users.filter(u => u.active !== false);
    }, [users, projectId, projectMembers]);

    const handleSave = async () => {
        if (!title.trim()) {
            setError('O título da tarefa é obrigatório.');
            return;
        }
        if (!clientId) {
            setError('O cliente é obrigatório.');
            return;
        }
        if (!projectId) {
            setError('O projeto é obrigatório.');
            return;
        }
        if (collaboratorIds.length === 0) {
            setError('A equipe alocada é obrigatória. Selecione pelo menos um colaborador.');
            return;
        }
        if (!scheduledStart) {
            setError('A data de início da tarefa é obrigatória.');
            return;
        }
        if (!estimatedDelivery) {
            setError('A data de entrega estimada é obrigatória.');
            return;
        }
        if (!estimatedHours || Number(estimatedHours) === 0) {
            setError('As horas estimadas da tarefa são obrigatórias.');
            return;
        }
        if (!estimatedHours || Number(estimatedHours) === 0) {
            setError('As horas estimadas da tarefa são obrigatórias.');
            return;
        }

        // Validar intervalo do projeto
        const project = projects.find(p => String(p.id) === String(projectId));
        if (project) {
            const pStart = project.startDate ? new Date(project.startDate + 'T00:00:00') : null;
            const pEnd = project.estimatedDelivery ? new Date(project.estimatedDelivery + 'T23:59:59') : null;
            const tStart = new Date(scheduledStart + 'T00:00:00');
            const tEnd = new Date(estimatedDelivery + 'T00:00:00');

            if (pStart && tStart < pStart) {
                setError(`A data de início da tarefa (${scheduledStart}) não pode ser anterior ao início do projeto (${project.startDate}).`);
                return;
            }
            if (pEnd && tEnd > pEnd) {
                setError(`A data de entrega da tarefa (${estimatedDelivery}) não pode ser posterior à entrega do projeto (${project.estimatedDelivery}).`);
                return;
            }
        }

        if (!developerId) {
            setError('O responsável principal é obrigatório.');
            return;
        }

        try {
            setLoading(true);
            setError('');

            await createTask({
                clientId,
                projectId,
                title,
                description,
                notes,
                link_ef: link_ef || undefined,
                developerId: developerId || undefined,
                collaboratorIds: collaboratorIds || undefined,
                priority,
                status,
                actualStart: status === 'In Progress' ? new Date().toISOString().split('T')[0] : undefined,
                actualDelivery: status === 'Done' ? new Date().toISOString().split('T')[0] : undefined,
                scheduledStart: scheduledStart || undefined,
                estimatedDelivery: estimatedDelivery || undefined,
                estimatedHours: Number(estimatedHours) || 0
            });

            onClose();
        } catch (err) {
            console.error(err);
            setError('Erro ao criar tarefa: ' + (err as any)?.message || 'Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg)]">
                    <div className="flex flex-col">
                        <h2 className="text-lg font-bold leading-tight">Nova Tarefa</h2>
                        {(clientId || projectId) && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                                {clientId && (
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--primary)] opacity-80">
                                        {clients.find(c => c.id === clientId)?.name}
                                    </span>
                                )}
                                {clientId && projectId && <span className="text-[10px] opacity-30">•</span>}
                                {projectId && (
                                    <span className="text-[10px] font-bold text-[var(--muted)] truncate max-w-[200px]">
                                        {projects.find(p => p.id === projectId)?.name}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-[var(--surface-hover)] transition-colors"
                    >
                        <X className="w-5 h-5 text-[var(--muted)]" />
                    </button>
                </div>

                {/* Body and Footer wrapped in Form */}
                <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="flex flex-col flex-1 overflow-hidden">
                    {/* Body */}
                    <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4">

                        {error && (
                            <div className="p-3 rounded-lg flex items-center gap-2 text-sm font-medium border" style={{ backgroundColor: 'var(--danger-bg)', borderColor: 'var(--danger-muted)', color: 'var(--danger-text)' }}>
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        {/* Cliente */}
                        <div>
                            <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70">Cliente *</label>
                            <select
                                value={clientId}
                                onChange={(e) => { setClientId(e.target.value); setProjectId(''); }}
                                disabled={!!preSelectedClientId}
                                className={`w-full p-2.5 border rounded-lg outline-none font-medium text-sm focus:ring-1 focus:ring-[var(--primary)] text-[var(--text)] disabled:opacity-50 transition-colors bg-[var(--bg)] ${!clientId ? 'border-yellow-500/50 ring-1 ring-yellow-500/20' : 'border-[var(--border)]'}`}
                            >
                                <option value="" className="bg-[var(--surface)]">Selecione o Cliente...</option>
                                {availableClients.map(c => (
                                    <option key={c.id} value={c.id} className="bg-[var(--surface)]">{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Projeto */}
                        <div>
                            <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70">Projeto *</label>
                            <select
                                value={projectId}
                                onChange={(e) => { setProjectId(e.target.value); }}
                                disabled={!clientId || !!preSelectedProjectId}
                                className={`w-full p-2.5 border rounded-lg outline-none font-medium text-sm focus:ring-1 focus:ring-[var(--primary)] text-[var(--text)] disabled:opacity-50 transition-colors bg-[var(--bg)] ${!projectId ? 'border-yellow-500/50 ring-1 ring-yellow-500/20' : 'border-[var(--border)]'}`}
                            >
                                <option value="" className="bg-[var(--surface)]">Selecione o Projeto...</option>
                                {filteredProjects.map(p => (
                                    <option key={p.id} value={p.id} className="bg-[var(--surface)]">{p.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Equipe Alocada (Colaboradores) */}
                        <div className="relative">
                            <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70">Equipe Alocada *</label>
                            <button
                                type="button"
                                onClick={() => setIsCollaboratorsOpen(!isCollaboratorsOpen)}
                                disabled={!projectId}
                                className={`w-full p-2.5 border rounded-lg outline-none font-medium text-sm flex items-center justify-between focus:ring-1 focus:ring-[var(--primary)] text-[var(--text)] disabled:opacity-50 text-left transition-colors bg-[var(--bg)] ${collaboratorIds.length === 0 ? 'border-yellow-500/50 ring-1 ring-yellow-500/20' : 'border-[var(--border)]'}`}
                            >
                                <span className={collaboratorIds.length === 0 ? 'text-[var(--muted)]' : ''}>
                                    {collaboratorIds.length === 0
                                        ? 'Selecione colaboradores...'
                                        : `${collaboratorIds.length} selecionado(s)`}
                                </span>
                                <span className="text-[10px] opacity-50">▼</span>
                            </button>

                            {isCollaboratorsOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto border rounded-lg shadow-xl bg-[var(--surface)] z-10 border-[var(--border)]">
                                    {eligibleUsers.map(u => (
                                        <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-[var(--surface-hover)] cursor-pointer text-sm">
                                            <input
                                                type="checkbox"
                                                checked={collaboratorIds.includes(u.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setCollaboratorIds([...collaboratorIds, u.id]);
                                                    } else {
                                                        const newCollaboratorIds = collaboratorIds.filter(id => id !== u.id);
                                                        setCollaboratorIds(newCollaboratorIds);
                                                        // Se o responsável foi removido da equipe, limpar o responsável
                                                        if (developerId === u.id) {
                                                            setDeveloperId('');
                                                        }
                                                    }
                                                }}
                                                className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                                            />
                                            <span>{u.name}</span>
                                        </label>
                                    ))}
                                    {eligibleUsers.length === 0 && (
                                        <div className="p-3 text-center text-xs text-[var(--muted)]">
                                            Nenhum colaborador disponível no projeto.
                                        </div>
                                    )}
                                </div>
                            )}
                            <p className="text-[10px] text-[var(--muted)] mt-1">
                                {projectId && eligibleUsers.length === 0 ? 'Nenhum membro no projeto.' : 'Selecione os membros da equipe para esta tarefa.'}
                            </p>
                        </div>

                        {/* Responsável Principal (apenas membros da equipe alocada) */}
                        <div>
                            <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70">Responsável Principal *</label>
                            <select
                                value={developerId}
                                onChange={(e) => setDeveloperId(e.target.value)}
                                disabled={collaboratorIds.length === 0}
                                className={`w-full p-2.5 border rounded-lg outline-none font-medium text-sm focus:ring-1 focus:ring-[var(--primary)] text-[var(--text)] disabled:opacity-50 transition-colors bg-[var(--bg)] ${!developerId ? 'border-yellow-500/50 ring-1 ring-yellow-500/20' : 'border-[var(--border)]'}`}
                            >
                                <option value="" className="bg-[var(--surface)]">Selecione o Responsável...</option>
                                {eligibleUsers
                                    .filter(u => collaboratorIds.includes(u.id))
                                    .map(u => (
                                        <option key={u.id} value={u.id} className="bg-[var(--surface)]">{u.name}</option>
                                    ))
                                }
                            </select>
                            <p className="text-[10px] text-[var(--muted)] mt-1">
                                Escolha o responsável dentre os membros da equipe alocada.
                            </p>
                        </div>

                        {/* Overlay to close dropdown when clicking outside */}
                        {isCollaboratorsOpen && (
                            <div className="fixed inset-0 z-0" onClick={() => setIsCollaboratorsOpen(false)} />
                        )}

                        <div className="h-px bg-[var(--border)] my-1" />

                        {/* Título */}
                        <div>
                            <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70">Título da Tarefa *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ex: Criar tela de login"
                                className={`w-full p-2.5 border rounded-lg outline-none font-medium text-sm focus:ring-1 focus:ring-[var(--primary)] text-[var(--text)] transition-colors bg-[var(--bg)] ${!title.trim() ? 'border-yellow-500/50 ring-1 ring-yellow-500/20' : 'border-[var(--border)]'}`}
                            />
                        </div>

                        {/* Descrição */}
                        <div>
                            <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70">Descrição</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Detalhes da tarefa..."
                                rows={2}
                                className="w-full p-2.5 border rounded-lg outline-none font-medium text-sm resize-none focus:ring-1 focus:ring-[var(--primary)] bg-[var(--bg)] border-[var(--border)] text-[var(--text)]"
                            />
                        </div>

                        {/* Anotações e Documentação */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70">Anotações Internas</label>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Observações rápidas..."
                                    className="w-full p-2.5 border rounded-lg outline-none font-medium text-sm focus:ring-1 focus:ring-[var(--primary)] bg-[var(--bg)] border-[var(--border)] text-[var(--text)]"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70" style={{ color: 'var(--info-text)' }}>Link de Documentação (URL)</label>
                                <input
                                    type="url"
                                    value={link_ef}
                                    onChange={(e) => setLinkEf(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full p-2.5 border rounded-lg outline-none font-medium text-sm focus:ring-1 focus:ring-blue-500/50 bg-[var(--bg)] border-[var(--border)] text-[var(--text)]"
                                />
                            </div>
                        </div>

                        {/* Datas e Esforço */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {/* Previsão Início */}
                            <div>
                                <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70">Início *</label>
                                <input
                                    type="date"
                                    value={scheduledStart}
                                    onChange={(e) => setScheduledStart(e.target.value)}
                                    className={`w-full p-2.5 border rounded-lg outline-none font-medium text-[11px] focus:ring-1 focus:ring-[var(--primary)] text-[var(--text)] transition-colors bg-[var(--bg)] ${!scheduledStart ? 'border-yellow-500/50 ring-1 ring-yellow-500/20' : 'border-[var(--border)]'}`}
                                />
                            </div>

                            {/* Entrega Estimada */}
                            <div>
                                <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70">Entrega *</label>
                                <input
                                    type="date"
                                    value={estimatedDelivery}
                                    onChange={(e) => setEstimatedDelivery(e.target.value)}
                                    className={`w-full p-2.5 border rounded-lg outline-none font-medium text-[11px] focus:ring-1 focus:ring-[var(--primary)] text-[var(--text)] transition-colors bg-[var(--bg)] ${!estimatedDelivery ? 'border-yellow-500/50 ring-1 ring-yellow-500/20' : 'border-[var(--border)]'}`}
                                />
                            </div>

                            {/* Horas Estimadas */}
                            <div>
                                <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70" style={{ color: 'var(--primary)' }}>Horas *</label>
                                <input
                                    type="text"
                                    value={estimatedHours}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(',', '.');
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                            setEstimatedHours(val);
                                        }
                                    }}
                                    placeholder="0h"
                                    className={`w-full p-2.5 border rounded-lg outline-none font-bold text-[11px] focus:ring-1 focus:ring-purple-500/50 text-[var(--text)] transition-colors bg-[var(--bg)] ${!estimatedHours || Number(estimatedHours) === 0 ? 'border-yellow-500/50 ring-1 ring-yellow-500/20' : 'border-[var(--border)]'}`}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Status */}
                            <div>
                                <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70">Status Inicial</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as Status)}
                                    className="w-full p-2.5 border rounded-lg outline-none font-medium text-sm focus:ring-1 focus:ring-[var(--primary)] bg-[var(--bg)] border-[var(--border)] text-[var(--text)]"
                                >
                                    <option value="Todo" className="bg-[var(--surface)]">A Fazer</option>
                                    <option value="In Progress" className="bg-[var(--surface)]">Em Andamento</option>
                                    <option value="Testing" className="bg-[var(--surface)]">Em Teste</option>
                                    <option value="Review" className="bg-[var(--surface)]">Pendente / Revisão</option>
                                    <option value="Done" className="bg-[var(--surface)]">Concluído</option>
                                </select>
                            </div>

                            {/* Prioridade */}
                            <div>
                                <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70" style={{ color: 'var(--warning-text)' }}>Prioridade</label>
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value as Priority)}
                                    className="w-full p-2.5 border rounded-lg outline-none font-medium text-sm focus:ring-1 focus:ring-amber-500/50 bg-[var(--bg)] border-[var(--border)] text-[var(--text)]"
                                >
                                    <option value="Low" className="bg-[var(--surface)]">Baixa</option>
                                    <option value="Medium" className="bg-[var(--surface)]">Média</option>
                                    <option value="High" className="bg-[var(--surface)]">Alta</option>
                                    <option value="Critical" className="bg-[var(--surface)]">Crítica</option>
                                </select>
                            </div>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg)] flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg font-bold text-sm transition-colors hover:bg-[var(--surface-hover)] border border-transparent text-[var(--muted)] hover:text-[var(--text)]"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 rounded-lg font-bold text-sm transition-colors bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? 'Salvando...' : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Criar Tarefa
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
