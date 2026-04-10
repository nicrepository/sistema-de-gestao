// frontend/src/services/apiClient.ts
// Cliente de API centralizado para o Backend Express
import { supabase } from './supabaseClient';

const AUTH_TOKEN_KEY = 'nic_labs_auth_token'; // mantido para compatibilidade de logout

/**
 * Obtém o token JWT sempre fresco do Supabase SDK.
 * O SDK gerencia refresh automático de tokens, garantindo validade.
 */
async function getValidToken(): Promise<string | null> {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
            // Fallback: tenta o token do localStorage (compatibilidade)
            const localToken = localStorage.getItem(AUTH_TOKEN_KEY);
            if (localToken && localToken !== 'undefined' && localToken !== 'null' && localToken.length > 20) {
                return localToken;
            }
            return null;
        }
        // Verifica se o token vai expirar em menos de 30 segundos e faz refresh
        const expiresAt = session.expires_at ?? 0;
        const nowSec = Math.floor(Date.now() / 1000);
        if (expiresAt - nowSec < 30) {
            const { data: refreshed } = await supabase.auth.refreshSession();
            return refreshed.session?.access_token ?? null;
        }
        return session.access_token;
    } catch (e) {
        // Fallback para localStorage
        const localToken = localStorage.getItem(AUTH_TOKEN_KEY);
        return (localToken && localToken !== 'undefined' && localToken.length > 20) ? localToken : null;
    }
}

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

    if (!baseUrl) throw new Error("Configuração da API não encontrada.");

    // Bloqueia chamadas que contenham 'undefined' como string no path
    if (path.includes('/undefined') || path.endsWith('/undefined')) {
        console.error('[API] Chamada abortada: Path contém "undefined":', path);
        throw new Error(`Caminho de API inválido (${path}). Verifique se os IDs estão carregados.`);
    }

    // Limpar barra inicial para concatenação
    const finalPath = path.startsWith('/') ? path.substring(1) : path;

    // Obtém token sempre fresco via Supabase SDK (com refresh automático)
    const token = await getValidToken();

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

    console.debug(`[API] ${options.method || 'GET'} ${fullUrl}`, options.body ? JSON.parse(String(options.body)) : '');
    const response = await fetch(fullUrl, { ...options, headers });

    if (response.status === 401) {
        // Token inválido — limpa sessão e redireciona para login
        localStorage.removeItem(AUTH_TOKEN_KEY);
        await supabase.auth.signOut();
        globalThis.location.href = '/login';
        throw new Error("Sessão expirada. Por favor, faça login novamente.");
    }

    if (!response.ok) {
        let errorMsg = response.statusText;
        try {
            const errData = await response.json();
            errorMsg = errData.error || errData.message || JSON.stringify(errData);
        } catch (e) { /* ignore */ }
        throw new Error(`Erro na API (${response.status}): ${errorMsg}`);
    }

    // Respostas sem body (204 No Content ou Content-Length: 0) não devem chamar response.json()
    const contentLength = response.headers.get('content-length');
    if (response.status === 204 || contentLength === '0') {
        return null as unknown as T;
    }

    // O backend customizado retorna no formato { success: true, data: ... }
    const responseData = await response.json();

    if (responseData?.success === true) {
        // SEMPRE prioriza o campo 'data'. Se não existir, retorna [] como fallback seguro para listagens
        return (responseData.data !== undefined ? responseData.data : []) as T;
    }

    // Se success for false, extraímos a mensagem de erro do campo 'error'
    const errorMessage = responseData?.error || responseData?.message || 'Erro desconhecido na resposta da API';
    console.error(`[API] Erro (${response.status}):`, errorMessage, responseData);
    throw new Error(errorMessage);
}

/**
 * Helper para download de arquivos/blobs
 */
export async function apiDownload(path: string, options: RequestInit = {}): Promise<{ blob: Blob, filename: string }> {
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

    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'download.xlsx'; // Fallback

    if (contentDisposition) {
        let filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (!filenameMatch) {
            filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
        }
        if (filenameMatch && filenameMatch[1]) {
            filename = decodeURIComponent(filenameMatch[1]);
        }
    }

    return { blob, filename };
}
