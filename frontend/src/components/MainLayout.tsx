import React, { useState, useContext } from 'react';
import { ThemeContext } from '@/App';
import HelpButton from './HelpButton';
import { Outlet, useNavigate, useLocation, useNavigationType } from 'react-router-dom';
import { ALL_ADMIN_ROLES } from '@/constants/roles';
import { useAuth } from '@/contexts/AuthContext';
import { User, Role, Organization } from '@/types';
import {
    LayoutDashboard,
    Users,
    CheckSquare,
    LogOut,
    Briefcase,
    Clock,
    Menu,
    X,
    Moon,
    Sun,
    Book,
    GraduationCap,
    StickyNote,
    Activity,
    Palmtree,
    History,
    Settings,
    Palette
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import ThemeEditor from './ThemeEditor';
import logoImg from '@/assets/logo.png';


const MainLayout: React.FC = () => {
    const { currentUser, logout, organization } = useAuth();
    const { themeMode, toggleTheme } = useContext(ThemeContext) as { themeMode: 'dark' | 'light', toggleTheme: () => void };
    const navigate = useNavigate();
    const location = useLocation();
    const navType = useNavigationType(); // Detecta PUSH, POP, REPLACE
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isThemeEditorOpen, setIsThemeEditorOpen] = useState(false);

    const isExpanded = sidebarOpen || isHovered;

    // Definição dos menus (movido para cima para ser usado na lógica de animação do menu)
    const adminMenuItems = [
        { path: '/admin/monitoring', icon: Activity, label: 'Monitoramento' },
        { path: '/admin/clients', icon: Briefcase, label: 'Gestão' },
        { path: '/tasks', icon: CheckSquare, label: 'Tarefas' },
        { path: '/admin/team', icon: Users, label: 'Colaboradores' },
        { path: '/admin/rh', icon: Palmtree, label: 'Gestão RH' },
        { path: '/admin/reports', icon: LayoutDashboard, label: 'Relatórios' },

        { path: '/timesheet', icon: Clock, label: 'Timesheet' },
        { path: '/admin/timeline', icon: History, label: 'Ações de Usuário' },
    ];

    const developerMenuItems = [
        { path: '/developer/projects', icon: Briefcase, label: 'Projetos' },
        { path: '/developer/tasks', icon: CheckSquare, label: 'Minhas Tarefas' },
        { path: '/timesheet', icon: Clock, label: 'Timesheet' },
        { path: '/developer/learning', icon: GraduationCap, label: 'Estudo' },
        { path: '/notes', icon: StickyNote, label: 'Notas' },
        { path: '/docs', icon: Book, label: 'Documentação' },
    ];

    const adminRoles = ALL_ADMIN_ROLES;

    const normalizedRole = String(currentUser?.role || '').trim().toLowerCase().replace(/\s+/g, '_');
    const menuItems = adminRoles.includes(normalizedRole as Role)
        ? adminMenuItems
        : developerMenuItems;

    // Listamos as rotas "raiz" do menu para forçar a animação
    const MAIN_PATHS = React.useMemo(() => menuItems.map(m => m.path).concat(['/profile']), [menuItems]);

    // Fechar sidebar automaticamente em telas específicas (ex: Executive Insights)
    React.useEffect(() => {
        const checkTab = () => {
            const params = new URLSearchParams(window.location.search);
            if (params.get('tab') === 'executivo') {
                setSidebarOpen(false);
            }
        };

        const handleCloseSidebar = () => setSidebarOpen(false);

        window.addEventListener('closeSidebar', handleCloseSidebar);
        // Verifica no mount e em mudanças de location
        checkTab();

        return () => window.removeEventListener('closeSidebar', handleCloseSidebar);
    }, [location.search]);

    // Ref para guardar o path anterior e calcular direção instantaneamente
    const prevPathRef = React.useRef(location.pathname);
    const [direction, setDirection] = useState<'root' | 'forward' | 'back' | 'menu-down' | 'menu-up'>('root');

    // Sincronizar direção imediatamente ao detectar mudança de path
    if (prevPathRef.current !== location.pathname) {
        const prev = prevPathRef.current.endsWith('/') && prevPathRef.current !== '/' ? prevPathRef.current.slice(0, -1) : prevPathRef.current;
        const curr = location.pathname.endsWith('/') && location.pathname !== '/' ? location.pathname.slice(0, -1) : location.pathname;

        const isPrevMain = MAIN_PATHS.some(p => prev === p);
        const isCurrentMain = MAIN_PATHS.some(p => curr === p);

        let newDir: 'root' | 'forward' | 'back' | 'menu-down' | 'menu-up' = 'root';

        if (curr.startsWith(prev + '/')) {
            newDir = 'forward';
        } else if (prev.startsWith(curr + '/')) {
            newDir = 'back';
        } else if (isPrevMain && isCurrentMain) {
            const prevIndex = menuItems.findIndex(m => m.path === prev);
            const currIndex = menuItems.findIndex(m => m.path === curr);
            if (prevIndex !== -1 && currIndex !== -1) {
                newDir = currIndex > prevIndex ? 'menu-down' : 'menu-up';
            } else {
                newDir = 'root';
            }
        } else if (navType === 'POP') {
            newDir = 'back';
        } else {
            newDir = 'root';
        }

        if (direction !== newDir) setDirection(newDir);
        prevPathRef.current = location.pathname;
    }

    // Variantes de animação premium estilo iOS Stacking (Impilhamento)
    const variants = {
        initial: (dir: string) => {
            if (dir === 'forward') return {
                x: '100%',
                opacity: 1,
                scale: 1,
                zIndex: 50,
                boxShadow: '-10px 0 30px rgba(0,0,0,0.1)', // Sombra no lado esquerdo do que está entrando
            };
            if (dir === 'back') return {
                x: '-10%', // Efeito de profundidade sutil
                opacity: 0.9,
                scale: 0.98,
                zIndex: 0,
            };

            if (dir === 'menu-down') return { y: '5%', opacity: 0, scale: 0.98 };
            if (dir === 'menu-up') return { y: '-5%', opacity: 0, scale: 0.98 };

            return { opacity: 0, scale: 0.99 };
        },
        animate: {
            x: 0,
            y: 0,
            opacity: 1,
            scale: 1,
            zIndex: 10,
            transition: {
                duration: 0.4,
                ease: [0.32, 0.72, 0, 1] as [number, number, number, number]
            }
        },
        exit: (dir: string) => {
            if (dir === 'forward') return {
                x: '-10%',
                opacity: 0.8,
                scale: 0.98,
                zIndex: 0,
                pointerEvents: 'none' as const,
                transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] }
            };
            if (dir === 'back') return {
                x: '100%',
                opacity: 1,
                scale: 1,
                zIndex: 50,
                boxShadow: '-10px 0 30px rgba(0,0,0,0.1)',
                pointerEvents: 'none' as const,
                transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] }
            };

            if (dir === 'menu-down') return { y: '-5%', opacity: 0, scale: 0.98, pointerEvents: 'none' as const, transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } };
            if (dir === 'menu-up') return { y: '5%', opacity: 0, scale: 0.98, pointerEvents: 'none' as const, transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } };

            return { opacity: 0, scale: 0.99, pointerEvents: 'none' as const, transition: { duration: 0.3 } };
        }
    };

    const handleLogout = async () => {

        try {
            await logout();

            navigate('/login', { replace: true });
        } catch (error) {
            console.error('[MainLayout] Erro crítico no logout:', error);
            navigate('/login', { replace: true });
        }
    };

    const isActive = (path: string) => {
        return location.pathname.startsWith(path);
    };

    return (
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
            {/* Sidebar Wrapper */}
            <div
                className={`relative z-30 flex-shrink-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${sidebarOpen ? 'w-64' : 'w-20'}`}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div
                    className={`absolute left-0 top-0 h-full flex flex-col z-20 shadow-2xl border-r overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isExpanded ? 'w-64' : 'w-20'}`}
                    style={{
                        background: 'linear-gradient(180deg, var(--sidebar-bg), var(--sidebar-bg-2))',
                        borderColor: 'var(--sidebar-border)'
                    }}
                >
                    <div className="flex items-center border-b h-[80px] relative overflow-hidden" style={{ borderColor: 'var(--sidebar-border)' }}>
                        <div className="w-20 flex-shrink-0 flex items-center justify-center">
                            <img src={organization?.logo_url || logoImg} alt="Logo" className="w-8 h-8 object-contain shrink-0" />
                        </div>
                        <div className="flex-1 flex items-center min-w-0 pr-12">
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.h1
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="text-xl font-bold tracking-widest uppercase whitespace-nowrap overflow-hidden"
                                        style={{ color: 'var(--sidebar-text)' }}
                                    >
                                        {organization?.name || 'NIC-LABS'}
                                    </motion.h1>
                                )}
                            </AnimatePresence>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className={`absolute right-4 p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-all ${!isExpanded ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100 scale-100'}`}
                            style={{ color: 'var(--sidebar-text)' }}
                        >
                            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* User Info Melhorado e Clicável */}
                    <button
                        className="border-b w-full bg-white/5 hover:bg-white/10 transition-all flex items-center group focus:outline-none relative h-[90px] overflow-hidden px-2 outline-none"
                        style={{ cursor: 'pointer', borderColor: 'var(--sidebar-border)' }}
                        onClick={() => {
                            navigate('/profile');
                        }}
                        title="Ver/editar perfil"
                    >
                        {isActive('/profile') && (
                            <div className="absolute left-0 top-0 w-1.5 h-full bg-white z-10 shadow-[0_0_10px_white]" />
                        )}
                        <div className="w-16 flex-shrink-0 flex items-center justify-center relative">
                            {currentUser?.avatarUrl ? (
                                <img
                                    src={currentUser.avatarUrl}
                                    alt={currentUser.name}
                                    className="w-10 h-10 rounded-full object-cover border-2 shadow-md group-hover:scale-110 transition-transform"
                                    style={{ borderColor: 'var(--sidebar-border)' }}
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-[var(--primary-soft)] flex items-center justify-center text-lg font-bold border-2 shadow-md group-hover:scale-110 transition-transform"
                                    style={{ borderColor: 'var(--sidebar-border)', color: 'var(--primary)' }}>
                                    {currentUser?.name?.charAt(0) || 'U'}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0 pr-4 text-left ml-2">
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="overflow-hidden"
                                    >
                                        <p className="font-bold truncate leading-tight transition-colors" style={{ color: 'var(--sidebar-text)' }}>{currentUser?.name}</p>
                                        <p className="text-[10px] truncate uppercase tracking-widest font-black mt-0.5 opacity-60" style={{ color: 'var(--sidebar-text)' }}>{currentUser?.role || 'Colaborador'}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </button>

                    <nav className="flex-1 px-2 py-4 space-y-2 overflow-y-auto no-scrollbar">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.path);

                            return (
                                <button
                                    key={item.path}
                                    onClick={() => {
                                        navigate(item.path);
                                    }}
                                    className="w-full h-12 flex items-center rounded-xl transition-all relative group/item overflow-hidden px-0 outline-none"
                                    style={{
                                        backgroundColor: active ? 'var(--primary)' : 'transparent',
                                        color: active ? 'white' : 'var(--sidebar-text)',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!active) {
                                            e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!active) {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }
                                    }}
                                >
                                    <div className="w-16 h-full flex items-center justify-center flex-shrink-0 transition-transform group-hover/item:scale-110">
                                        <Icon className="w-5 h-5" style={{
                                            color: active ? 'white' : 'var(--sidebar-text)',
                                            opacity: active ? 1 : 0.6,
                                            transition: 'color 0.2s, opacity 0.2s'
                                        }} />
                                    </div>
                                    <div className="flex-1 pr-4 overflow-hidden relative text-left ml-2">
                                        <AnimatePresence initial={false}>
                                            {isExpanded && (
                                                <motion.span
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -10 }}
                                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                                    className="font-bold text-sm whitespace-nowrap block"
                                                    translate="no"
                                                >
                                                    {item.label}
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    {active && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white rounded-r-full shadow-[0_0_10px_white] z-10" />
                                    )}
                                </button>
                            );
                        })}

                        {/* Divider visual subtle */}
                        <div className="my-4 h-px bg-white/10 mx-2" />

                        {/* Theme Toggle Button - Now Integrated */}
                        <button
                            onClick={toggleTheme}
                            className="w-full h-12 flex items-center rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5 group/theme overflow-hidden px-0 outline-none"
                            style={{ color: 'var(--sidebar-text)' }}
                        >
                            <div className="w-16 h-full flex items-center justify-center flex-shrink-0 transition-transform group-hover/theme:rotate-12 opacity-60 group-hover/theme:opacity-100">
                                {themeMode === 'light' ? (
                                    <Moon className="w-5 h-5" />
                                ) : (
                                    <Sun className="w-5 h-5" />
                                )}
                            </div>
                            <div className="flex-1 pr-4 overflow-hidden relative text-left ml-2">
                                <AnimatePresence initial={false}>
                                    {isExpanded && (
                                        <motion.span
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            transition={{ duration: 0.2 }}
                                            className="font-bold text-sm whitespace-nowrap block opacity-60 group-hover/theme:opacity-100"
                                        >
                                            {themeMode === 'light' ? 'Modo Escuro' : 'Modo Claro'}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </div>
                        </button>

                        {/* Logout - Now Integrated */}
                        <button
                            onClick={handleLogout}
                            className="w-full h-12 flex items-center rounded-xl transition-all hover:bg-red-500/10 dark:hover:bg-red-500/20 group/logout overflow-hidden px-0 outline-none"
                            style={{ color: 'var(--sidebar-text)' }}
                        >
                            <div className="w-16 h-full flex items-center justify-center flex-shrink-0 transition-transform group-hover/logout:translate-x-1 opacity-60 group-hover/logout:opacity-100 text-red-500">
                                <LogOut className="w-5 h-5" />
                            </div>
                            <div className="flex-1 pr-4 overflow-hidden relative text-left ml-2">
                                <AnimatePresence initial={false}>
                                    {isExpanded && (
                                        <motion.span
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            transition={{ duration: 0.2 }}
                                            className="font-bold text-sm whitespace-nowrap block opacity-60 group-hover/logout:opacity-100"
                                        >
                                            Sair do Sistema
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </div>
                        </button>

                        {/* Theme Customizer - ADMIN ONLY */}
                        {adminRoles.includes(normalizedRole as Role) && (
                            <button
                                onClick={() => setIsThemeEditorOpen(true)}
                                className="w-full h-12 flex items-center rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5 group/theme-editor overflow-hidden px-0 outline-none mt-2"
                                style={{ color: 'var(--sidebar-text)' }}
                            >
                                <div className="w-16 h-full flex items-center justify-center flex-shrink-0 transition-transform group-hover/theme-editor:scale-110 opacity-60 group-hover/theme-editor:opacity-100">
                                    <Palette className="w-5 h-5" />
                                </div>
                                <div className="flex-1 pr-4 overflow-hidden relative text-left ml-2">
                                    <AnimatePresence initial={false}>
                                        {isExpanded && (
                                            <motion.span
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -10 }}
                                                transition={{ duration: 0.2 }}
                                                className="font-bold text-sm whitespace-nowrap block opacity-60 group-hover/theme-editor:opacity-100"
                                            >
                                                Personalizar UI
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </button>
                        )}
                    </nav>

                </div>
            </div>

            {/* Main Content - iOS Navigation Wrapper */}
            <div className="flex-1 overflow-hidden relative" style={{ background: 'var(--bg)' }}>
                <div className="h-full w-full relative overflow-hidden"
                    style={{ backgroundColor: 'var(--bg)' }}>
                    <AnimatePresence custom={direction}>
                        <motion.div
                            key={location.pathname}
                            custom={direction}
                            variants={variants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="h-full w-full overflow-auto absolute inset-0 custom-scrollbar"
                            style={{ backgroundColor: 'var(--bg)' }}
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Modal de Customização de Tema */}
            <ThemeEditor 
                isOpen={isThemeEditorOpen} 
                onClose={() => setIsThemeEditorOpen(false)} 
            />

            {/* Contextual Help System - Oculto na aba executiva para maximizar espaço */}
            {new URLSearchParams(location.search).get('tab') !== 'executivo' && <HelpButton />}
        </div>
    );
};

export default MainLayout;
