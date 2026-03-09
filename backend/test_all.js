import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    for (const t of ['dim_clientes', 'dim_projetos', 'horas_trabalhadas']) {
        const { data, error } = await supabase.from(t).select('*').limit(1);
        console.log(t, ':', error || Object.keys(data[0] || {}));
    }
}
test();
