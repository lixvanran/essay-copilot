#!/usr/bin/env node
/**
 * 作文副驾驶 跨平台启动器 (start.js)
 * 不依赖 .bat 文件关联，不依赖 cmd 编码
 * 用法: node start.js
 *
 * 如果你装 Node v24+ 并且 .bat 被错误关联成 Node REPL，
 * 用这个脚本就 100% 不会闪退
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = __dirname;
const isWin = process.platform === 'win32';

const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m'
};

function log(msg, color = c.cyan) {
  console.log(`${color}[start]${c.reset} ${msg}`);
}
function ok(msg) { log(`OK ${msg}`, c.green); }
function warn(msg) { log(`WARN ${msg}`, c.yellow); }
function err(msg) { log(`ERROR ${msg}`, c.red); console.error(msg); }

function checkCmd(cmd) {
  try {
    const out = execSync(isWin ? `where ${cmd}` : `command -v ${cmd}`, {
      stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8'
    });
    return out.trim().split('\n')[0];
  } catch {
    return null;
  }
}

function getVer(cmd) {
  try {
    return execSync(`${cmd} --version`, { stdio: 'pipe', encoding: 'utf-8' }).trim();
  } catch { return null; }
}

function killPort3000() {
  try {
    if (isWin) {
      const out = execSync('netstat -ano', { encoding: 'utf-8' });
      const lines = out.split(/\r?\n/).filter(l => l.includes(':3000 ') && l.includes('LISTENING'));
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) {
          try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' }); log(`stopped PID ${pid}`); } catch {}
        }
      }
    } else {
      try {
        const pids = execSync('lsof -ti:3000 2>/dev/null', { encoding: 'utf-8' }).trim();
        if (pids) {
          log(`stopped: ${pids.split('\n').join(',')}`);
          execSync(`kill -9 ${pids.split('\n').join(' ')} 2>/dev/null`);
        }
      } catch {}
      try { execSync('pkill -f "next dev" 2>/dev/null'); } catch {}
      try { execSync('pkill -f "next-server" 2>/dev/null'); } catch {}
    }
  } catch {}
}

(async () => {
  console.log('');
  console.log(`${c.bold}============================================${c.reset}`);
  console.log(`${c.bold}  Zuowen Co-Pilot v0.1${c.reset}`);
  console.log(`${c.bold}============================================${c.reset}`);
  console.log('');
  log(`Working dir: ${root}`);
  console.log('');

  // 1. node
  log('[1/4] Checking node...');
  const nodePath = checkCmd('node');
  if (!nodePath) {
    err('Node.js not found');
    err('Install from https://nodejs.org/ (LTS)');
    process.exit(1);
  }
  ok(getVer('node') || nodePath);

  // 2. npm
  log('[2/4] Checking npm...');
  const npmPath = checkCmd('npm');
  if (!npmPath) {
    err('Node.js found but npm not.');
    err('Reinstall Node.js (https://nodejs.org/) - LTS');
    process.exit(1);
  }
  ok(getVer('npm') || npmPath);

  // 3. deps
  log('[3/4] Checking dependencies...');
  if (!fs.existsSync(path.join(root, 'node_modules', 'next', 'package.json'))) {
    log('Installing (this may take a few minutes)...');
    try {
      execSync('npm install --no-audit --no-fund --ignore-scripts', {
        cwd: root, stdio: 'inherit'
      });
    } catch (e) {
      err('npm install failed. Try running it manually:');
      err('  cd ' + root);
      err('  npm install');
      process.exit(1);
    }
  }
  ok('Dependencies');

  // 4. .env
  log('[4/4] Checking config...');
  const envLocal = path.join(root, '.env.local');
  if (!fs.existsSync(envLocal)) {
    const envExample = path.join(root, '.env.example');
    if (fs.existsSync(envExample)) {
      fs.copyFileSync(envExample, envLocal);
      log('Created .env.local from template');
    }
  }
  if (fs.existsSync(envLocal)) {
    const content = fs.readFileSync(envLocal, 'utf-8');
    if (content.includes('your-key-here') || !content.includes('OPENROUTER_API_KEY')) {
      warn('OPENROUTER_API_KEY not set or still placeholder');
      warn('Edit .env.local to set a real key');
    } else {
      ok('.env.local');
    }
  } else {
    warn('No .env.local found');
    warn('Create .env.local with OPENROUTER_API_KEY=sk-or-v1-...');
  }

  // kill port 3000
  log('Cleaning up port 3000...');
  killPort3000();

  // 5. start dev
  console.log('');
  console.log(`${c.bold}============================================${c.reset}`);
  console.log(`  Starting dev server on port 3000...`);
  console.log(`  Open http://localhost:3000 in your browser`);
  console.log(`  Press Ctrl+C to stop the server`);
  console.log(`${c.bold}============================================${c.reset}`);
  console.log('');

  // 关键修复：Windows 上必须用 shell: true
  // shell: false 直接 spawn npm.cmd 在 Windows 上经常 ENOENT（PATH 解析问题）
  // shell: true 让 cmd.exe 解析，自动找 npm.cmd
  // macOS/Linux 上 shell: false 也 OK，但用 true 更一致
  const npmCmd = isWin ? 'npm.cmd' : 'npm';
  let child;
  try {
    child = spawn(npmCmd, ['run', 'dev'], {
      cwd: root,
      stdio: 'inherit',
      shell: isWin  // Windows 必须用 shell，让 cmd.exe 找 npm.cmd
    });
  } catch (e) {
    err(`Failed to start npm: ${e.message}`);
    err('Try running manually:');
    err(`  cd "${root}"`);
    err('  npm run dev');
    process.exit(1);
  }

  // forward signals
  const sigs = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  for (const sig of sigs) {
    process.on(sig, () => {
      if (child && !child.killed) child.kill(sig);
    });
  }

  child.on('error', (e) => {
    err(`npm process error: ${e.message}`);
    err('Common causes:');
    err('  1. Node.js not properly installed');
    err('  2. npm not in PATH');
    err('  3. node_modules corrupted - try: rm -rf node_modules && npm install');
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    console.log('');
    if (signal) {
      log(`Server stopped by signal ${signal}`, c.yellow);
      process.exit(0);
    } else if (code === 0) {
      log('Server stopped cleanly', c.green);
      process.exit(0);
    } else {
      log(`Server stopped (exit code ${code})`, c.red);
      process.exit(code || 1);
    }
  });
})().catch(e => {
  err(e.message);
  err(e.stack);
  process.exit(1);
});
