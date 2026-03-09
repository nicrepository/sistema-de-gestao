import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRpc() {
    const q = `
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'relatorio_horas_custos';
    `;
    const { data, error } = await supabase.rpc('execute_sql', { query: q });
    if (error) {
        console.error("RPC fail, trying direct sql via REST or you can just run it", error);
    } else {
        console.log(data);
    }
}
fixRpc();
