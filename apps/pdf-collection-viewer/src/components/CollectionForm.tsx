import { useState } from 'react';
import { z } from 'zod';
import { COLLECTION_ICONS } from '@/types';
import { pickFolder } from '@/services/collections';

interface Props {
    initialName?: string;
    initialIcon?: string;
    initialPaths?: string[];
    initialIncludeSubfolders?: boolean;
    onSubmit: (data: {
        name: string;
        icon: string;
        paths: string[];
        includeSubfolders: boolean;
    }) => Promise<void>;
    onCancel: () => void;
}

function normalizePathKey(path: string): string {
    return path
        .trim()
        .replace(/\\/g, '/')
        .replace(/\/+$/, '')
        .toLowerCase();
}

const collectionFormSchema = z
    .object({
        name: z.string().trim().min(1, 'O nome é obrigatório'),
        icon: z.string().min(1),
        paths: z
            .array(z.string())
            .transform((entries) => entries.map((path) => path.trim()).filter(Boolean))
            .pipe(z.array(z.string()).min(1, 'Adicione pelo menos uma pasta')),
        includeSubfolders: z.boolean(),
    })
    .superRefine((data, ctx) => {
        const seen = new Set<string>();
        for (const path of data.paths) {
            const key = normalizePathKey(path);
            if (seen.has(key)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Caminho duplicado detectado: ${path}`,
                    path: ['paths'],
                });
                return;
            }
            seen.add(key);
        }
    });

export function CollectionForm({
    initialName = '',
    initialIcon = '📚',
    initialPaths = [],
    initialIncludeSubfolders = true,
    onSubmit,
    onCancel,
}: Props) {
    const [name, setName] = useState(initialName);
    const [icon, setIcon] = useState(initialIcon);
    const [paths, setPaths] = useState<string[]>(initialPaths.length > 0 ? initialPaths : ['']);
    const [includeSubfolders, setIncludeSubfolders] = useState(initialIncludeSubfolders);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const addPath = () => {
        setPaths([...paths, '']);
    };

    const browsePath = async (index: number) => {
        const picked = await pickFolder();
        if (!picked) return;

        setPaths((current) => current.map((path, itemIndex) => (itemIndex === index ? picked : path)));
    };

    const updatePath = (index: number, value: string) => {
        setPaths((current) => current.map((path, itemIndex) => (itemIndex === index ? value : path)));
    };

    const removePath = (index: number) => {
        setPaths((current) => {
            const next = current.filter((_, i) => i !== index);
            return next.length > 0 ? next : [''];
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const parsed = collectionFormSchema.safeParse({
            name,
            icon,
            paths,
            includeSubfolders,
        });

        if (!parsed.success) {
            setError(parsed.error.errors[0]?.message ?? 'Dados inválidos');
            return;
        }

        setSaving(true);
        try {
            await onSubmit(parsed.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar coleção');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Livros"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ícone</label>
                <div className="flex flex-wrap gap-2">
                    {COLLECTION_ICONS.map((candidate) => (
                        <button
                            key={candidate}
                            type="button"
                            onClick={() => setIcon(candidate)}
                            className={`w-10 h-10 flex items-center justify-center text-xl rounded-lg border transition-colors ${icon === candidate
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            {candidate}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Pastas</label>
                <div className="space-y-2">
                    {paths.map((path, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={path}
                                onChange={(event) => updatePath(index, event.target.value)}
                                placeholder="Cole ou digite o caminho da pasta"
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-slate-700"
                            />
                            <button
                                type="button"
                                onClick={() => browsePath(index)}
                                className="px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 rounded-lg"
                            >
                                Procurar...
                            </button>
                            <button
                                type="button"
                                onClick={() => removePath(index)}
                                className="p-2 text-slate-500 hover:text-red-600"
                                title="Remover pasta"
                            >
                                🗑️
                            </button>
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={addPath}
                    className="mt-2 px-3 py-2 text-sm border border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-400 hover:text-blue-600"
                >
                    + Adicionar pasta
                </button>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                    type="checkbox"
                    checked={includeSubfolders}
                    onChange={(e) => setIncludeSubfolders(e.target.checked)}
                    className="w-4 h-4"
                />
                Incluir subpastas
            </label>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>
        </form>
    );
}
