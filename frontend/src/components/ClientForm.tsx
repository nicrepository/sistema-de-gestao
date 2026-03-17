// components/ClientForm.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataController } from '../controllers/useDataController';
import type { Client, User } from '../types';
import { Save, Upload, Trash2, Handshake, Building2, User as UserIcon, Mail, Phone, Calendar, DollarSign, FileText, CalendarDays, Search, ChevronDown, Globe } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import BackButton from './shared/BackButton';
import CalendarPicker from './CalendarPicker';
import { toUpperCase, toSentenceCase, cleanText } from '../utils/textFormatter';

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

const ClientForm: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { getClientById, createClient, updateClient, deleteClient, clients, users } = useDataController();

  const isEdit = !!clientId;
  const client = clientId ? getClientById(clientId) : null;

  // Initialize type based on URL or existing client
  const [tipo_cliente, setTipoCliente] = useState<'parceiro' | 'cliente_final'>('cliente_final');

  // Common Fields
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [cnpj, setCnpj] = useState('');

  // Partner Specific Fields
  const [razaoSocial, setRazaoSocial] = useState(''); // Consultoria often has different specific legal name
  const [emailFinanceiro, setEmailFinanceiro] = useState('');
  const [emailComercial, setEmailComercial] = useState('');
  const [responsavelComercial, setResponsavelComercial] = useState('');
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');

  // Client Specific Fields
  const [partner_id, setPartnerId] = useState('');
  const [segmento, setSegmento] = useState('');
  const [responsavelProduto, setResponsavelProduto] = useState(''); // Product Owner at Client
  const [emailProduto, setEmailProduto] = useState('');
  const [responsavelTecnico, setResponsavelTecnico] = useState(''); // Tech Contact at Client (optional)

  // Internal Management (Both)
  const [responsavel_interno_id, setResponsavelInternoId] = useState(''); // Our Account Manager/PM
  const [active, setActive] = useState(true);
  const [doc_nic_ativo, setDoc_nic_ativo] = useState(false);

  // Novos Campos
  const [enderecoRua, setEnderecoRua] = useState('');
  const [enderecoNumero, setEnderecoNumero] = useState('');
  const [enderecoComplemento, setEnderecoComplemento] = useState('');
  const [enderecoBairro, setEnderecoBairro] = useState('');
  const [enderecoCidade, setEnderecoCidade] = useState('');
  const [enderecoEstado, setEnderecoEstado] = useState('');
  const [enderecoCep, setEnderecoCep] = useState('');
  const [contatoCelular, setContatoCelular] = useState('');
  const [contatoWhatsapp, setContatoWhatsapp] = useState('');
  const [contatoCargo, setContatoCargo] = useState('');
  const [pais, setPais] = useState('Brasil');
  const [telefone, setTelefone] = useState('');
  const [showAddressDetails, setShowAddressDetails] = useState(true);
  const [isAddressFromCep, setIsAddressFromCep] = useState(false);

  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [lastSearchedCep, setLastSearchedCep] = useState('');

  // Searchable Partner Select States
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Memoized Partners List (Filtered & Sorted)
  const partners = useMemo(() => {
    return clients
      .filter((c: Client) => c.tipo_cliente === 'parceiro')
      .sort((a: Client, b: Client) => a.name.localeCompare(b.name));
  }, [clients]);

  const filteredPartners = useMemo(() => {
    return partners.filter((p: Client) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [partners, searchTerm]);

  const selectedPartner = useMemo(() => {
    return partners.find((p: Client) => p.id === partner_id);
  }, [partners, partner_id]);

  // Click Outside Handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (paisDropdownRef.current && !paisDropdownRef.current.contains(event.target as Node)) {
        setIsPaisDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // CEP Lookup Logic
  const [cepError, setCepError] = useState('');
  const [cepLoading, setCepLoading] = useState(false);

  const handleCepSearch = async () => {
    const cleanedCep = enderecoCep.replace(/\D/g, '');
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
        setEnderecoRua(toUpperCase(data.logradouro));
        setEnderecoBairro(toUpperCase(data.bairro));
        setEnderecoCidade(toUpperCase(data.localidade));
        setEnderecoEstado(toUpperCase(data.uf));
        setPais('Brasil');
        setIsAddressFromCep(true);
        setLastSearchedCep(enderecoCep);
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
    const cleaned = enderecoCep.replace(/\D/g, '');
    
    // Se o CEP for apagado, estiver vazio ou tiver menos de 8 dígitos e não for o que foi pesquisado,
    // liberamos os campos. Se estiver totalmente vazio, limpamos os dados.
    if (!cleaned) {
      setEnderecoRua('');
      setEnderecoBairro('');
      setEnderecoCidade('');
      setEnderecoEstado('');
      setIsAddressFromCep(false);
      setLastSearchedCep('');
      setCepError('');
    } else if (cleaned !== lastSearchedCep.replace(/\D/g, '')) {
      // Se o usuário mexer no CEP após uma busca bem-sucedida, liberamos os campos
      setIsAddressFromCep(false);
    }
    
    // Se mudar de país, reseta flags de bloqueio
    if (pais !== 'Brasil') {
      setIsAddressFromCep(false);
      setCepError('');
    }
  }, [enderecoCep, pais, lastSearchedCep]);

  const getFlagUrl = (countryName: string) => {
    const country = COUNTRIES.find(c => c.name.toLowerCase() === countryName.toLowerCase());
    if (country) return `https://flagcdn.com/w40/${country.code}.png`;
    return null;
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryTipo = urlParams.get('tipo') as 'parceiro' | 'cliente_final';
    if (queryTipo) setTipoCliente(queryTipo);

    const queryPartnerId = urlParams.get('partnerId');
    if (queryPartnerId) {
      setPartnerId(queryPartnerId);
    }
  }, [clients, isEdit]);

  useEffect(() => {
    if (client) {
      setName(client.name);
      setLogoUrl(client.logoUrl || '');
      setCnpj(client.cnpj || '');
      setTipoCliente(client.tipo_cliente || 'cliente_final');
      setPartnerId(client.partner_id || '');
      setResponsavelInternoId(client.responsavel_interno_id || '');
      setActive(client.active !== false);
      setDoc_nic_ativo(client.doc_nic_ativo === true);
      setPais(client.pais || 'Brasil');
      setTelefone(client.telefone || '');

      // Novos Campos
      setEnderecoRua(client.endereco_rua || '');
      setEnderecoNumero(client.endereco_numero || '');
      setEnderecoComplemento(client.endereco_complemento || '');
      setEnderecoBairro(client.endereco_bairro || '');
      setEnderecoCidade(client.endereco_cidade || '');
      setEnderecoEstado(client.endereco_estado || '');
      setEnderecoCep(client.endereco_cep || '');
      setContatoCelular(client.contato_celular || '');
      setContatoWhatsapp(client.contato_whatsapp || '');
      setContatoCargo(client.contato_cargo || '');
      setRazaoSocial(client.razao_social || '');
      setSegmento(client.segmento || '');
      setEmailFinanceiro(client.email_financeiro || '');
      setResponsavelTecnico(client.responsavel_tecnico || '');
      setContractStart(client.data_inicio_contrato || '');
      setContractEnd(client.data_fim_contrato || '');

      // Map other fields from generic JSON or specific columns if they existed
      // For now we map to existing fields or state
      // Assuming 'email_contato' serves as primary contact
      if (client.tipo_cliente === 'parceiro') {
        setEmailComercial(client.email_contato || '');
        setResponsavelComercial(client.responsavel_externo || '');
        // If you have extended columns in DB, map them here. 
        // For this demo, we use the standard fields adaptable.
      } else {
        setEmailProduto(client.email_contato || '');
        setResponsavelProduto(client.responsavel_externo || '');
      }
    }
  }, [client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('Nome é obrigatório');

    if (tipo_cliente === 'cliente_final' && !partner_id) {
      return alert('É obrigatório vincular este cliente a um parceiro.');
    }

    try {
      setLoading(true);

      const payload = {
        name,
        logoUrl,
        cnpj,
        tipo_cliente,
        partner_id: tipo_cliente === 'cliente_final' ? partner_id : null,
        responsavel_interno_id: responsavel_interno_id || null,
        active,
        doc_nic_ativo,

        // Novos Campos
        razao_social: razaoSocial,
        segmento: segmento,
        email_financeiro: emailFinanceiro,
        responsavel_tecnico: responsavelTecnico,
        data_inicio_contrato: contractStart || null,
        data_fim_contrato: contractEnd || null,
        endereco_rua: enderecoRua,
        endereco_numero: enderecoNumero,
        endereco_complemento: enderecoComplemento,
        endereco_bairro: enderecoBairro,
        endereco_cidade: enderecoCidade,
        endereco_estado: enderecoEstado,
        endereco_cep: enderecoCep,
        contato_celular: contatoCelular,
        contato_whatsapp: contatoWhatsapp,
        contato_cargo: contatoCargo,
        pais: pais,
        telefone: telefone,

        // Mapping specific roles to the unified DB columns
        email_contato: tipo_cliente === 'parceiro' ? emailComercial : emailProduto,
        responsavel_externo: tipo_cliente === 'parceiro' ? responsavelComercial : responsavelProduto,

        // We could store extra metadata in a JSON column if needed, or simply extended columns
        // For now, ensuring core connectivity
      };

      if (isEdit && clientId) {
        await updateClient(clientId, payload);
        alert('Atualizado com sucesso!');
      } else {
        await createClient(payload);
        alert(`${tipo_cliente === 'parceiro' ? 'Parceiro' : 'Cliente'} criado com sucesso!`);
      }
      const urlParams = new URLSearchParams(window.location.search);
      const returnTo = urlParams.get('returnTo');
      const subTab = urlParams.get('sub');

      if (returnTo) {
        if (returnTo === 'dashboard') {
          navigate(`/admin/clients?tab=parceiros`);
        } else {
          // Se veio do AdminDashboard (Parceiros), o returnTo é o partnerId
          // Verificamos se a subTab é uma das abas do dashboard de parceiros
          const dashboardTabs = ['clientes', 'resumo', 'info', 'parceiros'];
          if (subTab && dashboardTabs.includes(subTab)) {
            navigate(`/admin/clients?tab=parceiros&partnerId=${returnTo}&sub=${subTab}`);
          } else {
            // Caso contrário, vai para a visão detalhada individual
            navigate(`/admin/clients/${returnTo}${subTab ? `?sub=${subTab}` : ''}`);
          }
        }
      } else if (isEdit && clientId) {
        // Se for edição e não tiver returnTo, tenta retornar conforme o tipo
        if (tipo_cliente === 'parceiro') {
          navigate(`/admin/clients?tab=parceiros&partnerId=${clientId}${subTab ? `&sub=${subTab}` : ''}`);
        } else {
          navigate(`/admin/clients/${clientId}${subTab ? `?sub=${subTab}` : ''}`);
        }
      } else {
        const defaultTab = tipo_cliente === 'parceiro' ? 'parceiros' : 'operacional';
        navigate(`/admin/clients?tab=${defaultTab}`);
      }
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      await deleteClient(clientId);
      alert('Excluído com sucesso!');
      navigate('/admin/clients');
    } catch (error) {
      alert('Erro ao excluir. Verifique vínculos.');
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg)]">
      {/* Header Distinct per Type */}
      <div className="px-8 py-6 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <BackButton fallbackRoute="/admin/clients" />
          <div>
            <h2 className="text-xl font-bold text-[var(--text-title)] flex items-center gap-2">
              {tipo_cliente === 'parceiro' ? <Handshake className="text-purple-500" /> : <Building2 className="text-blue-500" />}
              {isEdit ? `Editar ${tipo_cliente === 'parceiro' ? 'Parceiro' : 'Cliente'} ` : `Novo ${tipo_cliente === 'parceiro' ? 'Parceiro' : 'Cliente'} `}
            </h2>
            <p className="text-[var(--text-muted)] text-sm">
              {tipo_cliente === 'parceiro'
                ? 'Cadastre uma consultoria/parceiro de negócios'
                : 'Cadastre uma conta cliente vinculada a um parceiro'}
            </p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`px-6 py-2.5 text-white rounded-lg font-bold shadow hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 ${tipo_cliente === 'parceiro' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          <Save className="w-4 h-4" />
          {loading ? 'Salvando...' : 'Salvar Cadastro'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <form onSubmit={handleSubmit} className="w-full space-y-8">

          {/* -- FIELDS FOR PARTNER -- */}
          {tipo_cliente === 'parceiro' && (
            <>
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Handshake className="w-4 h-4 text-purple-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Dados da Consultoria</h3>
                </div>
                <div className="grid grid-cols-12 gap-6 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
                  <div className="col-span-12 md:col-span-4 lg:col-span-3">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Nome Fantasia (Parceiro) *</label>
                    <input
                      id="client-name"
                      name="name"
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl font-bold text-[var(--text)] focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder="Ex: Tech Solutions Consultoria"
                      autoComplete="organization"
                      required
                    />
                  </div>
                  <div className="col-span-12 md:col-span-2 lg:col-span-2">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">CNPJ</label>
                    <input
                      id="client-cnpj"
                      name="cnpj"
                      type="text"
                      value={cnpj}
                      onChange={e => setCnpj(e.target.value)}
                      className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder="00.000.000/0001-00"
                      autoComplete="off"
                    />
                  </div>
                  <div className="col-span-12 md:col-span-6 lg:col-span-7">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">URL do Logo</label>
                    <div className="flex gap-2">
                      <input
                        id="client-logo-url"
                        name="logoUrl"
                        type="text"
                        value={logoUrl}
                        onChange={e => setLogoUrl(e.target.value)}
                        className="flex-1 p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="https://..."
                        autoComplete="off"
                      />
                      {logoUrl && <img src={logoUrl} alt="Preview" className="w-12 h-12 object-contain bg-white rounded-lg border p-1" />}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <UserIcon className="w-4 h-4 text-purple-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Gestão Interna (Nossa Equipe)</h3>
                </div>
                <div className="grid grid-cols-12 gap-6 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
                  <div className="col-span-12 lg:col-span-4">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Gestor da Conta / PMO Responsável</label>
                    <select
                      id="internal-manager-partner"
                      value={responsavel_interno_id}
                      onChange={e => setResponsavelInternoId(e.target.value)}
                      className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="">Selecione um gestor interno...</option>
                      {users.filter((u: User) => u.active !== false).map((u: User) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <UserIcon className="w-4 h-4 text-purple-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Gestão e Pontos de Contato</h3>
                </div>
                <div className="grid grid-cols-12 gap-6 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
                  <div className="col-span-12 md:col-span-4 lg:col-span-3">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Responsável Comercial</label>
                    <input
                      id="client-external-manager"
                      name="responsavelComercial"
                      type="text"
                      value={responsavelComercial}
                      onChange={e => setResponsavelComercial(toSentenceCase(cleanText(e.target.value)))}
                      className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-purple-500"
                      placeholder="Nome do contato principal"
                      autoComplete="name"
                    />
                  </div>
                  <div className="col-span-12 md:col-span-4 lg:col-span-3">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Email Principal (Comercial)</label>
                    <input
                      id="client-external-email"
                      name="emailComercial"
                      type="email"
                      value={emailComercial}
                      onChange={e => setEmailComercial(e.target.value)}
                      className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-purple-500"
                      placeholder="contato@consultoria.com"
                      autoComplete="email"
                    />
                  </div>
                  <div className="col-span-12 md:col-span-4 lg:col-span-2">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Email Financeiro (Faturamento)</label>
                    <input type="email" value={emailFinanceiro} onChange={e => setEmailFinanceiro(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-purple-500" placeholder="financeiro@consultoria.com" />
                  </div>
                  <div className="col-span-12 md:col-span-4 lg:col-span-2">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Celular / WhatsApp</label>
                    <input type="text" value={contatoCelular} onChange={e => setContatoCelular(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-purple-500" placeholder="(11) 90000-0000" />
                  </div>
                  <div className="col-span-12 md:col-span-4 lg:col-span-2">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Cargo / Função</label>
                    <input type="text" value={contatoCargo} onChange={e => setContatoCargo(toSentenceCase(cleanText(e.target.value)))} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-purple-500" placeholder="Ex: Diretor de Tecnologia" />
                  </div>
                  <div className="col-span-12 md:col-span-4 lg:col-span-2">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Telefone Fixo (Opcional)</label>
                    <input type="text" value={telefone} onChange={e => setTelefone(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-purple-500" placeholder="(11) 0000-0000" />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-purple-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Dados Contratuais</h3>
                  {isEdit && (
                    <div
                      onClick={() => setActive(!active)}
                      className={`ml-4 px-3 py-1 rounded-full cursor-pointer transition-all border flex items-center gap-2 ${active ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-white/5 border-white/10 text-white/40'}`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest">{active ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  )}
                  {isEdit && (
                    <div
                      onClick={() => setDoc_nic_ativo(!doc_nic_ativo)}
                      className={`ml-4 px-3 py-1 rounded-full cursor-pointer transition-all border flex items-center gap-2 ${doc_nic_ativo ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-white/5 border-white/10 text-white/40'}`}
                    >
                      <FileText className={`w-3 h-3 ${doc_nic_ativo ? 'text-primary' : 'opacity-30'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">DOC. NIC</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-12 gap-6 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
                  <div className="col-span-12 lg:col-span-8">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Razão Social</label>
                    <input
                      type="text"
                      value={razaoSocial}
                      onChange={e => setRazaoSocial(toUpperCase(e.target.value))}
                      className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-purple-500 font-bold"
                      placeholder="Nome Juridico Completo"
                    />
                  </div>
                  <div className="col-span-12 md:col-span-6 lg:col-span-2 relative">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Início Vigência</label>
                    <div className="flex items-center justify-between p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                      <input
                        id="client-contract-start"
                        name="contractStart"
                        type="date"
                        value={contractStart}
                        onChange={e => setContractStart(e.target.value)}
                        className="bg-transparent outline-none text-[var(--text)] w-full cursor-pointer"
                        onClick={(e) => { e.preventDefault(); setShowStartCalendar(!showStartCalendar); setShowEndCalendar(false); }}
                        autoComplete="off"
                      />
                      <CalendarDays className="w-4 h-4 opacity-40 cursor-pointer hover:opacity-100 transition-opacity" onClick={() => { setShowStartCalendar(!showStartCalendar); setShowEndCalendar(false); }} />
                    </div>
                    {showStartCalendar && (
                      <CalendarPicker
                        selectedDate={contractStart}
                        onSelectDate={(date) => {
                          setContractStart(date);
                        }}
                        onClose={() => setShowStartCalendar(false)}
                      />
                    )}
                  </div>
                  <div className="col-span-12 md:col-span-6 lg:col-span-2 relative">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Fim Vigência (Opcional)</label>
                    <div className="flex items-center justify-between p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                      <input
                        id="client-contract-end"
                        name="contractEnd"
                        type="date"
                        value={contractEnd}
                        onChange={e => setContractEnd(e.target.value)}
                        className="bg-transparent outline-none text-[var(--text)] w-full cursor-pointer"
                        onClick={(e) => { e.preventDefault(); setShowEndCalendar(!showEndCalendar); setShowStartCalendar(false); }}
                        autoComplete="off"
                      />
                      <CalendarDays className="w-4 h-4 opacity-40 cursor-pointer hover:opacity-100 transition-opacity" onClick={() => { setShowEndCalendar(!showEndCalendar); setShowStartCalendar(false); }} />
                    </div>
                    {showEndCalendar && (
                      <CalendarPicker
                        selectedDate={contractEnd}
                        onSelectDate={(date) => {
                          setContractEnd(date);
                        }}
                        onClose={() => setShowEndCalendar(false)}
                      />
                    )}
                  </div>
                </div>
              </section>


            </>
          )}

          {/* -- FIELDS FOR CLIENT -- */}
          {tipo_cliente === 'cliente_final' && (
            <>
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Dados da Empresa (Cliente Final)</h3>
                </div>
                <div className="grid grid-cols-12 gap-6 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
                  <div className="col-span-12 md:col-span-8">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Nome da Empresa *</label>
                    <input
                      id="client-name-final"
                      name="name"
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl font-bold text-[var(--text)] focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Ex: Indústria XYZ S.A."
                      autoComplete="organization"
                      required
                    />
                  </div>
                  <div className="col-span-12 md:col-span-4">
                    {/* VINCULO COM PARCEIRO - CRUCIAL */}
                    <label className="block text-xs font-bold text-blue-500 mb-2 uppercase tracking-wide">Parceiro *</label>
                    <div className="relative" ref={dropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`w-full p-4 bg-[var(--bg)] border-2 rounded-xl text-[var(--text)] font-bold transition-all flex items-center justify-between outline-none ${isDropdownOpen ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-blue-500/20 hover:border-blue-500/40'}`}
                      >
                        {selectedPartner ? (
                          <div className="flex items-center gap-3">
                            {selectedPartner.logoUrl ? (
                              <img src={selectedPartner.logoUrl} alt={selectedPartner.name} className="w-8 h-8 object-contain rounded-lg border bg-white p-1" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg border bg-[var(--surface)] flex items-center justify-center">
                                <Handshake className="w-4 h-4 opacity-30" />
                              </div>
                            )}
                            <span className="truncate">{selectedPartner.name}</span>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)] font-normal italic">selecionar</span>
                        )}
                        <ChevronDown className={`w-5 h-5 text-blue-500/50 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-4 border-b border-[var(--border)] bg-[var(--bg)]/50 backdrop-blur-sm sticky top-0">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500/50" />
                              <input
                                id="partner-search"
                                name="partnerSearch"
                                autoFocus
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Procurar parceiro por nome..."
                                className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-medium outline-none focus:border-blue-500"
                                autoComplete="off"
                              />
                            </div>
                          </div>

                          <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-2">
                            {filteredPartners.length > 0 ? (
                              filteredPartners.map((p: Client) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setPartnerId(p.id);
                                    setIsDropdownOpen(false);
                                    setSearchTerm('');
                                  }}
                                  className={`w-full p-3 flex items-center gap-4 rounded-xl transition-all text-left ${partner_id === p.id ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'hover:bg-blue-500/10'}`}
                                >
                                  {p.logoUrl ? (
                                    <img src={p.logoUrl} alt={p.name} className={`w-10 h-10 object-contain rounded-lg border p-1.5 bg-white ${partner_id === p.id ? 'border-transparent' : ''}`} />
                                  ) : (
                                    <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${partner_id === p.id ? 'bg-white/20 border-transparent' : 'bg-[var(--bg)]'}`}>
                                      <Handshake className={`w-5 h-5 ${partner_id === p.id ? 'text-white' : 'opacity-20'}`} />
                                    </div>
                                  )}
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-bold truncate text-sm">{p.name}</span>
                                    {p.cnpj && <span className={`text-[10px] uppercase tracking-wider opacity-60 ${partner_id === p.id ? 'text-blue-50' : ''}`}>{p.cnpj}</span>}
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                                <div className="p-3 bg-red-50 rounded-full mb-3">
                                  <Search className="w-6 h-6 text-red-500 opacity-50" />
                                </div>
                                <p className="text-sm font-bold text-[var(--text-title)]">Nenhum parceiro encontrado</p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">Tente buscar por outro termo ou nome</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-span-12 md:col-span-5">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Segmento / Indústria</label>
                    <input type="text" value={segmento} onChange={e => setSegmento(toSentenceCase(cleanText(e.target.value)))} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Varejo, Bancário..." />
                  </div>
                  <div className="col-span-12 md:col-span-3">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">CNPJ</label>
                    <input type="text" value={cnpj} onChange={e => setCnpj(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] focus:ring-2 focus:ring-blue-500 outline-none" placeholder="00.000.000/0001-00" />
                  </div>
                  <div className="col-span-12 md:col-span-4">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">URL do Logo</label>
                    <div className="flex gap-2">
                       <input type="text" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className="flex-1 p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] focus:ring-2 focus:ring-blue-500 outline-none" placeholder="https://..." />
                       {logoUrl && <img src={logoUrl} alt="Preview" className="w-12 h-12 object-contain bg-white rounded-lg border p-1" />}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <UserIcon className="w-4 h-4 text-blue-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Gestão Interna (Nossa Equipe)</h3>
                </div>
                <div className="grid grid-cols-12 gap-6 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
                  <div className="col-span-12 lg:col-span-4">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Gestor da Conta / PMO Responsável</label>
                    <select
                      id="internal-manager-client"
                      value={responsavel_interno_id}
                      onChange={e => setResponsavelInternoId(e.target.value)}
                      className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Selecione um gestor interno...</option>
                      {users.filter((u: User) => u.active !== false).map((u: User) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <UserIcon className="w-4 h-4 text-blue-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Contatos e Responsáveis no Cliente</h3>
                </div>
                <div className="grid grid-cols-12 gap-6 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
                  <div className="col-span-12 md:col-span-7">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Ponto de Contato Principal</label>
                    <input type="text" value={responsavelProduto} onChange={e => setResponsavelProduto(toSentenceCase(cleanText(e.target.value)))} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-blue-500" placeholder="Nome do representante do cliente" />
                  </div>
                  <div className="col-span-12 md:col-span-5">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Email do Contato</label>
                    <input type="email" value={emailProduto} onChange={e => setEmailProduto(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-blue-500" placeholder="exemplo@cliente.com" />
                  </div>
                  <div className="col-span-12 md:col-span-4">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">WhatsApp / Celular</label>
                    <input type="text" value={contatoCelular} onChange={e => setContatoCelular(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-blue-500" placeholder="(11) 90000-0000" />
                  </div>
                  <div className="col-span-12 md:col-span-4">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Cargo / Função do Contato</label>
                    <input type="text" value={contatoCargo} onChange={e => setContatoCargo(toSentenceCase(cleanText(e.target.value)))} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-blue-500" placeholder="Ex: Gerente de Projetos" />
                  </div>
                  <div className="col-span-12 md:col-span-4">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Responsável Técnico / Apoio</label>
                    <input type="text" value={responsavelTecnico} onChange={e => setResponsavelTecnico(toSentenceCase(cleanText(e.target.value)))} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-blue-500" placeholder="Nome do técnico" />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Dados Contratuais (Opcional)</h3>
                  {isEdit && (
                    <div
                      onClick={() => setDoc_nic_ativo(!doc_nic_ativo)}
                      className={`ml-4 px-3 py-1 rounded-full cursor-pointer transition-all border flex items-center gap-2 ${doc_nic_ativo ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-white/5 border-white/10 text-white/40'}`}
                    >
                      <FileText className={`w-3 h-3 ${doc_nic_ativo ? 'text-primary' : 'opacity-30'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">DOC. NIC</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-12 gap-6 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
                  <div className="col-span-12 md:col-span-6 lg:col-span-2 relative">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Início Vigência (Projeto Único)</label>
                    <div className="flex items-center justify-between p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                      <input
                        id="client-final-contract-start"
                        name="contractStartFinal"
                        type="date"
                        value={contractStart}
                        onChange={e => setContractStart(e.target.value)}
                        className="bg-transparent outline-none text-[var(--text)] w-full cursor-pointer"
                        onClick={(e) => { e.preventDefault(); setShowStartCalendar(!showStartCalendar); setShowEndCalendar(false); }}
                        autoComplete="off"
                      />
                      <CalendarDays className="w-4 h-4 opacity-40 cursor-pointer hover:opacity-100 transition-opacity" onClick={() => { setShowStartCalendar(!showStartCalendar); setShowEndCalendar(false); }} />
                    </div>
                    {showStartCalendar && (
                      <CalendarPicker
                        selectedDate={contractStart}
                        onSelectDate={(date) => {
                          setContractStart(date);
                        }}
                        onClose={() => setShowStartCalendar(false)}
                      />
                    )}
                  </div>
                  <div className="col-span-12 md:col-span-6 lg:col-span-2 relative">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Fim Vigência (Previsão)</label>
                    <div className="flex items-center justify-between p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                      <input
                        id="client-final-contract-end"
                        name="contractEndFinal"
                        type="date"
                        value={contractEnd}
                        onChange={e => setContractEnd(e.target.value)}
                        className="bg-transparent outline-none text-[var(--text)] w-full cursor-pointer"
                        onClick={(e) => { e.preventDefault(); setShowEndCalendar(!showEndCalendar); setShowStartCalendar(false); }}
                        autoComplete="off"
                      />
                      <CalendarDays className="w-4 h-4 opacity-40 cursor-pointer hover:opacity-100 transition-opacity" onClick={() => { setShowEndCalendar(!showEndCalendar); setShowStartCalendar(false); }} />
                    </div>
                    {showEndCalendar && (
                      <CalendarPicker
                        selectedDate={contractEnd}
                        onSelectDate={(date) => {
                          setContractEnd(date);
                        }}
                        onClose={() => setShowEndCalendar(false)}
                      />
                    )}
                  </div>
                </div>
              </section>

            </>
          )}

          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className={`w-4 h-4 ${tipo_cliente === 'parceiro' ? 'text-purple-500' : 'text-blue-500'}`} />
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Endereço Completo</h3>
            </div>
            <div className="grid grid-cols-12 gap-6 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
               {/* País Primeiro */}
              <div className="col-span-12 md:col-span-4" ref={paisDropdownRef}>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">País</label>
                <div className="relative">
                  <div 
                    ref={triggerRef}
                    onClick={togglePaisDropdown}
                    className={`flex items-center gap-3 w-full p-4 bg-[var(--bg)] border-2 rounded-xl cursor-pointer transition-all ${isPaisDropdownOpen ? (tipo_cliente === 'parceiro' ? 'border-purple-500 shadow-md' : 'border-blue-500 shadow-md') : 'border-[var(--border)]'} hover:bg-[var(--surface)]`}
                  >
                    {getFlagUrl(pais) ? (
                      <img 
                        src={getFlagUrl(pais)!} 
                        alt={pais} 
                        className="w-6 h-4 object-cover rounded-sm shadow-sm" 
                      />
                    ) : (
                      <Globe className="w-5 h-5 opacity-40" />
                    )}
                    <span className={`font-extrabold text-[var(--text)] flex-1 ${!pais ? 'opacity-30' : ''}`}>
                      {pais || 'Selecionar País'}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isPaisDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {isPaisDropdownOpen && (
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
                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        {filteredCountries.length > 0 ? (
                          filteredCountries.map((c) => (
                            <div
                              key={c.code}
                              onClick={() => {
                                setPais(c.name);
                                setPaisSearch('');
                                setIsPaisDropdownOpen(false);
                              }}
                              className={`flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-[var(--bg)] ${pais === c.name ? 'bg-[var(--bg)]' : ''}`}
                            >
                              <img 
                                src={`https://flagcdn.com/w40/${c.code}.png`} 
                                alt={c.name} 
                                className="w-6 h-4 object-cover rounded-sm" 
                              />
                              <span className={`text-sm ${pais === c.name ? 'font-black text-blue-500' : 'font-bold'}`}>
                                {c.name}
                              </span>
                              {pais === c.name && <div className="ml-auto w-2 h-2 bg-blue-500 rounded-full"></div>}
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center text-xs text-[var(--text-muted)] font-bold">
                            Nenhum país encontrado
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* CEP / Zip Code - Somente Brasil */}
              {pais === 'Brasil' ? (
                <div className="col-span-12 md:col-span-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <label className={`block text-xs font-bold mb-1 uppercase ${tipo_cliente === 'parceiro' ? 'text-purple-500' : 'text-blue-500'}`}>
                    CEP para Busca *
                  </label>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 relative">
                      <input 
                        type="text" 
                        value={enderecoCep} 
                        onChange={e => setEnderecoCep(e.target.value)} 
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCepSearch();
                          }
                        }}
                        className={`w-full p-4 bg-[var(--bg)] border-2 rounded-xl text-[var(--text)] outline-none font-bold transition-all ${tipo_cliente === 'parceiro' ? 'border-purple-500/20 focus:border-purple-500' : 'border-blue-500/20 focus:border-blue-500'}`} 
                        placeholder="00000-000" 
                      />
                      {cepLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleCepSearch}
                      disabled={cepLoading || enderecoCep.replace(/\D/g, '').length !== 8}
                      className={`px-6 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-sm flex items-center gap-2 disabled:opacity-30 ${tipo_cliente === 'parceiro' ? 'bg-purple-500 text-white hover:bg-purple-600' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                    >
                      <Search className="w-4 h-4" />
                      Pesquisar
                    </button>
                    {cepError && <span className="text-[10px] text-red-500 font-bold uppercase ml-2">{cepError}</span>}
                  </div>
                </div>
              ) : (
                /* Espaçador para manter o layout estável em endereços internacionais */
                <div className="hidden md:block md:col-span-8"></div>
              )}

              {/* Campos sempre visíveis */}
              <div className="col-span-12 md:col-span-3 lg:col-span-2">
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">
                  {pais === 'Brasil' ? 'Estado (UF)' : 'Estado / Província'}
                </label>
                 <input 
                  type="text" 
                  value={enderecoEstado} 
                  onChange={e => setEnderecoEstado(toUpperCase(e.target.value))} 
                  className={`w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none transition-all ${isAddressFromCep ? 'bg-blue-500/[0.03] border-blue-500/30 font-black text-blue-500 cursor-default' : 'focus:border-blue-500'} ${tipo_cliente === 'parceiro' && !isAddressFromCep ? 'focus:border-purple-500' : ''}`} 
                  placeholder="Ex: SP" 
                  readOnly={isAddressFromCep}
                />
              </div>

              <div className="col-span-12 md:col-span-5 lg:col-span-4">
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Cidade</label>
                <input 
                  type="text" 
                  value={enderecoCidade} 
                  onChange={e => setEnderecoCidade(toUpperCase(e.target.value))} 
                  className={`w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none transition-all ${isAddressFromCep ? 'bg-blue-500/[0.03] border-blue-500/30 font-black text-blue-500 cursor-default' : 'focus:border-blue-500'} ${tipo_cliente === 'parceiro' && !isAddressFromCep ? 'focus:border-purple-500' : ''}`} 
                  placeholder="Ex: São Paulo" 
                  readOnly={isAddressFromCep}
                />
              </div>

              <div className="col-span-12 md:col-span-4 lg:col-span-6">
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">
                  {pais === 'Brasil' ? 'Bairro' : 'Bairro / Distrito'}
                </label>
                <input 
                  type="text" 
                  value={enderecoBairro} 
                  onChange={e => setEnderecoBairro(toUpperCase(e.target.value))} 
                  className={`w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none transition-all ${isAddressFromCep ? 'bg-blue-500/[0.03] border-blue-500/30 font-black text-blue-500 cursor-default' : 'focus:border-blue-500'} ${tipo_cliente === 'parceiro' && !isAddressFromCep ? 'focus:border-purple-500' : ''}`} 
                  placeholder="Ex: Centro" 
                  readOnly={isAddressFromCep}
                />
              </div>

              <div className="col-span-12 md:col-span-9 lg:col-span-10">
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Logradouro / Rua</label>
                <input 
                  type="text" 
                  value={enderecoRua} 
                  onChange={e => setEnderecoRua(toUpperCase(e.target.value))} 
                  className={`w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none transition-all ${isAddressFromCep ? 'bg-blue-500/[0.03] border-blue-500/30 font-black text-blue-500 cursor-default' : 'focus:border-blue-500'} ${tipo_cliente === 'parceiro' && !isAddressFromCep ? 'focus:border-purple-500' : ''}`} 
                  placeholder="Rua, Av, Travessa..." 
                  readOnly={isAddressFromCep}
                />
              </div>

              <div className="col-span-12 md:col-span-3 lg:col-span-2">
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Número</label>
                <input 
                  type="text" 
                  value={enderecoNumero} 
                  onChange={e => setEnderecoNumero(e.target.value)} 
                  className={`w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none font-bold transition-all shadow-sm ${tipo_cliente === 'parceiro' ? 'focus:border-purple-500' : 'focus:border-blue-500'}`} 
                  placeholder="Ex: 123" 
                />
              </div>

              <div className="col-span-12">
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Complemento (Bloco, Apto, Sala...)</label>
                <input 
                  type="text" 
                  value={enderecoComplemento} 
                  onChange={e => setEnderecoComplemento(e.target.value)} 
                  className={`w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none transition-all ${tipo_cliente === 'parceiro' ? 'focus:border-purple-500' : 'focus:border-blue-500'}`} 
                  placeholder="Opcional" 
                />
              </div>
            </div>
          </section>


          <div className="flex justify-end pt-4">
            {isEdit && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="mr-auto px-6 py-3 text-red-500 font-bold hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Excluir Cadastro
              </button>
            )}
          </div>

        </form>
      </div>

      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Excluir Cadastro"
        message={`Tem certeza que deseja excluir "${name}" ? `}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        confirmText={loading ? 'Excluindo...' : 'Excluir'}
        confirmColor="red"
        disabled={loading}
      />
    </div>
  );
};

export default ClientForm;
