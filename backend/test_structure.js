import { supabaseAdmin } from './src/config/supabaseAdmin.js';
import 'dotenv/config';

async function checkStructure() {
    const { data, error } = await supabaseAdmin
        .from('dim_colaboradores')
        .select('*')
        .limit(1);

    if (error) {
        console.error(error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
    } else {
        console.log('No data found in dim_colaboradores');
    }
}

checkStructure();
