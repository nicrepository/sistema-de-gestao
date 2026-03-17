import { logger } from './logger.js';

/**
 * responseHelper.js - Padronização de respostas da API
 * Sucesso: { success: true, data: {} }
 * Erro: { success: false, error: "Mensagem amigável" }
 */

export const sendSuccess = (res, data, status = 200) => {
    return res.status(status).json({
        success: true,
        data
    });
};

export const sendError = (res, message, status = 400) => {
    return res.status(status).json({
        success: false,
        error: message
    });
};

export const handleRouteError = (res, error, context = 'Route') => {
    logger.error(`[${context}] Erro identificado: ${error.message || error}`, { context, stack: error.stack });

    // Erros customizados do banco podem ser tratados aqui
    if (error.code === 'PGRST116') {
        return sendError(res, 'Recurso não encontrado', 404);
    }

    const status = error.status || 500;
    return sendError(res, error.message || 'Erro interno do servidor', status);
};

