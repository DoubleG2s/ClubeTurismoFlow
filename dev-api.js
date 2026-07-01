// Local dev server that wraps api/ handlers without requiring Vercel CLI auth.
// Mirrors Vercel's handler contract: handlers receive (req, res) with req.body pre-parsed.
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const http = require('http');

const groqHandler = require('./api/groq');
const adminDispatcher = require('./api/admin/[endpoint]');

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

function shimRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json   = (data) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
  res.send   = (data) => { res.end(typeof data === 'string' ? data : JSON.stringify(data)); };
  return res;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3001');
  req.body  = await parseBody(req);
  req.query = Object.fromEntries(url.searchParams);
  shimRes(res);

  if (url.pathname === '/api/groq') {
    return groqHandler(req, res);
  }

  const adminMatch = url.pathname.match(/^\/api\/admin\/(.+)$/);
  if (adminMatch) {
    req.query = { ...req.query, endpoint: adminMatch[1] };
    return adminDispatcher(req, res);
  }

  res.status(404).json({ error: 'Not found' });
});

server.listen(3001, () => {
  console.log('[dev-api] API local em http://localhost:3001');
});
