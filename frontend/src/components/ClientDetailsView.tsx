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
      
      // Aumentamos a tolerância para abrir para cima se houver pouco espaço
      if (spaceBelow < 300 && spaceAbove > spaceBelow) {
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
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
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
    pais: 'Brasil',
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
    contato_cargo: '',
    contato_nome_1: '',
    contato_email_1: '',
    contato_celular_1: '',
    contato_cargo_1: '',
    contato_nome_2: '',
    contato_email_2: '',
    contato_celular_2: '',
    contato_cargo_2: '',
    responsavel_interno_id: '',
    email_comercial: ''
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



  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        logoUrl: client.logoUrl || '',
        cnpj: client.cnpj || '',
        telefone: client.telefone || '',
        tipo_cliente: client.tipo_cliente || 'cliente_final',
        partner_id: client.partner_id || '',
        pais: client.pais || 'Brasil',
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
        contato_cargo: client.contato_cargo || '',
        contato_nome_1: client.contato_nome_1 || client.responsavel_externo || '',
        contato_email_1: client.contato_email_1 || client.email_contato || '',
        contato_celular_1: client.contato_celular_1 || client.contato_celular || '',
        contato_cargo_1: client.contato_cargo_1 || client.contato_cargo || '',
        contato_nome_2: client.contato_nome_2 || '',
        contato_email_2: client.contato_email_2 || '',
        contato_celular_2: client.contato_celular_2 || '',
        contato_cargo_2: client.contato_cargo_2 || '',
        responsavel_interno_id: client.responsavel_interno_id || '',
        email_comercial: client.contato_email_1 || ''
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
        contato_cargo: formData.contato_cargo,
        contato_nome_1: formData.contato_nome_1,
        contato_email_1: formData.contato_email_1,
        contato_celular_1: formData.contato_celular_1,
        contato_cargo_1: formData.contato_cargo_1,
        contato_nome_2: formData.contato_nome_2,
        contato_email_2: formData.contato_email_2,
        contato_celular_2: formData.contato_celular_2,
        contato_cargo_2: formData.contato_cargo_2,
        responsavel_interno_id: formData.responsavel_interno_id
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
        <div className="max-w-[1500px] mx-auto space-y-8">


          {/* 2. CONTEÚDO DAS TABS */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === 'details' && (
              <div className="space-y-6">
                <form onSubmit={handleSave} className="space-y-6">
                  <fieldset disabled={loading} className="space-y-8">
                    {/* -- FIELDS FOR PARTNER -- */}
                {formData.tipo_cliente === 'parceiro' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="w-4 h-4 text-purple-500" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Informações Institucionais</h3>
                      </div>
                      <div className="grid grid-cols-12 gap-6 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
                        <div className="col-span-12 md:col-span-8 lg:col-span-4">
                          <label className="block text-[10px] font-bold mb-1 uppercase">Nome do Parceiro *</label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            disabled={!isEditing}
                            className={`w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] font-bold focus:ring-2 focus:ring-purple-500 outline-none text-sm ${!isEditing ? 'opacity-70 cursor-default' : ''}`}
                            placeholder="Ex: Consultoria de Tecnologia"
                            required
                          />
                        </div>
                        <div className="col-span-12 md:col-span-4 lg:col-span-2">
                          <label className="block text-[10px] font-bold mb-1 uppercase">CNPJ / ID</label>
                          <input 
                            type="text" 
                            value={formData.cnpj} 
                            onChange={e => setFormData({ ...formData, cnpj: e.target.value })} 
                            disabled={!isEditing}
                            className={`w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] font-bold focus:ring-2 focus:ring-purple-500 outline-none text-sm ${!isEditing ? 'opacity-70 cursor-default' : ''}`} 
                            placeholder="00.000.000/0001-00" 
                          />
                        </div>
                        <div className="col-span-12 md:col-span-4 lg:col-span-2">
                          <label className="block text-[10px] font-bold mb-1 uppercase">URL do Logo</label>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={formData.logoUrl} 
                              onChange={e => setFormData({ ...formData, logoUrl: e.target.value })} 
                              disabled={!isEditing}
                              className={`flex-1 p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] font-bold focus:ring-2 focus:ring-purple-500 outline-none text-sm ${!isEditing ? 'opacity-70 cursor-default' : ''}`} 
                              placeholder="https://..." 
                            />
                            {formData.logoUrl && <img src={formData.logoUrl} alt="Preview" className="w-10 h-10 object-contain bg-white rounded-lg border p-1" />}
                          </div>
                        </div>

                        <div className="col-span-12 md:col-span-4 lg:col-span-2">
                          <label className="block text-[10px] font-bold mb-1 uppercase">Status da Conta</label>
                          <button
                            type="button"
                            onClick={handleToggleActive}
                            disabled={!isEditing}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all group ${formData.active ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600' : 'border-red-500/30 bg-red-500/5 text-red-600'} ${!isEditing ? 'cursor-default opacity-70' : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${formData.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                              <span className="font-black uppercase tracking-widest text-[10px]">{formData.active ? 'Conta Ativa' : 'Conta Inativa'}</span>
                            </div>
                            <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border transition-colors ${formData.active ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-red-500 text-white border-red-400'}`}>
                              {formData.active ? 'OK' : 'Bloqueado'}
                            </div>
                          </button>
                        </div>

                        <div className="col-span-12 md:col-span-4 lg:col-span-2">
                          <label className="block text-[10px] font-bold mb-1 uppercase">Documentação NIC</label>
                          <button
                            type="button"
                            onClick={handleToggleDoc}
                            disabled={!isEditing}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all group ${formData.doc_nic_ativo ? 'border-purple-500/30 bg-purple-500/5 text-purple-600' : 'border-[var(--border)] bg-[var(--surface-3)] text-[var(--muted)] hover:border-purple-500/20'} ${!isEditing ? 'cursor-default opacity-70' : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              <FileText size={14} className={formData.doc_nic_ativo ? 'text-purple-600' : 'text-muted'} />
                              <span className="font-black uppercase tracking-widest text-[10px]">DOC. NIC</span>
                            </div>
                            <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border transition-colors ${formData.doc_nic_ativo ? 'bg-purple-500 text-white border-purple-400' : 'bg-[var(--border)] text-muted border-[var(--border)]'}`}>
                              {formData.doc_nic_ativo ? 'Permitido' : 'Não Permitido'}
                            </div>
                          </button>
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {/* -- FIELDS FOR CLIENT -- */}
                {formData.tipo_cliente === 'cliente_final' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="grid grid-cols-12 gap-6">
                      {/* Coluna Esquerda: Dados da Empresa */}
                      <div className="col-span-12 lg:col-span-8 flex flex-col">
                        <section className="space-y-4 flex-1 flex flex-col">
                          <div className="flex items-center gap-2 mb-2 px-1">
                            <div className="p-1 px-2 bg-blue-500/10 text-blue-600 rounded-lg">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <h3 className="text-xs font-black uppercase tracking-widest text-blue-600">Dados da Empresa</h3>
                          </div>
                          <div className="grid grid-cols-12 gap-5 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm flex-1">
                            <div className="col-span-12 md:col-span-8">
                              <label className="block text-[10px] font-bold mb-1 uppercase">Nome da Empresa *</label>
                              <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                disabled={!isEditing}
                                className={`w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl font-bold text-[var(--text)] focus:ring-2 focus:ring-blue-500 outline-none text-sm ${!isEditing ? 'opacity-70 cursor-default' : ''}`}
                                placeholder="Ex: Indústria XYZ S.A."
                                required
                              />
                            </div>
                            <div className="col-span-12 md:col-span-4">
                              <label className="block text-[10px] font-bold mb-1 uppercase">CNPJ</label>
                              <input 
                                type="text" 
                                value={formData.cnpj} 
                                onChange={e => setFormData({ ...formData, cnpj: e.target.value })} 
                                disabled={!isEditing}
                                className={`w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl font-bold text-[var(--text)] focus:ring-2 focus:ring-blue-500 outline-none text-sm ${!isEditing ? 'opacity-70 cursor-default' : ''}`} 
                                placeholder="00.000.000/0001-00" 
                              />
                            </div>

                            <div className="col-span-12 md:col-span-4 relative">
                              <label className="block text-[10px] font-bold text-blue-500 mb-1 uppercase">Parceiro *</label>
                              <div className="relative" ref={dropdownRef}>
                                <button
                                  type="button"
                                  onClick={() => isEditing && setIsDropdownOpen(!isDropdownOpen)}
                                  disabled={!isEditing}
                                  className={`w-full p-3 bg-[var(--bg)] border rounded-xl text-[var(--text)] font-bold transition-all flex items-center justify-between outline-none text-sm ${isDropdownOpen ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-[var(--border)] hover:border-blue-500/40'} ${!isEditing ? 'opacity-70 cursor-default' : ''}`}
                                >
                                  {selectedPartners[0] ? (
                                    <div className="flex items-center gap-2">
                                      {selectedPartners[0].logoUrl ? (
                                        <img src={selectedPartners[0].logoUrl} alt={selectedPartners[0].name} className="w-6 h-6 object-contain rounded bg-white p-0.5" />
                                      ) : (
                                        <Handshake className="w-4 h-4 opacity-30" />
                                      )}
                                      <span className="truncate">{selectedPartners[0].name}</span>
                                    </div>
                                  ) : (
                                    <span className="opacity-100 font-normal text-sm italic">S/ parceiro</span>
                                  )}
                                  {isEditing && <ChevronDown className={`w-4 h-4 text-blue-500/50 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />}
                                </button>

                                {isEditing && isDropdownOpen && (
                                  <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl z-50 overflow-hidden">
                                    <div className="p-3 border-b border-[var(--border)] bg-[var(--bg)]">
                                      <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500/50" />
                                        <input
                                          type="text"
                                          value={searchTerm}
                                          onChange={e => setSearchTerm(e.target.value)}
                                          placeholder="Procurar parceiro..."
                                          className="w-full pl-9 pr-4 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs font-medium outline-none focus:border-blue-500"
                                          autoFocus
                                        />
                                      </div>
                                    </div>
                                    <div className="max-h-[250px] overflow-y-auto custom-scrollbar p-1">
                                      {filteredPartners.length > 0 ? (
                                        filteredPartners.map((p: any) => (
                                          <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => {
                                              setFormData({ ...formData, partner_id: p.id });
                                              setIsDropdownOpen(false);
                                              setSearchTerm('');
                                            }}
                                            className={`w-full p-2 flex items-center gap-3 rounded-lg transition-all text-left ${formData.partner_id === p.id ? 'bg-blue-500 text-white' : 'hover:bg-blue-500/10'}`}
                                          >
                                            {p.logoUrl && <img src={p.logoUrl} alt={p.name} className="w-7 h-7 object-contain rounded bg-white p-0.5" />}
                                            <div className="flex flex-col min-w-0">
                                              <span className="font-bold truncate text-xs">{p.name}</span>
                                            </div>
                                          </button>
                                        ))
                                      ) : (
                                        <div className="py-2 text-center text-xs italic">Nenhum parceiro encontrado</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="col-span-12 md:col-span-4">
                              <label className="block text-[10px] font-bold mb-1 uppercase">Segmento / Indústria</label>
                              <input 
                                type="text" 
                                value={formData.segmento} 
                                onChange={e => setFormData({ ...formData, segmento: toSentenceCase(cleanText(e.target.value)) })} 
                                disabled={!isEditing}
                                className={`w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] font-bold focus:ring-2 focus:ring-blue-500 outline-none text-sm ${!isEditing ? 'opacity-70 cursor-default' : ''}`} 
                                placeholder="Ex: Varejo, Bancário..." 
                              />
                            </div>
                            <div className="col-span-12 md:col-span-4">
                              <label className="block text-[10px] font-bold mb-1 uppercase">URL do Logo</label>
                              <div className="flex gap-2">
                                <input 
                                  type="text" 
                                  value={formData.logoUrl} 
                                  onChange={e => setFormData({ ...formData, logoUrl: e.target.value })} 
                                  disabled={!isEditing}
                                  className={`flex-1 p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] font-bold focus:ring-2 focus:ring-blue-500 outline-none text-sm ${!isEditing ? 'opacity-70 cursor-default' : ''}`} 
                                  placeholder="https://..." 
                                />
                                {formData.logoUrl && <img src={formData.logoUrl} alt="Preview" className="w-12 h-12 object-contain bg-white rounded-lg border p-1" />}
                              </div>
                            </div>
                          </div>
                        </section>
                      </div>

                      {/* Coluna Direita: Gestão Interna */}
                      <div className="col-span-12 lg:col-span-4 flex flex-col">
                        <section className="space-y-4 flex-1 flex flex-col">
                          <div className="flex items-center gap-2 mb-2 px-1">
                            <div className="p-1 px-2 bg-blue-500/10 text-blue-600 rounded-lg">
                              <UserIcon className="w-4 h-4" />
                            </div>
                            <h3 className="text-xs font-black uppercase tracking-widest text-blue-600">Gestão Interna</h3>
                          </div>
                          <div className="grid grid-cols-12 gap-5 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm flex-1 content-start">
                            <div className="col-span-12">
                              <label className="block text-[10px] font-bold mb-1 uppercase">Gestor da Conta / PMO Responsável</label>
                              <select
                                value={formData.responsavel_interno_id}
                                onChange={e => setFormData({ ...formData, responsavel_interno_id: e.target.value })}
                                disabled={!isEditing}
                                className={`w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] font-bold focus:ring-2 focus:ring-blue-500 outline-none text-sm ${!isEditing ? 'opacity-70 cursor-default' : ''}`}
                              >
                                <option value="">Selecione gestor...</option>
                                {users.filter((u: User) => u.active !== false).map((u: User) => (
                                  <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                              </select>
                            </div>

                            <div className="col-span-12 md:col-span-4">
                              <label className="block text-[10px] font-bold mb-1 uppercase">Status</label>
                              <button
                                type="button"
                                onClick={handleToggleActive}
                                disabled={!isEditing}
                                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all group ${formData.active ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600' : 'border-red-500/30 bg-red-500/5 text-red-600'} ${!isEditing ? 'opacity-70 cursor-default' : ''}`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${formData.active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                  <span className="font-black uppercase tracking-tight text-[10px]">{formData.active ? 'Ativa' : 'Off'}</span>
                                </div>
                              </button>
                            </div>

                            <div className="col-span-12 md:col-span-8">
                              <label className="block text-[10px] font-bold mb-1 uppercase">Documentação NIC</label>
                              <button
                                type="button"
                                onClick={handleToggleDoc}
                                disabled={!isEditing}
                                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all group ${formData.doc_nic_ativo ? 'border-purple-500/30 bg-purple-500/5 text-purple-600' : 'border-[var(--border)] bg-[var(--surface-3)] text-[var(--muted)] hover:border-purple-500/20'} ${!isEditing ? 'opacity-70 cursor-default' : ''}`}
                              >
                                <div className="flex items-center gap-2">
                                  <FileText size={14} className={formData.doc_nic_ativo ? 'text-purple-600' : 'text-muted'} />
                                  <span className="font-black uppercase tracking-tight text-[10px]">Doc. NIC</span>
                                </div>
                                <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border transition-colors ${formData.doc_nic_ativo ? 'bg-purple-500 text-white border-purple-400' : 'bg-[var(--border)] text-muted border-[var(--border)]'}`}>
                                  {formData.doc_nic_ativo ? 'Permitido' : 'Não Permitido'}
                                </div>
                              </button>
                            </div>
                          </div>
                        </section>
                      </div>
                    </div>
                  </div>
                )}

                    {/* Bloco de Contatos */}
                    <div className="p-8 rounded-[32px] border border-dashed mb-10" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2 mb-8">
                        <div className="p-1 px-2 bg-blue-500/10 text-blue-600 rounded-lg">
                          <UserIcon size={14} />
                        </div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-blue-600">Contatos e Responsáveis no Cliente</h4>
                      </div>

                      <div className="grid grid-cols-12 gap-8">
                        {/* Linha 1 */}
                        <div className="col-span-12 md:col-span-3">
                          <label className="block text-[9px] font-black uppercase mb-1.5 text-[var(--text)]">Contato Principal</label>
                          <input
                            type="text"
                            value={formData.contato_nome_1}
                            onChange={(e) => setFormData({ ...formData, contato_nome_1: toSentenceCase(e.target.value) })}
                            disabled={!isEditing}
                            className={`w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold outline-none transition-all ${isEditing ? 'border-blue-500/50 focus:border-blue-500' : 'opacity-70 cursor-default'}`}
                            placeholder="Nome"
                          />
                        </div>
                        <div className="col-span-12 md:col-span-3">
                          <label className="block text-[9px] font-black uppercase mb-1.5">Email</label>
                          <input
                            type="email"
                            value={formData.contato_email_1}
                            onChange={(e) => setFormData({ ...formData, contato_email_1: e.target.value })}
                            disabled={!isEditing}
                            className={`w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold outline-none transition-all ${isEditing ? 'border-blue-500/50 focus:border-blue-500' : 'opacity-70 cursor-default'}`}
                            placeholder="email@exemplo.com"
                          />
                        </div>
                        <div className="col-span-12 md:col-span-3">
                          <label className="block text-[9px] font-black uppercase mb-1.5">Cel / WhatsApp</label>
                          <input
                            type="text"
                            value={formData.contato_celular_1}
                            onChange={(e) => setFormData({ ...formData, contato_celular_1: e.target.value })}
                            disabled={!isEditing}
                            className={`w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold outline-none transition-all ${isEditing ? 'border-blue-500/50 focus:border-blue-500' : 'opacity-70 cursor-default'}`}
                            placeholder="(11) 90000-0000"
                          />
                        </div>
                        <div className="col-span-12 md:col-span-3">
                          <label className="block text-[9px] font-black uppercase mb-1.5">Cargo</label>
                          <input
                            type="text"
                            value={formData.contato_cargo_1}
                            onChange={(e) => setFormData({ ...formData, contato_cargo_1: toSentenceCase(e.target.value) })}
                            disabled={!isEditing}
                            className={`w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold outline-none transition-all ${isEditing ? 'border-blue-500/50 focus:border-blue-500' : 'opacity-70 cursor-default'}`}
                            placeholder="Cargo"
                          />
                        </div>

                        {/* Linha 2 */}
                        <div className="col-span-12 md:col-span-3">
                          <label className="block text-[9px] font-black uppercase mb-1.5 text-[var(--text)]">Contato 2</label>
                          <input
                            type="text"
                            value={formData.contato_nome_2}
                            onChange={(e) => setFormData({ ...formData, contato_nome_2: toSentenceCase(e.target.value) })}
                            disabled={!isEditing}
                            className={`w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold outline-none transition-all ${isEditing ? 'border-blue-500/50 focus:border-blue-500' : 'opacity-70 cursor-default'}`}
                            placeholder="Nome 2"
                          />
                        </div>
                        <div className="col-span-12 md:col-span-3">
                          <label className="block text-[9px] font-black uppercase mb-1.5">Email 2</label>
                          <input
                            type="email"
                            value={formData.contato_email_2}
                            onChange={(e) => setFormData({ ...formData, contato_email_2: e.target.value })}
                            disabled={!isEditing}
                            className={`w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold outline-none transition-all ${isEditing ? 'border-blue-500/50 focus:border-blue-500' : 'opacity-70 cursor-default'}`}
                            placeholder="email2@exemplo.com"
                          />
                        </div>
                        <div className="col-span-12 md:col-span-3">
                          <label className="block text-[9px] font-black uppercase mb-1.5">Celular 2</label>
                          <input
                            type="text"
                            value={formData.contato_celular_2}
                            onChange={(e) => setFormData({ ...formData, contato_celular_2: e.target.value })}
                            disabled={!isEditing}
                            className={`w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold outline-none transition-all ${isEditing ? 'border-blue-500/50 focus:border-blue-500' : 'opacity-70 cursor-default'}`}
                            placeholder="(11) 90000-0000"
                          />
                        </div>
                        <div className="col-span-12 md:col-span-3">
                          <label className="block text-[9px] font-black uppercase mb-1.5">Cargo 2</label>
                          <input
                            type="text"
                            value={formData.contato_cargo_2}
                            onChange={(e) => setFormData({ ...formData, contato_cargo_2: toSentenceCase(e.target.value) })}
                            disabled={!isEditing}
                            className={`w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold outline-none transition-all ${isEditing ? 'border-blue-500/50 focus:border-blue-500' : 'opacity-70 cursor-default'}`}
                            placeholder="Cargo 2"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bloco de Endereço */}
                    <section className="space-y-4 mb-10">
                      <div className="flex items-center gap-2 mb-4 px-1">
                        <div className="p-1 px-2 bg-blue-500/10 text-blue-600 rounded-lg">
                          <Globe className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-blue-600">Endereço e Localização</h3>
                      </div>

                      <div className="grid grid-cols-12 gap-6">
                        {/* Parte 1: Localização Básica */}
                        <div className="col-span-12 lg:col-span-6">
                          <div className="grid grid-cols-12 gap-5 p-7 bg-[var(--surface-2)] border border-[var(--border)] rounded-[32px] shadow-sm h-full">
                            <div className="col-span-12 md:col-span-7" ref={paisDropdownRef}>
                              <label className="block text-[10px] font-bold mb-1 uppercase">País</label>
                              <div className="relative">
                                <div 
                                  ref={triggerRef}
                                  onClick={() => isEditing && togglePaisDropdown()}
                                  className={`flex items-center gap-3 w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl transition-all ${isEditing ? 'cursor-pointer hover:border-blue-500' : 'cursor-default border-transparent bg-transparent px-0'}`}
                                >
                                  {getFlagUrl(formData.pais) ? (
                                    <img src={getFlagUrl(formData.pais)!} alt={formData.pais} className="w-5 h-3.5 object-cover rounded-sm" />
                                  ) : (
                                    <Globe className="w-4 h-4 opacity-40" />
                                  )}
                                  <span className={`font-bold text-[var(--text)] flex-1 text-sm truncate ${!formData.pais ? 'opacity-30' : ''}`}>
                                    {formData.pais || 'Selecionar País'}
                                  </span>
                                  {isEditing && <ChevronDown size={14} className="opacity-40" />}
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
                                      {filteredCountries.map((c) => (
                                        <div
                                          key={c.code}
                                          onClick={() => {
                                            setFormData({ ...formData, pais: c.name });
                                            setPaisSearch('');
                                            setIsPaisDropdownOpen(false);
                                          }}
                                          className={`flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-[var(--bg)] ${formData.pais === c.name ? 'bg-[var(--bg)]' : ''}`}
                                        >
                                          <img src={`https://flagcdn.com/w40/${c.code}.png`} alt={c.name} className="w-6 h-4 object-cover rounded-sm" />
                                          <span className={`text-sm ${formData.pais === c.name ? 'font-black text-blue-500' : 'font-bold'}`}>{c.name}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="col-span-12 md:col-span-5">
                              <label className="block text-[10px] font-bold text-blue-500 mb-1 uppercase">
                                {formData.pais === 'Brasil' ? 'CEP para Busca *' : 'Zip / Postal Code'}
                              </label>
                              <div className="flex gap-1.5 items-center">
                                <input
                                  type="text"
                                  value={formData.endereco_cep}
                                  onChange={(e) => setFormData({ ...formData, endereco_cep: e.target.value })}
                                  readOnly={!isEditing}
                                  className={`flex-1 p-2.5 bg-[var(--bg)] border rounded-xl text-sm font-bold outline-none transition-all ${isEditing ? 'border-[var(--border)] focus:border-blue-500' : 'border-transparent bg-transparent px-0'}`}
                                  placeholder="00000-000"
                                />
                                {isEditing && formData.pais === 'Brasil' && (
                                  <button
                                    type="button"
                                    onClick={handleCepSearch}
                                    disabled={cepLoading || formData.endereco_cep.replace(/\D/g, '').length !== 8}
                                    className="p-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all disabled:opacity-30"
                                  >
                                    <Search className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="col-span-12 md:col-span-8">
                              <label className="block text-[10px] font-bold mb-1 uppercase">Cidade</label>
                              <input
                                type="text"
                                value={formData.endereco_cidade}
                                onChange={(e) => setFormData({ ...formData, endereco_cidade: e.target.value })}
                                disabled={!isEditing}
                                className={`w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold outline-none transition-all ${isEditing ? 'focus:border-blue-500 ring-2 ring-blue-500/10' : 'opacity-70 cursor-default'}`}
                                placeholder="Ex: São Paulo"
                              />
                            </div>
                            <div className="col-span-12 md:col-span-4">
                              <label className="block text-[10px] font-bold mb-1 uppercase">{formData.pais === 'Brasil' ? 'UF' : 'Estado'}</label>
                              <input
                                type="text"
                                value={formData.endereco_estado}
                                onChange={(e) => setFormData({ ...formData, endereco_estado: e.target.value })}
                                disabled={!isEditing}
                                className={`w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold outline-none transition-all ${isEditing ? 'focus:border-blue-500 ring-2 ring-blue-500/10' : 'opacity-70 cursor-default'}`}
                                placeholder="EX: SP"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Parte 2: Logradouro e Detalhes */}
                        <div className="col-span-12 lg:col-span-6">
                          <div className="grid grid-cols-12 gap-5 p-7 bg-[var(--surface-2)] border border-[var(--border)] rounded-[32px] shadow-sm h-full font-bold">
                            <div className="col-span-12 md:col-span-9">
                              <label className="block text-[10px] font-bold mb-1 uppercase">Logradouro / Rua</label>
                              <input
                                type="text"
                                value={formData.endereco_rua}
                                onChange={(e) => setFormData({ ...formData, endereco_rua: toUpperCase(e.target.value) })}
                                disabled={!isEditing}
                                className={`w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold outline-none transition-all ${isEditing ? 'focus:border-blue-500 ring-2 ring-blue-500/10' : 'opacity-70 cursor-default'}`}
                                placeholder="Rua, Av, Travessa..."
                              />
                            </div>
                            <div className="col-span-12 md:col-span-3">
                              <label className="block text-[10px] font-bold mb-1 uppercase">Nº</label>
                              <input
                                type="text"
                                value={formData.endereco_numero}
                                onChange={(e) => setFormData({ ...formData, endereco_numero: e.target.value })}
                                disabled={!isEditing}
                                className={`w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold outline-none transition-all ${isEditing ? 'focus:border-blue-500 ring-2 ring-blue-500/10' : 'opacity-70 cursor-default'}`}
                                placeholder="123"
                              />
                            </div>
                            <div className="col-span-12 md:col-span-5">
                              <label className="block text-[10px] font-bold mb-1 uppercase">Bairro</label>
                              <input
                                type="text"
                                value={formData.endereco_bairro}
                                onChange={(e) => setFormData({ ...formData, endereco_bairro: toUpperCase(e.target.value) })}
                                disabled={!isEditing}
                                className={`w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold outline-none transition-all ${isEditing ? 'focus:border-blue-500 ring-2 ring-blue-500/10' : 'opacity-70 cursor-default'}`}
                                placeholder="Ex: Centro"
                              />
                            </div>
                            <div className="col-span-12 md:col-span-7">
                              <label className="block text-[10px] font-bold mb-1 uppercase">Complemento</label>
                              <input
                                type="text"
                                value={formData.endereco_complemento}
                                onChange={(e) => setFormData({ ...formData, endereco_complemento: e.target.value })}
                                disabled={!isEditing}
                                className={`w-full p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold outline-none transition-all ${isEditing ? 'focus:border-blue-500 ring-2 ring-blue-500/10' : 'opacity-70 cursor-default'}`}
                                placeholder="Bloco, Sala, Apto..."
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* NOVO: Equipe Geral do Cliente */}
                    <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2 mb-4 px-1">
                        <div className="p-1 px-1.5 bg-blue-500/10 text-blue-600 rounded-lg">
                          <UserIcon size={12} />
                        </div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                          Equipe Envolvida
                        </h4>
                      </div>
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
                          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Nenhum colaborador alocado ainda.</span>
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
                      <Briefcase className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text)' }} />
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
                    <CheckSquare className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text)' }} />
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
                                <span className="text-[8px] font-black uppercase tracking-tighter mb-1" style={{ color: 'var(--text)' }}>Evolução Média</span>
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
                                <span className="text-[8px] font-black uppercase tracking-tighter mb-1" style={{ color: 'var(--text)' }}>Concluído</span>
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
