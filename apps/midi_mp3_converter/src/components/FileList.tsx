import type { MouseEvent } from 'react';
import type { QueueItem } from '@/types';
import { STATUS_LABEL } from '@/types';
import { formatBytes, formatDuration } from '@/utils/format';

interface FileListProps {
    items: QueueItem[];
    selectedIds: number[];
    onSelectSingle: (id: number) => void;
    onToggleSelect: (id: number) => void;
    onSelectRange: (id: number) => void;
    onActivate: (item: QueueItem) => void;
    onContextMenu: (event: MouseEvent, item: QueueItem) => void;
}

export function FileList({
    items,
    selectedIds,
    onSelectSingle,
    onToggleSelect,
    onSelectRange,
    onActivate,
    onContextMenu,
}: FileListProps) {
    const handleClick = (event: MouseEvent, id: number) => {
        if (event.ctrlKey || event.metaKey) {
            onToggleSelect(id);
        } else if (event.shiftKey) {
            onSelectRange(id);
        } else {
            onSelectSingle(id);
        }
    };

    return (
        <div className='list'>
            <div className='list-header'>
                <span />
                <span>Nome</span>
                <span className='col-right'>Tamanho</span>
                <span className='col-right'>Duração</span>
                <span>Status</span>
            </div>
            <div className='list-body bevel-in' tabIndex={0}>
                {items.length === 0 ? (
                    <div className='empty'>Arraste arquivos ou pastas MIDI aqui, ou use Adicionar arquivos.</div>
                ) : (
                    items.map((item) => {
                        const isSelected = selectedIds.includes(item.id);
                        return (
                            <div
                                key={item.id}
                                className={rowClass(item, isSelected)}
                                onClick={(event) => handleClick(event, item.id)}
                                onDoubleClick={() => onActivate(item)}
                                onContextMenu={(event) => onContextMenu(event, item)}
                                title={item.error ?? item.path}
                            >
                                <span>
                                    {item.status === 'running'
                                        ? '»'
                                        : item.status === 'done'
                                        ? '♪'
                                        : item.status === 'error'
                                        ? '×'
                                        : '♫'}
                                </span>
                                <span className='ellipsis'>{item.name}</span>
                                <span className='col-right'>{formatBytes(item.size)}</span>
                                <span className='col-right'>{formatDuration(item.durationMs)}</span>
                                <span className='ellipsis'>
                                    {item.error ? 'Erro: ' + item.error : STATUS_LABEL[item.status]}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function rowClass(item: QueueItem, isSelected: boolean): string {
    const parts = ['row'];
    if (isSelected) parts.push('selected');
    if (item.status === 'error') parts.push('status-error');
    return parts.join(' ');
}