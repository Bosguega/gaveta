import { createHash } from 'node:crypto';
import { copyFileSync, createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '..');
const manifest = JSON.parse(readFileSync(join(appDir, 'tools.manifest.json'), 'utf8'));
const cacheDir = process.env.MIDI_MP3_TOOLS_CACHE || join(tmpdir(), manifest.cache || 'midi-mp3-tools-cache');
const force = process.argv.includes('--force');

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
const rel = (p) => p.replace(appDir, '').replace(/^[\\/]/, '');

const cachePath = (item) => join(cacheDir, item.id + extname(new URL(item.url).pathname));

async function download(item, dest) {
    const res = await fetch(item.url, { redirect: 'follow' });
    if (!res.ok || !res.body) throw new Error('HTTP ' + res.status + ' em ' + item.url);
    const total = Number(res.headers.get('content-length') ?? 0);
    const part = dest + '.part';
    let seen = 0;
    let nextReport = 0;
    const src = Readable.fromWeb(res.body);
    src.on('data', (chunk) => {
        seen += chunk.length;
        if (seen >= nextReport) {
            nextReport = seen + 25 * 1048576;
            console.log('  ... ' + mb(seen) + (total ? ' de ' + mb(total) : ''));
        }
    });
    await pipeline(src, createWriteStream(part));
    renameSync(part, dest);
    return seen;
}

async function ensure(item) {
    const dest = cachePath(item);
    if (!force && existsSync(dest) && (!item.sha256 || sha256(dest) === item.sha256)) {
        console.log('[cache ] ' + basename(dest));
        return dest;
    }
    console.log('[baixar] ' + basename(dest));
    const size = await download(item, dest);
    const hash = sha256(dest);
    if (item.sha256 && hash !== item.sha256) {
        const detail = 'hash inesperado em ' + item.id + ': ' + hash;
        if (item.floating) {
            console.warn('[AVISO ] ' + detail + ' (fonte flutuante, seguindo em frente)');
        } else {
            rmSync(dest, { force: true });
            throw new Error(detail);
        }
    }
    console.log('[ok    ] ' + mb(size) + ' sha256=' + hash);
    return dest;
}

function extractZip(zipPath, destDir) {
    try {
        execFileSync('tar', ['-xf', zipPath, '-C', destDir], { stdio: 'inherit' });
    } catch {
        execFileSync('powershell', ['-NoProfile', '-Command', 'Expand-Archive -LiteralPath \'' + zipPath + '\' -DestinationPath \'' + destDir + '\' -Force'], { stdio: 'inherit' });
    }
}

function findIn(dir, match) {
    const wanted = match.replace(/\\/g, '/');
    const stack = [dir];
    while (stack.length > 0) {
        const current = stack.pop();
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const full = join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(full);
            } else if (full.replace(/\\/g, '/').endsWith(wanted)) {
                return full;
            }
        }
    }
    return null;
}

function install(item, cached) {
    const copies = [];
    if (item.kind === 'file') {
        copies.push({ from: cached, to: resolve(appDir, item.to) });
    } else {
        const tmp = mkdtempSync(join(tmpdir(), 'm2m-extract-'));
        extractZip(cached, tmp);
        for (const rule of item.extract) {
            const found = findIn(tmp, rule.match);
            if (!found) throw new Error('nao encontrei ' + rule.match + ' dentro de ' + basename(cached));
            copies.push({ from: found, to: resolve(appDir, rule.to) });
        }
    }
    for (const copy of copies) {
        mkdirSync(dirname(copy.to), { recursive: true });
        copyFileSync(copy.from, copy.to);
        console.log('[instalar] ' + rel(copy.to) + ' (' + mb(statSync(copy.to).size) + ')');
    }
}

async function main() {
    mkdirSync(cacheDir, { recursive: true });
    console.log('cache: ' + cacheDir);
    for (const item of manifest.files) {
        install(item, await ensure(item));
    }
    console.log('pronto.');
}

main().catch((err) => {
    console.error('falhou: ' + err.message);
    process.exit(1);
});