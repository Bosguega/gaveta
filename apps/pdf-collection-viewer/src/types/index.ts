export interface Collection {
    id: number;
    name: string;
    icon: string;
    icon_path: string | null;
    include_subfolders: boolean;
    is_pinned: boolean;
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
    is_pinned: boolean;
    paths: string[];
    created_at: string;
    updated_at: string;
}

export interface GlobalSearchResultItem {
    id: number;
    collection_id: number;
    collection_name: string;
    path: string;
    filename: string;
    size: number;
    modified_at: string;
    page_count: number | null;
    file_type: string;
    thumbnail_key: string | null;
    thumbnail_status: string;
    is_favorite: boolean;
}

export type GridDensity = 'compact' | 'normal' | 'large';
export type ViewMode = 'flat' | 'folder';

export type SizeFilterOption = 'all' | 'lt-2mb' | '2mb-10mb' | '10mb-50mb' | 'gt-50mb';
export const SIZE_FILTER_OPTIONS: { value: SizeFilterOption; label: string }[] = [
    { value: 'all', label: 'Todos os tamanhos' },
    { value: 'lt-2mb', label: '< 2 MB' },
    { value: '2mb-10mb', label: '2 – 10 MB' },
    { value: '10mb-50mb', label: '10 – 50 MB' },
    { value: 'gt-50mb', label: '> 50 MB' },
];

export type StitchFilterOption = 'all' | 'lt-10k' | '10k-30k' | 'gt-30k';
export const STITCH_FILTER_OPTIONS: { value: StitchFilterOption; label: string }[] = [
    { value: 'all', label: 'Todos os pontos' },
    { value: 'lt-10k', label: '< 10.000 pts' },
    { value: '10k-30k', label: '10k – 30k pts' },
    { value: 'gt-30k', label: '> 30.000 pts' },
];

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

export interface RegenerateThumbnailsResult {
    requested: number;
    regenerated: number;
    failed: number;
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

export const ITEMS_PER_PAGE_OPTIONS = [50, 100, 500];

export const DEFAULT_ITEMS_PER_PAGE = 100;

export const EMBROIDERY_EXTENSIONS = ['dst', 'exp', 'pes', 'pec', 'jef', 'vp3', 'xxx', 'vip', 'hus', 'sew'];

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


/// Virtual collection id used by the favorites view on the home page.
export const FAVORITES_COLLECTION_ID = -1;
