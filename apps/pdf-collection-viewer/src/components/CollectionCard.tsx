import { convertFileSrc } from '@tauri-apps/api/core';
import type { Collection } from '@/types';
import { COLLECTION_ICONS } from '@/types';

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
                {collection.icon_path ? (
                    <>
                        <img
                            src={convertFileSrc(collection.icon_path)}
                            alt={`Capa de ${collection.name}`}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    </>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200">
                        <span className="text-5xl select-none">{randomIcon}</span>
                    </div>
                )}

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
