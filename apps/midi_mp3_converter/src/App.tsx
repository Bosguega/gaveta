import { useEffect, useState } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { FileList } from '@/components/FileList';
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

export function App() {
    const items = useConverterStore((state) => state.items);
    const selectedId = useConverterStore((state) => state.selectedId);
    const settings = useConverterStore((state) => state.settings);
    const progress = useConverterStore((state) => state.progress);
    const summary = useConverterStore((state) => state.summary);
    const busy = useConverterStore((state) => state.busy);
    const status = useConverterStore((state) => state.status);
    const load = useConverterStore((state) => state.load);
    const addPaths = useConverterStore((state) => state.addPaths);
    const select = useConverterStore((state) => state.select);
    const convert = useConverterStore((state) => state.convert);
    const cancel = useConverterStore((state) => state.cancel);
    const applyProgress = useConverterStore((state) => state.applyProgress);
    const finish = useConverterStore((state) => state.finish);
    const dismissSummary = useConverterStore((state) => state.dismissSummary);
    const [showOptions, setShowOptions] = useState(false);

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

    const reveal = (item: QueueItem) => {
        api.revealInFolder(item.outputPath ?? item.path).catch((error) => console.warn(String(error)));
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
            <Toolbar onOptions={() => setShowOptions(true)} />
            <FileList items={items} selectedId={selectedId} onSelect={select} onActivate={reveal} />
            <PlayerBar />
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
                <span className='ellipsis'>{pendingCount > 0 ? pendingCount + ' arquivo(s) na fila' : 'Fila vazia'}</span>
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
            {summary ? <ReportDialog summary={summary} onClose={dismissSummary} /> : null}
        </div>
    );
}