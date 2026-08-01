import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import TreemapView from './components/TreemapView';
import SnapshotCompareView from './components/SnapshotCompareView';
import KnowledgePackManager from './components/KnowledgePackManager';
import './App.css';

interface ScanStats {
    total_files: number;
    total_dirs: number;
    total_size: number;
    errors: string[];
}

interface ScanProgressEventData {
    current_path: string;
    files_scanned: number;
    dirs_scanned: number;
}

interface DirNode {
    id: number;
    parentId: number | null;
    name: string;
    size: number;
    fileCount: number;
    depth: number;
    children?: DirNode[];
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function App() {
    const [path, setPath] = useState('');
    const [stats, setStats] = useState<ScanStats | null>(null);
    const [snapshots, setSnapshots] = useState<any[]>([]);
    const [entities, setEntities] = useState<any[]>([]);
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<ScanProgressEventData | null>(null);
    const [showTreemap, setShowTreemap] = useState(false);
    const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
    const [showCompare, setShowCompare] = useState(false);
    const [compareA, setCompareA] = useState<number | null>(null);
    const [compareB, setCompareB] = useState<number | null>(null);
    const [showKnowledgePacks, setShowKnowledgePacks] = useState(false);

    async function selectPath() {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: 'Selecione a pasta para escanear'
            });
            if (selected && typeof selected === 'string') {
                setPath(selected);
            }
        } catch (err) {
            console.error('Erro ao selecionar pasta:', err);
        }
    }

    async function startScan() {
        if (!path.trim()) return;
        setLoading(true);
        setError(null);
        setStats(null);
        setSnapshots([]);
        setEntities([]);
        setRecommendations([]);
        setProgress(null);
        try {
            // Listen to progress events
            const unlisten = await listen<ScanProgressEventData>('scan-progress', (event) => {
                setProgress(event.payload);
            });

            const result = (await invoke('start_scan', { path: path.trim() })) as ScanStats;
            setStats(result);

            // Stop listening to progress events
            unlisten();

            const snap = (await invoke('list_snapshots')) as any[];
            setSnapshots(snap);

            if (snap.length > 0) {
                const ents = (await invoke('get_entities', { snapshotId: snap[0].id })) as any[];
                setEntities(ents);
                const recs = (await invoke('get_recommendations', { snapshotId: snap[0].id })) as any[];
                setRecommendations(recs);
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
            setProgress(null);
        }
    }

    // Cleanup listener on unmount
    useEffect(() => {
        return () => {
            listen<ScanProgressEventData>('scan-progress', () => { }).then(unlisten => unlisten());
        };
    }, []);

    return (
        <div className="container">
            <h1>DiskMind</h1>

            <div className="card">
                <input
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder="Selecione uma pasta para escanear"
                />
                <div className="button-row">
                    <button onClick={selectPath} disabled={loading}>📁 Escolher pasta</button>
                    <button onClick={startScan} disabled={loading || !path.trim()} className="primary">
                        {loading ? '⏳ Escaneando...' : '🔍 Iniciar escaneamento'}
                    </button>
                    <button onClick={() => setShowKnowledgePacks(true)} disabled={loading}>
                        📚 Knowledge Packs
                    </button>
                </div>

                {loading && progress && (
                    <div className="progress-section">
                        <div className="progress-bar-container">
                            <div className="progress-bar" style={{ width: '100%' }}></div>
                        </div>
                        <div className="progress-text">
                            Escaneando: {progress.current_path} — {progress.files_scanned} arquivos, {progress.dirs_scanned} pastas
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="card error-card">
                    <h2>❌ Erro</h2>
                    <p className="error-text">{error}</p>
                </div>
            )}

            {stats && (
                <div className="card">
                    <h2>📊 Resultado</h2>
                    <div className="stats-grid">
                        <div className="stat">
                            <span className="stat-value">{stats.total_files.toLocaleString()}</span>
                            <span className="stat-label">Arquivos</span>
                        </div>
                        <div className="stat">
                            <span className="stat-value">{stats.total_dirs.toLocaleString()}</span>
                            <span className="stat-label">Pastas</span>
                        </div>
                        <div className="stat">
                            <span className="stat-value">{formatBytes(stats.total_size)}</span>
                            <span className="stat-label">Tamanho total</span>
                        </div>
                    </div>
                    {stats.errors.length > 0 && (
                        <ul>
                            {stats.errors.map((err, idx) => <li key={idx}>{err}</li>)}
                        </ul>
                    )}
                </div>
            )}

            {entities.length > 0 && (
                <div className="card">
                    <h2>🧩 Entidades detectadas</h2>
                    <ul>
                        {entities.map((entity, idx) => (
                            <li key={idx}>{entity.kind} — {entity.id}</li>
                        ))}
                    </ul>
                </div>
            )}

            {recommendations.length > 0 && (
                <div className="card">
                    <h2>💡 Recomendações</h2>
                    <ul>
                        {recommendations.map((rec, idx) => (
                            <li key={idx}><strong>{rec.title}</strong>: {rec.description}</li>
                        ))}
                    </ul>
                </div>
            )}

            {snapshots.length > 0 && (
                <div className="card">
                    <h2>🗂️ Snapshots anteriores</h2>
                    <ul>
                        {snapshots.map((snap) => (
                            <li key={snap.id}>
                                <span className="snapshot-info">
                                    {snap.createdAt} — {snap.root}
                                </span>
                                <div className="snapshot-actions">
                                    <button
                                        onClick={() => {
                                            setSelectedSnapshotId(snap.id);
                                            setShowTreemap(true);
                                        }}
                                        className="treemap-btn"
                                    >
                                        🗺️ Treemap
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (compareA === null) {
                                                setCompareA(snap.id);
                                            } else if (compareB === null && snap.id !== compareA) {
                                                setCompareB(snap.id);
                                            }
                                        }}
                                        className="compare-btn"
                                        disabled={compareA === snap.id || compareB === snap.id}
                                    >
                                        📊 Comparar
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                const { save } = await import('@tauri-apps/plugin-dialog');
                                                const filePath = await save({
                                                    defaultPath: `snapshot-${snap.id}-report.json`,
                                                    filters: [{
                                                        name: 'JSON',
                                                        extensions: ['json']
                                                    }]
                                                });
                                                if (filePath && typeof filePath === 'string') {
                                                    await invoke('export_snapshot_report', { snapshotId: snap.id, path: filePath });
                                                    alert('Relatório exportado com sucesso!');
                                                }
                                            } catch (err) {
                                                console.error('Erro ao exportar:', err);
                                                alert('Erro ao exportar relatório');
                                            }
                                        }}
                                        className="export-btn"
                                    >
                                        📥 Exportar
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                    {compareA !== null && compareB !== null && (
                        <button
                            onClick={() => setShowCompare(true)}
                            className="primary compare-action-btn"
                        >
                            Ver comparação entre snapshots {compareA} e {compareB}
                        </button>
                    )}
                    {compareA !== null && compareB === null && (
                        <p className="compare-hint">Selecione um segundo snapshot para comparar</p>
                    )}
                </div>
            )}

            {showTreemap && selectedSnapshotId && (
                <TreemapView
                    snapshotId={selectedSnapshotId}
                    onBack={() => setShowTreemap(false)}
                />
            )}

            {showCompare && compareA !== null && compareB !== null && (
                <SnapshotCompareView
                    snapshotA={compareA}
                    snapshotB={compareB}
                    onBack={() => setShowCompare(false)}
                />
            )}

            {showKnowledgePacks && (
                <KnowledgePackManager
                    onClose={() => setShowKnowledgePacks(false)}
                />
            )}
        </div>
    );
}

export default App;
