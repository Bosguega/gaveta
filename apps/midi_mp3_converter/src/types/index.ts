export type QueueStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error' | 'canceled';

export interface QueueItem {
    id: number;
    path: string;
    name: string;
    size: number;
    durationMs: number | null;
    status: QueueStatus;
    outputPath: string | null;
    error: string | null;
    relativeDir: string | null;
}

export type ExistingPolicy = 'overwrite' | 'skip' | 'copy';

export interface Settings {
    outputDir: string | null;
    bitrateKbps: number;
    gain: number;
    sampleRate: number;
    existing: ExistingPolicy;
    includeSubfolders: boolean;
    soundfont: string | null;
    writeId3: boolean;
    completionBeep: boolean;
    reverb: boolean;
    chorus: boolean;
    normalize: boolean;
}

export interface SoundFontOption {
    name: string;
    path: string;
}

export interface ProgressEvent {
    id: number;
    index: number;
    total: number;
    name: string;
    phase: string;
    itemPercent: number;
    batchPercent: number;
    outputPath: string | null;
    status: QueueStatus;
    error: string | null;
    durationMs: number | null;
}

export interface SummaryError {
    name: string;
    message: string;
}

export interface Summary {
    done: number;
    skipped: number;
    failed: number;
    canceled: boolean;
    elapsedMs: number;
    errors: SummaryError[];
}

export const STATUS_LABEL: Record<QueueStatus, string> = {
    pending: 'Aguardando',
    running: 'Convertendo...',
    done: 'Concluído',
    skipped: 'Ignorado',
    error: 'Erro',
    canceled: 'Cancelado',
};

export const PHASE_LABEL: Record<string, string> = {
    sintetizando: 'Sintetizando',
    codificando: 'Codificando',
    convertendo: 'Convertendo...',
    aguardando: 'Aguardando',
    concluido: 'Concluído',
    ignorado: 'Ignorado',
    erro: 'Falhou',
    cancelado: 'Cancelado',
};

export const EXISTING_LABEL: Record<ExistingPolicy, string> = {
    overwrite: 'Substituir',
    skip: 'Pular',
    copy: 'Criar cópia',
};

export const BITRATES = [128, 160, 192, 256, 320];
export const SAMPLE_RATES = [22050, 44100, 48000];
export const GAINS = [0.4, 0.6, 0.8, 1.0];