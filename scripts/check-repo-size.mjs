import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const size = paths.reduce((total, file) => total + statSync(file).size, 0);
const limit = 10_000_000;
console.log(`${paths.length} tracked files: ${(size / 1_000_000).toFixed(2)} MB / 10 MB`);
if (size >= limit) { console.error('Repository exceeds the submission limit. Remove large tracked files.'); process.exitCode = 1; }
