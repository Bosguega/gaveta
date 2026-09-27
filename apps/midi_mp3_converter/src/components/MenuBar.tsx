import { useEffect, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useConverterStore } from '@/stores/useConverterStore';

interface MenuBarProps {
    onOptions: () => void;
    onAbout: () => void;
    onExit: () => void;
}

type MenuKey = 'file' | 'edit' | 'tools' | 'help' | null;

export function MenuBar({ onOptions, onAbout, onExit }: MenuBarProps) {
    const [openMenu, setOpenMenu] = useState<MenuKey>(null);
    const addPaths = useConverterStore((state) => state.addPaths);
    const removeSelected = useConverterStore((state) => state.removeSelected);
    const clearCompleted = useConverterStore((state) => state.clearCompleted);
    const clearList = useConverterStore((state) => state.clearList);
    const selectAll = useConverterStore((state) => state.selectAll);
    const busy = useConverterStore((state) => state.busy);
    const hasSelection = useConverterStore((state) => state.selectedIds.length > 0);
    const hasItems = useConverterStore((state) => state.items.length > 0);
    const barRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const onDocClick = (event: MouseEvent) => {
            if (barRef.current && !barRef.current.contains(event.target as Node)) {
                setOpenMenu(null);
            }
        };
        window.addEventListener('click', onDocClick);
        return () => window.removeEventListener('click', onDocClick);
    }, []);

    const pickFiles = async () => {
        setOpenMenu(null);
        const picked = await open({
            multiple: true,
            title: 'Adicionar arquivos MIDI',
            filters: [{ name: 'MIDI', extensions: ['mid', 'midi'] }],
        });
        if (!picked) return;
        await addPaths(Array.isArray(picked) ? picked : [picked]);
    };

    const pickFolder = async () => {
        setOpenMenu(null);
        const picked = await open({ directory: true, multiple: false, title: 'Adicionar pasta de MIDI' });
        if (typeof picked === 'string') {
            await addPaths([picked]);
        }
    };

    const toggle = (menu: MenuKey) => {
        setOpenMenu((curr) => (curr === menu ? null : menu));
    };

    const onHover = (menu: MenuKey) => {
        if (openMenu !== null && openMenu !== menu) {
            setOpenMenu(menu);
        }
    };

    return (
        <div className='menubar' ref={barRef}>
            <div className='menu-item-root' onMouseEnter={() => onHover('file')}>
                <div
                    className={'menu-title' + (openMenu === 'file' ? ' active' : '')}
                    onClick={() => toggle('file')}
                >
                    <u>A</u>rquivo
                </div>
                {openMenu === 'file' ? (
                    <div className='menu-dropdown bevel-out'>
                        <div className='menu-entry' onClick={() => void pickFiles()}>
                            <span>Adicionar arquivos...</span>
                        </div>
                        <div className='menu-entry' onClick={() => void pickFolder()}>
                            <span>Adicionar pasta...</span>
                        </div>
                        <div className='menu-sep' />
                        <div className='menu-entry' onClick={() => { setOpenMenu(null); onExit(); }}>
                            <span>Sair</span>
                            <span className='menu-accel'>Alt+F4</span>
                        </div>
                    </div>
                ) : null}
            </div>

            <div className='menu-item-root' onMouseEnter={() => onHover('edit')}>
                <div
                    className={'menu-title' + (openMenu === 'edit' ? ' active' : '')}
                    onClick={() => toggle('edit')}
                >
                    <u>E</u>ditar
                </div>
                {openMenu === 'edit' ? (
                    <div className='menu-dropdown bevel-out'>
                        <div
                            className={'menu-entry' + (hasItems ? '' : ' disabled')}
                            onClick={() => {
                                if (!hasItems) return;
                                selectAll();
                                setOpenMenu(null);
                            }}
                        >
                            <span>Selecionar tudo</span>
                            <span className='menu-accel'>Ctrl+A</span>
                        </div>
                        <div
                            className={'menu-entry' + (!busy && hasSelection ? '' : ' disabled')}
                            onClick={() => {
                                if (busy || !hasSelection) return;
                                void removeSelected();
                                setOpenMenu(null);
                            }}
                        >
                            <span>Remover selecionados</span>
                            <span className='menu-accel'>Del</span>
                        </div>
                        <div className='menu-sep' />
                        <div
                            className={'menu-entry' + (!busy && hasItems ? '' : ' disabled')}
                            onClick={() => {
                                if (busy || !hasItems) return;
                                void clearCompleted();
                                setOpenMenu(null);
                            }}
                        >
                            <span>Limpar concluídos</span>
                        </div>
                        <div
                            className={'menu-entry' + (!busy && hasItems ? '' : ' disabled')}
                            onClick={() => {
                                if (busy || !hasItems) return;
                                void clearList();
                                setOpenMenu(null);
                            }}
                        >
                            <span>Limpar lista inteira</span>
                        </div>
                    </div>
                ) : null}
            </div>

            <div className='menu-item-root' onMouseEnter={() => onHover('tools')}>
                <div
                    className={'menu-title' + (openMenu === 'tools' ? ' active' : '')}
                    onClick={() => toggle('tools')}
                >
                    <u>F</u>erramentas
                </div>
                {openMenu === 'tools' ? (
                    <div className='menu-dropdown bevel-out'>
                        <div
                            className='menu-entry'
                            onClick={() => {
                                setOpenMenu(null);
                                onOptions();
                            }}
                        >
                            <span>Opções...</span>
                        </div>
                    </div>
                ) : null}
            </div>

            <div className='menu-item-root' onMouseEnter={() => onHover('help')}>
                <div
                    className={'menu-title' + (openMenu === 'help' ? ' active' : '')}
                    onClick={() => toggle('help')}
                >
                    A<u>j</u>uda
                </div>
                {openMenu === 'help' ? (
                    <div className='menu-dropdown bevel-out'>
                        <div
                            className='menu-entry'
                            onClick={() => {
                                setOpenMenu(null);
                                onAbout();
                            }}
                        >
                            <span>Sobre o MIDI → MP3 Converter...</span>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}