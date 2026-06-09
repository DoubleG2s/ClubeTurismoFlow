const fs = require('fs');
const dotenv = require('dotenv');

console.log('inject-env.js iniciado');

const isProductionEnv =
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production';

function loadEnvFile(path) {
  if (!fs.existsSync(path)) {
    return {};
  }

  const parsed = dotenv.parse(fs.readFileSync(path));
  console.log(`${path} carregado`);
  return parsed;
}

function mergeEnv(...sources) {
  return Object.assign({}, ...sources);
}

function pick(env, names, fallback = '') {
  for (const name of names) {
    if (env[name] !== undefined && env[name] !== '') {
      return env[name];
    }
  }

  return fallback;
}

function pickNumber(env, names, fallback) {
  const rawValue = pick(env, names, '');
  const value = Number(rawValue);

  return Number.isFinite(value) ? value : fallback;
}

function toEnvironment(env, options) {
  return {
    production: options.production,
    supabaseUrl: pick(env, [
      options.production ? 'PROD_SUPABASE_URL' : 'DEV_SUPABASE_URL',
      'SUPABASE_URL',
      'VITE_SUPABASE_URL'
    ]),
    supabaseAnonKey: pick(env, [
      options.production ? 'PROD_SUPABASE_ANON_KEY' : 'DEV_SUPABASE_ANON_KEY',
      'SUPABASE_ANON_KEY',
      'VITE_SUPABASE_ANON_KEY'
    ]),
    geminiApiKey: pick(env, [
      options.production ? 'PROD_GEMINI_API_KEY' : 'DEV_GEMINI_API_KEY',
      'GEMINI_API_KEY'
    ]),
    stripePublishableKey: pick(env, [
      options.production ? 'PROD_STRIPE_PUBLISHABLE_KEY' : 'DEV_STRIPE_PUBLISHABLE_KEY',
      'STRIPE_PUBLISHABLE_KEY',
      'VITE_STRIPE_PUBLISHABLE_KEY'
    ]),
    apiBaseUrl: pick(env, [
      options.production ? 'PROD_API_BASE_URL' : 'DEV_API_BASE_URL',
      'API_BASE_URL'
    ]),
    monthlyPrice: pickNumber(env, [
      options.production ? 'PROD_ASAAS_MONTHLY_AMOUNT' : 'DEV_ASAAS_MONTHLY_AMOUNT',
      'ASAAS_MONTHLY_AMOUNT'
    ], options.production ? 370 : 5)
  };
}

function jsString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function writeEnvironmentFile(path, environment) {
  const content =
`// ⚠️ AVISO: Este arquivo é auto-gerado pelo script inject-env.js.
// Quaisquer alterações diretas aqui serão perdidas no próximo build.
export const environment = {
  production: ${environment.production},
  supabaseUrl: '${jsString(environment.supabaseUrl)}',
  supabaseAnonKey: '${jsString(environment.supabaseAnonKey)}',
  geminiApiKey: '${jsString(environment.geminiApiKey)}',
  stripePublishableKey: '${jsString(environment.stripePublishableKey)}',
  apiBaseUrl: '${jsString(environment.apiBaseUrl)}',
  monthlyPrice: ${environment.monthlyPrice}
};
`;

  fs.writeFileSync(path, content, 'utf8');
  console.log(`Variaveis injetadas em ${path}`);
}

function logEnvironmentStatus(label, environment) {
  console.log(`[${label}] SUPABASE_URL:`, environment.supabaseUrl ? 'OK' : 'MISSING');
  console.log(`[${label}] SUPABASE_ANON_KEY:`, environment.supabaseAnonKey ? 'OK' : 'MISSING');
  console.log(`[${label}] GEMINI_API_KEY:`, environment.geminiApiKey ? 'OK' : 'MISSING');
  console.log(`[${label}] STRIPE_PUBLISHABLE_KEY:`, environment.stripePublishableKey ? 'OK' : 'MISSING');
  console.log(`[${label}] API_BASE_URL:`, environment.apiBaseUrl || 'relative');
  console.log(`[${label}] ASAAS_MONTHLY_AMOUNT:`, environment.monthlyPrice);
}

function warnIfEnvironmentLooksMixed(label, environment) {
  if (!environment.production) {
    return;
  }

  if (String(environment.stripePublishableKey || '').startsWith('pk_test_')) {
    console.warn('[prod] AVISO: STRIPE_PUBLISHABLE_KEY esta usando pk_test_. Defina PROD_STRIPE_PUBLISHABLE_KEY=pk_live_... para Stripe em producao.');
  }

  if (environment.monthlyPrice < 100) {
    console.warn('[prod] AVISO: ASAAS_MONTHLY_AMOUNT de producao parece baixo. Defina PROD_ASAAS_MONTHLY_AMOUNT=370 ou o valor real.');
  }
}

const envFile = loadEnvFile('.env');
const localEnvFile = !isProductionEnv ? loadEnvFile('.env.local') : {};
const runtimeEnv = process.env;

const developmentEnv = mergeEnv(envFile, localEnvFile, runtimeEnv);
const productionEnv = mergeEnv(envFile, runtimeEnv);

const developmentEnvironment = toEnvironment(developmentEnv, { production: false });
const productionEnvironment = toEnvironment(productionEnv, { production: true });

logEnvironmentStatus('dev', developmentEnvironment);
logEnvironmentStatus('prod', productionEnvironment);
warnIfEnvironmentLooksMixed('prod', productionEnvironment);

writeEnvironmentFile('src/environments/environment.ts', developmentEnvironment);
writeEnvironmentFile('src/environments/environment.prod.ts', productionEnvironment);

console.log('inject-env.js finalizado');
