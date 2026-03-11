/**
 * Utilitários de segurança e controle de acesso
 */

export const ADM_ROLES = [
    'ADMIN',
    'ADMINISTRADOR',
    'SYSTEM_ADMIN',
    'GESTOR',
    'GESTAO',
    'GESTÃO',
    'GERENTE',
    'PMO',
    'CEO',
    'DIRETORIA',
    'DIRETORIA_GERAL',
    'EXECUTIVE',
    'COORDENADOR'
];

/**
 * Verifica se o usuário tem privilégios de administrador/gestão global
 * @param {Object} user - Objeto do usuário do request
 * @returns {boolean}
 */
export const isAdmUser = (user) => {
    if (!user?.role) return false;
    const normalizedRole = String(user.role).trim().toUpperCase().replaceAll(/\s+/g, '_');
    return ADM_ROLES.includes(normalizedRole);
};
