import { convertFileSrc } from '@tauri-apps/api/core';
import type { Collection } from '@/types';

interface Props {
    collection: Collection;
    onOpen: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

export function CollectionCard({ collection, onOpen, onEdit, onDelete }: Props) {
    return (
        <div
            className="group relative bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
            onClick={onOpen}
        >
            <div className="flex flex-col items-center justify-center p-6 h-48">
                {collection.icon_path ? (
                    <img
                        src={convertFileSrc(collection.icon_path)}
                        alt={`Ícone de ${collection.name}`}
                        className="w-16 h-16 rounded-lg object-cover mb-3 border border-slate-200"
                    />
                ) : (
                    <div className="text-5xl mb-3">{collection.icon}</div>
                )}
                <div className="font-semibold text-slate-800 text-center truncate w-full px-2">
                    {collection.name}
                </div>
                <div className="text-sm text-slate-500 mt-1">
                    {collection.item_count} arquivo{collection.item_count === 1 ? '' : 's'}
                </div>
            </div>

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
    );
}
