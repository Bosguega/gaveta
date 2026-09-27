import type { MouseEvent as ReactMouseEvent } from 'react';
import type { QueueItem } from '@/types';

interface ContextMenuProps {
    x: number;
    y: number;
    item: QueueItem;
    onClose: () => void;
    onPlay: (item: QueueItem) => void;
    onRevealOriginal: (item: QueueItem) => void;
    onRevealOutput: (item: QueueItem) => void;
    onRemove: (item: QueueItem) => void;
}

export function ContextMenu({
    x,
    y,
    item,
    onClose,
    onPlay,
    onRevealOriginal,
    onRevealOutput,
    onRemove,
}: ContextMenuProps) {
    const handleAction = (e: ReactMouseEvent, action: () => void) => {
        e.stopPropagation();
        onClose();
        action();
    };

    const hasOutput = item.status === 'done' && Boolean(item.outputPath);

    return (
        <div className='context-menu-backdrop' onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
            <div
                className='context-menu bevel-out'
                style={{ top: y, left: x }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className='menu-entry' onClick={(e) => handleAction(e, () => onPlay(item))}>
                    <span>{hasOutput ? 'Tocar MP3' : 'Tocar prévia'}</span>
                </div>
                <div className='menu-sep' />
                <div
                    className={'menu-entry' + (hasOutput ? '' : ' disabled')}
                    onClick={(e) => {
                        if (!hasOutput) return;
                        handleAction(e, () => onRevealOutput(item));
                    }}
                >
                    <span>Abrir arquivo gerado (Explorer)</span>
                </div>
                <div className='menu-entry' onClick={(e) => handleAction(e, () => onRevealOriginal(item))}>
                    <span>Abrir pasta do MIDI</span>
                </div>
                <div className='menu-sep' />
                <div className='menu-entry' onClick={(e) => handleAction(e, () => onRemove(item))}>
                    <span>Remover da lista</span>
                    <span className='menu-accel'>Del</span>
                </div>
            </div>
        </div>
    );
}