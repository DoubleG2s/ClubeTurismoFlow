import fs from 'fs';
import dotenv from 'dotenv';

console.log('🟢 inject-env.js iniciado');

/**
 * 1️⃣ Carrega variáveis locais se existirem (.env.local)
 *    Na Vercel isso não existe, então não muda nada
 */
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

console.log('SUPABASE_URL:', SUPABASE_URL ? 'OK' : 'MISSING');
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'OK' : 'MISSING');

/**
 * 2️⃣ Arquivos que receberão as variáveis
 */
const files = [
    'src/environments/environment.ts',
    'src/environments/environment.prod.ts'
];

files.forEach((file) => {
    if (!fs.existsSync(file)) {
        console.warn(`⚠️ Arquivo não encontrado: ${file}`);
        return;
    }

    let content = fs.readFileSync(file, 'utf8');

    content = content
        .replace('SUPABASE_URL_PLACEHOLDER', SUPABASE_URL)
        .replace('SUPABASE_ANON_KEY_PLACEHOLDER', SUPABASE_ANON_KEY);

    fs.writeFileSync(file, content);
    console.log(`✅ Variáveis injetadas em ${file}`);
});

console.log('🏁 inject-env.js finalizado');
