import { Button } from '@/components/ui/Button';

interface AboutDialogProps {
    onClose: () => void;
}

export function AboutDialog({ onClose }: AboutDialogProps) {
    return (
        <div className='modal-backdrop'>
            <div className='modal bevel-out' style={{ width: 440 }}>
                <div className='modal-title'>Sobre o MIDI → MP3 Converter</div>
                <div className='modal-body' style={{ fontSize: 11, lineHeight: '16px' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontSize: 32, userSelect: 'none' }}>♫</div>
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: 13 }}>MIDI → MP3 Converter</div>
                            <div>Versão 0.1.0 (Windows x64)</div>
                            <div style={{ color: 'var(--dark)' }}>Utilitário desktop leve e retrô</div>
                        </div>
                    </div>
                    <fieldset className='group'>
                        <legend>Componentes integrados</legend>
                        <div>• <b>FluidSynth 2.6.1</b> — Síntese MIDI offline (LGPL-2.1+)</div>
                        <div>• <b>FFmpeg 7.1 LGPL</b> — Codificador MP3 / LAME (LGPL-2.1+)</div>
                        <div>• <b>FluidR3Mono GM</b> — Banco de timbres General MIDI (MIT)</div>
                        <div>• <b>MuseScore General</b> — Banco alternativo de timbres (MIT)</div>
                    </fieldset>
                    <div style={{ marginTop: 8, color: 'var(--dark)' }}>
                        Desenvolvido no Gaveta Monorepo com Tauri 2 + React + Rust.
                    </div>
                </div>
                <div className='modal-buttons'>
                    <Button onClick={onClose}>OK</Button>
                </div>
            </div>
        </div>
    );
}