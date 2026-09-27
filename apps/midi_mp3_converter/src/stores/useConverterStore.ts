import { create } from 'zustand';
import * as api from '@/services/converter';
import type { ProgressEvent, QueueItem, Settings, SoundFontOption, Summary } from '@/types';

interface ConverterState {
    items: QueueItem[];
    selectedId: number | null;
    settings: Settings | null;
    soundfonts: SoundFontOption[];
    progress: ProgressEvent | null;
    summary: Summary | null;
    busy: boolean;
    status: string;
    load: () => Promise<void>;
    addPaths: (paths: string[]) => Promise<void>;
    removeSelected: () => Promise<void>;
    clearList: () => Promise<void>;
    select: (id: number | null) => void;
    applyProgress: (event: ProgressEvent) => void;
    finish: (summary: Summary) => void;
    convert: () => Promise<void>;
    cancel: () => Promise<void>;
    updateSettings: (patch: Partial<Settings>) => Promise<void>;
    dismissSummary: () => void;
}

function playBeep(): void {
    try {
        const Ctor = window.AudioContext;
        if (!Ctor) return;
        const context = new Ctor();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        oscillator.type = 'square';
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.04;
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.onended = () => {
            void context.close();
        };
        oscillator.start();
        oscillator.stop(context.currentTime + 0.12);
    } catch {
        return;
    }
}

function describeError(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    return String(error);
}

export const useConverterStore = create<ConverterState>((set, get) => ({
    items: [],
    selectedId: null,
    settings: null,
    soundfonts: [],
    progress: null,
    summary: null,
    busy: false,
    status: 'Pronto',
    load: async () => {
        const [items, settings, soundfonts] = await Promise.all([
            api.listQueue(),
            api.getSettings(),
            api.listSoundFonts(),
        ]);
        set({ items, settings, soundfonts, selectedId: items.length > 0 ? items[0].id : null });
    },
    addPaths: async (paths) => {
        if (paths.length === 0) return;
        set({ status: 'Adicionando arquivos...' });
        try {
            const added = await api.addPaths(paths);
            const items = await api.listQueue();
            set((state) => ({
                items,
                status: added.length > 0 ? added.length + ' arquivo(s) adicionado(s)' : 'Nada novo para adicionar',
                selectedId: state.selectedId ?? (items[0]?.id ?? null),
            }));
        } catch (error) {
            set({ status: describeError(error) });
        }
    },
    removeSelected: async () => {
        const id = get().selectedId;
        if (id === null) return;
        try {
            const items = await api.removeItems([id]);
            set({ items, selectedId: items.length > 0 ? items[0].id : null });
        } catch (error) {
            set({ status: describeError(error) });
        }
    },
    clearList: async () => {
        try {
            await api.clearQueue();
            set({ items: [], selectedId: null, progress: null, summary: null, status: 'Lista limpa' });
        } catch (error) {
            set({ status: describeError(error) });
        }
    },
    select: (id) => set({ selectedId: id }),
    applyProgress: (event) =>
        set((state) => ({
            items: state.items.map((item) =>
                item.id === event.id
                    ? {
                          ...item,
                          status: event.status,
                          error: event.error,
                          outputPath: event.outputPath ?? item.outputPath,
                          durationMs: event.durationMs ?? item.durationMs,
                      }
                    : item,
            ),
            progress: event,
            busy: true,
            status: event.error ? event.name + ': ' + event.error : 'Convertendo ' + event.index + ' de ' + event.total,
        })),
    finish: (summary) => {
        set({
            summary,
            progress: null,
            busy: false,
            status:
                'Concluído: ' +
                summary.done +
                ' ok, ' +
                summary.skipped +
                ' ignorado(s), ' +
                summary.failed +
                ' com erro' +
                (summary.canceled ? ' (cancelado)' : ''),
        });
        if (get().settings?.completionBeep) playBeep();
    },
    convert: async () => {
        set({ summary: null, status: 'Convertendo...', busy: true });
        try {
            await api.startConversion();
        } catch (error) {
            set({ busy: false, status: describeError(error) });
        }
    },
    cancel: async () => {
        set({ status: 'Cancelando...' });
        try {
            await api.cancelConversion();
        } catch (error) {
            set({ status: describeError(error) });
        }
    },
    updateSettings: async (patch) => {
        const current = get().settings;
        if (!current) return;
        const next: Settings = { ...current, ...patch };
        try {
            const saved = await api.saveSettings(next);
            set({ settings: saved });
        } catch (error) {
            set({ status: describeError(error) });
        }
    },
    dismissSummary: () => set({ summary: null }),
}));