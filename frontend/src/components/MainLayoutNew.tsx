// MainLayoutNew.tsx - Top Navigation + Command Palette + Context Panel
import React, { useState, useContext, useEffect } from 'react';
import { ThemeContext } from '@/App';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ALL_ADMIN_ROLES } from '@/constants/roles';
import { Role } from '@/types';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  LogOut,
  Briefcase,
  Clock,
  Moon,
  Sun,
  Book,
  GraduationCap,
  StickyNote,
  Activity,
  Palmtree,
  Bell,
  Search,
  Menu,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import logoImg from '@/assets/logo.png';
import { CommandPalette } from './CommandPalette';
import { ContextPanel } from './ContextPanel';
import NotificationCenter from './NotificationCenter';

const MainLayoutNew: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { themeMode, toggleTheme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [miniSidebarOpen, setMiniSidebarOpen] = useState(true);
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  const [notificationOpen, setNotificationOpen] = useState(false);

  // Menus
  const adminMenuItems = [
    { path: '/admin/monitoring', icon: Activity, label: 'Monitoramento' },
    { path: '/admin/clients', icon: Briefcase, label: 'Gestão' },
    { path: '/tasks', icon: CheckSquare, label: 'Tarefas' },
    { path: '/admin/team', icon: Users, label: 'Colaboradores' },
    { path: '/admin/rh', icon: Palmtree, label: 'Gestão RH' },
    { path: '/admin/reports', icon: LayoutDashboard, label: 'Relatórios' },
    { path: '/timesheet', icon: Clock, label: 'Timesheet' },
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

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Ctrl+K para abrir command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Animações de transição de página
  const variants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  };

  return (
    <>
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
        {/* TOP NAVIGATION */}
        <div
          className="h-16 border-b flex items-center px-6 justify-between z-20"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          {/* Left Side */}
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img src={logoImg} alt="Logo" className="w-8 h-8 object-contain" />
              <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                NIC-LABS
              </h1>
            </div>

            {/* Top Menu */}
            <nav className="hidden lg:flex items-center gap-2">
              {menuItems.slice(0, 5).map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium text-sm
                      ${active ? 'shadow-sm' : ''}
                    `}
                    style={{
                      backgroundColor: active ? 'var(--primary)' : 'transparent',
                      color: active ? 'white' : 'var(--text-2)'
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {/* Search Button (opens Command Palette) */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border transition-all"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--muted)'
              }}
            >
              <Search className="w-4 h-4" />
              <span className="text-sm">Buscar...</span>
              <kbd
                className="px-2 py-0.5 text-xs rounded border ml-2"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)'
                }}
              >
                Ctrl+K
              </kbd>
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="p-2 rounded-lg hover:bg-opacity-10 transition-all relative"
                style={{ color: 'var(--text)' }}
              >
                <Bell className="w-5 h-5" />
                <span
                  className="absolute top-1 right-1 w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: 'var(--danger)' }}
                />
              </button>
              <NotificationCenter
                isOpen={notificationOpen}
                onClose={() => setNotificationOpen(false)}
              />
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-all"
              style={{ color: 'var(--text)' }}
            >
              {themeMode === 'light' ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>

            {/* User Avatar */}
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border-2"
                  style={{ borderColor: 'var(--border)' }}
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2"
                  style={{
                    backgroundColor: 'var(--primary-soft)',
                    color: 'var(--primary)',
                    borderColor: 'var(--primary)'
                  }}
                >
                  {currentUser?.name?.charAt(0) || 'U'}
                </div>
              )}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-opacity-10 transition-all"
              style={{ color: 'var(--danger)' }}
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MAIN CONTENT WRAPPER */}
        <div className="flex flex-1 overflow-hidden">
          {/* MINI SIDEBAR (Colapsável) - FIXED: Always shows toggle button */}
          <div
            className={`
              ${miniSidebarOpen ? 'w-20' : 'w-16'}
              transition-all duration-300 border-r flex-shrink-0 relative
            `}
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--border)'
            }}
          >
            <div className="p-3 space-y-2">
              {/* Toggle button - Always visible */}
              <button
                onClick={() => setMiniSidebarOpen(!miniSidebarOpen)}
                className="w-full p-3 rounded-lg hover:bg-opacity-10 transition-all group"
                style={{ color: 'var(--text)' }}
                title={miniSidebarOpen ? 'Recolher menu' : 'Expandir menu'}
              >
                <Menu className="w-5 h-5 mx-auto" />
              </button>

              {/* Menu items - Hidden when collapsed */}
              {miniSidebarOpen && (
                <>
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className="w-full p-3 rounded-lg transition-all relative group"
                        style={{
                          backgroundColor: active ? 'var(--primary-soft)' : 'transparent',
                          color: active ? 'var(--primary)' : 'var(--text-2)'
                        }}
                        title={item.label}
                      >
                        <Icon className="w-5 h-5 mx-auto" />
                        {active && (
                          <div
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                            style={{ backgroundColor: 'var(--primary)' }}
                          />
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 overflow-hidden flex">
            <div className="flex-1 overflow-auto custom-scrollbar" style={{ backgroundColor: 'var(--bg)' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  variants={variants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* CONTEXT PANEL (Sidebar Direita) */}
            {contextPanelOpen && <ContextPanel />}
          </div>
        </div>
      </div>
    </>
  );
};

export default MainLayoutNew;
