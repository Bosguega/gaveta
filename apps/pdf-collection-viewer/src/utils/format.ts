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

export function formatStitchCount(count: number | null): string {
    if (count === null || count <= 0) {
        return '';
    }
    return `${count.toLocaleString('pt-BR')} pontos`;
}

export function formatColorCount(count: number | null): string {
    if (count === null || count <= 0) {
        return '';
    }
    return `${count} ${count === 1 ? 'cor' : 'cores'}`;
}

export function formatColorChanges(changes: number | null): string {
    if (changes === null || changes <= 0) {
        return '';
    }
    return `${changes} ${changes === 1 ? 'troca' : 'trocas'}`;
}

export function formatEmbroiderySize(widthMm: number | null, heightMm: number | null): string {
    if (widthMm === null || heightMm === null || widthMm <= 0 || heightMm <= 0) {
        return '';
    }
    const cm = (mm: number) => (mm / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    return `${cm(widthMm)} × ${cm(heightMm)} cm`;
}

export function getFileExtension(filename: string): string {
    const idx = filename.lastIndexOf('.');
    if (idx < 0) return '';
    return filename.slice(idx + 1).toLowerCase();
}
