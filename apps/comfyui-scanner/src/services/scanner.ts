// @ts-ignore - Tauri API will be available at runtime
import { invoke } from '@tauri-apps/api/core';
import type { ScanResult, SavedPath, WorkflowDependencyIndex, UsefulPath } from '@/types';

export async function scanComfyuiDirectory(path: string): Promise<ScanResult> {
    return invoke('scan_comfyui_directory', { path });
}

export async function getCommonComfyuiPaths(): Promise<string[]> {
    return invoke('get_common_comfyui_paths');
}

export async function findComfyuiInstallations(): Promise<SavedPath[]> {
    return invoke('find_comfyui_installations');
}

export async function getSavedPaths(): Promise<SavedPath[]> {
    return invoke('get_saved_paths');
}

export async function buildWorkflowDependencyIndex(path: string): Promise<WorkflowDependencyIndex> {
    return invoke('build_workflow_dependency_index', { path });
}

export async function saveExportFile(path: string, content: string): Promise<void> {
    return invoke('save_export_file', { path, content });
}

export async function getUsefulPaths(path: string): Promise<UsefulPath[]> {
    return invoke('get_useful_paths', { path });
}

export async function saveUsefulPaths(installationPath: string, shortcuts: UsefulPath[]): Promise<UsefulPath[]> {
    return invoke('save_useful_paths', { installationPath, shortcuts });
}

export async function openInExplorer(path: string): Promise<void> {
    return invoke('open_in_explorer', { path });
}
