import Vibrant from 'node-vibrant';

/**
 * Serviço responsável pela extração de cores e lógica de tematização.
 */
export const themeService = {
    /**
     * Extrai a paleta de cores principal de uma logo via URL.
     * @param {string} logoUrl URL da imagem
     */
    async extractColorsFromLogo(logoUrl) {
        if (!logoUrl) {
            return this.getFallbackTheme();
        }

        try {
            const palette = await Vibrant.from(logoUrl).getPalette();

            return {
                themePrimary: palette.Vibrant?.getHex() || '#1e293b',
                themeSecondary: palette.Muted?.getHex() || '#334155',
                themeAccent: palette.DarkVibrant?.getHex() || '#6366f1'
            };
        } catch (error) {
            console.error('[ThemeService] Erro ao extrair cores da logo:', error);
            return this.getFallbackTheme();
        }
    },

    /**
     * Retorna o tema padrão do sistema.
     */
    getFallbackTheme() {
        return {
            themePrimary: '#1e293b',
            themeSecondary: '#334155',
            themeAccent: '#6366f1'
        };
    }
};
