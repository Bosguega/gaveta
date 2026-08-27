import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { listPesFiles, parsePesPyembroidery } from '@/services/embroidery';
import type { PatternParse } from '@/types';

export function App() {
    const [folder, setFolder] = useState<string | null>(null);
    const [files, setFiles] = useState<string[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [result, setResult] = useState<PatternParse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handlePick() {
        try {
            const dir = await open({ directory: true, multiple: false });
            if (!dir) return;
            const folderPath = Array.isArray(dir) ? dir[0] : dir;
            setFolder(folderPath);
            const fs = await listPesFiles(folderPath, false);
            setFiles(fs);
            setSelected(fs[0] ?? null);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }

    async function handleSelect(path: string) {
        setSelected(path);
        setLoading(true);
        setError(null);
        try {
            const r = await parsePesPyembroidery(path);
            setResult(r);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex h-screen flex-col bg-slate-100 text-slate-700">
            <header className="border-b border-slate-300 bg-white px-4 py-2">
                <h1 className="text-lg font-semibold">Embroidery Viewer</h1>
                <p className="text-sm text-slate-500">
                    Visualização via pyembroidery (comparativo Rust × pyembroidery)
                </p>
            </header>
            <main className="flex flex-1 overflow-hidden">
                <aside className="w-60 border-r border-slate-300 bg-white p-3 overflow-y-auto">
                    <button
                        onClick={handlePick}
                        disabled={loading}
                        className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {loading ? 'Carregando…' : folder ? 'Trocar pasta' : 'Selecionar pasta'}
                    </button>
                    {folder && (
                        <p className="mt-2 truncate text-xs text-slate-500">{folder}</p>
                    )}
                    <ul className="mt-3 space-y-1">
                        {files.map((f) => (
                            <li key={f}>
                                <button
                                    onClick={() => handleSelect(f)}
                                    className={`block w-full truncate rounded px-2 py-0.5 text-left text-sm hover:bg-slate-100 ${
                                        selected === f ? 'bg-indigo-50 font-medium' : ''
                                    }`}
                                >
                                    {f.split(/[/ \\]/).pop()}
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>
                <section className="flex-1 overflow-auto p-4">
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {!selected && !error && (
                        <p className="text-sm text-slate-500">
                            Selecione um arquivo para começar.
                        </p>
                    )}
                    {result && (
                        <div className="space-y-3">
                            <div className="flex gap-4">
                                <div className="flex-1 rounded border border-slate-300 bg-white p-3">
                                    <h2 className="mb-1 text-sm font-semibold">pyembroidery</h2>
                                    <Stats pattern={result} />
                                </div>
                                <div className="flex-1 rounded border border-slate-300 bg-white p-3">
                                    <h2 className="mb-1 text-sm font-semibold">Rust (a implementar)</h2>
                                    <p className="text-xs text-slate-500">
                                        Parser Rust nativo conectado futuramente.
                                    </p>
                                </div>
                            </div>
                            {result.thumbnail && (
                                <img
                                    src={result.thumbnail}
                                    alt="miniatura do bordado"
                                    className="max-w-full rounded border border-slate-300"
                                />
                            )}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

function Stats({ pattern }: { pattern: PatternParse }) {
    return (
        <dl className="grid grid-cols-2 gap-1 text-sm">
            <div>
                <dt className="text-xs text-slate-500">Pontos (plain)</dt>
                <dd>{pattern.plainStitchCount ?? pattern.stitches.length}</dd>
            </div>
            <div>
                <dt className="text-xs text-slate-500">Saltos (JUMP)</dt>
                <dd>{pattern.jumpCount ?? 0}</dd>
            </div>
            <div>
                <dt className="text-xs text-slate-500">Cores</dt>
                <dd>{pattern.threads.length}</dd>
            </div>
            <div>
                <dt className="text-xs text-slate-500">Tamanho (mm)</dt>
                <dd>
                    {pattern.designWidthMm.toFixed(1)} × {pattern.designHeightMm.toFixed(1)}
                </dd>
            </div>
        </dl>
    );
}
