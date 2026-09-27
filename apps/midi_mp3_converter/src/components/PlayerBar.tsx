import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import * as api from '@/services/converter';
import { useConverterStore } from '@/stores/useConverterStore';
import { formatClock } from '@/utils/format';

interface Source {
    url: string;
    owner: number;
}

export function PlayerBar() {
    const items = useConverterStore((state) => state.items);
    const selectedId = useConverterStore((state) => state.selectedId);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [source, setSource] = useState<Source | null>(null);
    const [playing, setPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(80);
    const [message, setMessage] = useState('');
    const selected = items.find((item) => item.id === selectedId) ?? null;

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume / 100;
        }
    }, [volume]);

    const stop = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
        setPlaying(false);
        setPosition(0);
        setDuration(0);
        setSource(null);
        setMessage('');
        api.clearPreview().catch(() => undefined);
    }, []);

    useEffect(() => {
        stop();
    }, [selectedId, stop]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !source) return;
        audio.src = source.url;
        audio.load();
        audio.play().catch(() => setMessage('Não foi possível tocar o áudio'));
    }, [source]);

    const toggle = async () => {
        const audio = audioRef.current;
        if (!audio || !selected) return;
        if (playing) {
            audio.pause();
            return;
        }
        if (source && source.owner === selected.id) {
            audio.play().catch(() => setMessage('Não foi possível tocar o áudio'));
            return;
        }
        if (selected.status === 'done' && selected.outputPath) {
            setSource({ url: api.audioSource(selected.outputPath), owner: selected.id });
            setMessage('MP3 convertido');
            return;
        }
        setMessage('Sintetizando prévia...');
        try {
            const wav = await api.renderPreview(selected.id);
            setSource({ url: api.audioSource(wav), owner: selected.id });
            setMessage('Prévia do MIDI (mesma síntese da conversão)');
        } catch (error) {
            setMessage('Prévia falhou: ' + String(error));
        }
    };

    return (
        <div className='player'>
            <Button onClick={() => void toggle()} disabled={!selected}>
                {playing ? '❚❚ Pausar' : '▶ Play'}
            </Button>
            <Button onClick={stop} disabled={!source}>
                ■ Parar
            </Button>
            <label htmlFor='player-volume'>Volume</label>
            <input
                id='player-volume'
                className='slider'
                type='range'
                min={0}
                max={100}
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
            />
            <span className='player-message ellipsis'>{message}</span>
            <span className='player-pos'>
                {formatClock(position)} / {duration > 0 ? formatClock(duration) : '--:--'}
            </span>
            <audio
                ref={audioRef}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
                onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
                onEnded={() => {
                    setPlaying(false);
                    setPosition(0);
                }}
            />
        </div>
    );
}