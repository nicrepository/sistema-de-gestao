// App.tsx - Versão com React Router e Theme Management
import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { NotificationProvider } from './contexts/NotificationContext';
import AppRoutes from './routes/AppRoutes';
import * as serviceWorkerRegistration from './utils/serviceWorkerRegistration';
import { useOrganizationTheme } from './hooks/useOrganizationTheme';

// Theme Helpers
const getThemeKey = (userId: string) => `nic_theme_${userId}`;

const loadTheme = (userId: string): 'dark' | 'light' => {
    const saved = localStorage.getItem(getThemeKey(userId));
    return (saved as 'dark' | 'light') || 'dark'; // Default: dark
};

const applyTheme = (mode: 'dark' | 'light') => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
};

const saveTheme = (userId: string, mode: 'dark' | 'light') => {
    localStorage.setItem(getThemeKey(userId), mode);
    applyTheme(mode);
};

// Theme Context para compartilhar com componentes
export const ThemeContext = React.createContext<{
    themeMode: 'dark' | 'light';
    toggleTheme: () => void;
}>({
    themeMode: 'dark',
    toggleTheme: () => { },
});

function AppContent() {
    const { currentUser, organization } = useAuth();
    const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');

    // Aplica o tema dinâmico da organização (cores, gradientes e modo base)
    useOrganizationTheme();

    // Carregar preferência manual do usuário quando mudar
    useEffect(() => {
        if (currentUser?.id) {
            // Se a organização já definiu um modo, usamos ele como base
            // Senão, pegamos a preferência do usuário (localStorage)
            const baseTheme = organization?.theme_mode || loadTheme(currentUser.id);
            setThemeMode(baseTheme as 'dark' | 'light');
            applyTheme(baseTheme as 'dark' | 'light');
        }
    }, [currentUser?.id, organization?.theme_mode]);

    const toggleTheme = () => {
        if (!currentUser?.id) return;

        const nextMode = themeMode === 'dark' ? 'light' : 'dark';
        setThemeMode(nextMode);
        saveTheme(currentUser.id, nextMode);
    };

    const themeValue = React.useMemo(() => ({ themeMode, toggleTheme }), [themeMode, toggleTheme]);

    return (
        <ThemeContext.Provider value={themeValue}>
            <DataProvider>
                <NotificationProvider>
                    <AppRoutes />
                </NotificationProvider>
            </DataProvider>
        </ThemeContext.Provider>
    );
}

function App() {
    // Register Service Worker for auto-updates
    useEffect(() => {
        // Only register in production
        if (import.meta.env.PROD) {
            serviceWorkerRegistration.register();
        }
    }, []);

    return (
        <BrowserRouter>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
