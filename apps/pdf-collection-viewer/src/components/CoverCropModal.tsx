import { useCallback, useEffect, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { saveCollectionCover } from '@/services/collections';

interface Props {
    srcPath: string;
    onCancel: () => void;
    onSave: (coverPath: string) => void;
}

const FRAME_W = 640;
const FRAME_H = 360; // 16:9
const MAX_ZOOM = 4;

/**
 * Simple crop editor for collection covers. Shows the image inside a fixed
 * 16:9 frame; the visible area is exactly what the final cover will be.
 * On save, converts offset+zoom into a pixel rect of the original image and
 * delegates cropping/resizing to the Rust backend.
 */
export function CoverCropModal({ srcPath, onCancel, onSave }: Props) {
    const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dragState = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

    const baseScale = natural ? Math.max(FRAME_W / natural.w, FRAME_H / natural.h) : 1;
    const scale = baseScale * zoom;
    const dispW = natural ? natural.w * scale : 0;
    const dispH = natural ? natural.h * scale : 0;

    const clampOffset = useCallback(
        (x: number, y: number) => {
            if (!natural) return { x: 0, y: 0 };
            const maxX = Math.max(0, (dispW - FRAME_W) / 2);
            const maxY = Math.max(0, (dispH - FRAME_H) / 2);
            return {
                x: Math.min(maxX, Math.max(-maxX, x)),
                y: Math.min(maxY, Math.max(-maxY, y)),
            };
        },
        [natural, dispW, dispH],
    );

    useEffect(() => {
        const img = new Image();
        img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => setError('Não foi possível carregar a imagem.');
        img.src = convertFileSrc(srcPath);
    }, [srcPath]);

    // Re-clamp when zoom changes so the frame stays filled.
    useEffect(() => {
        setOffset((o) => clampOffset(o.x, o.y));
    }, [zoom, clampOffset]);

    const onPointerDown = (e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragState.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
    };

    const onPointerMove = (e: React.PointerEvent) => {
        const drag = dragState.current;
        if (!drag) return;
        setOffset(clampOffset(drag.baseX + (e.clientX - drag.startX), drag.baseY + (e.clientY - drag.startY)));
    };

    const onPointerUp = () => {
        dragState.current = null;
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        setZoom((z) => Math.min(MAX_ZOOM, Math.max(1, z - e.deltaY * 0.002)));
    };

    const handleSave = async () => {
        if (!natural) return;
        setSaving(true);
        setError(null);
        try {
            // The frame's top-left corner in displayed-image coordinates,
            // converted back to original-image pixels.
            const topLeftX = (FRAME_W - dispW) / 2 + offset.x;
            const topLeftY = (FRAME_H - dispH) / 2 + offset.y;
            const rect = {
                cropX: -topLeftX / scale,
                cropY: -topLeftY / scale,
                cropW: FRAME_W / scale,
                cropH: FRAME_H / scale,
            };
            const coverPath = await saveCollectionCover(srcPath, rect);
            onSave(coverPath);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Erro ao gerar a capa');
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-xl p-6 w-full max-w-3xl">
                <h2 className="text-lg font-semibold mb-4">Ajustar capa</h2>

                <div
                    className="relative mx-auto overflow-hidden rounded-lg bg-slate-900 touch-none select-none cursor-move"
                    style={{ width: FRAME_W, height: FRAME_H }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onWheel={handleWheel}
                >
                    {natural && (
                        <img
                            src={convertFileSrc(srcPath)}
                            alt=""
                            draggable={false}
                            className="absolute pointer-events-none"
                            style={{
                                width: dispW,
                                height: dispH,
                                left: (FRAME_W - dispW) / 2 + offset.x,
                                top: (FRAME_H - dispH) / 2 + offset.y,
                            }}
                        />
                    )}
                    {/* Frame guide */}
                    <div className="absolute inset-0 border-2 border-white/70 pointer-events-none" />
                </div>

                <div className="flex items-center gap-3 mt-4 max-w-sm mx-auto">
                    <span className="text-xs text-slate-500">Zoom</span>
                    <input
                        type="range"
                        min={1}
                        max={MAX_ZOOM}
                        step={0.01}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1"
                    />
                </div>
                <p className="text-xs text-center text-slate-400 mt-1">
                    Arraste para posicionar · use a roda do mouse ou o controle para dar zoom
                </p>

                {error && <div className="mt-3 text-sm text-red-600 text-center">{error}</div>}

                <div className="flex justify-end gap-2 mt-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!natural || saving}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? 'Gerando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
