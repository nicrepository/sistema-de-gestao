import { supabaseAdmin } from './src/config/supabaseAdmin.js';
import 'dotenv/config';

async function checkRoles() {
    const { data, error } = await supabaseAdmin
        .from('dim_colaboradores')
        .select('role')
        .is('deleted_at', null);

    if (error) {
        console.error(error);
        return;
    }

    const roles = [...new Set(data.filter(d => d.role).map(d => d.role.trim()))];
    console.log('Unique Roles:', roles);
}

checkRoles();
