import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './TreemapView.css';

interface DirNode {
    id: number;
    parentId: number | null;
    name: string;
    size: number;
    fileCount: number;
    depth: number;
    children?: DirNode[];
}

interface TreemapViewProps {
    snapshotId: number;
    onBack?: () => void;
}

function buildTree(nodes: DirNode[]): DirNode | null {
    const map = new Map<number, DirNode>();
    let root: DirNode | null = null;

    for (const node of nodes) {
        map.set(node.id, { ...node, children: [] });
    }

    for (const node of nodes) {
        const current = map.get(node.id)!;
        if (node.parentId === null || !map.has(node.parentId)) {
            root = current;
        } else {
            const parent = map.get(node.parentId)!;
            if (!parent.children) parent.children = [];
            parent.children.push(current);
        }
    }

    return root;
}

function TreemapNode({ node, depth = 0, totalSize }: { node: DirNode; depth?: number; totalSize: number }) {
    const [expanded, setExpanded] = useState(depth < 2);
    const percentage = totalSize > 0 ? (node.size / totalSize) * 100 : 0;
    const hasChildren = node.children && node.children.length > 0;

    const colors = [
        '#6ee7f7', '#a78bfa', '#f472b6', '#34d399', '#fbbf24',
        '#f87171', '#60a5fa', '#facc15', '#4ade80', '#fb923c'
    ];
    const color = colors[depth % colors.length];

    return (
        <div className="treemap-node" style={{ backgroundColor: color }}>
            <div className="treemap-header">
                <span className="treemap-name" title={node.name}>
                    {hasChildren && (
                        <button
                            className="expand-btn"
                            onClick={() => setExpanded(!expanded)}
                        >
                            {expanded ? '−' : '+'}
                        </button>
                    )}
                    {node.name}
                </span>
            </div>
            <div className="treemap-info">
                <span className="treemap-size">{formatBytes(node.size)}</span>
                <span className="treemap-files">{node.fileCount} arquivos</span>
            </div>
            {hasChildren && expanded && (
                <div className="treemap-children">
                    {node.children!.map(child => (
                        <TreemapNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            totalSize={totalSize}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function TreemapView({ snapshotId, onBack }: TreemapViewProps) {
    const [tree, setTree] = useState<DirNode | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadTree() {
            try {
                const result = await invoke<{ dirs: DirNode[] }>('get_snapshot_tree', { snapshotId });
                const built = buildTree(result.dirs);
                setTree(built);
            } catch (err) {
                setError(String(err));
            } finally {
                setLoading(false);
            }
        }
        loadTree();
    }, [snapshotId]);

    if (loading) return <div className="treemap-loading">Carregando treemap...</div>;
    if (error) return <div className="treemap-error">Erro: {error}</div>;
    if (!tree) return <div className="treemap-empty">Nenhum dado disponível</div>;

    const totalSize = tree.size;

    return (
        <div className="treemap-container">
            <div className="treemap-header-bar">
                {onBack && <button onClick={onBack} className="back-btn">← Voltar</button>}
                <h2>🗺️ Visualização em Treemap</h2>
                <span className="treemap-total">Total: {formatBytes(totalSize)}</span>
            </div>
            <div className="treemap-content">
                <TreemapNode node={tree} depth={0} totalSize={totalSize} />
            </div>
        </div>
    );
}