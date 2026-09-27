import { open } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/Button';
import { useConverterStore } from '@/stores/useConverterStore';

interface ToolbarProps {
    onOptions: () => void;
}

export function Toolbar({ onOptions }: ToolbarProps) {
    const addPaths = useConverterStore((state) => state.addPaths);
    const removeSelected = useConverterStore((state) => state.removeSelected);
    const clearList = useConverterStore((state) => state.clearList);
    const busy = useConverterStore((state) => state.busy);
    const hasSelection = useConverterStore((state) => state.selectedId !== null);

    const pickFiles = async () => {
        const picked = await open({
            multiple: true,
            title: 'Adicionar arquivos MIDI',
            filters: [{ name: 'MIDI', extensions: ['mid', 'midi'] }],
        });
        if (!picked) return;
        await addPaths(Array.isArray(picked) ? picked : [picked]);
    };

    const pickFolder = async () => {
        const picked = await open({ directory: true, multiple: false, title: 'Adicionar pasta de MIDI' });
        if (typeof picked === 'string') {
            await addPaths([picked]);
        }
    };

    return (
        <div className='toolbar'>
            <Button onClick={() => void pickFiles()}>Adicionar arquivos</Button>
            <Button onClick={() => void pickFolder()}>Adicionar pasta</Button>
            <span className='toolbar-sep' />
            <Button onClick={() => void removeSelected()} disabled={busy || !hasSelection}>
                Remover
            </Button>
            <Button onClick={() => void clearList()} disabled={busy}>
                Limpar lista
            </Button>
            <span className='toolbar-sep' />
            <Button onClick={onOptions}>Opções...</Button>
        </div>
    );
}