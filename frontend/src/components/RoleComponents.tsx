// frontend/src/components/RoleComponents.tsx
// Componentes para conditional rendering baseado em roles

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole, FINANCIAL_ROLES, PROJECT_EDIT_ROLES, USER_MANAGEMENT_ROLES, ALL_ADMIN_ROLES } from '@/constants/roles';

interface ShowForRolesProps {
    roles: UserRole[];
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * Componente para mostrar conteúdo apenas para roles específicos
 */
export const ShowForRoles: React.FC<ShowForRolesProps> = ({
    roles,
    children,
    fallback = null
}) => {
    const { currentUser } = useAuth();

    if (!currentUser) return <>{fallback}</>;

    const userRole = String(currentUser.role || 'resource').trim().toLowerCase().replace(/\s+/g, '_');
    const hasPermission = (roles as string[]).includes(userRole);

    return hasPermission ? <>{children}</> : <>{fallback}</>;
};

/**
 * Componente para ocultar conteúdo de roles específicos
 */
export const HideForRoles: React.FC<ShowForRolesProps> = ({
    roles,
    children
}) => {
    const { currentUser } = useAuth();

    if (!currentUser) return null;

    const userRole = String(currentUser.role || 'resource').trim().toLowerCase().replace(/\s+/g, '_');
    const shouldHide = (roles as string[]).includes(userRole);

    return shouldHide ? null : <>{children}</>;
};

/**
 * Componente para mostrar dados financeiros (apenas para roles autorizados)
 */
export const ShowFinancialData: React.FC<{
    children: React.ReactNode;
    fallback?: React.ReactNode;
}> = ({ children, fallback = null }) => {
    const { currentUser } = useAuth();

    if (!currentUser) return <>{fallback}</>;

    const userRole = currentUser.role || 'resource';
    const canSee = FINANCIAL_ROLES.includes(userRole as UserRole);

    return canSee ? <>{children}</> : <>{fallback}</>;
};

/**
 * Componente para mostrar controles de edição de projeto
 */
export const ShowProjectEditControls: React.FC<{
    children: React.ReactNode;
    projectOwnerId?: string;
}> = ({ children, projectOwnerId }) => {
    const { currentUser } = useAuth();

    if (!currentUser) return null;

    const userRole = currentUser.role || 'resource';

    // System Admin sempre pode editar
    if (ALL_ADMIN_ROLES.includes(userRole)) {
        return <>{children}</>;
    }

    // PMO pode editar apenas seus projetos
    if (userRole === 'pmo' && projectOwnerId) {
        const canEdit = (
            projectOwnerId === currentUser.id ||
            projectOwnerId === currentUser.id.toString()
        );
        return canEdit ? <>{children}</> : null;
    }

    return null;
};

/**
 * Componente para mostrar controles de gerenciamento de usuários
 */
export const ShowUserManagement: React.FC<{
    children: React.ReactNode
}> = ({ children }) => {
    const { currentUser } = useAuth();

    if (!currentUser) return null;

    const userRole = currentUser.role || 'resource';
    const canManage = USER_MANAGEMENT_ROLES.includes(userRole as UserRole);

    return canManage ? <>{children}</> : null;
};

/**
 * Componente para mostrar apenas para admins
 */
export const ShowForAdmin: React.FC<{
    children: React.ReactNode
}> = ({ children }) => {
    return (
        <ShowForRoles roles={ALL_ADMIN_ROLES as any}>
            {children}
        </ShowForRoles>
    );
};

/**
 * Componente para mostrar para Executive e superiores
 */
export const ShowForExecutive: React.FC<{
    children: React.ReactNode
}> = ({ children }) => {
    return (
        <ShowForRoles roles={ALL_ADMIN_ROLES as any}>
            {children}
        </ShowForRoles>
    );
};

/**
 * Componente para mostrar para PMO e superiores
 */
export const ShowForPMO: React.FC<{
    children: React.ReactNode
}> = ({ children }) => {
    return (
        <ShowForRoles roles={ALL_ADMIN_ROLES as any}>
            {children}
        </ShowForRoles>
    );
};

/**
 * Hook para verificar permissões inline
 */
export const usePermissions = () => {
    const { currentUser } = useAuth();

    const userRole = currentUser?.role || 'resource';

    return {
        isAdmin: ALL_ADMIN_ROLES.includes(userRole),
        isExecutive: userRole === 'executive',
        isPMO: userRole === 'pmo',
        isFinancial: userRole === 'financial',
        isTechLead: userRole === 'tech_lead',
        isResource: userRole === 'resource',
        canSeeFinancial: FINANCIAL_ROLES.includes(userRole as UserRole),
        canEditProjects: PROJECT_EDIT_ROLES.includes(userRole as UserRole),
        canManageUsers: USER_MANAGEMENT_ROLES.includes(userRole as UserRole),
        userRole
    };
};
