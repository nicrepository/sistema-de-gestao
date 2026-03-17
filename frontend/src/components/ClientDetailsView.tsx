// components/ClientDetailsView.tsx - Unificado: Resumo + Detalhes/Edição + Projetos + Tarefas
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataController } from '../controllers/useDataController';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft, Plus, Briefcase, CheckSquare, Clock, Edit,
  LayoutGrid, ListTodo, Filter, Trash2, Save, Upload,
  User as UserIcon, Building2, Globe, Phone, FileText, AlertTriangle, AlertCircle,
  Search, ChevronDown, Handshake, X, Check, DollarSign, Mail, Calendar, CalendarDays, Info
} from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { motion } from 'framer-motion';
import * as CapacityUtils from '../utils/capacity';
import type { Client, User, Project, Task, ProjectMember, TimesheetEntry } from '../types';
import { toUpperCase, toSentenceCase, cleanText } from '../utils/textFormatter';

type ViewTab = 'details' | 'projects' | 'tasks';

const COUNTRIES = [
  { name: 'Afeganistão', code: 'af' },
  { name: 'África do Sul', code: 'za' },
  { name: 'Albânia', code: 'al' },
  { name: 'Alemanha', code: 'de' },
  { name: 'Andorra', code: 'ad' },
  { name: 'Angola', code: 'ao' },
  { name: 'Antígua e Barbuda', code: 'ag' },
  { name: 'Arábia Saudita', code: 'sa' },
  { name: 'Argélia', code: 'dz' },
  { name: 'Argentina', code: 'ar' },
  { name: 'Armênia', code: 'am' },
  { name: 'Austrália', code: 'au' },
  { name: 'Áustria', code: 'at' },
  { name: 'Azerbaijão', code: 'az' },
  { name: 'Bahamas', code: 'bs' },
  { name: 'Bahrein', code: 'bh' },
  { name: 'Bangladesh', code: 'bd' },
  { name: 'Barbados', code: 'bb' },
  { name: 'Bélgica', code: 'be' },
  { name: 'Belize', code: 'bz' },
  { name: 'Benim', code: 'bj' },
  { name: 'Bielorrússia', code: 'by' },
  { name: 'Bolívia', code: 'bo' },
  { name: 'Bósnia e Herzegovina', code: 'ba' },
  { name: 'Botsuana', code: 'bw' },
  { name: 'Brasil', code: 'br' },
  { name: 'Brunei', code: 'bn' },
  { name: 'Bulgária', code: 'bg' },
  { name: 'Burquina Faso', code: 'bf' },
  { name: 'Burundi', code: 'bi' },
  { name: 'Butão', code: 'bt' },
  { name: 'Cabo Verde', code: 'cv' },
  { name: 'Camarões', code: 'cm' },
  { name: 'Camboja', code: 'kh' },
  { name: 'Canadá', code: 'ca' },
  { name: 'Catar', code: 'qa' },
  { name: 'Cazaquistão', code: 'kz' },
  { name: 'Chade', code: 'td' },
  { name: 'Chile', code: 'cl' },
  { name: 'China', code: 'cn' },
  { name: 'Chipre', code: 'cy' },
  { name: 'Colômbia', code: 'co' },
  { name: 'Comores', code: 'km' },
  { name: 'Congo-Brazzaville', code: 'cg' },
  { name: 'Congo-Kinshasa', code: 'cd' },
  { name: 'Coreia do Norte', code: 'kp' },
  { name: 'Coreia do Sul', code: 'kr' },
  { name: 'Costa do Marfim', code: 'ci' },
  { name: 'Costa Rica', code: 'cr' },
  { name: 'Croácia', code: 'hr' },
  { name: 'Cuba', code: 'cu' },
  { name: 'Dinamarca', code: 'dk' },
  { name: 'Djibouti', code: 'dj' },
  { name: 'Dominica', code: 'dm' },
  { name: 'Egito', code: 'eg' },
  { name: 'El Salvador', code: 'sv' },
  { name: 'Emirados Árabes Unidos', code: 'ae' },
  { name: 'Equador', code: 'ec' },
  { name: 'Eritreia', code: 'er' },
  { name: 'Eslováquia', code: 'sk' },
  { name: 'Eslovênia', code: 'si' },
  { name: 'Espanha', code: 'es' },
  { name: 'Essuatíni', code: 'sz' },
  { name: 'Estados Unidos', code: 'us' },
  { name: 'Estônia', code: 'ee' },
  { name: 'Etiópia', code: 'et' },
  { name: 'Fiji', code: 'fj' },
  { name: 'Filipinas', code: 'ph' },
  { name: 'Finlândia', code: 'fi' },
  { name: 'França', code: 'fr' },
  { name: 'Gabão', code: 'ga' },
  { name: 'Gâmbia', code: 'gm' },
  { name: 'Gana', code: 'gh' },
  { name: 'Geórgia', code: 'ge' },
  { name: 'Granada', code: 'gd' },
  { name: 'Grécia', code: 'gr' },
  { name: 'Guatemala', code: 'gt' },
  { name: 'Guiana', code: 'gy' },
  { name: 'Guiné', code: 'gn' },
  { name: 'Guiné Equatorial', code: 'gq' },
  { name: 'Guiné-Bissau', code: 'gw' },
  { name: 'Haiti', code: 'ht' },
  { name: 'Honduras', code: 'hn' },
  { name: 'Hungria', code: 'hu' },
  { name: 'Iêmen', code: 'ye' },
  { name: 'Ilhas Marshall', code: 'mh' },
  { name: 'Ilhas Salomão', code: 'sb' },
  { name: 'Índia', code: 'in' },
  { name: 'Indonésia', code: 'id' },
  { name: 'Irã', code: 'ir' },
  { name: 'Iraque', code: 'iq' },
  { name: 'Irlanda', code: 'ie' },
  { name: 'Islândia', code: 'is' },
  { name: 'Israel', code: 'il' },
  { name: 'Itália', code: 'it' },
  { name: 'Jamaica', code: 'jm' },
  { name: 'Japão', code: 'jp' },
  { name: 'Jordânia', code: 'jo' },
  { name: 'Kiribati', code: 'ki' },
  { name: 'Kuwait', code: 'kw' },
  { name: 'Laos', code: 'la' },
  { name: 'Lesoto', code: 'ls' },
  { name: 'Letônia', code: 'lv' },
  { name: 'Líbano', code: 'lb' },
  { name: 'Libéria', code: 'lr' },
  { name: 'Líbia', code: 'ly' },
  { name: 'Liechtenstein', code: 'li' },
  { name: 'Lituânia', code: 'lt' },
  { name: 'Luxemburgo', code: 'lu' },
  { name: 'Macedônia do Norte', code: 'mk' },
  { name: 'Madagascar', code: 'mg' },
  { name: 'Malásia', code: 'my' },
  { name: 'Malaui', code: 'mw' },
  { name: 'Maldivas', code: 'mv' },
  { name: 'Mali', code: 'ml' },
  { name: 'Malta', code: 'mt' },
  { name: 'Marrocos', code: 'ma' },
  { name: 'Maurícia', code: 'mu' },
  { name: 'Mauritânia', code: 'mr' },
  { name: 'México', code: 'mx' },
  { name: 'Mianmar', code: 'mm' },
  { name: 'Micronésia', code: 'fm' },
  { name: 'Moçambique', code: 'mz' },
  { name: 'Moldávia', code: 'md' },
  { name: 'Mônaco', code: 'mc' },
  { name: 'Mongólia', code: 'mn' },
  { name: 'Montenegro', code: 'me' },
  { name: 'Namíbia', code: 'na' },
  { name: 'Nauru', code: 'nr' },
  { name: 'Nepal', code: 'np' },
  { name: 'Nicarágua', code: 'ni' },
  { name: 'Níger', code: 'ne' },
  { name: 'Nigéria', code: 'ng' },
  { name: 'Noruega', code: 'no' },
  { name: 'Nova Zelândia', code: 'nz' },
  { name: 'Omã', code: 'om' },
  { name: 'Países Baixos', code: 'nl' },
  { name: 'Palau', code: 'pw' },
  { name: 'Panamá', code: 'pa' },
  { name: 'Papua-Nova Guiné', code: 'pg' },
  { name: 'Paquistão', code: 'pk' },
  { name: 'Paraguai', code: 'py' },
  { name: 'Peru', code: 'pe' },
  { name: 'Polônia', code: 'pl' },
  { name: 'Portugal', code: 'pt' },
  { name: 'Quênia', code: 'ke' },
  { name: 'Quirguistão', code: 'kg' },
  { name: 'Reino Unido', code: 'gb' },
  { name: 'República Centro-Africana', code: 'cf' },
  { name: 'República Checa', code: 'cz' },
  { name: 'República Dominicana', code: 'do' },
  { name: 'Romênia', code: 'ro' },
  { name: 'Ruanda', code: 'rw' },
  { name: 'Rússia', code: 'ru' },
  { name: 'Samoa', code: 'ws' },
  { name: 'Santa Lúcia', code: 'lc' },
  { name: 'São Cristóvão e Neves', code: 'kn' },
  { name: 'São Marino', code: 'sm' },
  { name: 'São Tomé e Príncipe', code: 'st' },
  { name: 'São Vicente e Granadinas', code: 'vc' },
  { name: 'Seicheles', code: 'sc' },
  { name: 'Senegal', code: 'sn' },
  { name: 'Serra Leoa', code: 'sl' },
  { name: 'Sérvia', code: 'rs' },
  { name: 'Singapura', code: 'sg' },
  { name: 'Síria', code: 'sy' },
  { name: 'Somália', code: 'so' },
  { name: 'Sri Lanka', code: 'lk' },
  { name: 'Sudão', code: 'sd' },
  { name: 'Sudão do Sul', code: 'ss' },
  { name: 'Suécia', code: 'se' },
  { name: 'Suíça', code: 'ch' },
  { name: 'Suriname', code: 'sr' },
  { name: 'Tailândia', code: 'th' },
  { name: 'Taiwan', code: 'tw' },
  { name: 'Tajiquistão', code: 'tj' },
  { name: 'Tanzânia', code: 'tz' },
  { name: 'Timor-Leste', code: 'tl' },
  { name: 'Togo', code: 'tg' },
  { name: 'Tonga', code: 'to' },
  { name: 'Trindade e Tobago', code: 'tt' },
  { name: 'Tunísia', code: 'tn' },
  { name: 'Turcomenistão', code: 'tm' },
  { name: 'Turquia', code: 'tr' },
  { name: 'Tuvalu', code: 'tv' },
  { name: 'Ucrânia', code: 'ua' },
  { name: 'Uganda', code: 'ug' },
  { name: 'Uruguai', code: 'uy' },
  { name: 'Uzbequistão', code: 'uz' },
  { name: 'Vanuatu', code: 'vu' },
  { name: 'Vaticano', code: 'va' },
  { name: 'Venezuela', code: 've' },
  { name: 'Vietnã', code: 'vn' },
  { name: 'Zâmbia', code: 'zm' },
  { name: 'Zimbábue', code: 'zw' },
].sort((a, b) => a.name.localeCompare(b.name));

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

  // CEP Lookup States
  const [cepError, setCepError] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [isAddressFromCep, setIsAddressFromCep] = useState(false);
  const [lastSearchedCep, setLastSearchedCep] = useState('');

  // Searchable Country States
  const [paisSearch, setPaisSearch] = useState('');
  const [isPaisDropdownOpen, setIsPaisDropdownOpen] = useState(false);
  const [dropdownDirection, setDropdownDirection] = useState<'up' | 'down'>('down');
  const paisDropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const filteredCountries = useMemo(() => {
    return COUNTRIES.filter(c => 
      c.name.toLowerCase().includes(paisSearch.toLowerCase())
    );
  }, [paisSearch]);

  const togglePaisDropdown = () => {
    if (!isPaisDropdownOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      if (spaceBelow < 350 && spaceAbove > spaceBelow) {
        setDropdownDirection('up');
      } else {
        setDropdownDirection('down');
      }
    }
    setIsPaisDropdownOpen(!isPaisDropdownOpen);
  };

  const getFlagUrl = (countryName: string) => {
    const country = COUNTRIES.find(c => c.name.toLowerCase() === countryName.toLowerCase());
    if (country) return `https://flagcdn.com/w40/${country.code}.png`;
    return null;
  };

  // Click Outside Handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (paisDropdownRef.current && !paisDropdownRef.current.contains(event.target as Node)) {
        setIsPaisDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleCepSearch = async () => {
    const cleanedCep = formData.endereco_cep.replace(/\D/g, '');
    if (cleanedCep.length !== 8) {
      setCepError('CEP inválido (deve ter 8 dígitos)');
      return;
    }

    try {
      setCepLoading(true);
      setCepError('');
      const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          endereco_rua: toUpperCase(data.logradouro),
          endereco_bairro: toUpperCase(data.bairro),
          endereco_cidade: toUpperCase(data.localidade),
          endereco_estado: toUpperCase(data.uf),
          pais: 'Brasil'
        }));
        setIsAddressFromCep(true);
        setLastSearchedCep(formData.endereco_cep);
        setCepError('');
      } else {
        setCepError('CEP não encontrado.');
        setIsAddressFromCep(false);
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      setCepError('Erro na conexão.');
      setIsAddressFromCep(false);
    } finally {
      setCepLoading(false);
    }
  };

  useEffect(() => {
    const cleaned = formData.endereco_cep.replace(/\D/g, '');
    
    if (!cleaned) {
      if (isAddressFromCep) {
        setFormData(prev => ({
          ...prev,
          endereco_rua: '',
          endereco_bairro: '',
          endereco_cidade: '',
          endereco_estado: ''
        }));
      }
      setIsAddressFromCep(false);
      setLastSearchedCep('');
      setCepError('');
    } else if (cleaned !== lastSearchedCep.replace(/\D/g, '')) {
      setIsAddressFromCep(false);
    }
    
    if (formData.pais !== 'Brasil') {
      setIsAddressFromCep(false);
      setCepError('');
    }
  }, [formData.endereco_cep, formData.pais, lastSearchedCep]);

  const handleToggleActive = () => {
    if (!isEditing) return;
    setFormData(prev => ({ ...prev, active: !prev.active }));
  };

  const handleToggleDoc = () => {
    if (!isEditing) return;
    setFormData(prev => ({ ...prev, doc_nic_ativo: !prev.doc_nic_ativo }));
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
          <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
            <button
              onClick={() => setActiveTab('projects')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-3 group ${activeTab === 'projects' ? 'bg-white text-slate-900 shadow-[0_8px_20px_rgba(255,255,255,0.2)]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
            >
              <Briefcase size={14} className={activeTab === 'projects' ? 'text-purple-600' : 'text-white/40'} />
              <span className="text-[10px] font-black uppercase tracking-widest">Projetos</span>
              <span className={`text-xs font-black px-1.5 py-0.5 rounded-md ${activeTab === 'projects' ? 'bg-purple-100 text-purple-700' : 'bg-white/10 text-white/50'}`}>{clientProjects.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-3 group ${activeTab === 'tasks' ? 'bg-white text-slate-900 shadow-[0_8px_20px_rgba(255,255,255,0.2)]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
            >
              <CheckSquare size={14} className={activeTab === 'tasks' ? 'text-purple-600' : 'text-white/40'} />
              <span className="text-[10px] font-black uppercase tracking-widest">Tarefas</span>
              <span className={`text-xs font-black px-1.5 py-0.5 rounded-md ${activeTab === 'tasks' ? 'bg-purple-100 text-purple-700' : 'bg-white/10 text-white/50'}`}>{clientTasks.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-3 group ${activeTab === 'details' ? 'bg-white text-slate-900 shadow-[0_8px_20px_rgba(255,255,255,0.2)]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
            >
              <Info size={14} className={activeTab === 'details' ? 'text-purple-600' : 'text-white/40'} />
              <span className="text-[10px] font-black uppercase tracking-widest">Informações</span>
            </button>

            {isAdmin && activeTab === 'details' && (
              <>
                <div className="w-px h-6 bg-white/10 mx-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }}
                  className={`px-4 py-2 rounded-xl transition-all border font-black text-[10px] uppercase tracking-widest flex items-center gap-2 ${isEditing ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                  title={isEditing ? 'Cancelar Edição' : 'Editar Cliente'}
                >
                  {isEditing ? <X size={14} /> : <Edit size={14} />}
                  <span>{isEditing ? 'Sair' : 'Editar'}</span>
                </button>
              </>
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

                {/* NOVO: Status e Documentação em Destaque no Topo (Mesmo padrão do ClientForm) */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[var(--surface-2)] border-2 border-[var(--border)] rounded-[24px] shadow-sm mb-8">
                  <div className="space-y-1.5">
                    <label className="block text-[8px] font-black uppercase tracking-[0.2em] text-[var(--muted)] ml-1">Status da Conta</label>
                    <button
                      type="button"
                      onClick={() => isEditing && setFormData({ ...formData, active: !formData.active })}
                      disabled={!isEditing}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border-2 transition-all group ${formData.active ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600' : 'border-red-500/30 bg-red-500/5 text-red-600'} ${!isEditing ? 'cursor-default opacity-100' : 'hover:border-emerald-500/50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${formData.active ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                        <span className="font-black uppercase tracking-widest text-[10px]">{formData.active ? 'Conta Ativa' : 'Conta Inativa'}</span>
                      </div>
                      <div className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase border transition-colors ${formData.active ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-red-500 text-white border-red-400'}`}>
                        {formData.active ? 'OK' : 'BLOQ'}
                      </div>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[8px] font-black uppercase tracking-[0.2em] text-[var(--muted)] ml-1">Documentação Corporativa</label>
                    <button
                      type="button"
                      onClick={() => isEditing && setFormData({ ...formData, doc_nic_ativo: !formData.doc_nic_ativo })}
                      disabled={!isEditing}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border-2 transition-all group ${formData.doc_nic_ativo ? 'border-purple-500/30 bg-purple-500/5 text-purple-600' : 'border-[var(--border)] bg-[var(--surface-3)] text-[var(--muted)]'} ${!isEditing ? 'cursor-default opacity-100' : 'hover:border-purple-500/20'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1 rounded-lg transition-colors ${formData.doc_nic_ativo ? 'bg-purple-500/10 text-purple-600' : 'bg-black/5 text-muted'}`}>
                          <FileText size={14} />
                        </div>
                        <span className="font-black uppercase tracking-widest text-[10px]">DOC. NIC</span>
                      </div>
                      <div className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase border transition-colors ${formData.doc_nic_ativo ? 'bg-purple-500 text-white border-purple-400' : 'bg-[var(--border)] text-muted border-[var(--border)]'}`}>
                        {formData.doc_nic_ativo ? 'VINCULADO' : 'PENDENTE'}
                      </div>
                    </button>
                  </div>
                </section>

                <form onSubmit={handleSave} className="space-y-8">
                  <fieldset disabled={!isEditing} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                      {(isEditing || formData.name) && (
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-muted)' }}>Nome da Empresa</label>
                          <div className="relative group">
                            {isEditing && (
                              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'var(--text-placeholder)' }} size={16} />
                            )}
                            <input
                              id="client-name"
                              name="name"
                              type="text"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              className="w-full pl-12 pr-4 py-3 border-2 border-transparent focus:border-purple-500 rounded-xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-lg"
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
                      )}

                      {(isEditing || formData.cnpj) && (
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-muted)' }}>CNPJ / Identificação</label>
                          <div className="relative group">
                            {isEditing && (
                              <FileText className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'var(--text-placeholder)' }} size={16} />
                            )}
                            <input
                              id="client-cnpj"
                              name="cnpj"
                              type="text"
                              value={formData.cnpj}
                              onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                              className="w-full pl-12 pr-4 py-3 border-2 border-transparent focus:border-purple-500 rounded-xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-lg"
                              style={{
                                backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                                color: 'var(--text)',
                                borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                              }}
                              autoComplete="off"
                            />
                          </div>
                        </div>
                      )}


                      {(isEditing || formData.telefone) && (
                        <div>
                          <label className="block text-[8px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-muted)' }}>Telefone Comercial</label>
                          <div className="relative group">
                            {isEditing && (
                              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'var(--text-placeholder)' }} size={16} />
                            )}
                            <input
                              id="client-phone"
                              name="phone"
                              type="text"
                              value={formData.telefone}
                              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                              className="w-full pl-12 pr-4 py-3 border-2 border-transparent focus:border-purple-500 rounded-xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-lg"
                              style={{
                                backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                                color: 'var(--text)',
                                borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                              }}
                              autoComplete="tel"
                            />
                          </div>
                        </div>
                      )}

                      {(isEditing || formData.contato_celular) && (
                        <div>
                          <label className="block text-[8px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-muted)' }}>Celular / WhatsApp</label>
                          <div className="relative group">
                            {isEditing && (
                              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'var(--text-placeholder)' }} size={16} />
                            )}
                            <input
                              type="text"
                              value={formData.contato_celular}
                              onChange={(e) => setFormData({ ...formData, contato_celular: e.target.value })}
                              className="w-full pl-12 pr-4 py-3 border-2 border-transparent focus:border-purple-500 rounded-xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-lg"
                              style={{
                                backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                                color: 'var(--text)',
                                borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {(isEditing || formData.contato_cargo) && (
                        <div className="md:col-span-2">
                          <label className="block text-[8px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-muted)' }}>Cargo do Responsável</label>
                          <div className="relative group">
                            {isEditing && (
                              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'var(--text-placeholder)' }} size={16} />
                            )}
                            <input
                              type="text"
                              value={formData.contato_cargo}
                              onChange={(e) => setFormData({ ...formData, contato_cargo: toSentenceCase(cleanText(e.target.value)) })}
                              className="w-full pl-12 pr-4 py-3 border-2 border-transparent focus:border-purple-500 rounded-xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-lg"
                              style={{
                                backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                                color: 'var(--text)',
                                borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {(isEditing || formData.razao_social) && (
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-muted)' }}>Razão Social</label>
                          <div className="relative group">
                            {isEditing && (
                              <FileText className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'var(--text-placeholder)' }} size={16} />
                            )}
                            <input
                              type="text"
                              value={formData.razao_social}
                              onChange={(e) => setFormData({ ...formData, razao_social: toUpperCase(e.target.value) })}
                              className="w-full pl-12 pr-4 py-3 border-2 border-transparent focus:border-purple-500 rounded-xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-lg"
                              style={{
                                backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                                color: 'var(--text)',
                                borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                              }}
                              placeholder="Nome Juridico"
                            />
                          </div>
                        </div>
                      )}

                      {(isEditing || formData.segmento) && (
                        <div className="md:col-span-2">
                          <label className="block text-[9px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-muted)' }}>Segmento / Indústria</label>
                          <div className="relative group">
                            {isEditing && (
                              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'var(--text-placeholder)' }} size={16} />
                            )}
                            <input
                              type="text"
                              value={formData.segmento}
                              onChange={(e) => setFormData({ ...formData, segmento: toSentenceCase(cleanText(e.target.value)) })}
                              className="w-full pl-12 pr-4 py-3 border-2 border-transparent focus:border-purple-500 rounded-xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-lg"
                              style={{
                                backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                                color: 'var(--text)',
                                borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                              }}
                              placeholder="Ex: Varejo, Tecnologia..."
                            />
                          </div>
                        </div>
                      )}

                      {(isEditing || formData.logoUrl) && (
                        <div className="md:col-span-2">
                          <label className="block text-[9px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-muted)' }}>URL da Logomarca</label>
                          <div className="flex gap-4">
                            <input
                              id="client-logo-url"
                              name="logoUrl"
                              type="text"
                              value={formData.logoUrl}
                              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                              className="flex-1 px-4 py-3 border-2 border-transparent focus:border-purple-500 rounded-xl outline-none transition-all font-bold disabled:bg-transparent disabled:px-0 disabled:border-b disabled:rounded-none disabled:text-lg"
                              style={{
                                backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent',
                                color: 'var(--text)',
                                borderBottomColor: isEditing ? 'transparent' : 'var(--border)'
                              }}
                              autoComplete="off"
                            />
                            {isEditing && (
                              <button type="button" className="px-5 py-3 border-2 rounded-xl transition-colors" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                                <Upload size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {(isEditing || [formData.endereco_rua, formData.endereco_numero, formData.endereco_complemento, formData.endereco_bairro, formData.endereco_cidade, formData.endereco_estado, formData.endereco_cep].some(v => v)) && (
                      <div className="p-6 rounded-[24px] border mt-10" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                        <h4 className="text-[10px] font-black uppercase mb-5 tracking-widest flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
                          <Globe size={14} className="text-purple-500" /> Endereço e Contato Detalhado
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                          {(isEditing || formData.pais) && (
                            <div className="md:col-span-2" ref={paisDropdownRef}>
                              <label className="block text-[9px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>País</label>
                              <div className="relative">
                                <div 
                                  ref={triggerRef}
                                  onClick={() => isEditing && togglePaisDropdown()}
                                  className={`flex items-center gap-3 w-full pl-4 pr-10 py-2.5 border-2 rounded-xl transition-all ${isEditing ? (isPaisDropdownOpen ? 'border-purple-500 shadow-md bg-[var(--input-bg)]' : 'border-transparent bg-[var(--input-bg)] hover:border-purple-500/30 cursor-pointer') : 'border-transparent bg-transparent border-b !border-[var(--border)] rounded-none px-0 cursor-default'}`}
                                >
                                  {getFlagUrl(formData.pais) ? (
                                    <img 
                                      src={getFlagUrl(formData.pais)!} 
                                      alt={formData.pais} 
                                      className="w-5 h-3.5 object-cover rounded-sm border border-black/10" 
                                    />
                                  ) : (
                                    <Globe className="w-4 h-4 opacity-40" />
                                  )}
                                  <span className={`font-bold text-[var(--text)] flex-1 ${!isEditing ? 'text-base' : ''}`}>
                                    {formData.pais || 'Selecionar País'}
                                  </span>
                                  {isEditing && (
                                    <ChevronDown className={`w-4 h-4 transition-transform absolute right-4 ${isPaisDropdownOpen ? 'rotate-180' : ''}`} />
                                  )}
                                </div>

                                {isEditing && isPaisDropdownOpen && (
                                  <div className={`absolute z-[100] left-0 right-0 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 min-w-[280px] ${dropdownDirection === 'up' ? 'bottom-[calc(100%+8px)] origin-bottom' : 'top-[calc(100%+8px)] origin-top'}`}>
                                    <div className="p-3 border-b border-[var(--border)] bg-[var(--bg)]/50">
                                      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg">
                                        <Search className="w-4 h-4 opacity-40" />
                                        <input
                                          type="text"
                                          placeholder="Buscar país..."
                                          value={paisSearch}
                                          onChange={(e) => setPaisSearch(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Escape') setIsPaisDropdownOpen(false);
                                          }}
                                          autoFocus
                                          className="bg-transparent border-none outline-none text-sm w-full font-medium"
                                        />
                                      </div>
                                    </div>
                                    <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                                      {filteredCountries.length > 0 ? (
                                        filteredCountries.map((c) => (
                                          <div
                                            key={c.code}
                                            onClick={() => {
                                              setFormData({ ...formData, pais: c.name });
                                              setPaisSearch('');
                                              setIsPaisDropdownOpen(false);
                                            }}
                                            className={`flex items-center gap-3 p-3.5 cursor-pointer transition-colors hover:bg-[var(--bg)] ${formData.pais === c.name ? 'bg-[var(--bg)]' : ''}`}
                                          >
                                            <img 
                                              src={`https://flagcdn.com/w40/${c.code}.png`} 
                                              alt={c.name} 
                                              className="w-6 h-4 object-cover rounded-sm border border-black/5" 
                                            />
                                            <span className={`text-[13px] ${formData.pais === c.name ? 'font-black text-purple-600' : 'font-bold'}`}>
                                              {c.name}
                                            </span>
                                            {formData.pais === c.name && <div className="ml-auto w-1.5 h-1.5 bg-purple-600 rounded-full"></div>}
                                          </div>
                                        ))
                                      ) : (
                                        <div className="p-6 text-center text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">
                                          Nenhum país encontrado
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {(isEditing || formData.endereco_cep) && (
                            <div className="md:col-span-2">
                              <label className="block text-[9px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>CEP</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={formData.endereco_cep}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCepSearch(); } }}
                                  onChange={(e) => setFormData({ ...formData, endereco_cep: e.target.value })}
                                  className="flex-1 px-4 py-2.5 border-2 border-transparent focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                                  style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                                  placeholder="00000-000"
                                />
                                {isEditing && formData.pais === 'Brasil' && (
                                  <button
                                    type="button"
                                    onClick={handleCepSearch}
                                    disabled={cepLoading}
                                    className="px-4 py-2.5 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors disabled:opacity-50"
                                  >
                                    {cepLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={16} />}
                                  </button>
                                )}
                              </div>
                              {cepError && <p className="text-[9px] text-red-500 font-bold mt-1 ml-1 uppercase">{cepError}</p>}
                            </div>
                          )}

                          {(isEditing || formData.endereco_rua) && (
                            <div className="md:col-span-3">
                              <label className="block text-[9px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Logradouro</label>
                              <input
                                type="text"
                                value={formData.endereco_rua}
                                disabled={!isEditing || isAddressFromCep}
                                onChange={(e) => setFormData({ ...formData, endereco_rua: toUpperCase(e.target.value) })}
                                className="w-full px-4 py-2.5 border-2 border-transparent focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                                style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                              />
                            </div>
                          )}
                          {(isEditing || formData.endereco_numero) && (
                            <div>
                              <label className="block text-[9px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Nº</label>
                              <input
                                type="text"
                                value={formData.endereco_numero}
                                disabled={!isEditing}
                                onChange={(e) => setFormData({ ...formData, endereco_numero: e.target.value })}
                                className="w-full px-4 py-2.5 border-2 border-transparent focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                                style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                              />
                            </div>
                          )}
                          {(isEditing || formData.endereco_complemento) && (
                            <div className="md:col-span-2">
                              <label className="block text-[9px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Complemento</label>
                              <input
                                type="text"
                                value={formData.endereco_complemento}
                                disabled={!isEditing}
                                onChange={(e) => setFormData({ ...formData, endereco_complemento: toSentenceCase(cleanText(e.target.value)) })}
                                className="w-full px-4 py-2.5 border-2 border-transparent focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                                style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                              />
                            </div>
                          )}
                          {(isEditing || formData.endereco_bairro) && (
                            <div className="md:col-span-2">
                              <label className="block text-[9px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Bairro</label>
                              <input
                                type="text"
                                value={formData.endereco_bairro}
                                disabled={!isEditing || isAddressFromCep}
                                onChange={(e) => setFormData({ ...formData, endereco_bairro: toUpperCase(e.target.value) })}
                                className="w-full px-4 py-2.5 border-2 border-transparent focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                                style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                              />
                            </div>
                          )}
                          {(isEditing || formData.endereco_cidade) && (
                            <div className="md:col-span-3">
                              <label className="block text-[9px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Cidade</label>
                              <input
                                type="text"
                                value={formData.endereco_cidade}
                                disabled={!isEditing || isAddressFromCep}
                                onChange={(e) => setFormData({ ...formData, endereco_cidade: toUpperCase(e.target.value) })}
                                className="w-full px-4 py-2.5 border-2 border-transparent focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                                style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                              />
                            </div>
                          )}
                          {(isEditing || formData.endereco_estado) && (
                            <div>
                              <label className="block text-[9px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>UF</label>
                              <input
                                type="text"
                                value={formData.endereco_estado}
                                disabled={!isEditing || isAddressFromCep}
                                onChange={(e) => setFormData({ ...formData, endereco_estado: toUpperCase(e.target.value) })}
                                className="w-full px-4 py-2.5 border-2 border-transparent focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                                style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                              />
                            </div>
                          )}

                        </div>
                      </div>
                    )}

                    {(isEditing || [formData.email_financeiro, formData.responsavel_tecnico, formData.data_inicio_contrato, formData.data_fim_contrato].some(v => v)) && (
                      <div className="p-6 rounded-[24px] border mt-10" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                        <h4 className="text-[10px] font-black uppercase mb-5 tracking-widest flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
                          <DollarSign size={14} className="text-purple-500" /> Dados de Contrato & Financeiro
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {(isEditing || formData.email_financeiro) && (
                            <div>
                              <label className="block text-[9px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Email Financeiro</label>
                              <div className="relative group">
                                {isEditing && <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500/50" />}
                                <input
                                  type="email"
                                  value={formData.email_financeiro}
                                  onChange={(e) => setFormData({ ...formData, email_financeiro: e.target.value })}
                                  className="w-full pl-12 pr-4 py-2.5 border-2 border-transparent focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                                  style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                                  placeholder="financeiro@empresa.com"
                                />
                              </div>
                            </div>
                          )}
                          {(isEditing || formData.responsavel_tecnico) && (
                            <div>
                              <label className="block text-[9px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Responsável Técnico</label>
                              <div className="relative group">
                                {isEditing && <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500/50" />}
                                <input
                                  type="text"
                                  value={formData.responsavel_tecnico}
                                  onChange={(e) => setFormData({ ...formData, responsavel_tecnico: toSentenceCase(cleanText(e.target.value)) })}
                                  className="w-full pl-12 pr-4 py-2.5 border-2 border-transparent focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                                  style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                                  placeholder="Nome do contato principal"
                                />
                              </div>
                            </div>
                          )}
                          {(isEditing || formData.data_inicio_contrato) && (
                            <div>
                              <label className="block text-[9px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Início do Contrato</label>
                              <div className="relative group">
                                {isEditing && (
                                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500/50" />
                                )}
                                <input
                                  type="date"
                                  value={formData.data_inicio_contrato}
                                  onChange={(e) => setFormData({ ...formData, data_inicio_contrato: e.target.value })}
                                  className="w-full pl-12 pr-4 py-2.5 border-2 border-transparent focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                                  style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                                />
                              </div>
                            </div>
                          )}
                          {(isEditing || formData.data_fim_contrato) && (
                            <div>
                              <label className="block text-[9px] font-black uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Fim do Contrato</label>
                              <div className="relative group">
                                {isEditing && (
                                  <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500/50" />
                                )}
                                <input
                                  type="date"
                                  value={formData.data_fim_contrato}
                                  onChange={(e) => setFormData({ ...formData, data_fim_contrato: e.target.value })}
                                  className="w-full pl-12 pr-4 py-2.5 border-2 border-transparent focus:border-purple-500 rounded-xl font-bold outline-none disabled:bg-transparent disabled:border-none disabled:px-0 disabled:text-base"
                                  style={{ backgroundColor: isEditing ? 'var(--input-bg)' : 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                    <div className="p-6 rounded-[24px] border border-dashed mt-8" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                      <h4 className="text-[10px] font-black uppercase mb-4 tracking-widest flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
                        <Handshake size={14} className="text-purple-500" /> Vínculos e Parcerias
                      </h4>
                      <div className="grid grid-cols-1 gap-6">
                        {formData.tipo_cliente === 'cliente_final' && (
                          <div className="relative">
                            <label className="block text-[9px] font-black uppercase mb-2 opacity-60" style={{ color: 'var(--text-muted)' }}>Parceiros Vinculados *</label>

                            <div
                              onClick={() => isEditing && setIsDropdownOpen(true)}
                              className={`w-full p-3 border-2 rounded-xl text-left transition-all flex flex-wrap gap-2 outline-none ${isEditing ? 'cursor-pointer border-[var(--border)] hover:border-purple-500/40 bg-[var(--input-bg)]' : 'border-none bg-transparent'}`}
                            >
                              {selectedPartners.length > 0 ? (
                                selectedPartners.map((p: any) => (
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
                                      filteredPartners.map((p: any) => {
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
                                      className="px-10 py-4 rounded-2xl shadow-xl transition-all font-black text-xs uppercase tracking-widest bg-slate-950 text-white hover:bg-slate-900 hover:-translate-y-0.5 active:scale-95 border border-transparent dark:bg-white dark:text-purple-700 dark:hover:bg-slate-50 dark:border-white/10"
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
                    <div className="mt-8 border-t pt-8" style={{ borderColor: 'var(--border)' }}>
                      <h4 className="text-[10px] font-black uppercase mb-5 tracking-widest flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
                        <div className="p-1.5 bg-blue-500/10 text-blue-600 rounded-lg"><UserIcon size={12} /></div>
                        Equipe Envolvida
                      </h4>
                      <div className="flex flex-wrap gap-2.5">
                        {Array.from(new Set([
                          ...clientProjects.flatMap((p: any) =>
                            projectMembers
                              .filter((pm: any) => String(pm.id_projeto) === String(p.id))
                              .map((pm: any) => String(pm.id_colaborador))
                          ),
                          ...clientTasks.map((t: any) => t.developerId).filter((id: any): id is string => typeof id === 'string')
                        ])).map((uId: string) => {
                          const user = users.find((u: any) => String(u.id) === String(uId));
                          if (!user) return null;
                          return (
                            <div key={user.id} className="flex items-center gap-2.5 px-3 py-1.5 border rounded-xl shadow-sm hover:border-purple-300 transition-all" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                              {user.avatarUrl ? (
                                <img src={user.avatarUrl as string} alt={user.name} className="w-7 h-7 rounded-lg object-cover" />
                              ) : (
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-[9px] uppercase border" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>{user.name.substring(0, 2)}</div>
                              )}
                              <div className="flex flex-col">
                                <span className="text-[11px] font-black leading-tight" style={{ color: 'var(--text)' }}>{user.name}</span>
                                <span className="text-[9px] font-bold uppercase tracking-tight" style={{ color: 'var(--text-muted)' }}>{user.cargo || 'Membro'}</span>
                              </div>
                            </div>
                          );
                        })}
                        {clientProjects.length === 0 && clientTasks.length === 0 && (
                          <span className="text-[10px] font-black uppercase tracking-wider opacity-60" style={{ color: 'var(--text-muted)' }}>Nenhum colaborador alocado ainda.</span>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="flex items-center justify-between pt-10 border-t mt-10" style={{ borderColor: 'var(--border)' }}>
                        <button
                          type="button"
                          onClick={() => setItemToDelete({ id: clientId || '', type: 'client' })}
                          className="px-5 py-3 text-red-500 hover:bg-red-500/10 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all border border-transparent hover:border-red-500/20"
                        >
                          Excluir Cliente Permanentemente
                        </button>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                          >
                            Descartar
                          </button>
                          <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-3 rounded-xl flex items-center gap-3 shadow-2xl transition-all font-black text-[10px] uppercase tracking-widest bg-slate-950 text-white hover:bg-slate-900 hover:-translate-y-1 active:scale-95 border border-transparent dark:bg-white dark:text-purple-700 dark:hover:bg-slate-50 dark:shadow-purple-500/20 shadow-black/20"
                          >
                            {loading ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            <span>{loading ? 'Processando...' : 'Salvar Alterações'}</span>
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

                  <div className="flex items-center gap-2.5 p-1.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] shadow-sm">
                    <button
                      onClick={() => setProjectFilter('active')}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${projectFilter === 'active' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-sm' : 'text-[var(--muted)] hover:text-[var(--text)] border border-transparent'}`}
                    >
                      Ativos ({projectStats.active})
                    </button>
                    <button
                      onClick={() => setProjectFilter('completed')}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${projectFilter === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-sm' : 'text-[var(--muted)] hover:text-[var(--text)] border border-transparent'}`}
                    >
                      Concluídos ({projectStats.completed})
                    </button>
                    <button
                      onClick={() => setProjectFilter('all')}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${projectFilter === 'all' ? 'bg-slate-500/10 text-slate-600 border border-slate-500/20 shadow-sm' : 'text-[var(--muted)] hover:text-[var(--text)] border border-transparent'}`}
                    >
                      Todos ({projectStats.all})
                    </button>
                    
                    <div className="w-px h-6 bg-[var(--border)] mx-1" />
                    
                    <button
                      onClick={() => navigate(`/admin/clients/${clientId}/projects/new`)}
                      className="px-5 py-2.5 rounded-xl flex items-center gap-2.5 shadow-xl transition-all font-black text-[10px] uppercase tracking-widest bg-slate-950 text-white hover:bg-slate-900 hover:-translate-y-0.5 active:scale-95 border border-transparent dark:bg-white dark:text-purple-700 dark:hover:bg-slate-50 dark:border-white/10"
                    >
                      <Plus size={14} className="text-white dark:text-purple-600" />
                      <span>Novo Projeto</span>
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
                <div className="flex justify-between items-center mb-10">
                  <div className="flex flex-col">
                    <h3 className="text-xl font-black tracking-tight" style={{ color: 'var(--text)' }}>Monitoramento de Tarefas</h3>
                    <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mt-1">Total de {clientTasks.length} {clientTasks.length === 1 ? 'registro encontrado' : 'registros encontrados'}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/tasks/new?client=${clientId}`)}
                    className="px-6 py-2.5 rounded-xl flex items-center gap-3 shadow-xl transition-all font-black text-xs uppercase tracking-widest bg-slate-950 text-white hover:bg-slate-900 hover:-translate-y-0.5 active:scale-95 border border-transparent dark:bg-white dark:text-purple-700 dark:hover:bg-slate-50 dark:border-white/10 shadow-black/10 dark:shadow-purple-500/10"
                  >
                    <Plus size={18} className="text-white dark:text-purple-600" />
                    <span>Nova Tarefa</span>
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
