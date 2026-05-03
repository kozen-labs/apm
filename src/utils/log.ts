import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

let logStream: fs.WriteStream | null = null;

function stripAnsi(s: string): string {
  return s.replace(/\[[0-9;]*m/g, '');
}

function emit(line: string): void {
  console.log(line);
  if (logStream) logStream.write(stripAnsi(line) + '\n');
}

// ── log-file lifecycle ────────────────────────────────────────────────────────

export function openLog(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  logStream = fs.createWriteStream(filePath, { flags: 'a' });
  const ts = new Date().toISOString();
  logStream.write(`\n${'='.repeat(60)}\nSession: ${ts}\n${'='.repeat(60)}\n`);
}

export function closeLog(): void {
  if (logStream) { logStream.end(); logStream = null; }
}

export function getLogPath(): string | null {
  return logStream ? (logStream as any).path as string : null;
}

// ── output helpers ────────────────────────────────────────────────────────────

export function banner(title: string): void {
  const w = Math.max(title.length + 4, 46);
  const bar = '─'.repeat(w);
  const padded = title.padStart(Math.floor((w + title.length) / 2)).padEnd(w - 2);
  emit('');
  emit(chalk.bold.magenta(`┌${bar}┐`));
  emit(chalk.bold.magenta(`│  ${padded}  │`));
  emit(chalk.bold.magenta(`└${bar}┘`));
}

export function section(title: string): void {
  emit('');
  emit(chalk.bold(title));
  emit(chalk.dim('─'.repeat(Math.min(title.length + 2, 60))));
}

export function settingsLine(provider: string, scope: string, type?: string): void {
  const typeStr = type ? `   type=${chalk.cyan(type)}` : '';
  emit(`\n  ${chalk.bold('Active settings')}   provider=${chalk.cyan(provider)}   scope=${chalk.cyan(scope)}${typeStr}\n`);
}

export function info(msg: string):   void { emit(`  ${chalk.cyan('[info]')}     ${msg}`); }
export function ok(msg: string):     void { emit(`  ${chalk.green('[ok]')}       ${msg}`); }
export function warn(msg: string):   void { emit(`  ${chalk.yellow('[warn]')}     ${msg}`); }
export function error(msg: string):  void { emit(`  ${chalk.red('[error]')}    ${msg}`); }
export function skip(msg: string):   void { emit(`  ${chalk.dim('[skip]')}     ${msg}`); }
export function detail(msg: string): void { emit(`  ${chalk.dim('         ' + msg)}`); }

export function summary(
  succeeded: string[],
  skipped:   string[],
  errors:    Array<[string, string]>,
  elapsed:   number,
  target:    string,
): void {
  section('Summary');
  emit(`  Target   : ${chalk.cyan(target)}`);
  emit(`  Succeeded: ${chalk.green(String(succeeded.length))}`);
  if (skipped.length)  emit(`  Skipped  : ${chalk.yellow(String(skipped.length))}`);
  if (errors.length) {
    emit(`  Errors   : ${chalk.red(String(errors.length))}`);
    for (const [name, msg] of errors) emit(`    ${chalk.red(`✗  ${name}`)}  ${msg}`);
  }
  emit(`  Duration : ${elapsed.toFixed(2)}s`);
  const lp = getLogPath();
  if (lp) emit(`  Log      : ${chalk.dim(lp)}`);
  console.log();
}
