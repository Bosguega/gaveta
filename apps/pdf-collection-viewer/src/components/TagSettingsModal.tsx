import { useEffect, useState } from 'react';
import { getDefaultTagSettings, getTagSettings, setTagSettings, testTagConnection } from '@/services/tags';
import type { TagSettings } from '@/types';

interface TagSettingsModalProps {
    onClose: () => void;
}

export function TagSettingsModal({ onClose }: TagSettingsModalProps) {
    const [settings, setSettings] = useState<TagSettings | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [promptResetMessage, setPromptResetMessage] = useState<string | null>(null);
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

    const update = (patch: Partial<TagSettings>) => {
        setSettings({ ...settings, ...patch });
        setPromptResetMessage(null);
    };

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

    const handleRestoreDefaultPrompts = async () => {
        try {
            const defaults = await getDefaultTagSettings();
            update({
                system_prompt: defaults.system_prompt,
                user_prompt: defaults.user_prompt,
            });
            setPromptResetMessage('Prompts restaurados para a versão padrão.');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Falha ao obter prompts padrão.');
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
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200">
                    <h2 className="text-base font-semibold text-slate-800">Configurações de tags (IA)</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Servidor llama.cpp compatível com a API OpenAI, rodando com um modelo multimodal local.
                    </p>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-4 text-sm">
                    {/* Parâmetros de Conexão */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">URL do servidor</label>
                            <input
                                type="text"
                                value={settings.base_url}
                                onChange={(e) => update({ base_url: e.target.value })}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
                                placeholder="http://127.0.0.1:8080"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Modelo</label>
                            <input
                                type="text"
                                value={settings.model}
                                onChange={(e) => update({ model: e.target.value })}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Páginas analisadas por PDF</label>
                            <input
                                type="number"
                                min={1}
                                max={8}
                                value={settings.pages}
                                onChange={(e) => update({ pages: Number(e.target.value) })}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Max tokens</label>
                            <input
                                type="number"
                                min={128}
                                max={2048}
                                value={settings.max_tokens}
                                onChange={(e) => update({ max_tokens: Number(e.target.value) })}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
                            />
                        </div>
                    </div>

                    {/* Prompts */}
                    <div className="pt-3 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <span className="text-xs font-semibold text-slate-700">Prompts da IA</span>
                                <span className="text-[11px] text-slate-500 ml-2">Personalize as instruções passadas ao modelo</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleRestoreDefaultPrompts}
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium"
                                title="Restaura os prompts de sistema e de usuário para os textos originais do app"
                            >
                                ↺ Restaurar prompts padrão
                            </button>
                        </div>

                        {promptResetMessage && (
                            <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2.5 py-1 mb-2">
                                {promptResetMessage}
                            </p>
                        )}

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    System Prompt (regras semânticas e critérios de tags)
                                </label>
                                <textarea
                                    rows={9}
                                    value={settings.system_prompt}
                                    onChange={(e) => update({ system_prompt: e.target.value })}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono bg-slate-50 text-slate-800 focus:bg-white focus:outline-blue-500"
                                    placeholder="Instruções de sistema..."
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-baseline mb-1">
                                    <label className="block text-xs font-medium text-slate-600">
                                        User Prompt Template
                                    </label>
                                    <span className="text-[11px] text-slate-400">
                                        Use <code className="text-purple-600 bg-purple-50 px-1 py-0.5 rounded">&#123;filename&#125;</code> para o nome do arquivo
                                    </span>
                                </div>
                                <textarea
                                    rows={3}
                                    value={settings.user_prompt}
                                    onChange={(e) => update({ user_prompt: e.target.value })}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono bg-slate-50 text-slate-800 focus:bg-white focus:outline-blue-500"
                                    placeholder="Prompt do usuário..."
                                />
                            </div>
                        </div>
                    </div>

                    {status && <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded p-2">{status}</p>}
                    {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={handleTest}
                        disabled={testing}
                        className="px-3 py-1.5 text-xs bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-medium shadow-sm disabled:opacity-50"
                    >
                        {testing ? 'Testando conexão…' : 'Testar conexão'}
                    </button>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-1.5 text-xs bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm disabled:opacity-50"
                        >
                            {saving ? 'Salvando…' : 'Salvar configurações'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}