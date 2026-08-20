import { useEffect, useState } from 'react';
import { CollectionCard } from '@/components/CollectionCard';
import { CollectionForm } from '@/components/CollectionForm';
import { useAppStore } from '@/store/useAppStore';
import { listCollections, createCollection, updateCollection, deleteCollection, getCollection } from '@/services/collections';
import type { CollectionDetail } from '@/types';

export function HomePage() {
    const { collections, setCollections, openCollection } = useAppStore();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<CollectionDetail | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadCollections = async () => {
        try {
            const data = await listCollections();
            setCollections(data);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as coleções.');
        }
    };

    useEffect(() => {
        loadCollections();
    }, []);

    const handleCreate = async (data: { name: string; icon: string; paths: string[]; includeSubfolders: boolean }) => {
        await createCollection(data.name, data.icon, data.paths, data.includeSubfolders);
        setShowForm(false);
        await loadCollections();
    };

    const handleUpdate = async (data: { name: string; icon: string; paths: string[]; includeSubfolders: boolean }) => {
        if (!editing) return;
        await updateCollection(editing.id, data.name, data.icon, data.paths, data.includeSubfolders);
        setEditing(null);
        await loadCollections();
    };

    const handleEdit = async (id: number) => {
        try {
            const detail = await getCollection(id);
            if (detail) {
                setEditing(detail);
            } else {
                setError('Coleção não encontrada.');
            }
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a coleção.');
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        await deleteCollection(confirmDelete.id);
        setConfirmDelete(null);
        await loadCollections();
    };

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-slate-800">Minhas coleções</h1>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    + Nova
                </button>
            </div>
            {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            {collections.length === 0 && !showForm ? (
                <div className="text-center py-16 text-slate-500">
                    <div className="text-5xl mb-4">📚</div>
                    <p className="text-lg">Nenhuma coleção ainda</p>
                    <p className="text-sm mt-1">Crie sua primeira coleção para começar</p>
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                    {collections.map((collection) => (
                        <CollectionCard
                            key={collection.id}
                            collection={collection}
                            onOpen={() => openCollection(collection.id)}
                            onEdit={() => handleEdit(collection.id)}
                            onDelete={() => setConfirmDelete({ id: collection.id, name: collection.name })}
                        />
                    ))}
                </div>
            )}

            {(showForm || editing) && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-semibold mb-4">
                            {editing ? 'Editar coleção' : 'Nova coleção'}
                        </h2>
                        <CollectionForm
                            initialName={editing?.name}
                            initialIcon={editing?.icon}
                            initialPaths={editing?.paths}
                            initialIncludeSubfolders={editing?.include_subfolders}
                            onSubmit={editing ? handleUpdate : handleCreate}
                            onCancel={() => {
                                setShowForm(false);
                                setEditing(null);
                            }}
                        />
                    </div>
                </div>
            )}

            {confirmDelete && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                        <h2 className="text-lg font-semibold mb-2">Remover a coleção "{confirmDelete.name}"?</h2>
                        <p className="text-sm text-slate-600 mb-4">
                            Isso não apagará nenhum arquivo do computador.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
