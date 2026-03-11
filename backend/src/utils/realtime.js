import { supabaseAdmin } from '../config/supabaseAdmin.js';

/**
 * Envia um sinal de atualização via Supabase Broadcast para o frontend.
 * Isso avisa os clientes conectados que eles precisam atualizar seus dados
 * chamando a API do backend, sem acessar o banco diretamente pelo front.
 */
export const notifyUpdates = async (type = 'general') => {
    try {
        const channel = supabaseAdmin.channel('app-updates');

        const status = await new Promise((resolve) => {
            channel.subscribe((s) => resolve(s));
        });

        if (status === 'SUBSCRIBED') {
            await channel.send({
                type: 'broadcast',
                event: 'refresh',
                payload: { type, timestamp: new Date().toISOString() },
            });
            console.log(`[Realtime] Notificação enviada: ${type}`);
        }

        supabaseAdmin.removeChannel(channel);
    } catch (error) {
        console.error('[Realtime] Erro ao enviar notificação:', error);
    }
};
