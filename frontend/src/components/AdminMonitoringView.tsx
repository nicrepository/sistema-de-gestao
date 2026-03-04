import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useDataController } from '@/controllers/useDataController';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabaseClient';
import { Task, Project, User, Client } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { getProjectStatusByTimeline, getProjectStatusColor } from '@/utils/projectStatus';
import {
    Activity,
    Timer,
    Users,
    Zap,
    Cpu,
    Wifi,
    CheckCircle2,
    LayoutGrid,
    Clock,
    Database,
    Cloud,
    Shield,
    Box,
    Maximize,
    AlertCircle,
    Ban,
    Layout,
    PlayCircle,
    AlertTriangle
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

// --- Sub-componentes Estilizados ---

const Badge = ({ children, status, className = "" }: { children: React.ReactNode, status: string, className?: string }) => {
     const colors: any = {
         'andamento': 'bg-blue-50 text-blue-600 border-blue-100',
         'impedido': 'bg-amber-50 text-amber-600 border-amber-100',
         'analise': 'bg-purple-50 text-purple-600 border-purple-100',
         'nao-iniciado': 'text-slate-700 border-slate-200',
                         'concluido': 'bg-emerald-100 text-emerald-700 border-emerald-200',
                         'atrasada': 'bg-red-500 text-white border-red-600',
                         'entrega-hoje': 'bg-blue-600 text-white border-blue-700 shadow-lg shadow-blue-500/20',
                         'pre-projeto': 'text-slate-700 border-slate-200',
         'saudavel': 'bg-emerald-100 text-emerald-700 border-emerald-200',
         'critico': 'bg-red-100 text-red-700 border-red-200',
     };
     const key = status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
     const colorClass = colors[key] || 'text-slate-600 border-slate-200';
     const shouldUseThemeBackground = key === 'nao-iniciado' || key === 'pre-projeto';

     return (
         <span className={`px-2 py-0.5 2xl:px-4 2xl:py-1.5 rounded-lg text-[9px] sm:text-[10px] 2xl:text-xs 3xl:text-sm font-black uppercase tracking-wide border-2 ${colorClass} ${className} whitespace-nowrap`} style={shouldUseThemeBackground ? { backgroundColor: 'var(--surface-3)', borderColor: 'var(--border)' } : {}}>
             {children}
         </span>
     );
};

const SectionHeader = ({ label, icon: Icon, colorClass, children }: { label: string, icon: any, colorClass: string, children?: React.ReactNode }) => (
     <div className="flex items-center gap-2 sm:gap-3 2xl:gap-6 mb-1.5 sm:mb-2 lg:mb-3 2xl:mb-4">
         <div className={`w-1.5 h-3 sm:h-4 lg:h-5 2xl:h-7 rounded-full ${colorClass}`} />
         <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 2xl:w-5 2xl:h-5 shrink-0" style={{ color: 'var(--text-muted)' }} />
         <h2 className="text-[5px] sm:text-[6px] lg:text-[7px] 2xl:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.15em] 2xl:tracking-[0.2em] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{label}</h2>
         <div className="h-[1px] flex-1 ml-2 opacity-50" style={{ backgroundColor: 'var(--border)' }} />
         {children && <div className="flex items-center gap-1 sm:gap-1.5 2xl:gap-3 ml-2">{children}</div>}
     </div>
);

const CompactStat = ({ label, count, icon: Icon, colorClass }: { label: string, count: number, icon: any, colorClass: string }) => (
     <div className="backdrop-blur-sm px-1.5 py-0.5 2xl:px-2.5 2xl:py-1 rounded-md border shadow-sm flex items-center gap-1.5 transition-all" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        <Icon className={`${colorClass} w-2 h-2 2xl:w-3.5 2xl:h-3.5 opacity-80`} />
        <span className={`text-[5px] sm:text-[5.5px] 2xl:text-[9.5px] font-black uppercase tracking-tighter ${colorClass}`}>
            {label} <span className="opacity-60 ml-0.5">({count})</span>
        </span>
    </div>
);

// --- Componente Principal ---

const AdminMonitoringView: React.FC = () => {
    const { tasks: allTasks, projects: allProjects, users: allUsers, clients: allClients, loading, timesheetEntries: allTimesheets, absences: allAbsences } = useDataController();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [weather, setWeather] = useState<{
        temp: number;
        icon: string;
        condition: string;
    } | null>(null);

    // Notification System State
    const [notifications, setNotifications] = useState<Array<{ id: string; message: string | React.ReactNode; timestamp: number; priority: 'HIGH' | 'LOW'; duration?: number }>>([]);
    const [currentNotification, setCurrentNotification] = useState<{ message: string | React.ReactNode; id: string } | null>(null);
    const currentNotificationRef = useRef(currentNotification);
    const lastNotificationEndTime = useRef<number>(0);
    const rotationIndexRef = useRef<{ [key: string]: number }>({});
    const lastRotationTime = useRef<number>(0);

    // Data Refs for Stable Access in Intervals
    const clientsRef = useRef(allClients);
    const usersRef = useRef(allUsers);
    const tasksRef = useRef(allTasks);

    useEffect(() => {
        clientsRef.current = allClients;
        usersRef.current = allUsers;
        tasksRef.current = allTasks;
    }, [allClients, allUsers, allTasks]);

    // Sincronizar ref para acesso em intervalos
    useEffect(() => {
        currentNotificationRef.current = currentNotification;
    }, [currentNotification]);

    // Atualizar hora a cada segundo
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Buscar clima de Sabará-MG
    useEffect(() => {
        const fetchWeather = async () => {
            try {
                // Latitude/Longitude de Sabará-MG: -19.8833, -43.8056
                const response = await fetch(
                    'https://api.open-meteo.com/v1/forecast?latitude=-19.8833&longitude=-43.8056&current=temperature_2m,weather_code&timezone=America/Sao_Paulo'
                );
                const data = await response.json();

                if (data.current) {
                    const code = data.current.weather_code;
                    let iconUrl = '';
                    let conditionText = 'Nublado';

                    // Mapeamento de condições expandido
                    const mappings: any = {
                        0: { text: 'Céu Limpo', hex: '2600' },
                        1: { text: 'Limpo', hex: '2600' },
                        2: { text: 'Parcialmente Nublado', hex: '1f324' },
                        3: { text: 'Nublado', hex: '2601' },
                        45: { text: 'Nevoeiro', hex: '1f32b' },
                        48: { text: 'Nevoeiro', hex: '1f32b' },
                        51: { text: 'Chuva Leve', hex: '1f327' },
                        61: { text: 'Chuva', hex: '1f327' },
                        63: { text: 'Chuva', hex: '1f327' },
                        80: { text: 'Pancadas', hex: '1f327' },
                        95: { text: 'Trovoada', hex: '26c8' },
                    };

                    const match = mappings[code] || { text: 'Nublado', hex: '2601' };
                    conditionText = match.text;
                    iconUrl = `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u${match.hex}.png`;

                    setWeather({
                        temp: Math.round(data.current.temperature_2m),
                        icon: iconUrl,
                        condition: conditionText
                    });
                }
            } catch (error) {
                console.error('Erro ao buscar clima:', error);
            }
        };
        fetchWeather();
        const interval = setInterval(fetchWeather, 600000); // Atualizar a cada 10 minutos
        return () => clearInterval(interval);
    }, []);

    const handleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((e) => {
                console.error(`Erro ao ativar tela cheia: ${e.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    // Adicionar notificação à fila
    const addNotification = (message: string | React.ReactNode, priority: 'HIGH' | 'LOW' = 'HIGH', duration: number = 5000) => {
        const id = `${Date.now()}-${Math.random()}`;
        setNotifications(prev => {
            const newNotif = { id, message, timestamp: Date.now(), priority, duration };
            if (priority === 'HIGH') {
                return [newNotif, ...prev];
            }
            return [...prev, newNotif];
        });
    };

    // --- ROTATION & SCHEDULER SYSTEM ---
    useEffect(() => {
        const PERIOD_MESSAGES = [
            { id: 'entrada_manha', range: [8, 0, 8, 30], messages: ["☀️ Bom dia, time!", "🚀 Sistemas iniciados e monitoramento ativo.", "📊 Painel de projetos atualizado.", "👀 Acompanhe suas atividades de hoje.", "⚙️ Ambientes operacionais.", "💡 Pequenos commits, grandes resultados."] },
            { id: 'manha_tarefas', range: [8, 30, 12, 0], messages: ["📋 Não esqueça de criar sua tarefa antes de iniciar.", "🧠 Organize suas prioridades do dia.", "👀 Sistema monitorando operações.", "🔄 Atualizações do sistema aparecem aqui.", "📈 Projetos em andamento.", "⚠️ Tarefa criada = rastreabilidade garantida."] },
            { id: 'almoco', range: [12, 0, 13, 0], messages: ["🍽️ Horário de almoço — bom descanso!", "☕ Pausa estratégica.", "😌 Recarregando energias.", "⏸️ Monitoramento segue ativo.", "📡 Sistemas estáveis.", "⏱️ Voltamos em breve."] },
            { id: 'tarde_foco', range: [13, 0, 16, 0], messages: ["⚡ Atividades retomadas.", "👀 Sistema monitorando projetos.", "🧩 Hora de transformar tarefas em entregas.", "📊 Acompanhe o progresso no dashboard.", "🔧 Ambientes estáveis.", "🚀 Foco na entrega."] },
            { id: 'apontamento_horas', range: [16, 0, 17, 30], messages: ["⏱️ Não esqueça de apontar suas horas.", "📌 Apontamento garante visibilidade.", "🕒 Último período para registrar horas.", "⚠️ Horas não apontadas impactam relatórios.", "📊 Confira se todas as tarefas estão registradas.", "✅ Feche o dia corretamente."] },
            { id: 'fora_horario_noite', range: [17, 30, 23, 59], messages: ["🌙 Sistema em monitoramento automático.", "🛡️ Ambientes protegidos.", "📡 Monitoramento 24/7 ativo.", "⏱️ Atualizações críticas aparecerão aqui.", "🔒 Operação segura.", "😴 Fora do horário comercial."] },
            { id: 'fora_horario_madruga', range: [0, 0, 7, 59], messages: ["🌙 Sistema em monitoramento automático.", "🛡️ Ambientes protegidos.", "📡 Monitoramento 24/7 ativo.", "⏱️ Atualizações críticas aparecerão aqui.", "🔒 Operação segura.", "😴 Fora do horário comercial."] }
        ];

        const runRotation = () => {
            const now = new Date();
            const hour = now.getHours();
            const min = now.getMinutes();
            const currentTimeInMinutes = hour * 60 + min;

            // 1. Injetar Tarefas para Entregar Hoje (Periodicamente)
            // A cada 45 segundos (aproximadamente, baseado na chamada de 2s * 22 ticks)
            const tick = Math.floor(Date.now() / 2000);
            if (tick % 25 === 0) {
                // Encontrar tarefas vencendo hoje
                const todayStr = now.toISOString().split('T')[0];
                const dueToday = tasksRef.current.filter(t => t.estimatedDelivery && t.estimatedDelivery.startsWith(todayStr) && t.status !== 'Done');

                if (dueToday.length > 0) {
                    const randomTask = dueToday[Math.floor(Math.random() * dueToday.length)];
                    const dev = usersRef.current.find(u => u.id === randomTask.developerId);

                    const msg = (
                        <div className="flex items-center gap-4">
                            <div className="flex -space-x-2">
                                <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden bg-white">
                                    <img
                                        src={dev?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(dev?.name || 'Dev')}`}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.onerror = null;
                                            target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(dev?.name || 'Dev')}&background=f8fafc&color=475569`;
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-300">ENTREGA HOJE</span>
                                <span className="text-lg font-black text-white leading-none">{randomTask.title}</span>
                                <span className="text-xs font-bold text-purple-300 mt-1">{dev?.name || 'Colaborador'}</span>
                            </div>
                        </div>
                    );
                    addNotification(msg, 'LOW', 6000);
                    return; // Prioriza essa mensagem neste ciclo
                }
            }


            const currentPeriod = PERIOD_MESSAGES.find(p => {
                const start = p.range[0] * 60 + p.range[1];
                const end = p.range[2] * 60 + p.range[3];
                return currentTimeInMinutes >= start && currentTimeInMinutes <= end;
            });

            if (!currentPeriod) return;

            const nowTs = Date.now();
            if (nowTs - lastRotationTime.current >= 6000) {
                if (currentNotificationRef.current) return;

                const periodKey = currentPeriod.id.includes('fora_horario') ? 'fora_horario' : currentPeriod.id;
                const idx = rotationIndexRef.current[periodKey] || 0;
                const msg = currentPeriod.messages[idx];

                addNotification(msg, 'LOW');
                rotationIndexRef.current[periodKey] = (idx + 1) % currentPeriod.messages.length;
                lastRotationTime.current = Date.now();
            }
        };

        const interval = setInterval(runRotation, 2000);
        return () => clearInterval(interval);
    }, []);

    // Sistema de notificações em tempo real (HIGH Priority)
    useEffect(() => {
        const channel = supabase
            .channel('monitoring_notifications')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fato_tarefas', filter: 'StatusTarefa=eq.Done' }, (payload: any) => {
                const user = usersRef.current.find(u => u.id === String(payload.new.ID_Colaborador));
                const taskName = payload.new.Afazer || 'Tarefa';
                addNotification(`✅ ${user?.name || 'Colaborador'} finalizou: ${taskName}`, 'HIGH');
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dim_projetos' }, async (payload: any) => {
                // Lookup client
                const client = clientsRef.current.find(c => c.id === String(payload.new.ID_Cliente));

                // Fetch members with a small delay to allow for member insertion
                await new Promise(resolve => setTimeout(resolve, 2000));

                let members: User[] = [];
                try {
                    const { data: memberData } = await supabase
                        .from('project_members')
                        .select('id_colaborador')
                        .eq('id_projeto', payload.new.ID_Projeto);

                    if (memberData) {
                        members = memberData.map((m: any) => usersRef.current.find(u => u.id === m.id_colaborador)).filter(Boolean) as User[];
                    }
                } catch (e) {
                    console.error('Error fetching new project members', e);
                }

                const msg = (
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col gap-1 flex-1">
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                                <Zap size={14} /> Novo Projeto Criado
                            </span>
                            <span className="text-xl font-black text-white">{payload.new.NomeProjeto || 'Novo Projeto'}</span>
                            <span className="text-sm font-bold text-slate-300">Cliente: {client?.name || 'Cliente'}</span>
                        </div>

                        {members.length > 0 && (
                            <div className="flex -space-x-3">
                                {members.slice(0, 4).map(m => (
                                    <div key={m.id} className="w-10 h-10 rounded-full border-2 overflow-hidden shadow-lg" style={{ borderColor: 'var(--surface)', backgroundColor: 'var(--surface-2)' }}>
                                        <img
                                            src={m.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}`}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.onerror = null;
                                                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=f8fafc&color=475569`;
                                            }}
                                        />
                                    </div>
                                ))}
                                {members.length > 4 && (
                                    <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white shadow-lg" style={{ borderColor: 'var(--surface)', backgroundColor: 'var(--surface-2)' }}>
                                        +{members.length - 4}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );

                // Projeto novo: 10 segundos, mostrar uma vez (HIGH priority garante destaque)
                addNotification(msg, 'HIGH', 10000);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fato_tarefas' }, (payload: any) => {
                const user = usersRef.current.find(u => u.id === String(payload.new.ID_Colaborador));
                const taskName = payload.new.Afazer || 'Nova Tarefa';
                const msg = (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-xs border border-white/20">
                            NEW
                        </div>
                        <div className="flex flex-col">
                            <span className="text-base font-bold text-white leading-tight">{taskName}</span>
                            <span className="text-xs text-blue-300">Criada para {user?.name || 'Equipe'}</span>
                        </div>
                    </div>
                );
                addNotification(msg, 'HIGH', 5000);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dim_clientes' }, (payload: any) => {
                addNotification(`🏢 Cliente cadastrado: ${payload.new.NomeCliente || 'Novo Cliente'}`, 'HIGH');
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // 1. Timer para limpar a notificação atual (Dinâmico base na duration)
    useEffect(() => {
        if (!currentNotification) return;

        // @ts-ignore - duration vem do obj original no state, mas aqui é simplificado
        const notifObj = notifications.find(n => n.id === currentNotification.id);
        const duration = notifObj?.duration || 5000;

        const timer = setTimeout(() => {
            const idToRemove = currentNotification.id;
            setCurrentNotification(null);
            setNotifications(prev => prev.filter(n => n.id !== idToRemove));
            lastNotificationEndTime.current = Date.now();
        }, duration);

        return () => clearTimeout(timer);
    }, [currentNotification?.id, notifications]);

    // 2. Gerenciador da Fila e Preempt
    useEffect(() => {
        const firstHighIndex = notifications.findIndex(n => n.priority === 'HIGH');
        const hasHighQueued = firstHighIndex !== -1;

        if (currentNotification) {
            const currentObj = notifications.find(n => n.id === currentNotification.id);
            if (currentObj?.priority === 'LOW' && hasHighQueued) {
                setCurrentNotification(null);
            }
            return;
        }

        if (notifications.length === 0) return;

        const now = Date.now();
        const timeSinceLast = now - lastNotificationEndTime.current;
        if (timeSinceLast < 1000) {
            const retry = setTimeout(() => setNotifications(prev => [...prev]), 300);
            return () => clearTimeout(retry);
        }

        const nextIndex = hasHighQueued ? firstHighIndex : 0;
        const next = notifications[nextIndex];

        setCurrentNotification({ message: next.message, id: next.id });
    }, [notifications, currentNotification]);

    const [taskPage, setTaskPage] = useState(() => {
        const saved = sessionStorage.getItem('adminMonitoring_taskPage');
        return saved ? parseInt(saved, 10) : 0;
    });

    useEffect(() => {
        sessionStorage.setItem('adminMonitoring_taskPage', String(taskPage));
    }, [taskPage]);
    const [windowSize, setWindowSize] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 1920,
        height: typeof window !== 'undefined' ? window.innerHeight : 1080
    });

    useEffect(() => {
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight
            });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const itemsPerPage = useMemo(() => {
        const { width, height } = windowSize;
        if (width >= 2500 && height >= 1300) return 9; // 3x3
        if (width >= 1800 && height >= 900) return 9;  // 3x3
        if (width >= 1200 && height >= 800) return 6;  // 3x2
        return 3; // 3x1
    }, [windowSize]);


    const tasksInProgressRaw = useMemo(() =>
        allTasks.filter(t => {
            const status = (t.status || '').toLowerCase();
            return status === 'in progress' || status === 'review';
        }),
        [allTasks]);

    const tasksInProgress = tasksInProgressRaw;

    useEffect(() => {
        const totalPages = Math.ceil(tasksInProgress.length / itemsPerPage);
        if (totalPages <= 1) {
            if (taskPage !== 0) setTaskPage(0);
            return;
        }

        if (taskPage >= totalPages) {
            setTaskPage(0);
        }

        const interval = setInterval(() => {
            setTaskPage((prev) => (prev + 1) % totalPages);
        }, 12000); // Um pouco mais de tempo para ler cards maiores

        return () => clearInterval(interval);
    }, [tasksInProgress.length, taskPage, itemsPerPage]);

    const filteredUsers = useMemo(() => {
        return allUsers.filter(u =>
            u.active !== false && u.torre !== 'N/A'
        );
    }, [allUsers]);

    const userMap = useMemo(() => new Map(filteredUsers.map(u => [u.id, u])), [filteredUsers]);

    const clientMap = useMemo(() => new Map(allClients.map(c => [c.id, c])), [allClients]);
    const projectMap = useMemo(() => new Map(allProjects.map(p => [p.id, p])), [allProjects]);

    const isTaskDelayed = (task: Task) => task.status !== 'Done' && task.status !== 'Review' && (task.progress || 0) < 100 && (task.daysOverdue ?? 0) > 0;
    const isCollaboratorDelayed = (task: Task) => task.status !== 'Done' && task.status !== 'Review' && (task.progress || 0) < 100 && (task.daysOverdue ?? 0) > 0;

    const activeProjects = useMemo(() => {
        return allProjects.filter(p => {
            const projTasks = allTasks.filter(t => t.projectId === p.id);
            const hasActiveTasks = projTasks.some(t => t.status !== 'Done');
            return projTasks.length > 0 && hasActiveTasks;
        });
    }, [allProjects, allTasks]);

    const teamStatus = useMemo(() => {
        const now = new Date();
        const hour = now.getHours();
        const isAfter16h = hour >= 16;
        const todayStr = now.toISOString().split('T')[0];

        const members = filteredUsers.map(user => {
            // Tarefas onde ele é o principal ou colaborador extra
            const userTasks = allTasks.filter(t =>
                t.developerId === user.id ||
                (t.collaboratorIds && t.collaboratorIds.includes(user.id))
            );

            // Tarefas ativas: Não Iniciado, Análise, Andamento ou Teste
            const activeTasks = userTasks.filter(t => {
                const s = (t.status || '').toLowerCase();
                return s === 'todo' || s === 'in progress' || s === 'testing' || s === 'review';
            });

            // Tarefas em atraso (entre as ativas)
            const delayedTasksForStatus = activeTasks.filter(t => isCollaboratorDelayed(t));

            // Check de estudo
            const hasStudy = userTasks.some(t => t.title.toLowerCase().includes('estudo'));
            const isStudyCargo = user.cargo?.toLowerCase().includes('estudo');

            // Check de apontamento (pelo menos um registro no dia de hoje)
            const hasTimesheetToday = allTimesheets.some(entry =>
                entry.userId === user.id &&
                entry.date === todayStr
            );

            let status: 'LIVRE' | 'ESTUDANDO' | 'OCUPADO' | 'APONTADO' | 'ATRASADO' | 'AUSENTE' = 'LIVRE';
            let absenceData = undefined;

            // Check if absent today
            const userAbsences = allAbsences.filter(a =>
                a.userId === user.id &&
                (a.status === 'finalizada_dp' || a.status === 'aprovada_rh')
            );
            const absentToday = userAbsences.find(a => {
                const start = new Date(a.startDate + 'T00:00:00');
                start.setHours(0, 0, 0, 0);
                const end = new Date(a.endDate + 'T23:59:59');
                end.setHours(23, 59, 59, 999);
                return now >= start && now <= end;
            });

            // Hierarquia: Ausente > Atrasado > Apontado (após 16h) > Iniciado > Estudando > Livre
            if (absentToday) {
                status = 'AUSENTE';
                absenceData = absentToday;
            } else if (delayedTasksForStatus.length > 0) {
                status = 'ATRASADO';
            } else if (isAfter16h && hasTimesheetToday) {
                status = 'APONTADO';
            } else if (activeTasks.length > 0) {
                status = 'OCUPADO';
            } else if (isStudyCargo || hasStudy) {
                status = 'ESTUDANDO';
            }

            return { ...user, boardStatus: status, absenceData };
        });

        return members;
    }, [allUsers, allTasks, allTimesheets, allAbsences]);

    const stats = useMemo(() => {
        const delayed = allTasks.filter(t => t.status !== 'Done' && (t.status === 'In Progress' || t.status === 'Testing') && (t.progress || 0) < 100 && (t.daysOverdue ?? 0) > 0).length;
        const review = allTasks.filter(t => t.status === 'Review').length;
        const preProjeto = allProjects.filter(p => !allTasks.some(t => t.projectId === p.id)).length;
        const analise = allProjects.filter(p => {
            const tasks = allTasks.filter(t => t.projectId === p.id);
            return tasks.length > 0 && tasks.every(t => t.status === 'Todo');
        }).length;
        const andamento = allProjects.filter(p => {
            const tasks = allTasks.filter(t => t.projectId === p.id);
            return tasks.some(t => t.status === 'In Progress' || t.status === 'Testing');
        }).length;

        const tasksByStatus = {
            todo: allTasks.filter(t => t.status === 'Todo').length,
            inProgress: allTasks.filter(t => t.status === 'In Progress').length,
            testing: allTasks.filter(t => t.status === 'Testing').length,
            review: allTasks.filter(t => t.status === 'Review').length,
            done: allTasks.filter(t => t.status === 'Done').length,
        };

        const todayStr = new Date().toISOString().split('T')[0];
        const entregaHoje = allTasks.filter(t => t.estimatedDelivery && t.estimatedDelivery.startsWith(todayStr) && t.status !== 'Done').length;

        return {
            atrasados: delayed,
            impedidos: review,
            entregaHoje,
            preProjeto,
            analise,
            andamento,
            tasksByStatus,
            team: {
                livre: teamStatus.filter(m => m.boardStatus === 'LIVRE').length,
                ocupado: teamStatus.filter(m => m.boardStatus === 'OCUPADO').length,
                atrasado: teamStatus.filter(m => m.boardStatus === 'ATRASADO').length,
                estudando: teamStatus.filter(m => m.boardStatus === 'ESTUDANDO').length,
                apontado: teamStatus.filter(m => m.boardStatus === 'APONTADO').length,
                ausente: teamStatus.filter(m => m.boardStatus === 'AUSENTE').length
            }
        };
    }, [allTasks, allProjects, teamStatus]);

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-purple-50 to-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.15em] sm:tracking-widest text-slate-500">Inicializando Sistemas...</span>
            </div>
        </div>
    );

    const weekDay = currentTime.toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase();

    return (
        <div className="h-screen w-full bg-gradient-to-br from-slate-100 via-white to-slate-100 flex flex-col overflow-hidden font-sans text-slate-900 selection:bg-purple-100">

            {/* --- BARRA INFORMATIVA --- */}
            <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-white/10 px-4 sm:px-6 h-[72px] 2xl:h-[100px] flex items-center justify-between shrink-0 shadow-xl overflow-hidden z-50">
                {/* Clima - Esquerda */}
                <div className="flex items-center h-full min-w-fit">
                    {weather ? (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 flex items-center justify-center filter drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                                <img src={weather.icon} alt="Clima" className="w-full h-full object-contain scale-110" />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-start">
                                    <span className="text-xl sm:text-2xl 2xl:text-4xl font-black text-white tabular-nums leading-none">{weather.temp}</span>
                                    <span className="text-xs font-bold text-slate-400 ml-0.5 mt-0.5 leading-none 2xl:text-base">°C</span>
                                </div>
                                <span className="text-[8px] 2xl:text-xs font-black text-slate-400 uppercase tracking-[0.2em] mt-1 leading-none">{weather.condition}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="w-24 h-8 rounded-lg bg-white/5 animate-pulse" />
                    )}
                </div>

                {/* Notificações - Centro */}
                <div className="flex-1 flex items-center justify-center px-4 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {currentNotification && (
                            <motion.div
                                key={currentNotification.id}
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                className="px-4 py-1"
                            >
                                <div className="text-sm sm:text-base lg:text-lg font-black text-white tracking-wide text-center line-clamp-1">
                                    {currentNotification.message}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Hora e Data - Direita */}
                <div className="flex items-center gap-4 min-w-fit justify-end">
                    <div className="flex flex-col items-end">
                        <span className="text-xl sm:text-2xl 2xl:text-4xl font-black text-white tabular-nums tracking-tight leading-none">
                            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[8px] 2xl:text-xs font-black text-emerald-400 uppercase tracking-widest leading-none">AO VIVO</span>
                            <div className="w-1.5 h-1.5 2xl:w-2.5 2xl:h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                    </div>
                    <div className="w-[1px] h-8 bg-white/10" />
                    <button
                        onClick={handleFullScreen}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                        title="Modo TV / Tela Cheia"
                    >
                        <Maximize size={18} />
                    </button>
                    <div className="flex flex-col items-end">
                        <span className="text-xs sm:text-sm font-black text-white tabular-nums leading-none uppercase tracking-tight">
                            {weekDay}
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 tabular-nums leading-none mt-1">
                            {(() => {
                                const d = new Date(currentTime);
                                if (d.getFullYear() < 2025) d.setFullYear(2026);
                                return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                            })()}
                        </span>
                    </div>
                </div>
            </header>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 p-2 sm:p-2.5 flex flex-col gap-2 overflow-hidden">
                {/* Section 1: OPERAÇÕES EM EXECUÇÃO (Snake Carousel) */}
                <section className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {(() => {
                        const reviewCount = tasksInProgress.filter(t => t.status === 'Review').length;
                        return (
                            <SectionHeader
                                label="Operações Iniciadas & Pendentes"
                                icon={Activity}
                                colorClass={reviewCount > 0 ? "bg-yellow-500" : "bg-purple-600"}
                            >
                                <CompactStat label="Entrega Hoje" count={stats.entregaHoje} icon={Zap} colorClass="text-sky-600" />
                                <CompactStat label="Andamento" count={stats.tasksByStatus.inProgress} icon={Activity} colorClass="text-blue-600" />
                                <CompactStat label="Atrasados" count={stats.atrasados} icon={AlertCircle} colorClass="text-red-600" />
                                <CompactStat label="Impedido" count={stats.impedidos} icon={Ban} colorClass="text-amber-600" />
                            </SectionHeader>
                        );
                    })()}

                    <div className="relative flex-1 min-h-0">
                        <AnimatePresence mode='wait'>
                            <motion.div
                                key={`${taskPage}-${itemsPerPage}`}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.02 }}
                                transition={{ duration: 0.5 }}
                                className={`grid gap-2 sm:gap-3 lg:gap-4 h-full grid-cols-1 md:grid-cols-2 xl:grid-cols-3`}
                            >
                                {(() => {
                                    const startIdx = taskPage * itemsPerPage;
                                    const pageItems = tasksInProgress.slice(startIdx, startIdx + itemsPerPage);

                                    return pageItems.map((task, idx) => {
                                        const project = projectMap.get(task.projectId);
                                        const client = clientMap.get(task.clientId);
                                        const dev = userMap.get(task.developerId || '');

                                        const delayed = isTaskDelayed(task);
                                        const isDueToday = task.estimatedDelivery && new Date(task.estimatedDelivery + 'T12:00:00').toDateString() === new Date().toDateString();
                                        const isReview = task.status === 'Review';

                                        let finalStatusLabel = task.status === 'In Progress' ? 'ANDAMENTO' :
                                            task.status === 'Review' ? 'ANÁLISE' :
                                                task.status === 'Todo' ? 'PRÉ-PROJETO' :
                                                    task.status === 'Testing' ? 'TESTE' :
                                                        task.status === 'Done' ? 'CONCLUÍDO' : task.status;

                                        if (delayed) finalStatusLabel = 'ATRASADA';
                                        else if (isDueToday && task.status !== 'Done') finalStatusLabel = 'ENTREGA HOJE';

                                        const statusLabelKey = finalStatusLabel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
                                        const formattedDate = task.estimatedDelivery ? new Date(task.estimatedDelivery + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'S/D';

                                        let countdownText = '';
                                        if (task.estimatedDelivery) {
                                            const parts = task.estimatedDelivery.split('-');
                                            const deadline = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                                            const now = new Date();
                                            now.setHours(0, 0, 0, 0);
                                            const diffTime = deadline.getTime() - now.getTime();
                                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                            if (diffDays < 0) countdownText = 'Atrasado';
                                            else if (diffDays === 0) countdownText = 'Hoje';
                                            else if (diffDays === 1) countdownText = 'Amanhã';
                                            else if (diffDays <= 3) countdownText = `Faltam ${diffDays}d`;
                                        }

                                        const shadowClass = delayed ? 'shadow-[0_8px_30px_rgb(239,68,68,0.2)] border-red-200' :
                                            isDueToday ? 'shadow-[0_8px_30px_rgb(14,165,233,0.2)] border-sky-200' :
                                                isReview ? 'shadow-[0_8px_30px_rgb(234,179,8,0.2)] border-yellow-200' :
                                                    'shadow-[0_8px_30px_rgb(147,51,234,0.1)] border-purple-100';

                                        const extraCollaborators = Array.from(new Set(task.collaboratorIds || []))
                                            .filter(id => id !== task.developerId)
                                            .map(id => userMap.get(id))
                                            .filter(Boolean) as User[];

                                        return (
                                            <div key={`${task.id}-${idx}`} className={`border rounded-xl p-2.5 sm:p-3 2xl:p-5 relative flex flex-col group hover:border-purple-400 transition-all ${shadowClass} overflow-hidden h-full min-h-[140px]`} style={{ backgroundColor: 'var(--surface)' }}>
                                                <div className="flex justify-between items-start mb-1.5 sm:mb-2 2xl:mb-4 gap-2">
                                                    <Badge className="2xl:text-xs 2xl:px-3 2xl:py-1" status={statusLabelKey}>{finalStatusLabel}</Badge>
                                                    <div className="w-8 h-8 2xl:w-12 2xl:h-12 rounded-lg border p-1 flex items-center justify-center overflow-hidden shadow-sm transition-all shrink-0" style={{ backgroundColor: 'var(--surface-3)', borderColor: 'var(--border)' }}>
                                                        <img
                                                            src={client?.logoUrl || 'https://placehold.co/100x100?text=Logo'}
                                                            className="w-full h-full object-contain"
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.onerror = null;
                                                                target.src = 'https://placehold.co/100x100?text=Logo';
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex-1 flex flex-col justify-start gap-1 2xl:gap-2 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <h3 className="text-xs sm:text-sm 2xl:text-xl font-black uppercase leading-tight line-clamp-2 flex-1 tracking-tight" style={{ color: 'var(--text)' }}>{task.title}</h3>
                                                        {isDueToday && (
                                                            <div className="flex items-center gap-0.5 bg-sky-500 text-white text-[7px] 2xl:text-[10px] font-black px-1.5 py-0.5 rounded-full animate-bounce shrink-0 shadow-lg shadow-sky-200">
                                                                <Zap size={10} className="shrink-0" /> HOJE
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col gap-0.5 2xl:gap-1">
                                                        <span className="text-[8px] sm:text-[10px] 2xl:text-xs font-black uppercase truncate" style={{ color: 'var(--text-muted)' }}>CLIENTE: {client?.name || 'Interno'}</span>
                                                        <span className="text-[8px] sm:text-[10px] 2xl:text-xs font-black text-purple-600 uppercase truncate leading-none">
                                                            PROJ: {project?.name || 'N/A'}
                                                        </span>
                                                        {task.status === 'Done' ? (
                                                            task.actualDelivery && (
                                                                <span className="text-[8px] sm:text-[10px] 2xl:text-xs font-black uppercase flex items-center gap-1 mt-0.5 text-emerald-600">
                                                                    ✅ Entregue em {new Date(task.actualDelivery + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                                </span>
                                                            )
                                                        ) : (
                                                            task.estimatedDelivery && (
                                                        <span className={`text-[8px] sm:text-[10px] 2xl:text-xs font-black uppercase flex items-center gap-1 mt-0.5 ${isDueToday ? 'text-sky-600' : ''}`} style={!isDueToday ? { color: 'var(--text-muted)' } : {}}>
                                                                    📅 {formattedDate}{countdownText ? ` • ${countdownText}` : ''}
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-2 2xl:mt-6 mb-1">
                                                    <div className="w-full h-1.5 2xl:h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-2)' }}>
                                                        <div
                                                            className={`h-full transition-all duration-500 ${delayed ? 'bg-red-500' : isDueToday ? 'bg-sky-500' : isReview ? 'bg-yellow-500' : 'bg-purple-600'}`}
                                                            style={{ width: `${task.progress}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between mt-auto pt-2 2xl:pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                                                    <div className="flex items-center gap-1.5 sm:gap-2 2xl:gap-4 min-w-0">
                                                        <div className="flex -space-x-1.5 2xl:-space-x-3">
                                                            <div className="w-6 h-6 2xl:w-10 2xl:h-10 rounded-full overflow-hidden border-2 shadow-sm shrink-0 z-10" style={{ borderColor: 'var(--surface)', backgroundColor: 'var(--surface-3)' }}>
                                                                <img
                                                                    src={dev?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(task.developer)}&background=f8fafc&color=475569`}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        const target = e.target as HTMLImageElement;
                                                                        target.onerror = null;
                                                                        target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(task.developer)}&background=f8fafc&color=475569`;
                                                                    }}
                                                                />
                                                            </div>
                                                            {(extraCollaborators || []).slice(0, 2).map((collab) => (
                                                                <div key={collab.id} className="w-6 h-6 2xl:w-10 2xl:h-10 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0 bg-white">
                                                                    <img src={collab.avatarUrl || `https://ui-avatars.com/api/?name=${collab.name}`} className="w-full h-full object-cover" />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[7px] sm:text-[8px] 2xl:text-[10px] font-black uppercase text-slate-400 leading-none">Equipe</span>
                                                            <span className="text-[8px] sm:text-[9px] 2xl:text-sm font-bold text-slate-700 truncate max-w-[60px] sm:max-w-[70px] 2xl:max-w-[120px] leading-tight">
                                                                {dev?.name ? dev.name.split(' ')[0] : task.developer}
                                                                {extraCollaborators.length > 0 && ` +${extraCollaborators.length}`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-0 shrink-0 ml-2">
                                                        <span className={`text-sm sm:text-base 2xl:text-2xl font-black tabular-nums leading-none ${delayed ? 'text-red-500' : isDueToday ? 'text-sky-600' : isReview ? 'text-yellow-600' : 'text-purple-600'}`}>{task.progress}%</span>
                                                        {(() => {
                                                            if (task.status === 'Done') return null;
                                                            const daysLate = task.daysOverdue || 0;
                                                            if (daysLate > 0) {
                                                                return <span className="text-[7px] 2xl:text-[11px] font-black text-red-500 uppercase whitespace-nowrap leading-none">atrasado {daysLate}d</span>;
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Pagination Indicators */}
                    {Math.ceil(tasksInProgress.length / itemsPerPage) > 1 && (
                        <div className="flex justify-center gap-1.5 sm:gap-2 mt-1.5">
                            {Array.from({ length: Math.ceil(tasksInProgress.length / itemsPerPage) }).map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setTaskPage(idx)}
                                    className={`h-1 rounded-full transition-all duration-300 ${taskPage === idx ? 'w-6 sm:w-8 bg-purple-600' : 'w-1.5 hover:bg-purple-400'}`}
                                    style={taskPage !== idx ? { backgroundColor: 'var(--border)' } : {}}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* Row 2: Projects and Team */}
                <div className="flex flex-col gap-2 shrink-0">

                    {/* ECOSSISTEMA DE PROJETOS ATIVOS */}
                    {activeProjects.length > 0 && (
                        <section className="flex flex-col min-h-0 overflow-hidden">
                            <SectionHeader label={`Ecossistema de Projetos Ativos (${activeProjects.length})`} icon={Timer} colorClass="bg-blue-600">
                                <CompactStat label="Pré-Projeto" count={stats.preProjeto} icon={Layout} colorClass="text-slate-600" />
                                <CompactStat label="Análise" count={stats.analise} icon={Cpu} colorClass="text-yellow-600" />
                                <CompactStat label="Andamento" count={stats.andamento} icon={Activity} colorClass="text-blue-600" />
                            </SectionHeader>
                            <div className="relative w-full overflow-hidden pb-1.5 sm:pb-2">
                                <div className="flex gap-2 sm:gap-3 lg:gap-4 w-max animate-marquee hover:[animation-play-state:paused]">
                                    {[...activeProjects, ...activeProjects, ...activeProjects].map((proj, idx) => { // Triplicated for infinite loop
                                        const Icons = [Cloud, Database, Zap, Shield, Box, Activity, Cpu, Wifi];
                                        const ProjIcon = Icons[idx % Icons.length];

                                        const projTasks = allTasks.filter(t => t.projectId === proj.id);
                                        const hasDelay = projTasks.some(t => isTaskDelayed(t));
                                        const hasReview = projTasks.some(t => t.status === 'Review');
                                        const hasInProgress = projTasks.some(t => t.status === 'In Progress');

                                        const projStatus = getProjectStatusByTimeline(proj, projTasks);
                                        const colors = getProjectStatusColor(projStatus);
                                        const statusLabel = projStatus;
                                        const statusColor = colors.text;
                                        const dotColor = colors.dot;

                                        const client = clientMap.get(proj.clientId || '');

                                        return (
                                            <div key={`${proj.id}-${idx}`} className="bg-white border border-slate-200 rounded-xl p-2 flex items-center justify-between shadow-lg min-w-[220px] sm:min-w-[250px] 2xl:min-w-[320px] h-[56px] 2xl:h-[75px] group hover:border-blue-400 hover:shadow-xl transition-all">
                                                <div className="flex items-center gap-2 sm:gap-2.5 2xl:gap-4 min-w-0 flex-1">
                                                    <div className="w-8 h-8 2xl:w-12 2xl:h-12 bg-white rounded-lg flex items-center justify-center border border-slate-100 group-hover:border-blue-300 transition-all overflow-hidden p-1 shadow-sm shrink-0">
                                                        {client?.logoUrl ? (
                                                            <img
                                                                src={client.logoUrl}
                                                                alt={client.name}
                                                                className="w-full h-full object-contain"
                                                            />
                                                        ) : (
                                                            <ProjIcon className="w-6 h-6 2xl:w-8 2xl:h-8 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <span className="text-[7px] sm:text-[8px] 2xl:text-[10px] font-black text-slate-400 uppercase tracking-tight leading-none mb-0.5">{client?.name || 'Interno'}</span>
                                                        <span className="text-[11px] sm:text-xs 2xl:text-lg font-black text-slate-800 uppercase truncate tracking-tight leading-tight">{proj.name}</span>

                                                        <div className="flex items-center gap-1.5 mt-0.5 2xl:mt-1 overflow-hidden">
                                                            {hasInProgress && (
                                                                <div className="flex items-center gap-0.5 shrink-0">
                                                                    <div className="w-1 h-1 2xl:w-1.5 2xl:h-1.5 rounded-full bg-blue-500" />
                                                                    <span className="text-[7px] 2xl:text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">{projTasks.filter(t => t.status === 'In Progress').length} andamento</span>
                                                                </div>
                                                            )}
                                                            {hasReview && (
                                                                <div className="flex items-center gap-0.5 shrink-0">
                                                                    <div className="w-1 h-1 2xl:w-1.5 2xl:h-1.5 rounded-full bg-amber-500" />
                                                                    <span className="text-[7px] 2xl:text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">{projTasks.filter(t => t.status === 'Review').length} análise</span>
                                                                </div>
                                                            )}
                                                            {hasDelay && (
                                                                <div className="flex items-center gap-0.5 shrink-0">
                                                                    <div className="w-1 h-1 2xl:w-1.5 2xl:h-1.5 rounded-full bg-red-500" />
                                                                    <span className="text-[7px] 2xl:text-[10px] font-bold text-red-600 uppercase whitespace-nowrap">{projTasks.filter(t => isTaskDelayed(t)).length} atrasos</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end justify-center shrink-0 pl-1.5 border-l border-slate-100 ml-1.5 h-full">
                                                    <div className={`w-1.5 h-1.5 2xl:w-2.5 2xl:h-2.5 rounded-full mb-0.5 2xl:mb-1 ${dotColor} shadow-md`} />
                                                    <span className={`text-[7px] sm:text-[8px] 2xl:text-xs font-black uppercase tracking-tight ${statusColor} whitespace-nowrap`}>{statusLabel}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* TIME & DISPONIBILIDADE */}
                    <section className="flex flex-col min-h-0 overflow-hidden">
                        <SectionHeader label="Time & Disponibilidade" icon={Users} colorClass="bg-emerald-600">
                            <CompactStat label="Livre" count={stats.team.livre} icon={CheckCircle2} colorClass="text-emerald-600" />
                            <CompactStat label="Ocupados" count={stats.team.ocupado + stats.team.apontado} icon={PlayCircle} colorClass="text-purple-600" />
                            <CompactStat label="Estudando" count={stats.team.estudando} icon={Box} colorClass="text-blue-500" />
                            <CompactStat label="Atrasados" count={stats.team.atrasado} icon={AlertTriangle} colorClass="text-red-600" />
                            {stats.team.ausente > 0 && <CompactStat label="Ausentes" count={stats.team.ausente} icon={AlertCircle} colorClass="text-orange-600" />}
                        </SectionHeader>
                        <div className="relative w-full overflow-hidden pb-1.5">
                            <div className="flex gap-2 sm:gap-3 lg:gap-4 w-max animate-marquee-reverse hover:[animation-play-state:paused]">
                                {[...teamStatus, ...teamStatus, ...teamStatus].map((member, idx) => { // Triplicated for infinite loop
                                    const colors: any = {
                                        'LIVRE': 'text-emerald-600 border-emerald-500 bg-emerald-50',
                                        'OCUPADO': 'text-purple-600 border-purple-500 bg-purple-50',
                                        'ESTUDANDO': 'text-blue-600 border-blue-500 bg-blue-50',
                                        'ATRASADO': 'text-red-600 border-red-500 bg-red-50',
                                        'APONTADO': 'text-indigo-700 border-indigo-500 bg-indigo-50',
                                        'AUSENTE': 'text-orange-600 border-orange-500 bg-orange-50'
                                    };
                                    const dotColors: any = {
                                        'LIVRE': 'bg-emerald-500',
                                        'OCUPADO': 'bg-purple-500',
                                        'ESTUDANDO': 'bg-blue-500',
                                        'ATRASADO': 'bg-red-500',
                                        'APONTADO': 'bg-indigo-600',
                                        'AUSENTE': 'bg-orange-500'
                                    };

                                    return (
                                        <div key={`${member.id}-${idx}`} className="min-w-[170px] sm:min-w-[190px] 2xl:min-w-[260px] h-[65px] sm:h-[70px] 2xl:h-[100px] bg-white border border-slate-200 rounded-xl p-2 2xl:p-4 flex flex-col justify-between shadow-lg group hover:border-emerald-400 hover:shadow-xl transition-all relative overflow-hidden">
                                            <div className="flex items-center gap-2 2xl:gap-4 mb-1">
                                                <div className="w-7 h-7 2xl:w-11 2xl:h-11 rounded-full p-0.5 border border-slate-200 shadow-sm shrink-0">
                                                    <img
                                                        src={member.avatarUrl || `https://ui-avatars.com/api/?name=${member.name}&background=f8fafc&color=475569`}
                                                        className="w-full h-full rounded-full object-cover"
                                                        onError={(e) => {
                                                            const target = e.target as HTMLImageElement;
                                                            target.onerror = null;
                                                            target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=f8fafc&color=475569`;
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <h4 className="text-[10px] 2xl:text-base font-black text-slate-800 uppercase tracking-tight truncate leading-tight">{member.name}</h4>
                                                    <p className="text-[7px] 2xl:text-xs font-black text-slate-400 uppercase tracking-widest truncate">{member.cargo || 'Especialista'}</p>
                                                </div>
                                            </div>

                                            <div className="border-t border-slate-50 pt-1 2xl:pt-3 flex items-center justify-between gap-2">
                                                <span className={`text-[7px] 2xl:text-[10px] font-black px-2 py-0.5 rounded-lg border ${colors[member.boardStatus]} whitespace-nowrap ${member.boardStatus === 'AUSENTE' ? 'flex-1 text-center truncate shadow-sm bg-opacity-30' : ''}`}>
                                                    {member.boardStatus === 'AUSENTE' && (member as any).absenceData ? (
                                                        (() => {
                                                            const abs = (member as any).absenceData;
                                                            const end = new Date(abs.endDate + 'T12:00:00');
                                                            end.setDate(end.getDate() + 1);
                                                            const returnDate = end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                                                            return `${abs.type.toUpperCase()} • VOLTA ${returnDate}`;
                                                        })()
                                                    ) : member.boardStatus}
                                                </span>
                                                <div className={`w-1.5 h-1.5 2xl:w-2.5 2xl:h-2.5 rounded-full ${dotColors[member.boardStatus]} shadow-md shrink-0`} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                </div>

                <style>{`
                    @keyframes marquee {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-33.33%); } 
                    }
                    @keyframes marquee-reverse {
                        0% { transform: translateX(-33.33%); }
                        100% { transform: translateX(0); } 
                    }
                    @keyframes glow {
                        0%, 100% { 
                            box-shadow: 0 0 25px rgba(14, 165, 233, 0.3), 0 0 15px rgba(14, 165, 233, 0.2); 
                            border-color: rgba(56, 189, 248, 0.6); 
                        }
                        50% { 
                            box-shadow: 0 0 40px rgba(14, 165, 233, 0.6), 0 0 25px rgba(14, 165, 233, 0.4); 
                            border-color: rgba(14, 165, 233, 1); 
                        }
                    }
                    .animate-glow {
                        animation: glow 2.5s ease-in-out infinite;
                    }
                    .animate-pulse-subtle {
                        animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                    }
                    .animate-marquee {
                        animation: marquee 160s linear infinite;
                    }
                    .animate-marquee-reverse {
                        animation: marquee-reverse 160s linear infinite;
                    }
                `}</style>

            </main>
        </div >
    );
};

export default AdminMonitoringView;
