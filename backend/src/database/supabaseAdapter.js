import { supabaseAdmin } from '../config/supabaseAdmin.js';

/**
 * Tabelas que suportam soft-delete (possuem a coluna deleted_at)
 */
const SOFT_DELETE_TABLES = new Set([
    'horas_trabalhadas',
    'fato_tarefas',
    'dim_colaboradores',
    'dim_clientes',
    'dim_projetos'
]);

export const supabaseAdapter = {
    async findAll(table, query = {}) {
        let q = supabaseAdmin.from(table).select(query.select || '*', { count: query.count || 'exact' });

        // Soft Delete: só filtra deleted_at em tabelas que suportam
        if (!query.includeDeleted && SOFT_DELETE_TABLES.has(table)) {
            q = q.is('deleted_at', null);
        }

        if (query.filters) {
            for (const [key, value] of Object.entries(query.filters)) {
                if (value !== undefined && value !== null) {
                    q = q.eq(key, value);
                }
            }
        }

        if (query.in) {
            for (const [key, value] of Object.entries(query.in)) {
                if (value !== undefined) {
                    q = q.in(key, value);
                }
            }
        }

        if (query.is) {
            for (const [key, value] of Object.entries(query.is)) {
                if (value !== undefined) {
                    q = q.is(key, value);
                }
            }
        }

        if (query.gte) {
            for (const [key, value] of Object.entries(query.gte)) {
                if (value !== undefined) {
                    q = q.gte(key, value);
                }
            }
        }

        if (query.lte) {
            for (const [key, value] of Object.entries(query.lte)) {
                if (value !== undefined) {
                    q = q.lte(key, value);
                }
            }
        }

        if (query.order) {
            const ascending = query.order.ascending !== undefined ? query.order.ascending : true;
            q = q.order(query.order.column, { ascending });
        }

        if (query.or) {
            q = q.or(query.or);
        }

        // Paginação
        if (query.offset !== undefined && query.limit) {
            const from = Number.parseInt(query.offset);
            const to = from + Number.parseInt(query.limit) - 1;
            q = q.range(from, to);
        } else if (query.page && query.limit) {
            const page = Number.parseInt(query.page);
            const limit = Number.parseInt(query.limit);
            const from = (page - 1) * limit;
            const to = from + limit - 1;
            q = q.range(from, to);
        } else if (query.limit) {
            q = q.limit(query.limit);
        }

        if (query.single) {
            q = q.single();
        } else if (query.maybeSingle) {
            q = q.maybeSingle();
        }

        const { data, error, count } = await q;
        if (error) throw error;

        if (query.withCount) {
            return { data, count };
        }
        return data;
    },

    async findById(table, id, query = {}) {
        let q = supabaseAdmin.from(table).select(query.select || '*');

        // Soft Delete: só filtra deleted_at em tabelas que suportam
        if (!query.includeDeleted && SOFT_DELETE_TABLES.has(table)) {
            q = q.is('deleted_at', null);
        }

        const entries = Object.entries(id);
        if (entries.length === 0) throw new Error('Query ID object cannot be empty');
        const [key, value] = entries[0];
        q = q.eq(key, value);

        if (query.is) {
            for (const [k, v] of Object.entries(query.is)) {
                if (v !== undefined) {
                    q = q.is(k, v);
                }
            }
        }

        q = q.maybeSingle();

        const { data, error } = await q;
        if (error) throw error;
        return data;
    },

    async insert(table, data, options = {}) {
        let q = supabaseAdmin.from(table).insert(data);
        if (options.select !== false) {
            q = q.select(options.select || '*');
            if (!Array.isArray(data)) {
                q = q.single();
            }
        }
        const { data: created, error } = await q;
        if (error) throw error;
        return created;
    },

    async update(table, id, data, options = {}) {
        let q = supabaseAdmin.from(table).update(data);
        for (const [k, v] of Object.entries(id)) {
            q = q.eq(k, v);
        }
        if (options.select !== false) {
            q = q.select(options.select || '*').single();
        }
        const { data: updated, error } = await q;
        if (error) {
            console.error(`[SupabaseAdapter] Erro no update:`, error);
            throw error;
        }
        return updated;
    },

    async upsert(table, data, options = {}) {
        let q = supabaseAdmin.from(table).upsert(data, {
            onConflict: options.onConflict,
            ignoreDuplicates: options.ignoreDuplicates || false
        });

        if (options.select !== false) {
            q = q.select(options.select || '*');
            if (!Array.isArray(data)) {
                q = q.single();
            }
        }

        const { data: result, error } = await q;
        if (error) throw error;
        return result;
    },

    async delete(table, id) {
        if (SOFT_DELETE_TABLES.has(table)) {
            // Soft Delete: marca como deletado
            return await this.update(table, id, {
                deleted_at: new Date().toISOString()
            }, { select: false });
        }
        // Hard Delete: apaga permanentemente
        return await this.deletePermanent(table, id);
    },

    async deletePermanent(table, id) {
        let q = supabaseAdmin.from(table).delete();
        for (const [k, v] of Object.entries(id)) {
            q = q.eq(k, v);
        }
        const { error } = await q;
        if (error) throw error;
        return true;
    }
};
