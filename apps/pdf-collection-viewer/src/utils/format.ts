export function formatBytes(bytes: number): string {
    if (bytes === 0) {
        return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** i;
    return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatPageCount(pages: number | null): string {
    if (pages === null) {
        return 'págs ?';
    }
    return `${pages} pág${pages === 1 ? '' : 's'}`;
}

export function formatModifiedAt(modifiedAt: string): string {
    const secs = Number(modifiedAt);
    if (Number.isNaN(secs) || secs <= 0) {
        return '';
    }
    const date = new Date(secs * 1000);
    return date.toLocaleDateString('pt-BR');
}