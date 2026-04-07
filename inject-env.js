const fs = require('fs');
const dotenv = require('dotenv');

console.log('🟢 inject-env.js iniciado');

if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
  console.log('📝 .env.local carregado');
}

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const STRIPE_PUBLISHABLE_KEY =
  process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

console.log('📝 SUPABASE_URL:', SUPABASE_URL ? '✅ OK' : '❌ MISSING');
console.log('📝 SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅ OK' : ' ❌ MISSING');
console.log('📝 GEMINI_API_KEY:', GEMINI_API_KEY ? '✅ OK' : '❌ MISSING');
console.log('📝 STRIPE_PUBLISHABLE_KEY:', STRIPE_PUBLISHABLE_KEY ? '✅ OK' : '❌ MISSING');

const environmentFiles = [
  { path: 'src/environments/environment.ts', production: false },
  { path: 'src/environments/environment.prod.ts', production: true }
];

for (const file of environmentFiles) {
  const content =
`export const environment = {
  production: ${file.production},
  supabaseUrl: '${SUPABASE_URL}',
  supabaseAnonKey: '${SUPABASE_ANON_KEY}',
  geminiApiKey: '${GEMINI_API_KEY}',
  stripePublishableKey: '${STRIPE_PUBLISHABLE_KEY}'
};
`;

  fs.writeFileSync(file.path, content, 'utf8');
  console.log(`📁 Variaveis injetadas em ${file.path}`);
}

console.log('🏁 inject-env.js finalizado');
