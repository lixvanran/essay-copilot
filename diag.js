#!/usr/bin/env node
/**
 * Zuowen Co-Pilot Diagnostic Helper
 * Generates a diagnose.txt with full environment report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const isWin = process.platform === 'win32';

const REPORT = path.join(__dirname, 'diagnose.txt');

function checkCmd(cmd) {
  try {
    const out = execSync(isWin ? `where ${cmd}` : `command -v ${cmd}`, { encoding: 'utf-8' });
    return out.trim().split('\n')[0];
  } catch { return null; }
}
function getVer(cmd) {
  try { return execSync(`${cmd} --version`, { encoding: 'utf-8' }).trim(); } catch { return null; }
}

const lines = [];
const push = (s) => lines.push(s);

push('============================================');
push('  Zuowen Co-Pilot Diagnostic Report');
push('  ' + new Date().toString());
push('============================================');
push('');
push('--- Working Dir ---');
push(process.cwd());
push('');
push('--- System ---');
try { push(require('os').platform() + ' ' + require('os').release()); } catch { push('unknown'); }
push('');
push('--- Node.js ---');
const np = checkCmd('node');
if (np) push(getVer('node') || np); else push('node: NOT FOUND');
const mp = checkCmd('npm');
if (mp) push(getVer('npm') || mp); else push('npm: NOT FOUND');
push('npm registry:');
try { push('  ' + execSync('npm config get registry', { encoding: 'utf-8' }).trim()); } catch { push('  unknown'); }
push('');
push('--- Port 3000 ---');
if (isWin) {
  try { push(execSync('netstat -ano 2>nul | findstr :3000', { encoding: 'utf-8' })); } catch { push('  (port 3000 free or netstat unavailable)'); }
} else {
  try { push(execSync('lsof -i:3000 2>/dev/null || echo "  (port 3000 free)"', { encoding: 'utf-8' })); } catch { push('  unknown'); }
}
push('');
push('--- Project files ---');
try {
  const files = fs.readdirSync(__dirname).sort();
  files.forEach(f => push('  ' + f));
} catch {}
push('');
push('--- Dependencies ---');
push(fs.existsSync(path.join(__dirname, 'node_modules')) ? '  node_modules: OK' : '  node_modules: MISSING');
push(fs.existsSync(path.join(__dirname, 'package.json')) ? '  package.json: OK' : '  package.json: MISSING');
push('');
push('--- Environment ---');
const envLocal = path.join(__dirname, '.env.local');
if (fs.existsSync(envLocal)) {
  push('  .env.local: exists');
  const content = fs.readFileSync(envLocal, 'utf-8');
  if (content.includes('OPENROUTER_API_KEY') && !content.includes('your-key-here')) {
    push('  OPENROUTER_API_KEY: SET');
  } else {
    push('  OPENROUTER_API_KEY: NOT SET or placeholder');
  }
} else {
  push('  .env.local: MISSING');
}
push('');
push('--- API self-test ---');
if (fs.existsSync(path.join(__dirname, 'node_modules'))) {
  push('  Testing /api/analyze...');
  try {
    const http = require('http');
    const req = http.request({
      hostname: 'localhost', port: 3000, path: '/api/analyze',
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      timeout: 3000
    }, (res) => {
      push(`  HTTP ${res.statusCode}`);
      done();
    });
    req.on('error', (e) => { push('  Server not responding: ' + e.message); done(); });
    req.on('timeout', () => { req.destroy(); push('  Server timeout'); done(); });
    req.write('{}');
    req.end();
  } catch (e) {
    push('  Error: ' + e.message);
    done();
  }
} else {
  push('  Skipped (no node_modules)');
  done();
}

function done() {
  fs.writeFileSync(REPORT, lines.join('\n'), 'utf-8');
  console.log('Done. Report: ' + REPORT);
  console.log('Please send this file to support if you need help.');
}
