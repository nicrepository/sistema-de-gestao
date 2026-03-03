import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, BookOpen, Target, Zap, Activity, Users,
    BarChart, TrendingUp, AlertTriangle, CheckCircle2,
    Info, ShieldCheck, PieChart, MousePointer2, Settings,
    ArrowRight, Sparkles, Layout, Globe, HelpCircle,
    Scale, Calendar, Rocket, RefreshCcw, Binary, Search,
    XCircle, Award, ListChecks, Layers
} from 'lucide-react';

interface CapacityDocumentationProps {
    isOpen: boolean;
    onClose: () => void;
}

const CapacityDocumentation: React.FC<CapacityDocumentationProps> = ({ isOpen, onClose }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-950/95 backdrop-blur-2xl"
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 30, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.95, y: 30, opacity: 0 }}
                        className="relative w-full max-w-7xl max-h-[92vh] bg-slate-900 border border-white/10 rounded-[48px] shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
                    >
                        {/* Background Decorations */}
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/10 blur-[120px] pointer-events-none" />

                        {/* Header */}
                        <div className="relative z-10 p-8 border-b border-white/5 flex items-center justify-between bg-white/5 sticky top-0 backdrop-blur-xl">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/30">
                                    <BookOpen className="text-white w-7 h-7" />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">
                                        📘 Documentação Estratégica
                                    </h2>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Gestão de Capacidade</span>
                                        <div className="w-1 h-1 rounded-full bg-white/20" />
                                        <span className="text-[10px] font-black text-purple-400 uppercase tracking-[0.3em]">Simulação Comercial</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/5 shadow-inner group"
                            >
                                <X className="w-7 h-7 group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        </div>

                        {/* Content Body */}
                        <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar p-8 md:p-16 space-y-32">

                            {/* 1. VISÃO GERAL */}
                            <section className="space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest">
                                        Introdução
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
                                    <div className="space-y-6">
                                        <h3 className="text-5xl font-black text-white uppercase italic leading-[0.9] tracking-tighter">
                                            O Twin Digital da sua <br />
                                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Operação Consultiva</span>
                                        </h3>
                                        <p className="text-slate-400 text-lg font-medium leading-relaxed italic border-l-4 border-blue-500/30 pl-8">
                                            A plataforma é um sistema de Planejamento Estratégico de Capacidade Operacional, desenhado para conectar o fechamento de um contrato com o chão de fábrica.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="p-6 rounded-[32px] bg-white/5 border border-white/5 space-y-4">
                                            <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                                <Target className="w-4 h-4 text-blue-400" /> Objetivos de Negócio
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                                                {[
                                                    'Visualizar ocupação real',
                                                    'Prever datas realistas',
                                                    'Detectar riscos estruturais',
                                                    'Simular novos contratos',
                                                    'Decidir com previsibilidade'
                                                ].map((item, i) => (
                                                    <div key={i} className="flex items-center gap-3 text-[11px] font-black text-slate-300 uppercase tracking-tight">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {item}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* 📐 REGRAS DE NEGÓCIO OFICIAIS (Total 11 rules) */}
                            <section className="space-y-16">
                                <div className="p-12 rounded-[56px] bg-slate-950 border border-white/5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-12 opacity-5 text-white">
                                        <Binary className="w-64 h-64" />
                                    </div>

                                    <div className="text-center space-y-4 mb-16 relative z-10">
                                        <h3 className="text-3xl font-black text-white uppercase italic tracking-widest">
                                            📐 Regras de Negócio Oficiais
                                        </h3>
                                        <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.4em]">A Matemática por trás do Sucesso</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                                        {[
                                            { n: '1', t: 'Capacidade Base', c: 'Cálculo derivado de Cap. Diária × Dias Úteis do período. Limite máximo imutável.' },
                                            { n: '2', t: 'Tipos de Projeto', c: 'Planejados consomem apenas a margem livre. Projetos de Sustentação são prioridade estrutural.' },
                                            { n: '3', t: 'Alocação Proporcional', c: 'Compromisso de Reserva = Capacidade ÷ Membros. Valor dinâmico e auditável.' },
                                            { n: '4', t: 'Previsão Realista', c: 'Logic: Esforço Restante ÷ (Capacidade - Compromisso de Reserva).' },
                                            { n: '5', t: 'Saturação Estrutural', c: 'Ocorre quando as Atividades de Reserva ocupam 100% da carga diária.' },
                                            { n: '6', t: 'Bloqueio de Projeto', c: 'Ativado automaticamente quando 100% do time alocado está saturado.' },
                                            { n: '7', t: 'Elasticidade', c: 'Buffer real de absorção. Risco crítico quando abaixo de 15%.' },
                                            { n: '8', t: 'Trend Forecast', c: 'Projeção futura de 90 dias baseada no encerramento gradual de backlogs.' },
                                            { n: '9', t: 'Simulador Comercial', c: 'Ambiente "What-If" que aplica as mesmas regras sem alterar dados reais.' },
                                            { n: '10', t: 'Reatividade Total', c: 'Recálculo em tempo real (Realtime) a cada apontamento ou alteração.' },
                                            { n: '11', t: 'Transparência de Carga', c: 'Não há mascaramento ou reservas artificiais. O sistema expõe o risco.' }
                                        ].map((rule) => (
                                            <div key={rule.n} className="p-6 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all space-y-3 group">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md">{rule.n}</span>
                                                    <h5 className="text-[11px] font-black text-white uppercase tracking-widest group-hover:text-blue-400 transition-colors">{rule.t}</h5>
                                                </div>
                                                <p className="text-[10px] text-slate-400 leading-relaxed italic">{rule.c}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            {/* 3. MOTOR & CONCEITOS (Merging the two lists) */}
                            <section className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                                <div className="space-y-12">
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3">
                                            <Settings className="w-5 h-5 text-orange-400" />
                                            <h4 className="text-xl font-black text-white uppercase italic tracking-wider italic">O Motor de Cálculo</h4>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="p-8 rounded-[40px] bg-white/5 border border-white/5 space-y-4">
                                                <h5 className="text-xs font-black text-blue-400 uppercase tracking-widest underline underline-offset-4 decoration-blue-500/30">Previsão Dual</h5>
                                                <div className="grid grid-cols-2 gap-8">
                                                    <div className="space-y-2">
                                                        <p className="text-[11px] font-black text-white uppercase">1. Previsão Ideal</p>
                                                        <p className="text-[10px] text-slate-400 italic">"Qual a menor data tecnicamente possível?" (100% de foco)</p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-[11px] font-black text-emerald-400 uppercase">2. Previsão Realista</p>
                                                        <p className="text-[10px] text-slate-400 italic">"Quando será entregue de fato?" (Considera operação contínua)</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-8 rounded-[40px] bg-white/5 border border-white/5 space-y-4">
                                                <h5 className="text-xs font-black text-amber-400 uppercase tracking-widest underline underline-offset-4 decoration-amber-500/30">Compromisso Estrutural</h5>
                                                <p className="text-[11px] text-slate-400 leading-relaxed italic">
                                                    O sistema não aceita percentuais fixos. Se um projeto contínuo tem 4 pessoas, cada uma "perde" 25% de sua capacidade (ex: 2h de 8h).
                                                </p>
                                                <div className="flex gap-4">
                                                    <div className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-2"> <ArrowRight className="w-3 h-3" /> Aloca Dinamicamente </div>
                                                    <div className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-2"> <ArrowRight className="w-3 h-3" /> Automatiza Gestão </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div className="p-10 rounded-[48px] bg-gradient-to-br from-red-600 to-orange-700 text-white shadow-2xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-8 opacity-20">
                                            <AlertTriangle className="w-48 h-48" />
                                        </div>
                                        <div className="relative z-10 space-y-6">
                                            <h4 className="text-sm font-black uppercase tracking-[0.3em]">Gestão de Riscos</h4>
                                            <h3 className="text-4xl font-black italic uppercase leading-none">Saturação & <br />Gargalos</h3>
                                            <div className="space-y-4 text-xs font-bold leading-relaxed opacity-90 italic border-l border-white/30 pl-6">
                                                <p>Saturação: Quando compromisso contínuo ≥ capacidade total.</p>
                                                <p>Bloqueio: Quando 100% do time alocado no projeto está saturado.</p>
                                                <p className="pt-2 text-[10px] uppercase font-black tracking-widest">O sistema não mascara o problema. Ele expõe a falha estrutural.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* 7. SIMULADOR & MAPA (Merging Section 7 & 8) */}
                            <section className="space-y-12">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Simulador Card */}
                                    <div className="p-12 rounded-[56px] bg-gradient-to-br from-blue-700 to-indigo-800 text-white relative overflow-hidden group/sim shadow-2xl shadow-blue-500/20">
                                        <div className="absolute top-0 right-0 p-12 opacity-10 group-hover/sim:rotate-12 transition-transform duration-500">
                                            <Zap className="w-64 h-64" />
                                        </div>
                                        <div className="relative z-10 space-y-8">
                                            <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-[9px] font-black uppercase tracking-widest text-blue-200">What-If Analysis</span>
                                            <h3 className="text-4xl font-black italic uppercase leading-none">Simulador Comercial</h3>
                                            <p className="text-sm font-medium opacity-80 leading-relaxed italic border-l-2 border-white/20 pl-6">
                                                Permite simular o acréscimo de centenas de horas e ver quem será afetado, quantos dias o backlog será deslocado e quem entrará em saturação crítica.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Mapa & Reatividade Card */}
                                    <div className="p-12 rounded-[56px] bg-slate-900 border border-white/10 relative overflow-hidden shadow-xl">
                                        <div className="absolute top-0 right-0 p-12 opacity-5">
                                            <Layers className="w-48 h-48" />
                                        </div>
                                        <div className="relative z-10 space-y-8">
                                            <div className="flex items-center gap-3">
                                                <Activity className="w-5 h-5 text-emerald-400" />
                                                <h4 className="text-lg font-black text-white uppercase tracking-widest italic">Mapa & Reatividade</h4>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0"> <RefreshCcw className="w-4 h-4 text-emerald-400" /> </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[11px] font-black text-white uppercase">Reatividade Automática</p>
                                                        <p className="text-[10px] text-slate-500 leading-relaxed italic">Cálculos atualizados em tempo real a cada apontamento de horas ou conclusão de tarefa.</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-4">
                                                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0"> <PieChart className="w-4 h-4 text-blue-400" /> </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[11px] font-black text-white uppercase">Visualização de Saldo</p>
                                                        <p className="text-[10px] text-slate-500 leading-relaxed italic">Controle total sobre Horas Planejadas vs Horas Contínuas vs Saldo Disponível.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* 10, 11, 12: ESTRATÉGIA & DEFINIÇÃO */}
                            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                <div className="p-8 rounded-[40px] bg-white/5 border border-white/5 space-y-6">
                                    <h5 className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 italic">
                                        <Scale className="w-4 h-4" /> Perguntas Chave
                                    </h5>
                                    <div className="space-y-3">
                                        {[
                                            'Quando podemos iniciar o próximo projeto?',
                                            'Temos braço para demanda urgente?',
                                            'Qual o custo de aceitar esse contrato?',
                                            'A saturação é temporária ou estrutural?'
                                        ].map((q, i) => (
                                            <div key={i} className="p-3 rounded-2xl bg-white/5 border border-white/5 text-[10px] font-bold text-slate-300 italic group hover:bg-white/10 transition-all">
                                                "{q}"
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-8 rounded-[40px] bg-emerald-500/5 border border-emerald-500/20 space-y-6">
                                    <h5 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2 italic">
                                        <Award className="w-4 h-4" /> Benefícios Diretos
                                    </h5>
                                    <div className="space-y-3">
                                        {[
                                            'Redução de atrasos inesperados',
                                            'Previsibilidade de entrega auditável',
                                            'Decisão comercial com base em dados',
                                            'Equilíbrio entre operação e crescimento'
                                        ].map((b, i) => (
                                            <div key={i} className="flex items-center gap-3 text-[10px] font-black text-slate-200 uppercase tracking-tight">
                                                <ListChecks className="w-4 h-4 text-emerald-500" /> {b}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-8 rounded-[40px] bg-slate-950/50 border border-white/5 flex flex-col justify-between">
                                    <div className="space-y-6">
                                        <h5 className="text-xs font-black text-[var(--muted)] uppercase tracking-widest flex items-center gap-2 italic italic">
                                            <Binary className="w-4 h-4" /> O que é o Twin Digital?
                                        </h5>
                                        <div className="space-y-4">
                                            <div className="flex gap-3 items-start">
                                                <Search className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                                <p className="text-[10px] font-bold text-slate-400">NÃO É apenas um gestor de tarefas ou controle de horas.</p>
                                            </div>
                                            <div className="flex gap-3 items-start">
                                                <Rocket className="w-4 h-4 text-purple-400 flex-shrink-0" />
                                                <p className="text-[10px] font-bold text-slate-300 italic uppercase tracking-tight">É UM radar de risco operacional e um simulador estratégico de vendas.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-center pt-8 opacity-20 grayscale hover:grayscale-0 transition-all">
                                        <ShieldCheck className="w-12 h-12 text-blue-500" />
                                    </div>
                                </div>
                            </section>

                            {/* Footer */}
                            <footer className="pt-16 border-t border-white/5 flex flex-col items-center gap-10 text-center">
                                <div className="flex flex-wrap justify-center gap-3">
                                    {['Resiliência', 'Previsibilidade', 'Transparência', 'Agilidade', 'Rentabilidade'].map((tag) => (
                                        <span key={tag} className="text-[9px] font-black text-slate-500 uppercase tracking-widest border border-white/10 px-4 py-2 rounded-xl">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">
                                        Documento Unificado de Diretrizes Estratégicas e Regras de Negócio
                                    </p>
                                    <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest">
                                        SISTEMA DE GESTÃO ESTRATÉGICA © 2026 • TODOS OS DIREITOS RESERVADOS
                                    </p>
                                </div>
                            </footer>

                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default CapacityDocumentation;
