// components/OrganizationalStructureSelector.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, CheckCircle2, Info, LayoutGrid, Edit3, Check, Plus } from 'lucide-react';
import { CARGOS, LEVELS, TOWER_GROUPS, getLevelsForCargo, getTowerGroupsForCargo, Level, TowerGroup, Tower, Specialization } from '@/utils/towerConfig';

interface OrganizationalStructureSelectorProps {
    initialCargo?: string;
    initialLevel?: string;
    initialTorre?: string;
    existingCargos?: string[];
    onChange: (data: { cargo: string; nivel: string; torre: string }) => void;
    isEditing?: boolean;
}

const OrganizationalStructureSelector: React.FC<OrganizationalStructureSelectorProps> = ({
    initialCargo = '',
    initialLevel = '',
    initialTorre = '',
    existingCargos = [],
    onChange,
    isEditing = true
}) => {
    const [cargo, setCargo] = useState(initialCargo);
    const [nivel, setNivel] = useState(initialLevel);
    const [torre, setTorre] = useState(initialTorre);
    const [isManualMode, setIsManualMode] = useState(false);

    // Identificar cargos que não estão no config padrão
    const otherCargos = useMemo(() => {
        const standardNames = CARGOS.map(c => c.name);
        return Array.from(new Set(existingCargos))
            .filter(c => c && !standardNames.includes(c))
            .sort((a, b) => a.localeCompare(b));
    }, [existingCargos]);

    useEffect(() => {
        if (initialCargo !== undefined && initialCargo !== cargo) setCargo(initialCargo);
        if (initialLevel !== undefined && initialLevel !== nivel) setNivel(initialLevel);
        if (initialTorre !== undefined && initialTorre !== torre) setTorre(initialTorre);
    }, [initialCargo, initialLevel, initialTorre]);

    // Se já tinha dados que não batem com o config, entra em modo manual por segurança
    useEffect(() => {
        const isStandardCargo = CARGOS.some(c => c.id === initialCargo);
        if (initialCargo && !isStandardCargo && !otherCargos.includes(initialCargo)) {
            setIsManualMode(true);
        }
    }, [initialCargo, otherCargos]);

    const availableLevels = useMemo(() => getLevelsForCargo(cargo), [cargo]);
    const availableTowerGroups = useMemo(() => getTowerGroupsForCargo(cargo), [cargo]);

    const handleCargoChange = (newCargo: string, isOther: boolean = false) => {
        setCargo(newCargo);
        setNivel('');
        setTorre('');
        onChange({ cargo: newCargo, nivel: '', torre: '' });
        if (isOther) {
            setIsManualMode(true);
        }
    };

    const handleLevelChange = (newLevel: string) => {
        setNivel(newLevel);
        setTorre('');
        onChange({ cargo, nivel: newLevel, torre: '' });
    };

    const StepIndicator = ({ title, active, completed, stepNumber, onClick }: { title: string; active: boolean; completed: boolean; stepNumber: number; onClick: () => void }) => (
        <button
            type="button"
            onClick={onClick}
            className={`flex-1 flex items-center justify-center gap-3 py-4 border-b-2 transition-all ${active ? 'border-[var(--primary)] text-[var(--primary)]' :
                completed ? 'border-emerald-500 text-emerald-600' :
                    'border-transparent text-[var(--muted)]'
                }`}
        >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-black ${active ? 'bg-[var(--primary)] text-white' :
                completed ? 'bg-emerald-500 text-white' :
                    'bg-[var(--surface-2)] text-[var(--muted)]'
                }`}>
                {completed ? <Check className="w-4 h-4" /> : stepNumber}
            </div>
            <span className="text-xs font-black uppercase tracking-widest">{title}</span>
        </button>
    );

    if (!isEditing) {
        return (
            <div className="p-4 rounded-2xl border bg-[var(--surface-2)] border-[var(--border)] flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--surface)] flex items-center justify-center text-[var(--primary)] border border-[var(--border)] shadow-sm">
                        <LayoutGrid className="w-5 h-5" />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-black uppercase tracking-wider">
                        <span className="text-[var(--text)]">{cargo || 'Cargo'}</span>
                        <ChevronRight className="w-4 h-4 text-[var(--muted)] opacity-30" />
                        <span className="text-[var(--text)]">{nivel || 'Nível'}</span>
                        <ChevronRight className="w-4 h-4 text-[var(--muted)] opacity-30" />
                        <span className="text-[var(--text-2)]">{torre || 'Especialidade'}</span>
                    </div>
                </div>
            </div>
        );
    }

    if (isManualMode) {
        return (
            <div className="space-y-4 p-5 rounded-2xl border-2 border-dashed border-[var(--primary)] bg-[var(--primary-soft)]/5">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-black text-[var(--primary)] uppercase tracking-widest flex items-center gap-2">
                        <Edit3 className="w-4 h-4" /> Edição Manual Direta
                    </h4>
                    <button type="button" onClick={() => setIsManualMode(false)} className="text-[10px] font-bold text-[var(--muted)] hover:text-red-500 transition-colors">
                        Restaurar Fluxo Padrão
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-[var(--muted)] uppercase mb-1">Cargo / Função</label>
                        <input type="text" value={cargo} onChange={(e) => { setCargo(e.target.value); onChange({ cargo: e.target.value, nivel, torre }); }} className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm font-bold focus:ring-2 focus:ring-[var(--primary)] outline-none" placeholder="Ex: Desenvolvedor Fullstack" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-[var(--muted)] uppercase mb-1">Nível / Senioridade</label>
                        <input type="text" value={nivel} onChange={(e) => { setNivel(e.target.value); onChange({ cargo, nivel: e.target.value, torre }); }} className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm font-bold focus:ring-2 focus:ring-[var(--primary)] outline-none" placeholder="Ex: Pleno II" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-[var(--muted)] uppercase mb-1">Área / Torre</label>
                        <input type="text" value={torre} onChange={(e) => { setTorre(e.target.value); onChange({ cargo, nivel, torre: e.target.value }); }} className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm font-bold focus:ring-2 focus:ring-[var(--primary)] outline-none" placeholder="Ex: Core Banking" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex border-b border-[var(--border)]">
                <StepIndicator stepNumber={1} title="Função" active={!cargo} completed={!!cargo} onClick={() => { setCargo(''); setNivel(''); setTorre(''); onChange({ cargo: '', nivel: '', torre: '' }); }} />
                <StepIndicator stepNumber={2} title="Sênior" active={!!cargo && !nivel} completed={!!nivel} onClick={() => { if (cargo) { setNivel(''); setTorre(''); onChange({ cargo, nivel: '', torre: '' }); } }} />
                <StepIndicator stepNumber={3} title="Área" active={!!nivel && !torre} completed={!!torre} onClick={() => { if (nivel) { setTorre(''); onChange({ cargo, nivel, torre: '' }); } }} />
            </div>

            <div className="min-h-[220px] bg-[var(--surface-2)]/30 rounded-2xl p-6 border border-[var(--border)] relative">
                {!cargo && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Todos os Cargos (Padrão + Customizados) em um único lugar */}
                        {[...CARGOS.map(c => ({ id: c.id, name: c.name, type: 'standard' })),
                        ...otherCargos.map(c => ({ id: c, name: c, type: 'custom' }))]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((c) => (
                                <button
                                    type="button"
                                    key={c.id}
                                    onClick={() => handleCargoChange(c.name, c.type === 'custom')}
                                    className={`px-5 py-4 rounded-xl border-2 transition-all text-left group flex flex-col justify-between h-full ${c.type === 'standard' ? 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] hover:shadow-md' : 'border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-500 hover:shadow-md'}`}
                                >
                                    <span className={`block text-sm font-black uppercase tracking-tight ${c.type === 'standard' ? 'text-[var(--text-2)] group-hover:text-[var(--primary)]' : 'text-indigo-600'}`}>{c.name}</span>
                                    {c.type === 'custom' && <span className="text-[8px] font-black text-indigo-400 mt-2 uppercase tracking-widest">Cargo Customizado</span>}
                                </button>
                            ))}

                        {/* Botão para Novo Cargo - Bem visível */}
                        <button
                            type="button"
                            onClick={() => setIsManualMode(true)}
                            className="px-5 py-4 rounded-xl border-2 border-dashed border-amber-500/30 bg-amber-500/5 text-amber-600 hover:bg-amber-500/10 hover:border-amber-500 transition-all flex flex-col items-center justify-center gap-2 text-center"
                        >
                            <Plus className="w-5 h-5 mb-1" />
                            <span className="text-[10px] font-black uppercase tracking-widest leading-tight">Criar Novo<br />Cargo/Função</span>
                        </button>
                    </div>
                )}

                {cargo && !nivel && (
                    <div className="flex flex-wrap gap-3">
                        {availableLevels.map((l: Level) => (
                            <button
                                type="button"
                                key={l.id}
                                onClick={() => handleLevelChange(l.name)}
                                className="px-6 py-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] hover:text-[var(--primary)] text-xs font-black transition-all shadow-sm hover:translate-y-[-2px]"
                            >
                                {l.name}
                            </button>
                        ))}
                    </div>
                )}

                {nivel && !torre && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {availableTowerGroups.map((group: TowerGroup) => (
                                <div key={group.id} className="space-y-3">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] bg-[var(--surface)] border border-[var(--border)] px-3 py-1 rounded-full w-fit">{group.name}</h5>
                                    <div className="space-y-3">
                                        {group.towers.map((t: Tower) => (
                                            <div key={t.id} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                                                <h6 className="text-xs font-black text-[var(--text)] mb-3 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]"></div>
                                                    {t.name}
                                                </h6>
                                                <div className="flex flex-wrap gap-2">
                                                    {t.specializations.map((spec: Specialization) => (
                                                        <button
                                                            type="button"
                                                            key={spec.id}
                                                            onClick={() => { const newTorre = `${t.name}: ${spec.name}`; setTorre(newTorre); onChange({ cargo, nivel, torre: newTorre }); }}
                                                            className="px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--surface)] text-[10px] font-bold transition-all"
                                                        >
                                                            {spec.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-6 border-t border-[var(--border)] flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Info className="w-4 h-4 text-amber-500" />
                                <p className="text-[11px] text-[var(--muted)] font-medium italic">Se o integrante não fizer parte de nenhuma torre operacional ou for gestão direta:</p>
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setIsManualMode(true)} className="px-4 py-2 text-[10px] font-black text-[var(--muted)] uppercase tracking-wider hover:text-[var(--primary)] transition-colors">Digitar Customizado</button>
                                <button
                                    type="button"
                                    onClick={() => { setTorre('N/A'); onChange({ cargo, nivel, torre: 'N/A' }); }}
                                    className="px-4 py-2 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
                                    style={{ backgroundColor: 'var(--text)' }}
                                >
                                    Pular / N/A
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {torre && (
                    <div className="p-6 rounded-2xl border bg-emerald-500/5 border-emerald-500/20 flex items-center justify-between animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-1">Configuração Concluída</h4>
                                <div className="flex items-center gap-2 text-sm font-black text-emerald-600 dark:text-emerald-400">
                                    <span>{cargo}</span>
                                    <ChevronRight className="w-4 h-4 opacity-40" />
                                    <span>{nivel}</span>
                                    <ChevronRight className="w-4 h-4 opacity-40" />
                                    <span>{torre}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setIsManualMode(true)} className="px-4 py-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:bg-emerald-500/10 rounded-lg transition-colors">Customizar</button>
                            <button type="button" onClick={() => setCargo('')} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all">Trocar Tudo</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrganizationalStructureSelector;
