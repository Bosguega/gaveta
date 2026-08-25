export interface Collection {
    id: number;
    name: string;
    icon: string;
    icon_path: string | null;
    include_subfolders: boolean;
    item_count: number;
    created_at: string;
    updated_at: string;
}

export interface CollectionDetail {
    id: number;
    name: string;
    icon: string;
    icon_path: string | null;
    include_subfolders: boolean;
    paths: string[];
    created_at: string;
    updated_at: string;
}

export interface CollectionItem {
    id: number;
    collection_id: number;
    path: string;
    filename: string;
    size: number;
    modified_at: string;
    page_count: number | null;
    file_type: string;
    thumbnail_key: string | null;
    thumbnail_status: string;
    is_favorite: boolean;
    stitch_count: number | null;
    color_count: number | null;
    color_changes: number | null;
    design_width_mm: number | null;
    design_height_mm: number | null;
}

export interface ScanProgress {
    stage: string;
    current: number;
    total: number;
}

export interface UpdateResult {
    found: number;
    added: number;
    removed: number;
    updated: number;
    thumbnails_generated: number;
    unavailable_paths: string[];
    errored_paths: string[];
}

export interface DuplicateItem {
    item_id: number;
    path: string;
    filename: string;
    size: number;
    modified_at: string;
    page_count: number | null;
    file_type: string;
    thumbnail_key: string | null;
    thumbnail_status: string;
    hash: string;
}

export interface DuplicateGroup {
    hash: string;
    size: number;
    items: DuplicateItem[];
}

export interface DuplicateAnalysis {
    groups: DuplicateGroup[];
    unreadable_count: number;
}

export interface RemoveDuplicateResult {
    removed_from_disk: boolean;
    file_missing: boolean;
    hash_changed: boolean;
    affected_other_collections: number;
}

export type SortOption =
    | 'name-asc'
    | 'name-desc'
    | 'size-asc'
    | 'size-desc'
    | 'modified-desc'
    | 'modified-asc'
    | 'pages-asc'
    | 'pages-desc';

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: 'name-asc', label: 'Nome A → Z' },
    { value: 'name-desc', label: 'Nome Z → A' },
    { value: 'size-asc', label: 'Tamanho: menor → maior' },
    { value: 'size-desc', label: 'Tamanho: maior → menor' },
    { value: 'modified-desc', label: 'Modificação: mais recente' },
    { value: 'modified-asc', label: 'Modificação: mais antiga' },
    { value: 'pages-asc', label: 'Páginas: menor → maior' },
    { value: 'pages-desc', label: 'Páginas: maior → menor' },
];

export const COLLECTION_ICONS = [
    '📚',
    '📖',
    '🍳',
    '📄',
    '🗂️',
    '💼',
    '🎓',
    '🛠️',
    '🎨',
    '🧾',
    '🔬',
    '📊',
    '⚖️',
    '🚗',
    '🎵',
    '🏠',
];
