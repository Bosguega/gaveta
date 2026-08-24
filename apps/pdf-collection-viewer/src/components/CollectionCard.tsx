import type { Collection } from '@/types';
import { COLLECTION_ICONS } from '@/types';
import { CollectionCover } from '@/components/CollectionCover';

interface Props {
    collection: Collection;
    onOpen: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

function getRandomIcon(id: number): string {
    return COLLECTION_ICONS[id % COLLECTION_ICONS.length];
}

export function CollectionCard({ collection, onOpen, onEdit, onDelete }: Props) {
    const randomIcon = getRandomIcon(collection.id);

    return (
        <div
            className="group relative rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden flex flex-col"
            onClick={onOpen}
        >
            {/* Cover area */}
            <div className="relative h-36 flex-shrink-0 bg-slate-100">
                <CollectionCover iconPath={collection.icon_path} fallbackIcon={randomIcon} />

                {/* Action buttons */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        className="p-1.5 rounded bg-white shadow text-slate-600 hover:text-blue-600"
                        title="Editar"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit();
                        }}
                    >
                        ✏️
                    </button>
                    <button
                        className="p-1.5 rounded bg-white shadow text-slate-600 hover:text-red-600"
                        title="Excluir"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                    >
                        🗑️
                    </button>
                </div>
            </div>

            {/* Info footer — always below the image, never overlapping */}
            <div className="px-3 py-2 bg-white border-t border-slate-100">
                <div className="font-semibold text-slate-800 text-sm truncate">{collection.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                    {collection.item_count} arquivo{collection.item_count === 1 ? '' : 's'}
                </div>
            </div>
        </div>
    );
}
