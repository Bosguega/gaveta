import { create } from 'zustand';
import * as api from '@/services/converter';
import type { ProgressEvent, QueueItem, Settings, SoundFontOption, Summary } from '@/types';

interface ConverterState {
    items: QueueItem[];
    selectedIds: number[];
    settings: Settings | null;
    soundfonts: SoundFontOption[];
    progress: ProgressEvent | null;
    summary: Summary | null;
    busy: boolean;
    status: string;
    load: () => Promise<void>;
    addPaths: (paths: string[]) => Promise<void>;
    removeSelected: () => Promise<void>;
    clearCompleted: () => Promise<void>;
    clearList: () => Promise<void>;
    selectSingle: (id: number | null) => void;
    toggleSelect: (id: number) => void;
    selectRange: (id: number) => void;
    selectAll: () => void;
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
    selectedIds: [],
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
        set({
            items,
            settings,
            soundfonts,
            selectedIds: items.length > 0 ? [items[0].id] : [],
        });
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
                selectedIds: state.selectedIds.length > 0 ? state.selectedIds : items[0] ? [items[0].id] : [],
            }));
        } catch (error) {
            set({ status: describeError(error) });
        }
    },
    removeSelected: async () => {
        const ids = get().selectedIds;
        if (ids.length === 0) return;
        try {
            const items = await api.removeItems(ids);
            set({
                items,
                selectedIds: items.length > 0 ? [items[0].id] : [],
                status: ids.length + ' item(ns) removido(s)',
            });
        } catch (error) {
            set({ status: describeError(error) });
        }
    },
    clearCompleted: async () => {
        try {
            const items = await api.clearCompleted();
            set({
                items,
                selectedIds: items.length > 0 ? [items[0].id] : [],
                status: 'Concluídos removidos da lista',
            });
        } catch (error) {
            set({ status: describeError(error) });
        }
    },
    clearList: async () => {
        try {
            await api.clearQueue();
            set({ items: [], selectedIds: [], progress: null, summary: null, status: 'Lista limpa' });
        } catch (error) {
            set({ status: describeError(error) });
        }
    },
    selectSingle: (id) => set({ selectedIds: id !== null ? [id] : [] }),
    toggleSelect: (id) =>
        set((state) => {
            const exists = state.selectedIds.includes(id);
            if (exists) {
                return { selectedIds: state.selectedIds.filter((item) => item !== id) };
            }
            return { selectedIds: [...state.selectedIds, id] };
        }),
    selectRange: (id) =>
        set((state) => {
            const last = state.selectedIds[state.selectedIds.length - 1];
            if (last === undefined) {
                return { selectedIds: [id] };
            }
            const i1 = state.items.findIndex((item) => item.id === last);
            const i2 = state.items.findIndex((item) => item.id === id);
            if (i1 === -1 || i2 === -1) {
                return { selectedIds: [id] };
            }
            const [start, end] = i1 < i2 ? [i1, i2] : [i2, i1];
            const rangeIds = state.items.slice(start, end + 1).map((item) => item.id);
            const merged = Array.from(new Set([...state.selectedIds, ...rangeIds]));
            return { selectedIds: merged };
        }),
    selectAll: () => set((state) => ({ selectedIds: state.items.map((item) => item.id) })),
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