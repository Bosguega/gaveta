import type { ScanProgress } from '@/types';

interface ProgressBarProps {
    progress: ScanProgress;
    className?: string;
}

export function ProgressBar({ progress, className = '' }: ProgressBarProps) {
    const percent = progress.total > 0
        ? Math.min(100, Math.max(0, (progress.current / progress.total) * 100))
        : 0;

    return (
        <div className={`p-4 bg-blue-50 rounded-lg ${className}`}>
            <div className="text-sm text-blue-800 mb-2 flex items-center justify-between">
                <span>{progress.stage}</span>
                <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                <div
                    className="h-full bg-blue-600 transition-all duration-200 ease-out"
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    );
}
