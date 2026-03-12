// components/ClientForm.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataController } from '@/controllers/useDataController';
import { Save, Upload, Trash2, Handshake, Building2, User, Mail, Phone, Calendar, DollarSign, FileText } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import BackButton from './shared/BackButton';

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

  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryTipo = urlParams.get('tipo') as 'parceiro' | 'cliente_final';
    if (queryTipo) setTipoCliente(queryTipo);
  }, []);

  useEffect(() => {
    if (client) {
      setName(client.name);
      setLogoUrl(client.logoUrl || '');
      setCnpj(client.cnpj || '');
      setTipoCliente(client.tipo_cliente || 'cliente_final');
      setPartnerId(client.partner_id || '');
      setResponsavelInternoId(client.responsavel_interno_id || '');

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

    try {
      setLoading(true);

      const payload = {
        name,
        logoUrl,
        cnpj,
        tipo_cliente,
        partner_id: tipo_cliente === 'cliente_final' ? partner_id : null,
        responsavel_interno_id: responsavel_interno_id || null,

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
        await createClient({
          ...payload,
          active: true,
          // Pass extra data if your createClient supports it, or use standard fields
        });
        alert(`${tipo_cliente === 'parceiro' ? 'Parceiro' : 'Cliente'} criado com sucesso!`);
      }
      const returnTo = new URLSearchParams(window.location.search).get('returnTo');
      const subTab = new URLSearchParams(window.location.search).get('sub');
      if (returnTo) {
        navigate(`/admin/clients?partnerId=${returnTo}${subTab ? `&sub=${subTab}` : ''}`);
      } else {
        navigate('/admin/clients');
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
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">

          {/* -- FIELDS FOR PARTNER -- */}
          {tipo_cliente === 'parceiro' && (
            <>
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Handshake className="w-4 h-4 text-purple-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Dados da Consultoria</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Nome Fantasia (Parceiro) *</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl font-bold text-[var(--text)] focus:ring-2 focus:ring-purple-500 outline-none" placeholder="Ex: Tech Solutions Consultoria" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">CNPJ</label>
                    <input type="text" value={cnpj} onChange={e => setCnpj(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] focus:ring-2 focus:ring-purple-500 outline-none" placeholder="00.000.000/0001-00" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">URL do Logo</label>
                    <div className="flex gap-2">
                      <input type="text" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className="flex-1 p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] focus:ring-2 focus:ring-purple-500 outline-none" placeholder="https://..." />
                      {logoUrl && <img src={logoUrl} alt="Preview" className="w-12 h-12 object-contain bg-white rounded-lg border p-1" />}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-purple-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Pontos de Contato (Parceiro)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Responsável Comercial</label>
                    <input type="text" value={responsavelComercial} onChange={e => setResponsavelComercial(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-purple-500" placeholder="Nome do contato principal" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Email Comercial</label>
                    <input type="email" value={emailComercial} onChange={e => setEmailComercial(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-purple-500" placeholder="contato@consultoria.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Email Financeiro (Faturamento)</label>
                    <input type="email" value={emailFinanceiro} onChange={e => setEmailFinanceiro(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-purple-500" placeholder="financeiro@consultoria.com" />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-purple-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Dados Contratuais</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Início Vigência</label>
                    <input type="date" value={contractStart} onChange={e => setContractStart(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Fim Vigência (Opcional)</label>
                    <input type="date" value={contractEnd} onChange={e => setContractEnd(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none" />
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Nome da Empresa *</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl font-bold text-[var(--text)] focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Indústria XYZ S.A." required />
                  </div>
                  <div className="col-span-2">
                    {/* VINCULO COM PARCEIRO - CRUCIAL */}
                    <label className="block text-xs font-bold text-blue-500 mb-2 uppercase tracking-wide">Vinculado ao Parceiro (Quarterização)</label>
                    <select
                      value={partner_id}
                      onChange={e => setPartnerId(e.target.value)}
                      className="w-full p-4 bg-[var(--bg)] border-2 border-blue-500/20 rounded-xl text-[var(--text)] font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Sem Parceiro (Cliente Direto)</option>
                      {clients.filter(c => c.tipo_cliente === 'parceiro').map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Parceiro)</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-[var(--muted)] mt-1.5 ml-1">Selecione a consultoria que trouxe este cliente (se houver).</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Segmento / Indústria</label>
                    <input type="text" value={segmento} onChange={e => setSegmento(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Varejo, Bancário..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">CNPJ</label>
                    <input type="text" value={cnpj} onChange={e => setCnpj(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] focus:ring-2 focus:ring-blue-500 outline-none" placeholder="00.000.000/0001-00" />
                  </div>
                  <div>
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
                  <User className="w-4 h-4 text-blue-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Responsáveis no Cliente</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Product Owner / Contato Principal</label>
                    <input type="text" value={responsavelProduto} onChange={e => setResponsavelProduto(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-blue-500" placeholder="Nome do PO" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Email do PO</label>
                    <input type="email" value={emailProduto} onChange={e => setEmailProduto(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-blue-500" placeholder="po@cliente.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Responsável Técnico (Opcional)</label>
                    <input type="text" value={responsavelTecnico} onChange={e => setResponsavelTecnico(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-blue-500" placeholder="Tech Lead do cliente" />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Dados Contratuais (Opcional)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Início Vigência (Projeto Único)</label>
                    <input type="date" value={contractStart} onChange={e => setContractStart(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Fim Vigência (Previsão)</label>
                    <input type="date" value={contractEnd} onChange={e => setContractEnd(e.target.value)} className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none" />
                  </div>
                </div>
              </section>
            </>
          )}

          {/* -- INTERNAL MANAGEMENT (COMMON) -- */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-[var(--text)]" />
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Gestão Interna (Nossa Equipe)</h3>
            </div>
            <div className="p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Gestor da Conta / PMO Responsável</label>
              <select
                value={responsavel_interno_id}
                onChange={e => setResponsavelInternoId(e.target.value)}
                className="w-full p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] focus:ring-2 focus:ring-[var(--brand)] outline-none"
              >
                <option value="">Selecione um gestor interno...</option>
                {users.filter(u => u.active !== false).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
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
