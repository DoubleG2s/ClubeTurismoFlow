import fs from 'fs';

console.log('🟢 inject-env.js iniciado');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'OK' : 'MISSING');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'OK' : 'MISSING');

const file = 'src/environments/environment.prod.ts';

let content = fs.readFileSync(file, 'utf8');

content = content
    .replace('SUPABASE_URL_PLACEHOLDER', process.env.SUPABASE_URL || '')
    .replace('SUPABASE_ANON_KEY_PLACEHOLDER', process.env.SUPABASE_ANON_KEY || '');

fs.writeFileSync(file, content);

console.log('✅ inject-env.js finalizado');
