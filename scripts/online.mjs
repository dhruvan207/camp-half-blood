// Bringt die Website online: baut die fertige Version und lädt sie in den Zweig „gh-pages“
// auf GitHub hoch. GitHub Pages zeigt diesen Zweig als Website an.
// Aufruf im Projektordner:  npm run online

import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });
const read = (cmd, cwd) => execSync(cmd, { cwd, encoding: 'utf8' }).trim();

const projekt = process.cwd();
const remote = read('git remote get-url origin', projekt);

console.log('\n1/3 Baue die fertige Website …');
run('npm run build', projekt);

console.log('\n2/3 Bereite den Upload vor …');
const tmp = mkdtempSync(join(tmpdir(), 'camp-online-'));
cpSync(join(projekt, 'dist'), tmp, { recursive: true });
writeFileSync(join(tmp, '.nojekyll'), ''); // GitHub soll die Dateien unverändert ausliefern
run('git init -q -b gh-pages', tmp);
run('git add -A', tmp);
const name = read('git config user.name', projekt);
const mail = read('git config user.email', projekt);
run(`git -c user.name="${name}" -c user.email="${mail}" commit -q -m "Website-Version vom ${new Date().toLocaleString('de-DE')}"`, tmp);

console.log('\n3/3 Lade hoch …');
run(`git push -q -f "${remote}" gh-pages`, tmp);
rmSync(tmp, { recursive: true, force: true });

console.log('\nFertig! In 1–2 Minuten ist die neue Version online.');
