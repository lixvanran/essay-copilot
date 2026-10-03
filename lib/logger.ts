/**
 * 结构化日志（v0.5.1）
 *
 * 输出 JSON 格式（生产可直接接 Loki / ELK）
 * 输出人类可读格式（开发环境）
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const CURRENT_LEVEL: Level = (process.env.LOG_LEVEL as Level) || 'info';
const JSON_OUTPUT = process.env.LOG_JSON === 'true' || process.env.NODE_ENV === 'production';

type Fields = Record<string, unknown>;

function emit(level: Level, msg: string, fields: Fields = {}) {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[CURRENT_LEVEL]) return;

  const entry = {
    t: new Date().toISOString(),
    level,
    msg,
    ...fields
  };

  if (JSON_OUTPUT) {
    // 生产：JSON 行（便于日志聚合）
    const stream = level === 'error' ? process.stderr : process.stdout;
    stream.write(JSON.stringify(entry) + '\n');
  } else {
    // 开发：人类可读
    const color = level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : '\x1b[36m';
    const reset = '\x1b[0m';
    const ctx = Object.keys(fields).length > 0 ? ' ' + JSON.stringify(fields) : '';
    const stream = level === 'error' ? process.stderr : process.stdout;
    stream.write(`${color}[${level.toUpperCase()}]${reset} ${entry.msg}${ctx}\n`);
  }
}

export const logger = {
  debug: (msg: string, fields?: Fields) => emit('debug', msg, fields),
  info: (msg: string, fields?: Fields) => emit('info', msg, fields),
  warn: (msg: string, fields?: Fields) => emit('warn', msg, fields),
  error: (msg: string, fields?: Fields) => emit('error', msg, fields),

  /** 创建带预设字段的子 logger */
  child: (defaults: Fields) => ({
    debug: (msg: string, fields?: Fields) => emit('debug', msg, { ...defaults, ...fields }),
    info: (msg: string, fields?: Fields) => emit('info', msg, { ...defaults, ...fields }),
    warn: (msg: string, fields?: Fields) => emit('warn', msg, { ...defaults, ...fields }),
    error: (msg: string, fields?: Fields) => emit('error', msg, { ...defaults, ...fields })
  })
};