// frontend/src/services/apiClient.ts
// Cliente de API centralizado para o Backend Express

const AUTH_TOKEN_KEY = 'nic_labs_auth_token';

/**
 * Obtém a URL base da API a partir do ambiente ou fallback seguro.
 * Não deve apontar diretamente para o Supabase REST.
 */
export async function getApiBaseUrl(): Promise<string> {
    const envUrl = import.meta.env.VITE_API_URL?.toString()?.trim();

    if (envUrl && envUrl !== 'undefined' && envUrl !== '') {
        let url = envUrl.replace(/\/$/, '');
        if (!url.endsWith('/api')) url += '/api';
        return url;
    }

    // Fallback padrão para desenvolvimento local
    return 'http://localhost:3000/api';
}

/**
 * Helper centralizado para chamadas à API.
 * Comunica-se exclusivamente com o Backend Customizado.
 */
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = await getApiBaseUrl();
    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    if (!baseUrl) throw new Error("Configuração da API não encontrada.");

    // Bloqueia chamadas que contenham 'undefined' como string no path
    if (path.includes('/undefined') || path.endsWith('/undefined')) {
        console.error('[API] Chamada abortada: Path contém "undefined":', path);
        throw new Error(`Caminho de API inválido (${path}). Verifique se os IDs estão carregados.`);
    }

    // Limpar barra inicial para concatenação
    let finalPath = path.startsWith('/') ? path.substring(1) : path;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(options.headers as any),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const sep = baseUrl.endsWith('/') ? '' : '/';
    const fullUrl = `${baseUrl}${sep}${finalPath}`;

    const response = await fetch(fullUrl, { ...options, headers });

    if (response.status === 401) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
    }

    if (!response.ok) {
        let errorMsg = response.statusText;
        try {
            const errData = await response.json();
            errorMsg = errData.message || JSON.stringify(errData);
        } catch (e) { /* ignore */ }
        throw new Error(`Erro na API (${response.status}): ${errorMsg}`);
    }

    // No backend customizado, o retorno já vem desempacotado
    const responseData = await response.json();
    return responseData as T;
}

/**
 * Helper para download de arquivos/blobs
 */
export async function apiDownload(path: string, options: RequestInit = {}): Promise<Blob> {
    const baseUrl = await getApiBaseUrl();
    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    let finalPath = path.startsWith('/') ? path.substring(1) : path;
    const headers: Record<string, string> = {
        'ngrok-skip-browser-warning': 'true',
        ...(options.headers as any),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const sep = baseUrl.endsWith('/') ? '' : '/';
    const response = await fetch(`${baseUrl}${sep}${finalPath}`, { ...options, headers });

    if (!response.ok) {
        let errorMsg = response.statusText;
        try {
            const errData = await response.json();
            errorMsg = errData.message || JSON.stringify(errData);
        } catch (e) { /* ignore */ }
        throw new Error(`Erro no download (${response.status}): ${errorMsg}`);
    }

    return await response.blob();
}
