import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { generateOrganizationTheme, updateOrganizationTheme } from '@/services/api';
import { Palette, Wand2, Save, X, Moon, Sun, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Componente Editor de Tema da Organização.
 * Permite que administradores customizem a identidade visual do tenant.
 */
const ThemeEditor = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    const { organization, isAdmin } = useAuth();
    const [colors, setColors] = useState({
        themePrimary: '#1e293b',
        themeSecondary: '#334155',
        themeAccent: '#6366f1',
        themeMode: 'dark' as 'dark' | 'light'
    });
    const [loading, setLoading] = useState(false);

    // Sincroniza estado inicial com a organização
    useEffect(() => {
        if (organization) {
            setColors({
                themePrimary: organization.theme_primary || '#1e293b',
                themeSecondary: organization.theme_secondary || '#334155',
                themeAccent: organization.theme_accent || '#6366f1',
                themeMode: (organization.theme_mode as 'dark' | 'light') || 'dark'
            });
        }
    }, [organization, isOpen]);

    if (!isAdmin || !organization) return null;

    /**
     * Gera cores automaticamente usando a logo.
     */
    const handleGenerate = async () => {
        setLoading(true);
        try {
            const result = await generateOrganizationTheme(organization.id);
            setColors(prev => ({
                ...prev,
                themePrimary: result.themePrimary,
                themeSecondary: result.themeSecondary,
                themeAccent: result.themeAccent
            }));
            // Feedback visual de sucesso (opcional)
        } catch (err) {
            console.error('[ThemeEditor] Falha ao gerar tema:', err);
            alert('Não foi possível gerar as cores da logo. Verifique se a URL da logo está correta.');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Salva as configurações permanentemente.
     */
    const handleSave = async () => {
        setLoading(true);
        try {
            await updateOrganizationTheme(organization.id, colors);
            // Idealmente usaríamos um sistema de notificação global
            onClose();
            // Recarrega para que todos os componentes e o root CSS variáveis sejam atualizados
            window.location.reload();
        } catch (err) {
            console.error('[ThemeEditor] Falha ao salvar tema:', err);
            alert('Erro ao salvar as configurações de tema.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-end">
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
                    />

                    {/* Drawer Content */}
                    <motion.div 
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="relative w-full max-w-sm h-full bg-[var(--surface)] shadow-2xl border-l border-[var(--border)] flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[var(--primary-soft)] rounded-lg">
                                    <Palette className="w-5 h-5 text-[var(--primary)]" />
                                </div>
                                <h2 className="text-xl font-bold">Tema da Empresa</h2>
                            </div>
                            <button 
                                onClick={onClose} 
                                className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            {/* Logo AI Sync */}
                            <section>
                                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">Sincronização Inteligente</h3>
                                <div className="p-4 rounded-2xl bg-[var(--primary-soft)] border border-[var(--primary-muted)]">
                                    <p className="text-sm opacity-80 mb-4 leading-relaxed">
                                        Extraia as cores automaticamente da logo da sua organização para manter a consistência visual.
                                    </p>
                                    <button 
                                        onClick={handleGenerate}
                                        disabled={loading}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--primary)] text-white rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none shadow-md"
                                    >
                                        <Wand2 className="w-4 h-4" />
                                        {loading ? 'Analisando Logo...' : 'Gerar pela Logo'}
                                    </button>
                                </div>
                            </section>

                            {/* Color Inputs */}
                            <section className="space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">Customização Manual</h3>
                                
                                <ColorField 
                                    label="Cor Primária (Brand)"
                                    value={colors.themePrimary}
                                    onChange={(v) => setColors({...colors, themePrimary: v})}
                                />

                                <ColorField 
                                    label="Cor Secundária (Sidebar)"
                                    value={colors.themeSecondary}
                                    onChange={(v) => setColors({...colors, themeSecondary: v})}
                                />

                                <ColorField 
                                    label="Cor de Destaque (Accent)"
                                    value={colors.themeAccent}
                                    onChange={(v) => setColors({...colors, themeAccent: v})}
                                />
                            </section>

                            {/* Mode Toggle */}
                            <section>
                                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">Modo Visual Padrão</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => setColors({...colors, themeMode: 'light'})}
                                        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${colors.themeMode === 'light' ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-sm' : 'border-[var(--border)] opacity-60'}`}
                                    >
                                        <Sun className="w-5 h-5" />
                                        <span className="text-xs font-bold uppercase">Claro</span>
                                    </button>
                                    <button 
                                        onClick={() => setColors({...colors, themeMode: 'dark'})}
                                        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${colors.themeMode === 'dark' ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-sm' : 'border-[var(--border)] opacity-60'}`}
                                    >
                                        <Moon className="w-5 h-5" />
                                        <span className="text-xs font-bold uppercase">Escuro</span>
                                    </button>
                                </div>
                            </section>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-[var(--border)] bg-[var(--surface-elevated)]">
                            <button 
                                onClick={handleSave}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 py-4 bg-[var(--primary)] text-white rounded-2xl font-bold shadow-lg shadow-[var(--primary-soft)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                            >
                                <Save className="w-5 h-5" />
                                {loading ? 'Sincronizando...' : 'Salvar Alterações'}
                            </button>
                            <p className="text-[10px] text-center mt-3 opacity-40 uppercase tracking-tighter">As alterações afetam todos os usuários da organização.</p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

// Componente auxiliar para Input de Cor
const ColorField = ({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) => (
    <div className="space-y-2">
        <label className="text-xs font-bold block ml-1">{label}</label>
        <div className="flex gap-2">
            <div className="relative group overflow-hidden">
                <input 
                    type="color" 
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-12 h-12 rounded-xl border-none cursor-pointer bg-transparent scale-150"
                />
            </div>
            <div className="flex-1 border border-[var(--border)] rounded-xl flex items-center px-3 bg-[var(--surface-2)]">
                <span className="text-xs font-bold opacity-30 mr-2">HEX</span>
                <input 
                    type="text" 
                    value={value.toUpperCase()}
                    onChange={(e) => onChange(e.target.value)}
                    className="bg-transparent border-none w-full font-mono text-sm uppercase focus:outline-none"
                    maxLength={7}
                />
            </div>
        </div>
    </div>
);

export default ThemeEditor;
