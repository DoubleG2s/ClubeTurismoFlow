const fs = require('fs');
const dotenv = require('dotenv');

console.log('inject-env.js iniciado');

if (fs.existsSync('.env')) {
  dotenv.config({ path: '.env' });
  console.log('.env carregado');
}

const PRODUCTION_MONTHLY_PRICE = Number(process.env.ASAAS_MONTHLY_AMOUNT || 370);

const isProductionEnv =
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production';

if (!isProductionEnv && fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true });
  console.log('.env.local carregado');
}

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const STRIPE_PUBLISHABLE_KEY =
  process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const API_BASE_URL = process.env.API_BASE_URL || '';
const DEVELOPMENT_MONTHLY_PRICE = Number(process.env.ASAAS_MONTHLY_AMOUNT || 5);

console.log('SUPABASE_URL:', SUPABASE_URL ? 'OK' : 'MISSING');
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'OK' : 'MISSING');
console.log('GEMINI_API_KEY:', GEMINI_API_KEY ? 'OK' : 'MISSING');
console.log('STRIPE_PUBLISHABLE_KEY:', STRIPE_PUBLISHABLE_KEY ? 'OK' : 'MISSING');
console.log('API_BASE_URL:', API_BASE_URL || 'relative');
console.log('ASAAS_MONTHLY_AMOUNT dev:', Number.isFinite(DEVELOPMENT_MONTHLY_PRICE) ? DEVELOPMENT_MONTHLY_PRICE : 5);
console.log('ASAAS_MONTHLY_AMOUNT prod:', Number.isFinite(PRODUCTION_MONTHLY_PRICE) ? PRODUCTION_MONTHLY_PRICE : 370);

const environmentFiles = [
  { path: 'src/environments/environment.ts', production: false },
  { path: 'src/environments/environment.prod.ts', production: true }
];

for (const file of environmentFiles) {
  const monthlyPrice = file.production ? PRODUCTION_MONTHLY_PRICE : DEVELOPMENT_MONTHLY_PRICE;
  const content =
`export const environment = {
  production: ${file.production},
  supabaseUrl: '${SUPABASE_URL}',
  supabaseAnonKey: '${SUPABASE_ANON_KEY}',
  geminiApiKey: '${GEMINI_API_KEY}',
  stripePublishableKey: '${STRIPE_PUBLISHABLE_KEY}',
  apiBaseUrl: '${API_BASE_URL}',
  monthlyPrice: ${Number.isFinite(monthlyPrice) ? monthlyPrice : (file.production ? 370 : 5)}
};
`;

  fs.writeFileSync(file.path, content, 'utf8');
  console.log(`Variaveis injetadas em ${file.path}`);
}

console.log('inject-env.js finalizado');
