import type { QueueItem } from '@/types';
import { STATUS_LABEL } from '@/types';
import { formatBytes, formatDuration } from '@/utils/format';

interface FileListProps {
    items: QueueItem[];
    selectedId: number | null;
    onSelect: (id: number) => void;
    onActivate: (item: QueueItem) => void;
}

export function FileList({ items, selectedId, onSelect, onActivate }: FileListProps) {
    return (
        <div className='list'>
            <div className='list-header'>
                <span />
                <span>Nome</span>
                <span className='col-right'>Tamanho</span>
                <span className='col-right'>Duração</span>
                <span>Status</span>
            </div>
            <div className='list-body bevel-in'>
                {items.length === 0 ? (
                    <div className='empty'>Arraste arquivos ou pastas MIDI aqui, ou use Adicionar arquivos.</div>
                ) : (
                    items.map((item) => (
                        <div
                            key={item.id}
                            className={rowClass(item, selectedId)}
                            onClick={() => onSelect(item.id)}
                            onDoubleClick={() => onActivate(item)}
                            title={item.error ?? item.path}
                        >
                            <span>{item.status === 'running' ? '»' : item.status === 'done' ? '♪' : item.status === 'error' ? '×' : '♫'}</span>
                            <span className='ellipsis'>{item.name}</span>
                            <span className='col-right'>{formatBytes(item.size)}</span>
                            <span className='col-right'>{formatDuration(item.durationMs)}</span>
                            <span className='ellipsis'>{item.error ? 'Erro: ' + item.error : STATUS_LABEL[item.status]}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function rowClass(item: QueueItem, selectedId: number | null): string {
    const parts = ['row'];
    if (item.id === selectedId) parts.push('selected');
    if (item.status === 'error') parts.push('status-error');
    return parts.join(' ');
}