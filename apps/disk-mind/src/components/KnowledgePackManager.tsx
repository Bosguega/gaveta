import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './KnowledgePackManager.css';

interface KnowledgePackManagerProps {
    onClose?: () => void;
}

export default function KnowledgePackManager({ onClose }: KnowledgePackManagerProps) {
    const [packs, setPacks] = useState<string[]>([]);
    const [newPackName, setNewPackName] = useState('');
    const [newPackRules, setNewPackRules] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadPacks();
    }, []);

    async function loadPacks() {
        try {
            const result = await invoke<string[]>('list_knowledge_packs');
            setPacks(result);
        } catch (err) {
            setError(String(err));
        }
    }

    async function handleLoadPack() {
        if (!newPackName.trim() || !newPackRules.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const rules = newPackRules.split('\n').map(r => r.trim()).filter(r => r.length > 0);
            await invoke('load_knowledge_pack', { name: newPackName.trim(), rules });
            setNewPackName('');
            setNewPackRules('');
            await loadPacks();
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="knowledge-pack-container">
            <div className="knowledge-pack-header">
                <h2>📚 Knowledge Packs</h2>
                {onClose && <button onClick={onClose} className="back-btn">✕</button>}
            </div>
            <div className="knowledge-pack-content">
                <div className="pack-list">
                    <h3>Packs carregados ({packs.length})</h3>
                    {packs.length === 0 ? (
                        <p className="empty-text">Nenhum knowledge pack carregado</p>
                    ) : (
                        <ul>
                            {packs.map((pack) => (
                                <li key={pack}>{pack}</li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="pack-form">
                    <h3>Carregar novo pack</h3>
                    <input
                        value={newPackName}
                        onChange={(e) => setNewPackName(e.target.value)}
                        placeholder="Nome do pack"
                    />
                    <textarea
                        value={newPackRules}
                        onChange={(e) => setNewPackRules(e.target.value)}
                        placeholder="Regras (uma por linha)"
                        rows={6}
                    />
                    <button
                        onClick={handleLoadPack}
                        disabled={loading || !newPackName.trim() || !newPackRules.trim()}
                        className="primary"
                    >
                        {loading ? 'Carregando...' : 'Carregar pack'}
                    </button>
                </div>
            </div>
            {error && <div className="error-text">{error}</div>}
        </div>
    );
}