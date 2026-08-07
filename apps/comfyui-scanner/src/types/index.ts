export interface ScannedItem {
    name: string;
    path: string;
    size_mb: number;
    category: string;
    file_type: string;
}

export interface ScanResult {
    success: boolean;
    comfyui_path: string;
    items: ScannedItem[];
    summary: Record<string, number>;
    error?: string;
}

export interface SavedPath {
    path: string;
    path_type: string;
}

export interface ExportData {
    comfyui_path: string;
    scan_date: string;
    summary: Record<string, number>;
    items: ScannedItem[];
}

export interface WorkflowDependency {
    name: string;
    kind: string;
    status: 'installed' | 'missing';
    matched_path?: string;
}

export interface WorkflowRecord {
    name: string;
    path: string;
    dependencies: WorkflowDependency[];
    node_types: string[];
    custom_nodes: string[];
}

export interface WorkflowDependencyIndex {
    workflows: WorkflowRecord[];
    model_usage: Record<string, number>;
    unused_models: string[];
}

export interface UsefulPath {
    id: string;
    label: string;
    path: string;
    builtin: boolean;
    exists: boolean;
}

export interface ScanProgress {
    stage: string;
    current: number;
    total: number;
}

export interface SafetensorsMetadata {
    base_model?: string;
    trigger_words: string[];
    model_name?: string;
    architecture?: string;
}

export interface DuplicateGroup {
    size_mb: number;
    items: ScannedItem[];
}

