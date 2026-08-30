#!/usr/bin/env node
/**
 * Zuowen Co-Pilot Stop Helper
 * Cleanup lingering next dev / next-server processes
 */

const { execSync } = require('child_process');
const isWin = process.platform === 'win32';

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' });
  } catch {}
}

if (isWin) {
  // kill any next dev / next-server by name
  run('taskkill /F /IM node.exe /FI "WINDOWTITLE eq ZuowenCoPilot*" 2>nul');
  // kill any node on port 3000
  try {
    const out = execSync('netstat -ano', { encoding: 'utf-8' });
    const lines = out.split(/\r?\n/).filter(l => l.includes(':3000 ') && l.includes('LISTENING'));
    for (const line of lines) {
      const pid = line.trim().split(/\s+/).pop();
      if (pid && /^\d+$/.test(pid)) {
        try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'inherit' }); } catch {}
      }
    }
  } catch {}
} else {
  run('pkill -f "next dev" 2>/dev/null');
  run('pkill -f "next-server" 2>/dev/null');
  // kill by port
  try {
    const pids = execSync('lsof -ti:3000 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (pids) execSync(`kill -9 ${pids.split('\n').join(' ')} 2>/dev/null`);
  } catch {}
}

console.log('Done.');
console.log('Press Ctrl+C to close if running in a new window.');
