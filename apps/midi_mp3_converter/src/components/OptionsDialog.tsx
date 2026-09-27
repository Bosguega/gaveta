import { open } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/Button';
import { useConverterStore } from '@/stores/useConverterStore';
import { BITRATES, EXISTING_LABEL, GAINS, SAMPLE_RATES, type ExistingPolicy } from '@/types';

interface OptionsDialogProps {
    onClose: () => void;
}

export function OptionsDialog({ onClose }: OptionsDialogProps) {
    const settings = useConverterStore((state) => state.settings);
    const soundfonts = useConverterStore((state) => state.soundfonts);
    const updateSettings = useConverterStore((state) => state.updateSettings);

    if (!settings) return null;

    const pickOutput = async () => {
        const picked = await open({ directory: true, multiple: false, title: 'Pasta de saída' });
        if (typeof picked === 'string') {
            await updateSettings({ outputDir: picked });
        }
    };

    const pickSoundfont = async () => {
        const picked = await open({
            multiple: false,
            title: 'Escolher SoundFont',
            filters: [{ name: 'SoundFont', extensions: ['sf2', 'sf3'] }],
        });
        if (typeof picked === 'string') {
            await updateSettings({ soundfont: picked });
        }
    };

    return (
        <div className='modal-backdrop'>
            <div className='modal bevel-out'>
                <div className='modal-title'>Opções</div>
                <div className='modal-body'>
                    <fieldset className='group'>
                        <legend>Saída</legend>
                        <div className='option-row'>
                            <span className='option-label'>Pasta:</span>
                            <input
                                className='input bevel-in grow'
                                readOnly
                                value={settings.outputDir ?? ''}
                                placeholder='(mesma pasta do MIDI)'
                            />
                            <Button onClick={() => void pickOutput()}>...</Button>
                            {settings.outputDir ? (
                                <Button onClick={() => void updateSettings({ outputDir: null })}>Limpar</Button>
                            ) : null}
                        </div>
                        <div className='option-row'>
                            <span className='option-label'>Se o MP3 já existir:</span>
                            <select
                                className='select bevel-in'
                                value={settings.existing}
                                onChange={(event) => void updateSettings({ existing: event.target.value as ExistingPolicy })}
                            >
                                {(Object.keys(EXISTING_LABEL) as ExistingPolicy[]).map((value) => (
                                    <option key={value} value={value}>
                                        {EXISTING_LABEL[value]}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className='option-row'>
                            <label className='checkbox'>
                                <input
                                    type='checkbox'
                                    checked={settings.includeSubfolders}
                                    onChange={(event) => void updateSettings({ includeSubfolders: event.target.checked })}
                                />
                                Incluir subpastas ao adicionar uma pasta
                            </label>
                        </div>
                    </fieldset>
                    <fieldset className='group'>
                        <legend>Áudio e MP3</legend>
                        <div className='option-row'>
                            <span className='option-label'>Bitrate MP3:</span>
                            <select
                                className='select bevel-in'
                                value={settings.bitrateKbps}
                                onChange={(event) => void updateSettings({ bitrateKbps: Number(event.target.value) })}
                            >
                                {BITRATES.map((value) => (
                                    <option key={value} value={value}>
                                        {value} kbps
                                    </option>
                                ))}
                            </select>
                            <span className='option-label'>Taxa de amostragem:</span>
                            <select
                                className='select bevel-in'
                                value={settings.sampleRate}
                                onChange={(event) => void updateSettings({ sampleRate: Number(event.target.value) })}
                            >
                                {SAMPLE_RATES.map((value) => (
                                    <option key={value} value={value}>
                                        {value} Hz
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className='option-row'>
                            <span className='option-label'>Volume:</span>
                            <select
                                className='select bevel-in'
                                value={settings.gain}
                                onChange={(event) => void updateSettings({ gain: Number(event.target.value) })}
                            >
                                {GAINS.map((value) => (
                                    <option key={value} value={value}>
                                        {Math.round(value * 100)}%
                                    </option>
                                ))}
                            </select>
                            <label className='checkbox'>
                                <input
                                    type='checkbox'
                                    checked={settings.writeId3}
                                    onChange={(event) => void updateSettings({ writeId3: event.target.checked })}
                                />
                                Gravar tags ID3 (Título)
                            </label>
                        </div>
                        <div className='option-row'>
                            <label className='checkbox'>
                                <input
                                    type='checkbox'
                                    checked={settings.normalize}
                                    onChange={(event) => void updateSettings({ normalize: event.target.checked })}
                                />
                                Normalizar volume do lote (loudnorm)
                            </label>
                        </div>
                    </fieldset>
                    <fieldset className='group'>
                        <legend>Efeitos do FluidSynth</legend>
                        <div className='option-row'>
                            <label className='checkbox'>
                                <input
                                    type='checkbox'
                                    checked={settings.reverb}
                                    onChange={(event) => void updateSettings({ reverb: event.target.checked })}
                                />
                                Habilitar Reverb
                            </label>
                            <label className='checkbox' style={{ marginLeft: 12 }}>
                                <input
                                    type='checkbox'
                                    checked={settings.chorus}
                                    onChange={(event) => void updateSettings({ chorus: event.target.checked })}
                                />
                                Habilitar Chorus
                            </label>
                        </div>
                    </fieldset>
                    <fieldset className='group'>
                        <legend>SoundFont</legend>
                        <div className='option-row'>
                            <select
                                className='select bevel-in grow'
                                value={settings.soundfont ?? ''}
                                onChange={(event) =>
                                    void updateSettings({ soundfont: event.target.value === '' ? null : event.target.value })
                                }
                            >
                                {soundfonts.map((option, index) => (
                                    <option key={option.path} value={index === 0 ? '' : option.path}>
                                        {option.name}
                                        {index === 0 ? ' (padrão)' : ''}
                                    </option>
                                ))}
                                {settings.soundfont && !soundfonts.some((option) => option.path === settings.soundfont) ? (
                                    <option value={settings.soundfont}>{settings.soundfont}</option>
                                ) : null}
                            </select>
                            <Button onClick={() => void pickSoundfont()}>Escolher...</Button>
                        </div>
                    </fieldset>
                    <fieldset className='group'>
                        <legend>Outros</legend>
                        <label className='checkbox'>
                            <input
                                type='checkbox'
                                checked={settings.completionBeep}
                                onChange={(event) => void updateSettings({ completionBeep: event.target.checked })}
                            />
                            Tocar um bipe clássico ao concluir
                        </label>
                    </fieldset>
                </div>
                <div className='modal-buttons'>
                    <Button onClick={onClose}>Fechar</Button>
                </div>
            </div>
        </div>
    );
}