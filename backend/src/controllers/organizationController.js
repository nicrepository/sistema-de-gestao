import { organizationRepository } from '../repositories/organizationRepository.js';
import { themeService } from '../services/themeService.js';
import { sendSuccess, handleRouteError } from '../utils/responseHelper.js';

/**
 * Controller para operações relacionadas a organizações e temas.
 */
export const organizationController = {
    /**
     * Retorna a organização e o tema do usuário logado.
     */
    async getMyOrganization(req, res) {
        try {
            const user = req.user;
            if (!user) return res.status(401).json({ error: 'Não autorizado' });

            // Busca colaborador pelo email ou id para pegar organization_id
            const { data: colab } = await organizationRepository.findByCollaboratorId(user.id);
            if (!colab) return res.status(404).json({ error: 'Usuário não vinculado a uma organização' });

            return sendSuccess(res, colab);
        } catch (e) {
            return handleRouteError(res, e, 'OrganizationController.getMyOrganization');
        }
    },

    /**
     * Gera e salva o tema a partir da logo.
     */
    async generateTheme(req, res) {
        try {
            const { id } = req.params;
            const org = await organizationRepository.findById(id);

            if (!org) return res.status(404).json({ error: 'Organização não encontrada' });

            // Se já tiver tema E não foi forçado, retorna o cache
            const { force } = req.query;
            if (!force && org.theme_primary) {
                return sendSuccess(res, {
                    themePrimary: org.theme_primary,
                    themeSecondary: org.theme_secondary,
                    themeAccent: org.theme_accent
                });
            }

            // Gerar pela logo
            const generated = await themeService.extractColorsFromLogo(org.logo_url);
            
            // Salvar no banco
            await organizationRepository.update(id, {
                theme_primary: generated.themePrimary,
                theme_secondary: generated.themeSecondary,
                theme_accent: generated.themeAccent
            });

            return sendSuccess(res, generated);
        } catch (e) {
            return handleRouteError(res, e, 'OrganizationController.generateTheme');
        }
    },

    /**
     * Atualiza o tema manualmente com overrides.
     */
    async updateTheme(req, res) {
        try {
            const { id } = req.params;
            const { themePrimary, themeSecondary, themeAccent, themeMode } = req.body;

            const payload = {};
            if (themePrimary) payload.theme_primary = themePrimary;
            if (themeSecondary) payload.theme_secondary = themeSecondary;
            if (themeAccent) payload.theme_accent = themeAccent;
            if (themeMode) payload.theme_mode = themeMode;

            // Salva também no theme_overrides JSON para auditoria/preview
            payload.theme_overrides = {
                manual: true,
                updatedAt: new Date().toISOString(),
                ...req.body
            };

            const updated = await organizationRepository.update(id, payload);
            return sendSuccess(res, updated);
        } catch (e) {
            return handleRouteError(res, e, 'OrganizationController.updateTheme');
        }
    }
};
