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

