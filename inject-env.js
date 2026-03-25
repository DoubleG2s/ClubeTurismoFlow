const fs = require('fs');
const dotenv = require('dotenv');

console.log('🟢 inject-env.js iniciado');

/**
 * Carrega .env.local se existir (desenvolvimento local)
 */
if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
    console.log('📝 .env.local carregado');
}

// Captura as variáveis (prioriza o que o dotenv carregou ou variáveis de sistema/Vercel)
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Logs de verificação (sem exibir as chaves por segurança)
console.log('SUPABASE_URL:', SUPABASE_URL ? '✅ OK' : '❌ MISSING');
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅ OK' : '❌ MISSING');
console.log('GEMINI_API_KEY:', GEMINI_API_KEY ? '✅ OK' : '❌ MISSING');

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

    // Realiza as substituições dos placeholders pelas chaves reais
    content = content
        .replace('SUPABASE_URL_PLACEHOLDER', SUPABASE_URL)
        .replace('SUPABASE_ANON_KEY_PLACEHOLDER', SUPABASE_ANON_KEY)
        .replace('GEMINI_API_KEY_PLACEHOLDER', GEMINI_API_KEY);

    fs.writeFileSync(file, content);
    console.log(`✅ Variáveis injetadas em ${file}`);
});

console.log('🏁 inject-env.js finalizado');