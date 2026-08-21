export function formatBytes(bytes: number): string {
    if (bytes === 0) {
        return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** i;
    return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function getFileTypeIcon(fileType: string = 'pdf'): string {
    switch (fileType.toLowerCase()) {
        case 'image':
            return '🖼️';
        case 'embroidery':
            return '🧵';
        case 'pdf':
            return '📄';
        default:
            return '📁';
    }
}

export function getFileTypeLabel(fileType: string = 'pdf'): string {
    switch (fileType.toLowerCase()) {
        case 'image':
            return 'Imagem';
        case 'embroidery':
            return 'Bordado';
        case 'pdf':
            return 'PDF';
        default:
            return fileType.toUpperCase();
    }
}

export function formatPageCount(pages: number | null, fileType: string = 'pdf'): string {
    const type = fileType.toLowerCase();
    if (type === 'image') {
        return 'imagem';
    }
    if (type === 'embroidery') {
        return 'matriz';
    }
    if (type === 'pdf') {
        if (pages === null) {
            return 'págs ?';
        }
        return `${pages} pág${pages === 1 ? '' : 's'}`;
    }
    if (pages !== null) {
        return `${pages} pág${pages === 1 ? '' : 's'}`;
    }
    return getFileTypeLabel(type);
}

export function formatModifiedAt(modifiedAt: string): string {
    const secs = Number(modifiedAt);
    if (Number.isNaN(secs) || secs <= 0) {
        return '';
    }
    const date = new Date(secs * 1000);
    return date.toLocaleDateString('pt-BR');
}