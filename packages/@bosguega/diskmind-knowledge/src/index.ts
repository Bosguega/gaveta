export interface KnowledgeEntry {
    id: string;
    title: string;
    description: string;
    canDelete: boolean;
    risk: 'low' | 'medium' | 'high' | 'unknown';
    tags: string[];
}