import { userRepository } from '../repositories/userRepository.js';

export const userService = {
    async createUser({ nome, cargo, email, password, role, ativo }) {
        const normalizedEmail = email.trim().toLowerCase();

        // 1) cria usuário no Supabase Auth (Admin API)
        const { data: created, error: createErr } = await userRepository.adminCreateUser(normalizedEmail, password);

        if (createErr) {
            const msg = (createErr.message || "").toLowerCase();
            if (!msg.includes("already")) {
                throw new Error(createErr.message);
            }
        }

        // Descobrir o user_id no Auth
        let authUserId = created?.user?.id;
        if (!authUserId) {
            const { data: listData, error: listErr } = await userRepository.listAuthUsers();
            if (!listErr && listData?.users?.length) {
                const found = listData.users.find(u => (u.email || "").toLowerCase() === normalizedEmail);
                authUserId = found?.id || null;
            }
        }

        // 2) upsert na dim_colaboradores
        const payload = {
            nome_colaborador: nome.trim(),
            cargo: cargo ? cargo.trim() : null,
            email: normalizedEmail,
            role: role.trim(),
            ativo: !!ativo,
            auth_user_id: authUserId
        };

        await userRepository.upsertCollaborator(payload);

        return { email: normalizedEmail, auth_user_id: authUserId };
    }
};
