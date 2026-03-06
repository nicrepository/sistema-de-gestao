// frontend/src/services/api.ts (ou o nome do seu arquivo de api)

const AUTH_TOKEN_KEY = 'nic_labs_auth_token';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
let cachedApiUrl: string | null = null;

export async function getApiBaseUrl(): Promise<string> {
    const envUrl = import.meta.env.VITE_API_URL?.toString()?.trim();
    const isLocalHost = globalThis.location.hostname === 'localhost' || globalThis.location.hostname === '127.0.0.1';

    // Se estiver no .env, usa ele - exceto se for localhost rodando fora de localhost
    if (envUrl && envUrl !== 'undefined' && envUrl !== '') {
        const isEnvLocal = envUrl.includes('localhost') || envUrl.includes('127.0.0.1');

        if (!isEnvLocal || isLocalHost) {
            let url = envUrl.replace(/\/$/, '');
            if (!url.endsWith('/api')) url += '/api';
            return url;
        }
        console.warn('[API] VITE_API_URL ignora localhost pois estamos em produção:', globalThis.location.hostname);
    }

    // Se estiver rodando localmente, tenta o local:3000
    if (isLocalHost) {
        const url = 'http://localhost:3000/api';
        console.log('[API] Usando fallback para localhost:3000');
        return url;
    }

    // Último recurso: Supabase REST (Caminho A)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl) {
        console.log('[API] Usando fallback para Supabase REST (Produção)');
        return `${supabaseUrl}/rest/v1`;
    }

    console.error('[API] Nenhuma URL de API configurada!');
    return '';
}

/**
 * Aplica transformações específicas para o PostgREST do Supabase.
 */
function applyPostgrestTransformations(path: string, options: RequestInit): { finalPath: string; fetchOptions: RequestInit } {
    let finalPath = path;
    const fetchOptions = { ...options };

    const method = fetchOptions.method || 'GET';
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    const baseMappings: Record<string, { view: string, table: string, pk: string, select?: string }> = {
        '/support/': { view: '/support_', table: '/support_', pk: 'id' },
        '/audit-logs': { view: '/audit_logs', table: '/audit_logs', pk: 'id' },
        '/colaboradores': { view: '/v_colaboradores', table: '/dim_colaboradores', pk: 'id_colaborador' },
        '/clientes': { view: '/v_clientes', table: '/dim_clientes', pk: 'id_cliente' },
        '/projetos': { view: '/v_projetos', table: '/dim_projetos', pk: 'ID_Projeto' },
        '/tarefas': { view: '/v_tarefas', table: '/fato_tarefas', pk: 'id_tarefa_novo' },
        '/tasks': { view: '/v_tarefas', table: '/fato_tarefas', pk: 'id_tarefa_novo' },
        '/timesheets': { view: '/horas_trabalhadas', table: '/horas_trabalhadas', pk: 'ID_Horas_Trabalhadas', select: '*,colaborador:dim_colaboradores(NomeColaborador:nome_colaborador)' },
        '/allocations': { view: '/task_member_allocations', table: '/task_member_allocations', pk: 'id' }
    };

    let matchedPk = 'id';
    let matchedSelect: string | undefined = undefined;
    let matchedConfig: any = null;

    Object.entries(baseMappings).forEach(([key, config]) => {
        if (finalPath.includes(key)) {
            finalPath = finalPath.replace(key, isMutation ? config.table : config.view);
            matchedPk = config.pk;
            matchedSelect = config.select;
            matchedConfig = config;
        }
    });

    const urlParts = finalPath.split('?')[0].split('/');
    const lastPart = urlParts.at(-1);
    // Verificar se o último componente é um ID numérico (ex: /tarefas/41)
    if (urlParts.length >= 2 && lastPart && !Number.isNaN(Number(lastPart))) {
        urlParts.pop();
        const resource = urlParts.join('/');
        finalPath = `${resource}?${matchedPk}=eq.${lastPart}${finalPath.includes('?') ? '&' + finalPath.split('?')[1] : ''}`;
    }

    if (fetchOptions.method === 'PUT') fetchOptions.method = 'PATCH';

    if (finalPath.includes('?')) {
        const [urlStr, paramsStr] = finalPath.split('?');
        const searchParams = new URLSearchParams(paramsStr);
        const reserves = new Set(['select', 'limit', 'offset', 'order', 'columns', 'or', 'and']);

        // Mapeamento de filtros amigáveis para colunas do Banco
        const filterMap: Record<string, string> = {
            'userId': 'ID_Colaborador',
            'projectId': 'ID_Projeto',
            'taskId': 'id_tarefa_novo',
            'clientId': 'ID_Cliente',
            'startDate': 'Data',
            'endDate': 'Data'
        };

        [...searchParams.keys()].forEach(k => {
            const val = searchParams.get(k);
            if (reserves.has(k) || val?.includes('.')) return;

            const dbCol = filterMap[k];
            if (dbCol) {
                let op = 'eq';
                if (k === 'startDate') op = 'gte';
                if (k === 'endDate') op = 'lte';
                // Usar append para permitir múltiplos filtros na mesma coluna (ex: Data gte e lte)
                searchParams.append(dbCol, `${op}.${val}`);
                searchParams.delete(k);
            } else {
                searchParams.delete(k);
            }
        });

        if (matchedSelect && !isMutation && !searchParams.has('select')) {
            searchParams.set('select', matchedSelect);
        }

        const newQuery = searchParams.toString();
        finalPath = newQuery ? `${urlStr}?${newQuery}` : urlStr;
    } else if (matchedSelect && !isMutation) {
        finalPath = `${finalPath}?select=${matchedSelect}`;
    }

    if (isMutation && fetchOptions.body && typeof fetchOptions.body === 'string') {
        const payloadMappings: Record<string, Record<string, string>> = {
            '/dim_colaboradores': {
                'NomeColaborador': 'nome_colaborador',
                'Cargo': 'cargo',
                'hourlyCost': 'custo_hora',
                'dailyAvailableHours': 'horas_disponiveis_dia',
                'monthlyAvailableHours': 'horas_disponiveis_mes'
            },
            '/fato_tarefas': {
                'projectId': 'ID_Projeto',
                'clientId': 'ID_Cliente',
                'developerId': 'ID_Colaborador',
                'title': 'Afazer',
                'status': 'StatusTarefa',
                'estimatedDelivery': 'entrega_estimada',
                'actualDelivery': 'entrega_real',
                'scheduledStart': 'inicio_previsto',
                'actualStart': 'inicio_real',
                'progress': 'Porcentagem',
                'priority': 'Prioridade',
                'impact': 'Impacto',
                'risks': 'Riscos',
                'notes': 'Observações',
                'estimatedHours': 'estimated_hours',
                'description': 'description'
            },
            '/horas_trabalhadas': {
                'userId': 'ID_Colaborador',
                'projectId': 'ID_Projeto',
                'taskId': 'id_tarefa_novo',
                'clientId': 'ID_Cliente',
                'date': 'Data',
                'totalHours': 'Horas_Trabalhadas',
                'startTime': 'Hora_Inicio',
                'endTime': 'Hora_Fim',
                'lunchDeduction': 'Almoco_Deduzido',
                'description': 'Descricao'
            }
        };

        const targetTable = Object.keys(payloadMappings).find(t => finalPath.includes(t));
        if (targetTable) {
            try {
                const bodyObj = JSON.parse(fetchOptions.body);
                const map = payloadMappings[targetTable];

                // Conversão de valores específicos de tarefas (Status / Prioridade etc)
                const mapStatusToDb = (s: string) => {
                    switch (s) {
                        case 'Done': return 'Concluído';
                        case 'In Progress': return 'Andamento';
                        case 'Review': return 'Análise';
                        case 'Testing': return 'Teste';
                        case 'Todo': default: return 'Pré-Projeto';
                    }
                };
                const mapPriorityToDb = (p: string) => {
                    if (!p) return null;
                    switch (p) {
                        case 'Critical': return 'Crítica';
                        case 'High': return 'Alta';
                        case 'Medium': return 'Média';
                        case 'Low': return 'Baixa';
                        default: return null;
                    }
                };
                const mapImpactToDb = (i: string) => {
                    if (!i) return null;
                    switch (i) {
                        case 'High': return 'Alto';
                        case 'Medium': return 'Médio';
                        case 'Low': return 'Baixo';
                        default: return null;
                    }
                };

                const newBody: any = {};

                // Set of known extra columns that frontend might send correctly in their db name
                const validExtraColumns: Record<string, string[]> = {
                    '/dim_colaboradores': ['deleted_at', 'ativo', 'role', 'torre', 'nivel', 'email', 'avatar_url', 'atrasado', 'nome_colaborador', 'cargo', 'custo_hora', 'horas_disponiveis_dia', 'horas_disponiveis_mes'],
                    '/fato_tarefas': ['id_tarefa_novo', 'em_testes', 'deleted_at', 'attachment', 'link_ef', 'is_impediment', 'task_weight', 'ID_Projeto', 'ID_Cliente', 'ID_Colaborador', 'Afazer', 'StatusTarefa', 'entrega_estimada', 'entrega_real', 'inicio_previsto', 'inicio_real', 'Porcentagem', 'Prioridade', 'Impacto', 'Riscos', 'Observações', 'estimated_hours', 'dias_atraso', 'ID_Tarefa', 'description'],
                    '/horas_trabalhadas': ['ID_Horas_Trabalhadas', 'Data', 'ID_Colaborador', 'ID_Cliente', 'ID_Projeto', 'id_tarefa_novo', 'Horas_Trabalhadas', 'Hora_Inicio', 'Hora_Fim', 'Almoco_Deduzido', 'Descricao', 'deleted_at']
                };

                for (const key of Object.keys(bodyObj)) {
                    let mappedKey = map[key];
                    let isKnownColumn = false;

                    if (!mappedKey) {
                        const validCols = validExtraColumns[targetTable] || [];
                        if (validCols.includes(key)) {
                            mappedKey = key;
                            isKnownColumn = true;
                        }
                    } else {
                        isKnownColumn = true;
                    }

                    if (isKnownColumn && mappedKey) {
                        let val = bodyObj[key];

                        // Skip mapping if value is null or undefined to avoid PostgREST errors
                        if (val === null || val === undefined) continue;

                        // Treat empty strings as null for IDs/Numeric/Date fields to avoid 400 (especially 22007 invalid datetime)
                        if (typeof val === 'string' && val.trim() === '') {
                            const isNonText =
                                mappedKey.startsWith('ID_') ||
                                mappedKey.includes('_id') ||
                                mappedKey === 'id_tarefa_novo' ||
                                mappedKey.includes('entrega') ||
                                mappedKey.includes('inicio') ||
                                mappedKey.includes('Data') ||
                                mappedKey === 'Porcentagem' ||
                                mappedKey.includes('hours') ||
                                mappedKey.includes('weight');

                            if (isNonText) continue;
                        }

                        if (targetTable === '/fato_tarefas') {
                            if (key === 'status' || mappedKey === 'StatusTarefa') {
                                switch (val) {
                                    case 'Done': val = 'Concluído'; break;
                                    case 'In Progress': val = 'Andamento'; break;
                                    case 'Review': val = 'Análise'; break;
                                    case 'Testing': val = 'Teste'; break;
                                    case 'Backlog': case 'Todo': val = 'Pré-Projeto'; break;
                                }
                            }
                            if (key === 'priority' || mappedKey === 'Prioridade') val = mapPriorityToDb(val);
                            if (key === 'impact' || mappedKey === 'Impacto') val = mapImpactToDb(val);
                            if (key === 'em_testes' || mappedKey === 'em_testes') val = !!val;
                        }

                        newBody[mappedKey] = val;
                    }
                }

                // If it's a POST, remove the primary key from body if it's null or empty
                if (method === 'POST') {
                    const pk = matchedPk || 'id';
                    if (newBody[pk] === null || newBody[pk] === undefined || newBody[pk] === '') {
                        delete newBody[pk];
                    }
                }

                fetchOptions.body = JSON.stringify(newBody);
            } catch (e) {
                console.error('API Client Fallback Body Transform Error:', e);
            }
        }
    }

    return { finalPath, fetchOptions };
}

/**
 * Helper centralizado para chamadas à API
 */
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = await getApiBaseUrl();
    const supabaseKey = SUPABASE_KEY;

    if (!baseUrl) throw new Error("Configuração da API não encontrada.");

    const isPostgrest = baseUrl.includes('.supabase.co/rest/v1');
    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    let finalPath = path;
    let fetchOptions = { ...options };

    if (isPostgrest) {
        ({ finalPath, fetchOptions } = applyPostgrestTransformations(path, options));
        if (!supabaseKey) {
            console.error('[API] Erro: VITE_SUPABASE_ANON_KEY não definida no ambiente!');
        }
    }

    if (!finalPath.startsWith('/')) finalPath = '/' + finalPath;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'ngrok-skip-browser-warning': 'true',
        'Prefer': 'return=representation',
        ...(options.headers as any),
    };

    // Para Supabase, se não houver token de usuário, usamos o anon key também no Authorization
    // Isso ajuda em builds onde o header 'apikey' pode ser barrado ou ignorado por proxies/bolhas de rede
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    } else if (isPostgrest) {
        headers['Authorization'] = `Bearer ${supabaseKey}`;
    }

    const response = await fetch(`${baseUrl}${finalPath}`, { ...fetchOptions, headers });

    if (response.status === 401) localStorage.removeItem(AUTH_TOKEN_KEY);

    if (!response.ok) {
        let errorMsg = response.statusText;
        try {
            const errData = await response.json();
            errorMsg = errData.message || JSON.stringify(errData);
        } catch (e) { /* ignore */ }
        throw new Error(`Erro na API (${response.status}): ${errorMsg}`);
    }

    if (response.status === 204) return {} as T;
    const result = await response.json();

    if (result && typeof result === 'object' && 'success' in result) {
        if (!result.success) throw new Error(result.error || 'Erro desconhecido na API');
        return result.data as T;
    }

    return result as T;
}

/**
 * Helper para download de arquivos (Blob)
 */
export async function apiDownload(path: string, options: RequestInit = {}): Promise<Blob> {
    const baseUrl = await getApiBaseUrl();
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    const headers: Record<string, string> = {
        'apikey': supabaseKey,
        'ngrok-skip-browser-warning': 'true',
        ...(options.headers as any),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Download Error ${response.status}: ${text || response.statusText}`);
    }

    return response.blob();
}
