import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './SnapshotCompareView.css';

interface CompareItem {
    name: string;
    sizeA: number;
    sizeB: number;
    diff: number;
}

interface SnapshotCompareViewProps {
    snapshotA: number;
    snapshotB: number;
    onBack?: () => void;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function SnapshotCompareView({ snapshotA, snapshotB, onBack }: SnapshotCompareViewProps) {
    const [items, setItems] = useState<CompareItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadComparison() {
            try {
                const result = await invoke<{ items: CompareItem[] }>('compare_snapshots', {
                    snapshot_a: snapshotA,
                    snapshot_b: snapshotB,
                });
                setItems(result.items);
            } catch (err) {
                setError(String(err));
            } finally {
                setLoading(false);
            }
        }
        loadComparison();
    }, [snapshotA, snapshotB]);

    if (loading) return <div className="compare-loading">Carregando comparação...</div>;
    if (error) return <div className="compare-error">Erro: {error}</div>;
    if (items.length === 0) return <div className="compare-empty">Nenhuma diferença encontrada</div>;

    return (
        <div className="compare-container">
            <div className="compare-header-bar">
                {onBack && <button onClick={onBack} className="back-btn">← Voltar</button>}
                <h2>📊 Comparação de Snapshots</h2>
                <span className="compare-info">
                    Snapshot {snapshotA} vs {snapshotB}
                </span>
            </div>
            <div className="compare-content">
                <table className="compare-table">
                    <thead>
                        <tr>
                            <th>Pasta</th>
                            <th>Size A</th>
                            <th>Size B</th>
                            <th>Diferença</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={idx}>
                                <td className="compare-name">{item.name}</td>
                                <td className="compare-size-a">{formatBytes(item.sizeA)}</td>
                                <td className="compare-size-b">{formatBytes(item.sizeB)}</td>
                                <td className={`compare-diff ${item.diff > 0 ? 'positive' : item.diff < 0 ? 'negative' : 'neutral'}`}>
                                    {item.diff > 0 ? '+' : ''}{formatBytes(item.diff)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}