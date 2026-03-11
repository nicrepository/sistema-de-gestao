import { supabaseAdmin } from './src/config/supabaseAdmin.js';
import 'dotenv/config';

async function checkMembers() {
    const { data: members, error } = await supabaseAdmin
        .from('project_members')
        .select('*')
        .limit(10);

    if (error) {
        console.error(error);
        return;
    }

    console.log('Project Members Sample:', members);
}

checkMembers();
