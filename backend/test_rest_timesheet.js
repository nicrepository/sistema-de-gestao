import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const url = `${process.env.SUPABASE_URL}/rest/v1/horas_trabalhadas?select=*,colaborador:dim_colaboradores(NomeColaborador:nome_colaborador)&limit=5`;
const headers = {
    "apikey": process.env.SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}`,
};

console.log("Testing Timesheet query with select join...");
console.log("URL:", url);

fetch(url, { headers })
    .then(async res => {
        console.log('Status:', res.status);
        console.log('Data sample:', (await res.json()).slice(0, 1));
    })
    .catch(console.error);
