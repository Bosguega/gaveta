import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AboutDialog } from '@/components/AboutDialog';
import { ContextMenu } from '@/components/ContextMenu';
import { FileList } from '@/components/FileList';
import { MenuBar } from '@/components/MenuBar';
import { OptionsDialog } from '@/components/OptionsDialog';
import { PlayerBar } from '@/components/PlayerBar';
import { ProgressPanel } from '@/components/ProgressPanel';
import { ReportDialog } from '@/components/ReportDialog';
import { StatusBar } from '@/components/StatusBar';
import { Toolbar } from '@/components/Toolbar';
import { Button } from '@/components/ui/Button';
import * as api from '@/services/converter';
import { useConverterStore } from '@/stores/useConverterStore';
import type { QueueItem } from '@/types';
import { baseName } from '@/utils/format';

interface MenuState {
    x: number;
    y: number;
    item: QueueItem;
}

export function App() {
    const items = useConverterStore((state) => state.items);
    const selectedIds = useConverterStore((state) => state.selectedIds);
    const settings = useConverterStore((state) => state.settings);
    const progress = useConverterStore((state) => state.progress);
    const summary = useConverterStore((state) => state.summary);
    const busy = useConverterStore((state) => state.busy);
    const status = useConverterStore((state) => state.status);
    const load = useConverterStore((state) => state.load);
    const addPaths = useConverterStore((state) => state.addPaths);
    const selectSingle = useConverterStore((state) => state.selectSingle);
    const toggleSelect = useConverterStore((state) => state.toggleSelect);
    const selectRange = useConverterStore((state) => state.selectRange);
    const selectAll = useConverterStore((state) => state.selectAll);
    const removeSelected = useConverterStore((state) => state.removeSelected);
    const convert = useConverterStore((state) => state.convert);
    const cancel = useConverterStore((state) => state.cancel);
    const applyProgress = useConverterStore((state) => state.applyProgress);
    const finish = useConverterStore((state) => state.finish);
    const dismissSummary = useConverterStore((state) => state.dismissSummary);

    const [showOptions, setShowOptions] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [contextMenu, setContextMenu] = useState<MenuState | null>(null);
    const [previewTrigger, setPreviewTrigger] = useState<{ id: number; nonce: number } | null>(null);

    useEffect(() => {
        load().catch((error) => console.warn('falha ao carregar o estado inicial', error));
    }, [load]);

    useEffect(() => {
        const offProgress = api.onProgress(applyProgress);
        const offDone = api.onDone(finish);
        return () => {
            offProgress.then((off) => off()).catch(() => undefined);
            offDone.then((off) => off()).catch(() => undefined);
        };
    }, [applyProgress, finish]);

    useEffect(() => {
        const listener = getCurrentWebview().onDragDropEvent((event) => {
            if (event.payload.type === 'drop') {
                addPaths(event.payload.paths).catch((error) => console.warn('falha no arrastar e soltar', error));
            }
        });
        return () => {
            listener.then((off) => off()).catch(() => undefined);
        };
    }, [addPaths]);

    // Atalhos de teclado clássicos
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) {
                return;
            }
            if (event.key === 'Delete') {
                event.preventDefault();
                void removeSelected();
            } else if ((event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'A')) {
                event.preventDefault();
                selectAll();
            } else if (event.key === 'Escape') {
                setContextMenu(null);
                if (showOptions) setShowOptions(false);
                if (showAbout) setShowAbout(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [removeSelected, selectAll, showOptions, showAbout]);

    const reveal = useCallback((item: QueueItem) => {
        api.revealInFolder(item.outputPath ?? item.path).catch((error) => console.warn(String(error)));
    }, []);

    const playItem = useCallback((item: QueueItem) => {
        selectSingle(item.id);
        setPreviewTrigger({ id: item.id, nonce: Date.now() });
    }, [selectSingle]);

    const onContextMenu = useCallback((event: MouseEvent, item: QueueItem) => {
        event.preventDefault();
        event.stopPropagation();
        if (!selectedIds.includes(item.id)) {
            selectSingle(item.id);
        }
        setContextMenu({ x: event.clientX, y: event.clientY, item });
    }, [selectedIds, selectSingle]);

    const handleOpenOutputDir = () => {
        if (settings?.outputDir) {
            api.openFolder(settings.outputDir).catch((error) => console.warn(String(error)));
        } else if (items.length > 0) {
            api.revealInFolder(items[0].outputPath ?? items[0].path).catch((error) => console.warn(String(error)));
        }
    };

    const doneCount = items.filter((item) => item.status === 'done').length;
    const pendingCount = items.filter((item) => item.status !== 'done' && item.status !== 'skipped').length;
    const running = busy || (progress !== null && progress.status === 'running');
    const currentName = running && progress ? progress.name : null;
    const phase = running && progress ? progress.phase : '';
    const itemPercent = running && progress ? progress.itemPercent : 0;
    const batchPercent = running && progress ? progress.batchPercent : items.length > 0 ? (doneCount / items.length) * 100 : 0;
    const soundFont = baseName(settings?.soundfont ?? 'FluidR3Mono_GM.sf3');

    return (
        <div className='app'>
            <MenuBar
                onOptions={() => setShowOptions(true)}
                onAbout={() => setShowAbout(true)}
                onExit={() => void getCurrentWindow().close()}
            />
            <Toolbar onOptions={() => setShowOptions(true)} />
            <FileList
                items={items}
                selectedIds={selectedIds}
                onSelectSingle={selectSingle}
                onToggleSelect={toggleSelect}
                onSelectRange={selectRange}
                onActivate={reveal}
                onContextMenu={onContextMenu}
            />
            <PlayerBar previewTrigger={previewTrigger} />
            <div className='output-row'>
                <label htmlFor='output-dir'>Saída:</label>
                <input
                    id='output-dir'
                    className='input bevel-in'
                    readOnly
                    value={settings?.outputDir ?? ''}
                    placeholder='(mesma pasta do MIDI)'
                />
                <Button onClick={() => setShowOptions(true)}>...</Button>
                <Button onClick={handleOpenOutputDir} title='Abrir pasta no Windows Explorer'>
                    Abrir pasta
                </Button>
            </div>
            <div className='output-row'>
                {running ? (
                    <Button className='btn-wide' onClick={() => void cancel()}>
                        Cancelar
                    </Button>
                ) : (
                    <Button className='btn-wide' onClick={() => void convert()} disabled={pendingCount === 0}>
                        Converter
                    </Button>
                )}
                <span className='ellipsis'>
                    {pendingCount > 0 ? pendingCount + ' arquivo(s) na fila' : 'Fila vazia'}
                    {selectedIds.length > 1 ? ` (${selectedIds.length} selecionados)` : ''}
                </span>
            </div>
            <ProgressPanel
                currentName={currentName}
                phase={phase}
                itemPercent={itemPercent}
                batchPercent={batchPercent}
                doneCount={doneCount}
                totalCount={items.length}
            />
            <StatusBar message={status} soundFont={soundFont} doneCount={doneCount} totalCount={items.length} />

            {showOptions ? <OptionsDialog onClose={() => setShowOptions(false)} /> : null}
            {showAbout ? <AboutDialog onClose={() => setShowAbout(false)} /> : null}
            {summary ? <ReportDialog summary={summary} onClose={dismissSummary} /> : null}
            {contextMenu ? (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    item={contextMenu.item}
                    onClose={() => setContextMenu(null)}
                    onPlay={playItem}
                    onRevealOriginal={(item) => void api.revealInFolder(item.path)}
                    onRevealOutput={(item) => item.outputPath && void api.revealInFolder(item.outputPath)}
                    onRemove={() => void removeSelected()}
                />
            ) : null}
        </div>
    );
}