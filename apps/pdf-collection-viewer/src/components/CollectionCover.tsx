import { useEffect, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';

interface Props {
    iconPath: string | null;
    fallbackIcon: string;
}

/**
 * Renders the collection cover image with a graceful fallback when there is
 * no cover or the file cannot be loaded. Keeps image logic out of the card.
 */
export function CollectionCover({ iconPath, fallbackIcon }: Props) {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
    }, [iconPath]);

    if (!iconPath || failed) {
        return (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200">
                <span className="text-5xl select-none">{fallbackIcon}</span>
            </div>
        );
    }

    return (
        <img
            src={convertFileSrc(iconPath)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setFailed(true)}
        />
    );
}
