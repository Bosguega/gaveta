export interface RawEntry {
    path: string;
    name: string;
    size: number;
    modified: number;
    extension: string | null;
    isHidden: boolean;
    isSymlink: boolean;
    parentId: number | null;
}

export interface ScanStats {
    totalFiles: number;
    totalDirs: number;
    totalSize: number;
    errors: string[];
}

export interface Entity {
    id: string;
    kind: EntityKind;
    confidence: number;
    attributes: Record<string, unknown>;
}

export type EntityKind =
    | "software"
    | "project"
    | "model"
    | "cache"
    | "sdk"
    | "game"
    | "library"
    | "dataset"
    | "system";

export interface Insight {
    entity: Entity;
    explanation: string;
    recommendations: Recommendation[];
    risk: RiskLevel;
}

export type RiskLevel = "low" | "medium" | "high" | "unknown";

export interface Recommendation {
    title: string;
    description: string;
    estimatedSavings: number;
    risk: RiskLevel;
    action: Action;
}

export type Action =
    | "safe_clean"
    | "verify_before_delete"
    | "do_not_touch"
    | "archive"
    | "review";