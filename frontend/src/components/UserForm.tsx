// components/UserForm.tsx - Adaptado para Router
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataController } from '@/controllers/useDataController';
import { formatDecimalToTime } from '@/utils/normalizers';
import { User, Role } from '@/types';
import { ArrowLeft, Save, User as UserIcon, Shield, Zap, Info, LayoutGrid, AlertTriangle } from 'lucide-react';
import OrganizationalStructureSelector from './OrganizationalStructureSelector';
import * as CapacityUtils from '@/utils/capacity';

const UserForm: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { users, holidays, createUser, updateUser } = useDataController();

  const isNew = !userId || userId === 'new';
  const initialUser = !isNew ? users.find(u => u.id === userId) : undefined;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cargo: '',
    nivel: '',
    role: 'developer' as Role,
    active: true,
    avatarUrl: '',
    torre: '',
    hourlyCost: 0,
    dailyAvailableHours: 8,
    monthlyAvailableHours: 160,
    atrasado: false
  });

  useEffect(() => {
    if (initialUser) {
      setFormData({
        name: initialUser.name,
        email: initialUser.email,
        cargo: initialUser.cargo || '',
        nivel: initialUser.nivel || '',
        role: initialUser.role,
        active: initialUser.active !== false,
        avatarUrl: initialUser.avatarUrl || '',
        torre: initialUser.torre || '',
        hourlyCost: initialUser.hourlyCost || 0,
        dailyAvailableHours: initialUser.dailyAvailableHours || 8,
        monthlyAvailableHours: initialUser.monthlyAvailableHours || 160,
        atrasado: !!initialUser.atrasado
      });
    }
  }, [initialUser]);

  // Sincronizar Horas Mês automaticamente apenas se estiver zerado ou se a carga diária mudar
  // Mas permite edição manual
  useEffect(() => {
    if (formData.dailyAvailableHours > 0) {
      const currentMonthStr = new Date().toISOString().slice(0, 7);
      const workingDays = CapacityUtils.getWorkingDaysInMonth(currentMonthStr, holidays || []);
      const calculatedMonthly = (formData.dailyAvailableHours || 0) * workingDays;

      if (!formData.monthlyAvailableHours || formData.monthlyAvailableHours === 0) {
        setFormData(prev => ({ ...prev, monthlyAvailableHours: calculatedMonthly }));
      }
    }
  }, [formData.dailyAvailableHours, holidays]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!formData.name || !formData.email) {
      alert('Por favor, preencha nome e email.');
      return;
    }

    setLoading(true);
    try {
      if (isNew) {
        await createUser(formData as any);
      } else {
        await updateUser(userId!, formData as any);
      }
      navigate(-1);
    } catch (error: any) {
      console.error(error);
      alert('Erro ao salvar colaborador: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isNew && !initialUser) {
    return <div className="p-8 text-xs font-bold text-[var(--muted)]">Colaborador não encontrado.</div>;
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg)]">
      {/* Header Compacto - Estilo Premium */}
      <div className="px-8 py-5 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-[var(--surface-2)] rounded-xl transition-colors text-[var(--muted)]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-black text-[var(--text)] tracking-tight leading-tight">
              {isNew ? 'Novo Integrante' : 'Editar Integrante'}
            </h2>
            <p className="text-[var(--muted)] text-[10px] font-black uppercase tracking-widest mt-1 opacity-70">
              {isNew ? 'Cadastro Institucional de Equipe' : formData.name}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleSave()}
          disabled={loading}
          className="px-6 py-2.5 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-black/5 transition-all flex items-center gap-2 disabled:opacity-50 hover:opacity-90"
          style={{ backgroundColor: 'var(--text)' }}
        >
          {loading ? (
            <span className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Salvando</span>
          ) : (
            <><Save className="w-4 h-4" /> {isNew ? 'Criar Cadastro' : 'Confirmar Tudo'}</>
          )}
        </button>
      </div>

      {/* Form Area */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-3xl mx-auto">
          <div className="ui-card p-10 space-y-10">

            {/* Avatar e Nome Principal */}
            <div className="flex items-center gap-8">
              <div className="w-24 h-24 rounded-3xl bg-[var(--surface-2)] flex items-center justify-center border-4 border-[var(--surface)] shadow-lg overflow-hidden text-2xl font-black text-[var(--muted)]">
                {formData.avatarUrl ? (
                  <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  formData.name ? formData.name.substring(0, 2).toUpperCase() : <UserIcon className="w-10 h-10" />
                )}
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Nome Completo</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--text)] focus:ring-2 focus:ring-[var(--primary)]/20 outline-none transition-all"
                    placeholder="Ex: Ricardo Duraes"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">E-mail Corporativo</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--text)] focus:ring-2 focus:ring-[var(--primary)]/20 outline-none transition-all"
                    placeholder="email@nic-labs.com.br"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Estrutura Organizacional */}
            <div className="pt-10 border-t border-[var(--border)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black text-[var(--text)] uppercase tracking-widest">Enquadramento e Especialidade</h3>
              </div>
              <OrganizationalStructureSelector
                initialCargo={formData.cargo}
                initialLevel={formData.nivel}
                initialTorre={formData.torre}
                existingCargos={Array.from(new Set(users.map(u => u.cargo).filter(Boolean)))}
                onChange={({ cargo, nivel, torre }) => setFormData(prev => ({ ...prev, cargo, nivel, torre }))}
              />
            </div>

            {/* Acesso e Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-10 border-t border-[var(--border)]">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Nível de Permissão</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-sm font-black text-[var(--text)] focus:ring-2 focus:ring-[var(--primary)]/20 outline-none transition-all"
                >
                  <option value="developer">Padrão</option>
                  <option value="tech_lead">Tech Lead / Liderança</option>
                  <option value="pmo">Planejamento / PMO</option>
                  <option value="executive">Gestão Executiva</option>
                  <option value="system_admin">Admin TI / Suporte</option>
                  <option value="ceo">Presidência</option>
                </select>
              </div>
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Configurações de Fluxo e Acesso</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* TOGGLE: PARTICIPAR DO FLUXO */}
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, torre: prev.torre === 'N/A' ? '' : 'N/A' }))}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${formData.torre !== 'N/A' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className={`w-4 h-4 ${formData.torre !== 'N/A' ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{formData.torre !== 'N/A' ? 'No Fluxo' : 'Fora do Fluxo'}</span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${formData.torre !== 'N/A' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                  </button>

                  {/* TOGGLE: DESLIGAR COLABORADOR */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, active: !formData.active })}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${formData.active ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-red-50 border-red-200 text-red-700'}`}
                  >
                    <div className="flex items-center gap-2">
                      <Shield className={`w-4 h-4 ${formData.active ? 'text-blue-500' : 'text-red-500'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{formData.active ? 'Ativo' : 'Desligar'}</span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${formData.active ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`}></div>
                  </button>

                  {/* TOGGLE: ATRASADO */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, atrasado: !formData.atrasado })}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${formData.atrasado ? 'bg-red-50 border-red-200 text-red-700 shadow-inner' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`w-4 h-4 ${formData.atrasado ? 'text-red-500' : 'text-slate-400'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{formData.atrasado ? 'Com Atraso' : 'Em Dia'}</span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${formData.atrasado ? 'bg-red-500 animate-pulse' : 'bg-slate-400'}`}></div>
                  </button>
                </div>
              </div>
            </div>

            {/* Financeiro e Metas */}
            <div className="p-6 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-500" /> Métricas e Cargas Horárias
                </h4>
                <div className="p-1 rounded bg-[var(--surface)] border border-[var(--border)] text-[9px] font-black text-[var(--muted)] uppercase px-2">Privado</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-[var(--muted)] uppercase tracking-widest">Custo Hora (Interno)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 text-xs font-black">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.hourlyCost || ''}
                      onChange={(e) => setFormData({ ...formData, hourlyCost: e.target.value === '' ? 0 : Number(e.target.value) })}
                      className="w-full pl-10 pr-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm font-black text-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-[var(--muted)] uppercase tracking-widest">Avatar Personalizado (URL)</label>
                  <input
                    type="text"
                    value={formData.avatarUrl}
                    onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[10px] font-mono text-[var(--muted)]"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-[var(--muted)] uppercase tracking-widest">Carga Horária (Dia)</label>
                  <input
                    type="number"
                    value={formData.dailyAvailableHours || ''}
                    onChange={(e) => setFormData({ ...formData, dailyAvailableHours: e.target.value === '' ? 0 : Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm font-black text-[var(--text)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-[var(--muted)] uppercase tracking-widest">Hrs Meta Mês</label>
                  <input
                    type="number"
                    value={formData.monthlyAvailableHours || ''}
                    onChange={(e) => setFormData({ ...formData, monthlyAvailableHours: e.target.value === '' ? 0 : Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm font-black text-[var(--text)] focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                  />
                  <p className="text-[7px] font-bold opacity-40 mt-1 uppercase">
                    Ref: {new Date().toLocaleString('pt-BR', { month: 'short' }).replace('.', '')} | Sugerido: {formatDecimalToTime(CapacityUtils.getWorkingDaysInMonth(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`, holidays || []) * (formData.dailyAvailableHours || 8))}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-start p-4 bg-amber-500/5 rounded-xl border border-amber-500/10">
                <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 font-medium leading-relaxed italic">Estes dados são utilizados para o cálculo de IDL (Índice de Lucratividade) e monitoramento de capacidade. Somente administradores do sistema têm visibilidade total destes campos.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserForm;
