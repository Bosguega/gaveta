import { invoke } from '@tauri-apps/api/core';
import type { PatternParse } from '@/types';

export async function listPesFiles(folder: string, recursive: boolean): Promise<string[]> {
    return invoke<string[]>('list_pes_files', { folder, recursive });
}

export async function parsePesPyembroidery(path: string): Promise<PatternParse> {
    return invoke<PatternParse>('parse_pes_pyembroidery', { path });
}

