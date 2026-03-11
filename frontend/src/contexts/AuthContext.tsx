// contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, PropsWithChildren } from 'react';
import { User } from '@/types';
import { supabase } from '@/services/supabaseClient';
import { ALL_ADMIN_ROLES } from '@/constants/roles';

interface AuthContextType {
    currentUser: User | null;
    isLoading: boolean;
    authReady: boolean;
    isAdmin: boolean;
    login: (user: User, token: string) => void;
    logout: () => void;
    updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USER_CACHE_KEY = 'nic_labs_user_profile';
const AUTH_TOKEN_KEY = 'nic_labs_auth_token';

export const normalizeEmail = (email: string | undefined | null): string => {
    return (email || '').trim().toLowerCase();
};

export function AuthProvider({ children }: PropsWithChildren) {
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        try {
            const cached = localStorage.getItem(USER_CACHE_KEY);
            return cached ? JSON.parse(cached) : null;
        } catch {
            return null;
        }
    });
    const [isLoading, setIsLoading] = useState(true);
    const [authReady, setAuthReady] = useState(false);

    const init = useCallback(async () => {
        try {
            // Verifica se existe sessão ativa no Supabase SDK
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.access_token) {
                // Sessão válida — atualiza o token no localStorage
                localStorage.setItem(AUTH_TOKEN_KEY, session.access_token);

                // Mantém o perfil do cache se existir
                const cachedUser = localStorage.getItem(USER_CACHE_KEY);
                if (cachedUser) {
                    setCurrentUser(JSON.parse(cachedUser));
                }
            } else {
                // Sem sessão válida no Supabase — limpa tudo
                const localToken = localStorage.getItem(AUTH_TOKEN_KEY);
                if (localToken) {
                    // Token no localStorage mas sem sessão Supabase = token velho/corrompido
                    console.warn('[Auth] Token no localStorage sem sessão Supabase. Limpando.');
                    localStorage.removeItem(AUTH_TOKEN_KEY);
                    localStorage.removeItem(USER_CACHE_KEY);
                    setCurrentUser(null);
                } else {
                    setCurrentUser(null);
                }
            }
        } catch (e) {
            console.error('[Auth] Erro ao inicializar sessão:', e);
            setCurrentUser(null);
        } finally {
            setAuthReady(true);
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        init();

        // Listener para eventos de autenticação do Supabase
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                setCurrentUser(null);
                localStorage.removeItem(AUTH_TOKEN_KEY);
                localStorage.removeItem(USER_CACHE_KEY);
            } else if (event === 'TOKEN_REFRESHED' && session?.access_token) {
                // Atualiza o token no localStorage automaticamente quando o SDK faz refresh
                localStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
            }
        });

        return () => subscription.unsubscribe();
    }, [init]);

    const login = (user: User, token: string) => {
        setCurrentUser(user);
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
        localStorage.setItem(AUTH_TOKEN_KEY, token);
    };

    const logout = () => {
        setCurrentUser(null);
        localStorage.removeItem(USER_CACHE_KEY);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        window.location.href = '/login';
    };

    const updateUser = (user: User) => {
        setCurrentUser(user);
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    };

    const isAdmin = !!currentUser && (() => {
        const role = String(currentUser.role || '').trim().toLowerCase().replace(/\s+/g, '_');
        return ALL_ADMIN_ROLES.includes(role);
    })();

    return (
        <AuthContext.Provider value={{
            currentUser,
            isLoading: !authReady || isLoading,
            authReady,
            isAdmin,
            login,
            logout,
            updateUser
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
