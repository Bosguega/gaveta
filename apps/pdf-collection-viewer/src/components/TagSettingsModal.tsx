import { useEffect, useState } from 'react';
import { getTagSettings, setTagSettings, testTagConnection } from '@/services/tags';
import type { TagSettings } from '@/types';

interface TagSettingsModalProps {
    onClose: () => void;
}

export function TagSettingsModal({ onClose }: TagSettingsModalProps) {
    const [settings, setSettings] = useState<TagSettings | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getTagSettings()
            .then(setSettings)
            .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
    }, []);

    if (!settings) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <div className="bg-white rounded-xl p-6 text-sm text-slate-600">Carregando…</div>
            </div>
        );
    }

    const update = (patch: Partial<TagSettings>) => setSettings({ ...settings, ...patch });

    const handleTest = async () => {
        setTesting(true);
        setStatus(null);
        setError(null);
        try {
            setStatus(await testTagConnection(settings));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            await setTagSettings(settings);
            onClose();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <h2 className="text-base font-semibold text-slate-800 mb-1">Configurações de tags (IA)</h2>
                <p className="text-xs text-slate-500 mb-4">
                    Servidor llama.cpp compatível com a API OpenAI, rodando com um modelo multimodal.
                </p>

                <label className="block text-xs font-medium text-slate-600 mb-1">URL do servidor</label>
                <input
                    type="text"
                    value={settings.base_url}
                    onChange={(e) => update({ base_url: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm mb-3"
                    placeholder="http://127.0.0.1:8080"
                />

                <label className="block text-xs font-medium text-slate-600 mb-1">Modelo</label>
                <input
                    type="text"
                    value={settings.model}
                    onChange={(e) => update({ model: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm mb-3"
                />

                <div className="flex gap-3 mb-4">
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Páginas analisadas</label>
                        <input
                            type="number"
                            min={1}
                            max={8}
                            value={settings.pages}
                            onChange={(e) => update({ pages: Number(e.target.value) })}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Max tokens</label>
                        <input
                            type="number"
                            min={128}
                            max={2048}
                            value={settings.max_tokens}
                            onChange={(e) => update({ max_tokens: Number(e.target.value) })}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                        />
                    </div>
                </div>

                {status && <p className="text-xs text-green-600 mb-2">{status}</p>}
                {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={handleTest}
                        disabled={testing}
                        className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                    >
                        {testing ? 'Testando…' : 'Testar conexão'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                    >
                        {saving ? 'Salvando…' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
}