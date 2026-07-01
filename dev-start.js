const { spawn, execSync } = require('child_process');

function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (!line.match(new RegExp(`[:\\s]${port}\\s`))) continue;
      const pid = line.trim().split(/\s+/).pop();
      if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
    }
    for (const pid of pids) {
      try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); console.log(`[dev-start] Encerrou processo ${pid} que estava na porta ${port}`); } catch {}
    }
  } catch {}
}

function run(label, cmd, color) {
  // Passing cmd as a single string with shell:true avoids DEP0190 (args+shell concat warning)
  const proc = spawn(cmd, { shell: true, stdio: 'pipe' });
  const prefix = `\x1b[${color}m[${label}]\x1b[0m `;
  proc.stdout.on('data', d => process.stdout.write(prefix + d.toString().replace(/\n(?!$)/g, '\n' + prefix)));
  proc.stderr.on('data', d => process.stderr.write(prefix + d.toString().replace(/\n(?!$)/g, '\n' + prefix)));
  proc.on('exit', code => { if (code !== 0 && code !== null) { console.error(`${prefix}Encerrou com código ${code}`); process.exit(code); } });
  return proc;
}

killPort(3000);
killPort(3001);

const api = run('api', 'node dev-api.js', '34');
const ng  = run('ng',  'ng serve --proxy-config .dev/proxy.conf.json', '32');

process.on('SIGINT',  () => { api.kill(); ng.kill(); process.exit(0); });
process.on('SIGTERM', () => { api.kill(); ng.kill(); process.exit(0); });
