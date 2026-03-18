import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook para gerenciar e aplicar o tema da organização dinamicamente.
 * Atualiza variáveis CSS e classes de modo baseado nos dados do tenant.
 */
export const useOrganizationTheme = () => {
    const { organization } = useAuth();

    useEffect(() => {
        if (!organization) return;

        const root = document.documentElement;

        // 1. Aplicação de Cores Primárias (Sobrescrevendo defaults do theme.css)
        if (organization.theme_primary) {
            root.style.setProperty('--primary', organization.theme_primary);
            // Variantes derivadas (Opacidade para backgrounds)
            root.style.setProperty('--primary-soft', `${organization.theme_primary}1A`); // 10% opacidade
            root.style.setProperty('--primary-muted', `${organization.theme_primary}33`); // 20% opacidade
        }

        if (organization.theme_secondary) {
            // No nosso sistema, a cor secundária costuma ser usada no Sidebar
            root.style.setProperty('--sidebar-bg', organization.theme_secondary);
            root.style.setProperty('--sidebar-bg-2', organization.theme_secondary);
        }

        if (organization.theme_accent) {
            root.style.setProperty('--info', organization.theme_accent);
            root.style.setProperty('--status-occupied', organization.theme_accent);
        }

        // 2. Headings & Topbar (Baseado no tema)
        if (organization.theme_primary) {
            // Cria um gradiente elegante baseado na cor primária
            const primary = organization.theme_primary;
            root.style.setProperty('--header-bg', `linear-gradient(135deg, ${primary} 0%, ${primary}CC 100%)`);
        }

        // 3. Gerenciamento de Modo (Dark/Light)
        // Se a organização define um modo, ele é o preferencial
        if (organization.theme_mode) {
            const isDark = organization.theme_mode === 'dark';
            root.classList.toggle('dark', isDark);
            
            // Sincroniza com o localStorage do App.tsx original para manter compatibilidade
            localStorage.setItem(`nic_theme_global`, organization.theme_mode);
        }

    }, [organization]);

    return {
        organization,
        logo: organization?.logo_url || '/logo-default.png',
        name: organization?.name || 'Sistema'
    };
};
