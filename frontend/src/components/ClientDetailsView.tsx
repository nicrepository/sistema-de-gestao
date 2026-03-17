// components/ClientDetailsView.tsx - Unificado: Resumo + Detalhes/Edição + Projetos + Tarefas
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataController } from '../controllers/useDataController';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft, Plus, Briefcase, CheckSquare, Clock, Edit,
  LayoutGrid, ListTodo, Filter, Trash2, Save, Upload,
  User as UserIcon, Building2, Globe, Phone, FileText, AlertTriangle, AlertCircle,
  Search, ChevronDown, Handshake, X, Check, DollarSign, Mail, Calendar, CalendarDays
} from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { motion } from 'framer-motion';
import * as CapacityUtils from '../utils/capacity';
import type { Client, User, Project, Task, ProjectMember, TimesheetEntry } from '../types';
import { toUpperCase, toSentenceCase, cleanText } from '../utils/textFormatter';

type ViewTab = 'details' | 'projects' | 'tasks';

const ClientDetailsView: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const {
    clients, projects, tasks, users, timesheetEntries, getClientById, projectMembers,
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
    pais: '',
    active: true,
    doc_nic_ativo: false,
    razao_social: '',
    segmento: '',
    email_financeiro: '',
    responsavel_tecnico: '',
    data_inicio_contrato: '',
    data_fim_contrato: '',
    endereco_rua: '',
    endereco_numero: '',
    endereco_complemento: '',
    endereco_bairro: '',
    endereco_cidade: '',
    endereco_estado: '',
    endereco_cep: '',
    contato_celular: '',
    contato_whatsapp: '',
    contato_cargo: ''
  });

  // Searchable Partner Select States
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Memoized Partners List (Filtered & Sorted)
  const partners = useMemo(() => {
    return (clients as Client[])
      .filter((c: Client) => c.tipo_cliente === 'parceiro')
      .sort((a: Client, b: Client) => (a.name || '').localeCompare(b.name || ''));
  }, [clients]);

  const filteredPartners = useMemo(() => {
    return partners.filter((p: Client) =>
      (p.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [partners, searchTerm]);

  const selectedPartners = useMemo(() => {
    const ids = formData.partner_id?.split(',').filter(Boolean) || [];
    return partners.filter((p: Client) => ids.includes(p.id));
  }, [partners, formData.partner_id]);

  const togglePartner = (id: string) => {
    const ids = formData.partner_id?.split(',').filter(Boolean) || [];
    let newIds;
    if (ids.includes(id)) {
      newIds = ids.filter(i => i !== id);
    } else {
      newIds = [...ids, id];
    }
    setFormData({ ...formData, partner_id: newIds.join(',') });
  };

  // Click Outside Handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        logoUrl: client.logoUrl || '',
        cnpj: client.cnpj || '',
        telefone: client.telefone || '',
        tipo_cliente: client.tipo_cliente || 'cliente_final',
        partner_id: client.partner_id || '',
        pais: client.pais || '',
        active: client.active ?? true,
        doc_nic_ativo: client.doc_nic_ativo ?? false,
        razao_social: client.razao_social || '',
        segmento: client.segmento || '',
        email_financeiro: client.email_financeiro || '',
        responsavel_tecnico: client.responsavel_tecnico || '',
        data_inicio_contrato: client.data_inicio_contrato || '',
        data_fim_contrato: client.data_fim_contrato || '',
        endereco_rua: client.endereco_rua || '',
        endereco_numero: client.endereco_numero || '',
        endereco_complemento: client.endereco_complemento || '',
        endereco_bairro: client.endereco_bairro || '',
        endereco_cidade: client.endereco_cidade || '',
        endereco_estado: client.endereco_estado || '',
        endereco_cep: client.endereco_cep || '',
        contato_celular: client.contato_celular || '',
        contato_whatsapp: client.contato_whatsapp || '',
        contato_cargo: client.contato_cargo || ''
      });
    }
  }, [client]);

  // Computed Stats
  const clientProjects = projects.filter((p: Project) => p.clientId === clientId);
  const clientTasks = tasks.filter((t: Task) => t.clientId === clientId);

  const totalHoursSold = clientProjects.reduce((sum: number, p: Project) => sum + (Number(p.horas_vendidas) || 0), 0);
  const totalHoursReported = clientTasks.reduce((sum: number, t: Task) => {
    const hours = timesheetEntries
      .filter((entry: TimesheetEntry) => String(entry.taskId) === String(t.id))
      .reduce((s: number, entry: TimesheetEntry) => s + (Number(entry.totalHours) || 0), 0);
    return sum + hours;
  }, 0);

  const getComputedProjectStatus = (projectTasks: Task[]) => {
    if (projectTasks.length === 0) return 'S/ Tarefas';

    const isDelayed = (t: Task) => {
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
    if (projectTasks.some((t: Task) => t.status === 'In Progress')) return 'Em Andamento';
    if (projectTasks.some((t: Task) => t.status === 'Testing')) return 'Teste';
    if (projectTasks.some((t: Task) => t.status === 'Review')) return 'Análise';
    if (projectTasks.some((t: Task) => t.status === 'Todo')) return 'Pré-Projeto';
    if (projectTasks.every((t: Task) => t.status === 'Done')) return 'Concluído';

    return 'Iniciado';
  };

  const projectStats = useMemo(() => {
    const withComputed = clientProjects.map((p: Project) => {
      const pTasks = tasks.filter((t: Task) => t.projectId === p.id);
      const computedStatus = getComputedProjectStatus(pTasks);
      return { ...p, computedStatus };
    });

    const active = withComputed.filter((p: Project & { computedStatus: string }) =>
      p.computedStatus !== 'Concluído' &&
      p.status !== 'Concluído' &&
      p.status !== 'Finalizado' &&
      p.status !== 'Entregue'
    ).length;

    const completed = withComputed.filter((p: Project & { computedStatus: string }) =>
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
      return projectStats.withComputed.filter((p: Project & { computedStatus: string }) =>
        p.computedStatus === 'Concluído' ||
        p.status === 'Concluído' ||
        p.status === 'Finalizado' ||
        p.status === 'Entregue'
      );
    }

    return projectStats.withComputed.filter((p: Project & { computedStatus: string }) =>
      p.computedStatus !== 'Concluído' &&
      p.status !== 'Concluído' &&
      p.status !== 'Finalizado' &&
      p.status !== 'Entregue'
    );
  }, [projectStats, projectFilter]);

  const isProjectIncomplete = (p: Project) => {
    return (
      !p.name?.trim() ||
      !p.clientId ||
      !p.partnerId ||
      !p.valor_total_rs ||
      !p.horas_vendidas ||
      !p.startDate ||
      !p.estimatedDelivery ||
      !p.responsibleNicLabsId ||
      projectMembers.filter((pm: ProjectMember) => String(pm.id_projeto) === p.id).length === 0
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;

    if (formData.tipo_cliente === 'cliente_final' && !formData.partner_id) {
      return alert('É obrigatório vincular este cliente a um parceiro.');
    }

    setLoading(true);
    try {
      await updateClient(clientId, {
        name: formData.name,
        logoUrl: formData.logoUrl,
        tipo_cliente: formData.tipo_cliente,
        partner_id: formData.partner_id || undefined,
        cnpj: formData.cnpj,
        telefone: formData.telefone,
        pais: formData.pais,
        active: formData.active,
        doc_nic_ativo: formData.doc_nic_ativo,
        razao_social: formData.razao_social,
        segmento: formData.segmento,
        email_financeiro: formData.email_financeiro,
        responsavel_tecnico: formData.responsavel_tecnico,
        data_inicio_contrato: formData.data_inicio_contrato || null,
        data_fim_contrato: formData.data_fim_contrato || null,
        endereco_rua: formData.endereco_rua,
        endereco_numero: formData.endereco_numero,
        endereco_complemento: formData.endereco_complemento,
        endereco_bairro: formData.endereco_bairro,
        endereco_cidade: formData.endereco_cidade,
        endereco_estado: formData.endereco_estado,
        endereco_cep: formData.endereco_cep,
        contato_celular: formData.contato_celular,
        contato_whatsapp: formData.contato_whatsapp,
        contato_cargo: formData.contato_cargo
      } as Partial<Client>);

      alert('Cliente atualizado com sucesso!');
      setIsEditing(false);
    } catch (error: any) {
      console.error('Erro ao atualizar cliente:', error);
      alert('Erro ao salvar informações.');
    } finally {
      setLoading(false);
      setIsEditing(false);
    }
  };

  const statusColors: Record<string, string> = {
    'Todo': 'bg-gray-500',
    'In Progress': 'bg-blue-500',
    'Testing': 'bg-purple-500',
    'Review': 'bg-orange-500',
    'Done': 'bg-green-500'
  };

  const getPartnerName = (id: string) => {
    const partner = clients.find((c: Client) => c.id === id);
    return partner ? partner.name : 'Direto';
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
      <div className="px-8 py-4 shadow-lg flex items-center justify-between text-white z-20 sticky top-0" style={{ background: 'var(--header-bg-alt)' }}>
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/admin/clients')}
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full transition-all text-white"
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
                <span className={`text-[9px] font-black uppercase border px-2 py-0.5 rounded-full tracking-widest ${client.active !== false ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  {client.active !== false ? 'ATIVO' : 'INATIVO'}
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
                            id="client-name"
                            name="name"
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full pl-12 pr-4 py-4 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-xl"
                            style={{
                              backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                              color: 'var(--text)',
                              borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                            }}
                            autoComplete="organization"
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
                            id="client-cnpj"
                            name="cnpj"
                            type="text"
                            value={formData.cnpj}
                            onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                            className="w-full pl-12 pr-4 py-4 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-xl"
                            style={{
                              backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                              color: 'var(--text)',
                              borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                            }}
                            autoComplete="off"
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
                            id="client-country"
                            name="country"
                            type="text"
                            value={formData.pais}
                            onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
                            className="w-full pl-12 pr-4 py-4 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-xl"
                            style={{
                              backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                              color: 'var(--text)',
                              borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                            }}
                            autoComplete="country-name"
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
                            id="client-phone"
                            name="phone"
                            type="text"
                            value={formData.telefone}
                            onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                            className="w-full pl-12 pr-4 py-4 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-xl"
                            style={{
                              backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                              color: 'var(--text)',
                              borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                            }}
                            autoComplete="tel"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-muted)' }}>Razão Social</label>
                        <div className="relative group">
                          {isEditing && (
                            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'var(--text-placeholder)' }} size={18} />
                          )}
                          <input
                            type="text"
                            value={formData.razao_social}
                            onChange={(e) => setFormData({ ...formData, razao_social: toUpperCase(e.target.value) })}
                            className="w-full pl-12 pr-4 py-4 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-xl"
                            style={{
                              backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                              color: 'var(--text)',
                              borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                            }}
                            placeholder="Nome Juridico"
                          />
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-muted)' }}>Segmento / Indústria</label>
                        <div className="relative group">
                          {isEditing && (
                            <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'var(--text-placeholder)' }} size={18} />
                          )}
                          <input
                            type="text"
                            value={formData.segmento}
                            onChange={(e) => setFormData({ ...formData, segmento: toSentenceCase(cleanText(e.target.value)) })}
                            className="w-full pl-12 pr-4 py-4 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-xl"
                            style={{
                              backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                              color: 'var(--text)',
                              borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                            }}
                            placeholder="Ex: Varejo, Tecnologia..."
                          />
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-muted)' }}>URL da Logomarca</label>
                        <div className="flex gap-4">
                          <input
                            id="client-logo-url"
                            name="logoUrl"
                            type="text"
                            value={formData.logoUrl}
                            onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                            className="flex-1 px-4 py-4 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none"
                            style={{
                              backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                              color: 'var(--text)',
                              borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                            }}
                            autoComplete="off"
                          />
                          {isEditing && (
                            <button type="button" className="px-6 py-4 border-2 rounded-2xl transition-colors" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                              <Upload size={20} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-muted)' }}>Status da Conta</label>
                        <button
                          type="button"
                          onClick={() => isEditing && setFormData({ ...formData, active: !formData.active })}
                          className={`flex items-center gap-3 px-6 py-4 rounded-2xl border-2 transition-all ${formData.active ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600' : 'border-red-500/30 bg-red-500/5 text-red-600'}`}
                          disabled={!isEditing}
                        >
                          <div className={`w-4 h-4 rounded-full ${formData.active ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                          <span className="font-black uppercase tracking-widest text-xs">{formData.active ? 'Ativo' : 'Inativo'}</span>
                        </button>
                        {isEditing && !formData.active && (
                          <p className="mt-2 text-[10px] font-bold text-red-400">Nota: Ao desativar, o cliente será desvinculado dos parceiros.</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-muted)' }}>Documentação</label>
                        <button
                          type="button"
                          id="doc-nic-toggle-detail"
                          name="doc_nic_ativo"
                          onClick={() => isEditing && setFormData({ ...formData, doc_nic_ativo: !formData.doc_nic_ativo })}
                          className={`flex items-center gap-3 px-6 py-4 rounded-2xl border-2 transition-all ${formData.doc_nic_ativo ? 'border-primary/30 bg-primary/5 text-primary' : 'border-[var(--border)] bg-[var(--surface-3)] text-[var(--muted)]'}`}
                          disabled={!isEditing}
                        >
                          <FileText className={`w-4 h-4 ${formData.doc_nic_ativo ? 'text-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]' : 'opacity-30'}`} />
                          <span className="font-black uppercase tracking-widest text-xs">DOC. NIC</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-8 rounded-[24px] border mt-12" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                      <h4 className="text-xs font-black uppercase mb-6 tracking-widest flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
                        <Globe size={16} className="text-purple-500" /> Endereço e Contato Detalhado
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-3">
                          <label className="block text-[10px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Rua / Logradouro</label>
                          <input
                            type="text"
                            value={formData.endereco_rua}
                            onChange={(e) => setFormData({ ...formData, endereco_rua: toUpperCase(e.target.value) })}
                            className="w-full px-4 py-3 border-2 focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                            style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Número</label>
                          <input
                            type="text"
                            value={formData.endereco_numero}
                            onChange={(e) => setFormData({ ...formData, endereco_numero: e.target.value })}
                            className="w-full px-4 py-3 border-2 focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                            style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Complemento</label>
                          <input
                            type="text"
                            value={formData.endereco_complemento}
                            onChange={(e) => setFormData({ ...formData, endereco_complemento: toSentenceCase(cleanText(e.target.value)) })}
                            className="w-full px-4 py-3 border-2 focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                            style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Bairro</label>
                          <input
                            type="text"
                            value={formData.endereco_bairro}
                            onChange={(e) => setFormData({ ...formData, endereco_bairro: toUpperCase(e.target.value) })}
                            className="w-full px-4 py-3 border-2 focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                            style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Cidade</label>
                          <input
                            type="text"
                            value={formData.endereco_cidade}
                            onChange={(e) => setFormData({ ...formData, endereco_cidade: toUpperCase(e.target.value) })}
                            className="w-full px-4 py-3 border-2 focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                            style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>UF</label>
                          <input
                            type="text"
                            value={formData.endereco_estado}
                            onChange={(e) => setFormData({ ...formData, endereco_estado: toUpperCase(e.target.value) })}
                            className="w-full px-4 py-3 border-2 focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                            style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>CEP</label>
                          <input
                            type="text"
                            value={formData.endereco_cep}
                            onChange={(e) => setFormData({ ...formData, endereco_cep: e.target.value })}
                            className="w-full px-4 py-3 border-2 focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                            style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Celular / WhatsApp</label>
                          <input
                            type="text"
                            value={formData.contato_celular}
                            onChange={(e) => setFormData({ ...formData, contato_celular: e.target.value })}
                            className="w-full px-4 py-3 border-2 focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                            style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Cargo do Responsável</label>
                          <input
                            type="text"
                            value={formData.contato_cargo}
                            onChange={(e) => setFormData({ ...formData, contato_cargo: toSentenceCase(cleanText(e.target.value)) })}
                            className="w-full px-4 py-3 border-2 focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                            style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="p-8 rounded-[24px] border mt-12" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                      <h4 className="text-xs font-black uppercase mb-6 tracking-widest flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
                        <DollarSign size={16} className="text-purple-500" /> Dados de Contrato & Financeiro
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-[10px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Email Financeiro</label>
                          <div className="relative group">
                            {isEditing && <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500/50" />}
                            <input
                              type="email"
                              value={formData.email_financeiro}
                              onChange={(e) => setFormData({ ...formData, email_financeiro: e.target.value })}
                              className="w-full pl-12 pr-4 py-3 border-2 focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                              style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                              placeholder="financeiro@empresa.com"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Responsável Técnico</label>
                          <div className="relative group">
                            {isEditing && <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500/50" />}
                            <input
                              type="text"
                              value={formData.responsavel_tecnico}
                              onChange={(e) => setFormData({ ...formData, responsavel_tecnico: toSentenceCase(cleanText(e.target.value)) })}
                              className="w-full pl-12 pr-4 py-3 border-2 focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                              style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                              placeholder="Nome do contato principal"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Início do Contrato</label>
                          <div className="relative group">
                            {isEditing && (
                              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500/50" />
                            )}
                            <input
                              type="date"
                              value={formData.data_inicio_contrato}
                              onChange={(e) => setFormData({ ...formData, data_inicio_contrato: e.target.value })}
                              className="w-full pl-12 pr-4 py-3 border-2 focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                              style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Fim do Contrato</label>
                          <div className="relative group">
                            {isEditing && (
                              <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500/50" />
                            )}
                            <input
                              type="date"
                              value={formData.data_fim_contrato}
                              onChange={(e) => setFormData({ ...formData, data_fim_contrato: e.target.value })}
                              className="w-full pl-12 pr-4 py-3 border-2 focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                              style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                            />
                          </div>
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
                            id="client-classification"
                            name="tipo_cliente"
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
                          <div className="relative">
                            <label className="block text-[10px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Parceiros Vinculados *</label>

                            <div
                              onClick={() => isEditing && setIsDropdownOpen(true)}
                              className={`w-full p-3 border-2 rounded-xl text-left transition-all flex flex-wrap gap-2 outline-none ${isEditing ? 'cursor-pointer border-[var(--border)] hover:border-purple-500/40 bg-[var(--input-bg)]' : 'border-none bg-transparent'}`}
                            >
                              {selectedPartners.length > 0 ? (
                                selectedPartners.map(p => (
                                  <div key={p.id} className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1.5 rounded-lg shadow-sm">
                                    {p.logoUrl ? (
                                      <img src={p.logoUrl} alt={p.name} className="w-5 h-5 object-contain rounded border bg-white p-0.5" />
                                    ) : (
                                      <Handshake className="w-3.5 h-3.5 text-purple-500 opacity-50" />
                                    )}
                                    <span className="text-xs font-bold leading-tight">{p.name}</span>
                                    {isEditing && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); togglePartner(p.id); }}
                                        className="ml-1 p-0.5 hover:bg-purple-500/20 rounded-md transition-colors"
                                      >
                                        <X size={10} className="text-purple-500" />
                                      </button>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <span className={`${isEditing ? 'text-[var(--text-placeholder)]' : 'text-[var(--text)]'} font-normal text-sm py-1`}>Nenhum parceiro vinculado...</span>
                              )}
                            </div>

                            {/* Modal de Seleção de Parceiros */}
                            {isEditing && isDropdownOpen && (
                              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  onClick={() => setIsDropdownOpen(false)}
                                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  className="relative w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                                >
                                  <div className="p-6 border-b border-[var(--border)] bg-[var(--bg)]/50 backdrop-blur-md flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                      <div className="p-3 bg-purple-500/10 text-purple-600 rounded-2xl">
                                        <Handshake size={24} />
                                      </div>
                                      <div>
                                        <h3 className="text-lg font-black uppercase tracking-tight">Vincular Parceiros</h3>
                                        <p className="text-xs font-medium opacity-50">Selecione um ou mais parceiros para este cliente</p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setIsDropdownOpen(false)}
                                      className="p-2.5 hover:bg-[var(--surface-hover)] rounded-xl transition-colors"
                                    >
                                      <X size={20} className="text-muted" />
                                    </button>
                                  </div>

                                  <div className="p-6 pb-2">
                                    <div className="relative">
                                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-500/50" />
                                      <input
                                        id="partner-modal-search"
                                        name="partnerSearch"
                                        autoFocus
                                        type="text"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Procurar parceiro por nome ou CNPJ..."
                                        className="w-full pl-12 pr-4 py-4 bg-[var(--bg)] border-2 border-[var(--border)] focus:border-purple-500 rounded-2xl text-base font-bold outline-none transition-all shadow-sm"
                                        autoComplete="off"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-2">
                                    {filteredPartners.length > 0 ? (
                                      filteredPartners.map((p: Client) => {
                                        const isSelected = (formData.partner_id || '').split(',').includes(p.id);
                                        return (
                                          <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => togglePartner(p.id)}
                                            className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-all text-left border-2 ${isSelected ? 'bg-purple-600/10 border-purple-500/30 shadow-sm' : 'hover:bg-purple-500/5 border-transparent'}`}
                                          >
                                            <div className="relative">
                                              {p.logoUrl ? (
                                                <img src={p.logoUrl} alt={p.name} className={`w-12 h-12 object-cover rounded-xl border bg-white ${isSelected ? 'border-purple-500/50' : 'border-[var(--border)]'}`} />
                                              ) : (
                                                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${isSelected ? 'bg-purple-500/20 border-purple-500/30' : 'bg-[var(--bg)] border-[var(--border)]'}`}>
                                                  <Handshake className={`w-6 h-6 ${isSelected ? 'text-purple-500' : 'opacity-20'}`} />
                                                </div>
                                              )}
                                              {isSelected && (
                                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center border-2 border-[var(--surface)] shadow-lg">
                                                  <Check size={12} strokeWidth={4} />
                                                </div>
                                              )}
                                            </div>
                                            <div className="flex flex-col min-w-0 flex-1">
                                              <span className={`font-black tracking-tight text-base ${isSelected ? 'text-purple-600' : 'text-[var(--text)]'}`}>{p.name}</span>
                                              {p.cnpj && <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{p.cnpj}</span>}
                                            </div>
                                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-purple-600 border-purple-600 shadow-md' : 'border-[var(--border)] bg-transparent'}`}>
                                              {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                                            </div>
                                          </button>
                                        );
                                      })
                                    ) : (
                                      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                                        <div className="p-5 bg-purple-500/5 rounded-full mb-4">
                                          <Search className="w-10 h-10 text-purple-500/20" />
                                        </div>
                                        <p className="text-base font-black text-[var(--text)] uppercase tracking-widest opacity-30">Nenhum parceiro encontrado</p>
                                      </div>
                                    )}
                                  </div>

                                  <div className="p-6 border-t border-[var(--border)] bg-[var(--bg)]/30 backdrop-blur-md flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-black uppercase tracking-widest opacity-50">Selecionados</span>
                                      <span className="text-lg font-black text-purple-600">{selectedPartners.length} Parceiro(s)</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setIsDropdownOpen(false)}
                                      className="px-10 py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-purple-500/30 hover:bg-purple-700 hover:-translate-y-0.5 transition-all active:translate-y-0"
                                    >
                                      Confirmar Seleção
                                    </button>
                                  </div>
                                </motion.div>
                              </div>
                            )}
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
                          ...clientProjects.flatMap((p: Project) =>
                            projectMembers
                              .filter((pm: ProjectMember) => String(pm.id_projeto) === String(p.id))
                              .map((pm: ProjectMember) => String(pm.id_colaborador))
                          ),
                          ...clientTasks.map((t: Task) => t.developerId).filter((id: string | undefined): id is string => typeof id === 'string')
                        ])).map((uId: string) => {
                          const user = users.find((u: User) => String(u.id) === String(uId));
                          if (!user) return null;
                          return (
                            <div key={user.id} className="flex items-center gap-3 px-4 py-2 border rounded-2xl shadow-sm hover:border-purple-300 transition-all" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                              {user.avatarUrl ? (
                                <img src={user.avatarUrl as string} alt={user.name} className="w-8 h-8 rounded-xl object-cover" />
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
                          onClick={() => setItemToDelete({ id: clientId || '', type: 'client' })}
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
                  {filteredProjects.map((project: Project & { computedStatus: string }) => {
                    const projectTasks = tasks.filter((t: Task) => t.projectId === project.id);
                    const doneTasks = projectTasks.filter((t: Task) => t.status === 'Done').length;
                    const progress = projectTasks.length > 0 ? Math.round(CapacityUtils.calculateProjectWeightedProgress(project.id, tasks as Task[])) : 0;
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
                              .filter((pm: ProjectMember) => String(pm.id_projeto) === String(project.id))
                              .map((pm: ProjectMember) => {
                                const member = users.find((u: User) => u.id === String(pm.id_colaborador));
                                if (!member) return null;
                                return (
                                  <div key={member.id} className="w-9 h-9 rounded-2xl border-4 shadow-sm overflow-hidden" style={{ borderColor: 'var(--surface)', backgroundColor: 'var(--surface-hover)' }} title={member.name}>
                                    {member.avatarUrl ? (
                                      <img src={member.avatarUrl} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center font-bold text-[10px]" style={{ color: 'var(--muted)' }}>{member.name ? member.name.substring(0, 2).toUpperCase() : '??'}</div>
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

                {clientProjects.filter((p: Project) => clientTasks.some((t: Task) => t.projectId === p.id)).length === 0 ? (
                  <div className="py-20 rounded-[32px] border-2 border-dashed text-center" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                    <CheckSquare className="w-12 h-12 mx-auto mb-4 opacity-20" style={{ color: 'var(--text)' }} />
                    <p className="font-bold uppercase tracking-widest text-sm" style={{ color: 'var(--muted)' }}>Nenhuma tarefa ativa para este cliente</p>
                  </div>
                ) : (
                  clientProjects
                    .filter((project: Project) => clientTasks.some((task: Task) => task.projectId === project.id))
                    .map((project: Project) => {
                      const projectTasks = clientTasks.filter((t: Task) => t.projectId === project.id);
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
                                      ? Math.round(projectTasks.reduce((acc: number, t: Task) => acc + (t.progress || 0), 0) / projectTasks.length)
                                      : 0}%
                                  </span>
                                  <div className="flex-1 h-1 w-16 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-[var(--brand)]" style={{
                                      width: `${projectTasks.length > 0 ? projectTasks.reduce((acc: number, t: Task) => acc + (t.progress || 0), 0) / projectTasks.length : 0}%`
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
                                    {projectTasks.filter((t: Task) => t.status === 'Done').length}/{projectTasks.length}
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
                            {projectTasks.map((task: Task) => (
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
                                        {(() => {
                                          const user = users.find((u: User) => u.id === task.developerId);
                                          if (user?.avatarUrl) {
                                            return <img src={user.avatarUrl} className="w-full h-full object-cover rounded-lg" alt="Dev" />;
                                          }
                                          return (
                                            <div className="w-full h-full flex items-center justify-center font-bold text-[10px] uppercase" style={{ color: 'var(--muted)' }}>
                                              {(task.developer || '??').substring(0, 2)}
                                            </div>
                                          );
                                        })()}
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
