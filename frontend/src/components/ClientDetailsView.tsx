// components/ClientDetailsView.tsx - Unificado: Resumo + Detalhes/Edição + Projetos + Tarefas
import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataController } from '@/controllers/useDataController';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft, Plus, Briefcase, CheckSquare, Clock, Edit,
  LayoutGrid, ListTodo, Filter, Trash2, Save, Upload,
  User as UserIcon, Building2, Globe, Phone, FileText, AlertTriangle, AlertCircle
} from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { motion } from 'framer-motion';

type ViewTab = 'details' | 'projects' | 'tasks';

const ClientDetailsView: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const {
    clients, projects, tasks, users, getClientById, projectMembers,
    updateClient, deleteClient, deleteProject, deleteTask
  } = useDataController();
  const { isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<ViewTab>('projects');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'project' | 'task' | 'client' } | null>(null);
  const [projectFilter, setProjectFilter] = useState<'active' | 'completed' | 'all'>('active');

  // Form State
  const client = clientId ? getClientById(clientId) : null;
  const [formData, setFormData] = useState({
    name: '',
    logoUrl: '',
    cnpj: '',
    telefone: '',
    tipo_cliente: 'cliente_final' as 'parceiro' | 'cliente_final',
    partner_id: '',
    pais: ''
  });

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        logoUrl: client.logoUrl || '',
        cnpj: client.cnpj || '',
        telefone: client.telefone || '',
        tipo_cliente: client.tipo_cliente || 'cliente_final',
        partner_id: client.partner_id || '',
        pais: client.pais || ''
      });
    }
  }, [client]);

  const clientProjects = useMemo(() =>
    projects.filter(p => p.clientId === clientId),
    [projects, clientId]
  );

  const clientTasks = useMemo(() =>
    tasks.filter(t => t.clientId === clientId),
    [tasks, clientId]
  );

  const getComputedProjectStatus = (projectTasks: any[]) => {
    if (projectTasks.length === 0) return 'S/ Tarefas';

    const isDelayed = (t: any) => {
      if (t.status === 'Done' || (t.progress || 0) >= 100) return false;
      if (!t.estimatedDelivery) return false;
      const parts = t.estimatedDelivery.split('-');
      if (parts.length !== 3) return false;
      const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today > due;
    };

    if (projectTasks.some(isDelayed)) return 'Atrasado';
    if (projectTasks.some(t => t.status === 'In Progress')) return 'Em Andamento';
    if (projectTasks.some(t => t.status === 'Testing')) return 'Teste';
    if (projectTasks.some(t => t.status === 'Review')) return 'Análise';
    if (projectTasks.some(t => t.status === 'Todo')) return 'Pré-Projeto';
    if (projectTasks.every(t => t.status === 'Done')) return 'Concluído';

    return 'Iniciado';
  };

  const projectStats = useMemo(() => {
    const withComputed = clientProjects.map(p => {
      const pTasks = tasks.filter(t => t.projectId === p.id);
      const computedStatus = getComputedProjectStatus(pTasks);
      return { ...p, computedStatus };
    });

    const active = withComputed.filter(p =>
      p.computedStatus !== 'Concluído' &&
      p.status !== 'Concluído' &&
      p.status !== 'Finalizado' &&
      p.status !== 'Entregue'
    ).length;

    const completed = withComputed.filter(p =>
      p.computedStatus === 'Concluído' ||
      p.status === 'Concluído' ||
      p.status === 'Finalizado' ||
      p.status === 'Entregue'
    ).length;

    return {
      active,
      completed,
      all: withComputed.length,
      withComputed
    };
  }, [clientProjects, tasks]);

  const filteredProjects = useMemo(() => {
    if (projectFilter === 'all') return projectStats.withComputed;

    if (projectFilter === 'completed') {
      return projectStats.withComputed.filter(p =>
        p.computedStatus === 'Concluído' ||
        p.status === 'Concluído' ||
        p.status === 'Finalizado' ||
        p.status === 'Entregue'
      );
    }

    return projectStats.withComputed.filter(p =>
      p.computedStatus !== 'Concluído' &&
      p.status !== 'Concluído' &&
      p.status !== 'Finalizado' &&
      p.status !== 'Entregue'
    );
  }, [projectStats, projectFilter]);

  const isProjectIncomplete = (p: any) => {
    return (
      !p.name?.trim() ||
      !p.clientId ||
      !p.partnerId ||
      !p.valor_total_rs ||
      !p.horas_vendidas ||
      !p.startDate ||
      !p.estimatedDelivery ||
      !p.responsibleNicLabsId ||
      !p.managerClient ||
      projectMembers.filter(pm => String(pm.id_projeto) === p.id).length === 0
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;

    setLoading(true);
    try {
      await updateClient(clientId, {
        name: formData.name,
        logoUrl: formData.logoUrl,
        tipo_cliente: formData.tipo_cliente,
        partner_id: formData.partner_id || undefined,
        cnpj: formData.cnpj,
        telefone: formData.telefone,
        pais: formData.pais
      } as any);

      alert('Cliente atualizado com sucesso!');
      setIsEditing(false);
    } catch (error: any) {
      console.error(error);
      alert('Erro ao salvar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      await deleteClient(clientId);
      navigate('/admin/clients');
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir cliente. Verifique se existem projetos vinculados.');
    } finally {
      setLoading(false);
      setItemToDelete(null);
    }
  };

  if (!client) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text)]">
        <div className="text-center">
          <Building2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <h2 className="text-2xl font-bold mb-2">Cliente não encontrado</h2>
          <button onClick={() => navigate('/admin/clients')} className="text-purple-500 hover:underline">
            Voltar para lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bgApp)', color: 'var(--text)' }}>
      <div className="px-8 py-4 shadow-lg flex items-center justify-between text-white z-20 sticky top-0" style={{ background: 'linear-gradient(to right, var(--sidebar-bg), var(--sidebar-bg-2))' }}>
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/admin/clients')}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft />
          </button>
          <div className="flex items-center gap-4">
            {client.logoUrl && (
              <div className="w-12 h-12 rounded-xl p-1.5 shadow-xl border" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'rgba(255,255,255,0.1)' }}>
                <img
                  src={client.logoUrl}
                  className="w-full h-full object-contain"
                  alt={client.name}
                  onError={(e) => (e.currentTarget.src = "https://placehold.co/100x100?text=Logo")}
                />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight">{client.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-black uppercase bg-white/10 border border-white/20 px-2 py-0.5 rounded-full tracking-widest text-white/90">
                  {client.tipo_cliente === 'parceiro' ? 'PARCEIRO' : 'CLIENTE FINAL'}
                </span>
                {client.pais && (
                  <span className="text-[10px] font-medium text-white/50">• {client.pais}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* COMPACT TABS INTEGRATED IN HEADER (FUNCTIONAL VERSION) */}
        <div className="flex items-center gap-2">
          <div
            onClick={() => setActiveTab('projects')}
            className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-3 ${activeTab === 'projects' ? 'border-white bg-white/20 shadow-sm' : 'border-white/10 bg-black/10 hover:bg-white/5'}`}
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-white">Projetos</span>
            <span className="text-sm font-black text-white">{clientProjects.length}</span>
          </div>

          <div
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-3 ${activeTab === 'tasks' ? 'border-white bg-white/20 shadow-sm' : 'border-white/10 bg-black/10 hover:bg-white/5'}`}
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-white">Tarefas</span>
            <span className="text-sm font-black text-white">{clientTasks.length}</span>
          </div>

          <div
            onClick={() => setActiveTab('details')}
            className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-3 ${activeTab === 'details' ? 'border-white bg-white/20 shadow-sm' : 'border-white/10 bg-black/10 hover:bg-white/5'}`}
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-white">Informações</span>
          </div>

          {isAdmin && activeTab === 'details' && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }}
              className={`ml-2 px-3 py-1.5 rounded-lg transition-all border ${isEditing ? 'bg-white text-slate-800' : 'bg-black/20 text-white border-white/20 hover:bg-black/30'}`}
              title={isEditing ? 'Cancelar Edição' : 'Editar Cliente'}
            >
              <span className="text-[10px] font-black uppercase tracking-widest">{isEditing ? 'Sair' : 'Editar'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <div className="max-w-7xl mx-auto space-y-8">


          {/* 2. CONTEÚDO DAS TABS */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === 'details' && (
              <div className="rounded-[32px] shadow-sm border p-10" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3 mb-10 border-b pb-6" style={{ borderColor: 'var(--border)' }}>
                  <div className="p-3 rounded-2xl text-purple-600" style={{ backgroundColor: 'var(--surface-hover)' }}>
                    <UserIcon size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black" style={{ color: 'var(--text)' }}>Perfil Corporativo</h3>
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>Gerenciamento de dados e configurações contratuais</p>
                  </div>
                </div>

                <form onSubmit={handleSave} className="space-y-10">
                  <fieldset disabled={!isEditing} className="space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-muted)' }}>Nome da Empresa</label>
                        <div className="relative group">
                          {isEditing && (
                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'var(--text-placeholder)' }} size={18} />
                          )}
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full pl-12 pr-4 py-4 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-xl"
                            style={{
                              backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                              color: 'var(--text)',
                              borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                            }}
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-muted)' }}>CNPJ / Identificação</label>
                        <div className="relative group">
                          {isEditing && (
                            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'var(--text-placeholder)' }} size={18} />
                          )}
                          <input
                            type="text"
                            value={formData.cnpj}
                            onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                            className="w-full pl-12 pr-4 py-4 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-xl"
                            style={{
                              backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                              color: 'var(--text)',
                              borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-muted)' }}>País de Atuação</label>
                        <div className="relative group">
                          {isEditing && (
                            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'var(--text-placeholder)' }} size={18} />
                          )}
                          <input
                            type="text"
                            value={formData.pais}
                            onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
                            className="w-full pl-12 pr-4 py-4 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-xl"
                            style={{
                              backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                              color: 'var(--text)',
                              borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-muted)' }}>Telefone Comercial</label>
                        <div className="relative group">
                          {isEditing && (
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'var(--text-placeholder)' }} size={18} />
                          )}
                          <input
                            type="text"
                            value={formData.telefone}
                            onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                            className="w-full pl-12 pr-4 py-4 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-xl"
                            style={{
                              backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                              color: 'var(--text)',
                              borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                            }}
                          />
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-muted)' }}>URL da Logomarca</label>
                        <div className="flex gap-4">
                          <input
                            type="text"
                            value={formData.logoUrl}
                            onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                            className="flex-1 px-4 py-4 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none"
                            style={{
                              backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                              color: 'var(--text)',
                              borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                            }}
                          />
                          {isEditing && (
                            <button type="button" className="px-6 py-4 border-2 rounded-2xl transition-colors" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                              <Upload size={20} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-8 rounded-[24px] border mt-12" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                      <h4 className="text-xs font-black uppercase mb-6 tracking-widest flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
                        <FileText size={16} className="text-purple-500" /> Configuração de Filtros & Categorias
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-[10px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Classificação</label>
                          <select
                            value={formData.tipo_cliente}
                            onChange={(e) => setFormData({ ...formData, tipo_cliente: e.target.value as any })}
                            className="w-full px-4 py-3 border-2 focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:appearance-none"
                            style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                          >
                            <option value="cliente_final">Cliente Final</option>
                            <option value="parceiro">Parceiro Nic-Labs</option>
                          </select>
                        </div>
                        {formData.tipo_cliente === 'cliente_final' && (
                          <div>
                            <label className="block text-[10px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Parceiro Vinculado</label>
                            <select
                              value={formData.partner_id}
                              onChange={(e) => setFormData({ ...formData, partner_id: e.target.value })}
                              className="w-full px-4 py-3 border-2 focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:appearance-none"
                              style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                            >
                              <option value="">Direto (Sem intermédio)</option>
                              {clients.filter(c => c.tipo_cliente === 'parceiro' && c.id !== clientId).map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* NOVO: Equipe Geral do Cliente */}
                    <div className="mt-10 border-t pt-10" style={{ borderColor: 'var(--border)' }}>
                      <h4 className="text-sm font-black uppercase mb-6 tracking-widest flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
                        <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg"><UserIcon size={14} /></div>
                        Equipe Envolvida
                      </h4>
                      <div className="flex flex-wrap gap-3">
                        {Array.from(new Set([
                          ...clientProjects.flatMap(p => projectMembers.filter(pm => String(pm.id_projeto) === String(p.id)).map(pm => String(pm.id_colaborador))),
                          ...clientTasks.map(t => t.developerId).filter(id => id)
                        ])).map(uId => {
                          const user = users.find(u => u.id === uId);
                          if (!user) return null;
                          return (
                            <div key={user.id} className="flex items-center gap-3 px-4 py-2 border rounded-2xl shadow-sm hover:border-purple-300 transition-all" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                              {user.avatarUrl ? (
                                <img src={user.avatarUrl} className="w-8 h-8 rounded-xl object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-[10px] uppercase border" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>{user.name.substring(0, 2)}</div>
                              )}
                              <div className="flex flex-col">
                                <span className="text-xs font-black" style={{ color: 'var(--text)' }}>{user.name}</span>
                                <span className="text-[10px] font-bold uppercase tracking-tighter" style={{ color: 'var(--text-muted)' }}>{user.cargo || 'Membro'}</span>
                              </div>
                            </div>
                          );
                        })}
                        {clientProjects.length === 0 && clientTasks.length === 0 && (
                          <span className="text-sm italic" style={{ color: 'var(--text-muted)' }}>Nenhum colaborador alocado ainda.</span>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="flex items-center justify-between pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
                        <button
                          type="button"
                          onClick={() => setItemToDelete({ id: clientId, type: 'client' })}
                          className="px-6 py-3 text-red-500 hover:bg-red-500/10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                        >
                          Excluir Cliente
                        </button>
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="px-6 py-3 rounded-2xl font-bold transition-all"
                            style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold shadow-xl transition-all flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" /> {loading ? 'Salvando...' : 'Salvar Perfil'}
                          </button>
                        </div>
                      </div>
                    )}
                  </fieldset>
                </form>
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                  <div className="flex flex-col">
                    <h3 className="text-xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
                      {projectFilter === 'active' ? 'Projetos em Andamento' : projectFilter === 'completed' ? 'Projetos Concluídos' : 'Todos os Projetos'} ({filteredProjects.length})
                    </h3>
                    <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mt-1">
                      Visualizando {projectFilter === 'active' ? 'apenas ativos' : projectFilter === 'completed' ? 'apenas concluídos' : 'portfólio completo'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
                    <button
                      onClick={() => setProjectFilter('active')}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${projectFilter === 'active' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                    >
                      Ativos ({projectStats.active})
                    </button>
                    <button
                      onClick={() => setProjectFilter('completed')}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${projectFilter === 'completed' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                    >
                      Concluídos ({projectStats.completed})
                    </button>
                    <button
                      onClick={() => setProjectFilter('all')}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${projectFilter === 'all' ? 'bg-[var(--text)] text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                    >
                      Todos ({projectStats.all})
                    </button>
                    <div className="w-px h-4 bg-[var(--border)] mx-1" />
                    <button
                      onClick={() => navigate(`/admin/clients/${clientId}/projects/new`)}
                      className="ml-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-200 hover:bg-purple-700 transition-all flex items-center gap-2"
                    >
                      <Plus size={16} /> Novo
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProjects.map(project => {
                    const projectTasks = tasks.filter(t => t.projectId === project.id);
                    const doneTasks = projectTasks.filter(t => t.status === 'Done').length;
                    const progress = projectTasks.length > 0 ? Math.round((doneTasks / projectTasks.length) * 100) : 0;
                    const isIncomplete = isProjectIncomplete(project);

                    return (
                      <motion.div
                        whileHover={{ y: -5 }}
                        key={project.id}
                        onClick={() => navigate(`/admin/projects/${project.id}`)}
                        className={`p-7 rounded-[32px] border shadow-sm hover:shadow-xl transition-all cursor-pointer group relative`}
                        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: project.id, type: 'project' }); }}
                          className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all rounded-xl"
                        >
                          <Trash2 size={16} />
                        </button>
                        <h4 className="font-black text-lg mb-6 pr-8 group-hover:text-purple-600 transition-colors uppercase tracking-tight line-clamp-1" style={{ color: 'var(--text)' }}>
                          {project.name}
                        </h4>

                        <div className="space-y-6">
                          <div>
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
                              <span>Evolução Física</span>
                              <span style={{ color: 'var(--brand)' }}>{progress}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-hover)' }}>
                              <div className="h-full bg-gradient-to-r from-[var(--brand)] to-[var(--primary-hover)]" style={{ width: `${progress}%` }} />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                            <div className="flex items-center gap-2">
                              <CheckSquare size={14} style={{ color: 'var(--brand)' }} />
                              <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>{doneTasks} / {projectTasks.length}</span>
                            </div>
                            <div className="flex flex-col gap-2">
                              {(() => {
                                const status = project.computedStatus;
                                let colorClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';

                                if (status === 'Atrasado') colorClass = 'bg-red-500/10 text-red-500 border-red-500/20';
                                else if (status === 'Concluído') colorClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                                else if (status === 'Teste') colorClass = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                                else if (status === 'Análise') colorClass = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
                                else if (status === 'Pré-Projeto') colorClass = 'bg-slate-500/10 text-slate-400 border-slate-500/20';

                                return (
                                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] border flex items-center justify-center ${colorClass}`}>
                                    {status}
                                  </span>
                                );
                              })()}
                              {progress === 100 && project.computedStatus !== 'Concluído' && (project.status !== 'Concluído' && project.status !== 'Finalizado' && project.status !== 'Entregue') && (
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg animate-pulse">
                                  <AlertCircle size={10} className="text-amber-500" />
                                  <span className="text-[8px] font-black text-amber-600 uppercase">Sugestão: Concluir</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex -space-x-3 mt-4">
                            {projectMembers
                              .filter(pm => String(pm.id_projeto) === String(project.id))
                              .map(pm => {
                                const member = users.find(u => u.id === String(pm.id_colaborador));
                                if (!member) return null;
                                return (
                                  <div key={member.id} className="w-9 h-9 rounded-2xl border-4 shadow-sm overflow-hidden" style={{ borderColor: 'var(--surface)', backgroundColor: 'var(--surface-hover)' }} title={member.name}>
                                    {member.avatarUrl ? (
                                      <img src={member.avatarUrl} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center font-bold text-[10px]" style={{ color: 'var(--muted)' }}>{member.name.substring(0, 2).toUpperCase()}</div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {clientProjects.length === 0 && (
                    <div className="col-span-full py-20 rounded-[32px] border-2 border-dashed text-center" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                      <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-20" style={{ color: 'var(--text)' }} />
                      <p className="font-bold uppercase tracking-widest text-sm" style={{ color: 'var(--text-muted)' }}>Sem projetos cadastrados</p>
                      <button onClick={() => navigate(`/admin/clients/${clientId}/projects/new`)} className="mt-4 text-purple-600 font-black text-xs uppercase hover:underline">Criar Primeiro Projeto</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-10">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-black tracking-tight" style={{ color: 'var(--text)' }}>Monitoramento de Tarefas ({clientTasks.length})</h3>
                  <button
                    onClick={() => navigate(`/tasks/new?client=${clientId}`)}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2"
                  >
                    <Plus size={18} /> Nova Tarefa
                  </button>
                </div>

                {clientProjects.filter(p => clientTasks.some(t => t.projectId === p.id)).length === 0 ? (
                  <div className="py-20 rounded-[32px] border-2 border-dashed text-center" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                    <CheckSquare className="w-12 h-12 mx-auto mb-4 opacity-20" style={{ color: 'var(--text)' }} />
                    <p className="font-bold uppercase tracking-widest text-sm" style={{ color: 'var(--muted)' }}>Nenhuma tarefa ativa para este cliente</p>
                  </div>
                ) : (
                  clientProjects
                    .filter(project => clientTasks.some(task => task.projectId === project.id))
                    .map(project => {
                      const projectTasks = clientTasks.filter(t => t.projectId === project.id);
                      return (
                        <div key={project.id} className="space-y-4">
                          {/* Rich Project Status Bar */}
                          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 p-4 rounded-2xl border transition-all"
                            style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>

                            <div className="flex items-center gap-4 flex-1">
                              <div className="w-1.5 h-10 rounded-full bg-gradient-to-b from-blue-500 to-purple-600 shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
                              <div className="flex flex-col">
                                <h4 className="font-black text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text)' }}>
                                  {project.name}
                                </h4>
                                <div className="flex items-center gap-3">
                                  <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${project.status === 'Concluído' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    }`}>
                                    {project.status || 'Ativo'}
                                  </div>
                                  <span className="text-[10px] font-bold opacity-30" style={{ color: 'var(--text)' }}>•</span>
                                  <span className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>
                                    {projectTasks.length} {projectTasks.length === 1 ? 'Tarefa' : 'Tarefas'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between md:justify-end gap-8 px-4 border-t md:border-t-0 md:border-l pt-4 md:pt-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                              {/* Physical Evolution Stats */}
                              <div className="flex flex-col min-w-[100px]">
                                <span className="text-[8px] font-black uppercase tracking-tighter mb-1 opacity-50" style={{ color: 'var(--text)' }}>Evolução Média</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black" style={{ color: 'var(--brand)' }}>
                                    {projectTasks.length > 0
                                      ? Math.round(projectTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / projectTasks.length)
                                      : 0}%
                                  </span>
                                  <div className="flex-1 h-1 w-16 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-[var(--brand)]" style={{
                                      width: `${projectTasks.length > 0 ? projectTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / projectTasks.length : 0}%`
                                    }} />
                                  </div>
                                </div>
                              </div>

                              {/* Completion Stats */}
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black uppercase tracking-tighter mb-1 opacity-50" style={{ color: 'var(--text)' }}>Concluído</span>
                                <div className="flex items-center gap-2">
                                  <CheckSquare className="w-3.5 h-3.5" style={{ color: 'var(--brand)' }} />
                                  <span className="text-sm font-black" style={{ color: 'var(--text)' }}>
                                    {projectTasks.filter(t => t.status === 'Done').length}/{projectTasks.length}
                                  </span>
                                </div>
                              </div>

                              <button
                                onClick={() => navigate(`/admin/projects/${project.id}`)}
                                className="p-2 hover:bg-white/5 rounded-xl transition-all border border-white/5 group"
                              >
                                <ArrowLeft className="w-4 h-4 rotate-180 transition-transform group-hover:translate-x-1" style={{ color: 'var(--muted)' }} />
                              </button>
                            </div>
                          </div>

                          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar-thin pl-1">
                            {projectTasks.map(task => (
                              <motion.div
                                whileHover={{ y: -4 }}
                                key={task.id}
                                onClick={() => navigate(`/tasks/${task.id}`)}
                                className="min-w-[320px] max-w-[320px] p-5 rounded-2xl border shadow-sm transition-all cursor-pointer group flex flex-col justify-between h-[110px]"
                                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                              >
                                <div className="flex justify-between items-start gap-4">
                                  <div className="min-w-0 flex-1">
                                    <h5 className="font-bold text-sm group-hover:text-blue-500 transition-colors line-clamp-1" style={{ color: 'var(--text)' }}>
                                      {task.title}
                                    </h5>
                                    <div className="mt-1 flex items-center gap-2">
                                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border ${task.status === 'Done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                        task.status === 'In Progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                          task.status === 'Testing' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                            task.status === 'Review' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                              'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                        }`}>
                                        {task.status === 'Todo' ? 'Pré-Projeto' :
                                          task.status === 'Review' ? 'Análise' :
                                            task.status === 'In Progress' ? 'Andamento' :
                                              task.status === 'Testing' ? 'Teste' :
                                                task.status === 'Done' ? 'Concluído' : task.status}
                                      </span>
                                      {task.estimatedDelivery && (
                                        <span className="text-[9px] font-medium" style={{ color: 'var(--muted)' }}>
                                          {new Date(task.estimatedDelivery).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="shrink-0">
                                    {task.developerId && (
                                      <div className="w-8 h-8 rounded-xl border p-0.5 shadow-sm" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                                        {users.find(u => u.id === task.developerId)?.avatarUrl ? (
                                          <img src={users.find(u => u.id === task.developerId)?.avatarUrl} className="w-full h-full object-cover rounded-lg" alt="Dev" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center font-bold text-[10px] uppercase" style={{ color: 'var(--muted)' }}>
                                            {(task.developer || '??').substring(0, 2)}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-4">
                                  <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Progresso</span>
                                    <span className="text-[10px] font-black" style={{ color: 'var(--brand)' }}>{task.progress}%</span>
                                  </div>
                                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-hover)' }}>
                                    <div
                                      className="h-full bg-gradient-to-r from-[var(--brand)] to-[var(--primary-hover)] transition-all duration-500"
                                      style={{ width: `${task.progress}%` }}
                                    />
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!itemToDelete}
        title={`Excluir ${itemToDelete?.type === 'client' ? 'Cliente' : itemToDelete?.type === 'project' ? 'Projeto' : 'Tarefa'}`}
        message={`Tem certeza que deseja excluir? Esta ação não pode ser desfeita.`}
        onConfirm={async () => {
          if (!itemToDelete) return;
          try {
            if (itemToDelete.type === 'client') {
              await handleDeleteClient();
            } else if (itemToDelete.type === 'project') {
              try {
                await deleteProject(itemToDelete.id);
                alert('Projeto excluído com sucesso!');
              } catch (projectError: any) {
                const msg = projectError.message || "";
                if (msg.includes("tarefas criadas") || msg.includes("hasTasks")) {
                  if (window.confirm("Este projeto possui tarefas e possivelmente horas apontadas. Deseja realizar a EXCLUSÃO FORÇADA de todos os dados vinculados? Esta ação é irreversível.")) {
                    await deleteProject(itemToDelete.id, true);
                    alert('Projeto e dados vinculados excluídos com sucesso!');
                  } else return;
                } else throw projectError;
              }
            } else if (itemToDelete.type === 'task') {
              try {
                await deleteTask(itemToDelete.id);
                alert('Tarefa excluída com sucesso!');
              } catch (taskError: any) {
                const msg = taskError.message || "";
                if (msg.includes("horas apontadas") || msg.includes("hasHours")) {
                  if (window.confirm("Esta tarefa possui horas apontadas. Deseja excluir a tarefa e TODOS os apontamentos de horas vinculados?")) {
                    await deleteTask(itemToDelete.id, true);
                    alert('Tarefa e horas excluídas com sucesso!');
                  } else return;
                } else throw taskError;
              }
            }
            setItemToDelete(null);
          } catch (err: any) {
            console.error(err);
            alert('Erro ao excluir item: ' + (err.message || 'Erro desconhecido'));
          }
        }}
        onCancel={() => setItemToDelete(null)}
        disabled={loading}
      />
    </div >
  );
};

export default ClientDetailsView;
