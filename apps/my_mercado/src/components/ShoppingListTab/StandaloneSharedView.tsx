import React, { useState, useEffect, useMemo } from "react";
import { ListChecks, ArrowLeft, Share2, RefreshCw } from "lucide-react";
import { ShoppingListItem } from "../ShoppingListItem";
import { deserializeSnapshotFromUrl } from "../../utils/urlDataSerializer";
import { sanitizeShoppingList } from "../../utils/shoppingList";
import { useSortedShoppingItems } from "../../hooks/queries/useSortedShoppingItems";
import { getPublicListByCode, togglePublicItem } from "../../services/publicShoppingListService";
import { notify } from "../../utils/notifications";
import type { CollaborativeShoppingList, CollaborativeShoppingListItem } from "../../types/domain";

interface StandaloneSharedViewProps {
  data?: string | null;
  code?: string | null;
  onClose: () => void;
}

export function StandaloneSharedView({ data, code, onClose }: StandaloneSharedViewProps) {
  const [liveData, setLiveData] = useState<{
    list: CollaborativeShoppingList;
    items: CollaborativeShoppingListItem[];
  } | null>(null);
  const [loading, setLoading] = useState(!!code);
  // Carregamento de dados (Snapshot ou Live)
  const snapshot = useMemo(() => (data ? deserializeSnapshotFromUrl(data) : null), [data]);

  useEffect(() => {
    if (code) {
      setLoading(true);
      getPublicListByCode(code).then(res => {
        if (res) setLiveData(res);
        setLoading(false);
      });
    }
  }, [code]);

  const list = code ? liveData?.list : snapshot?.lists[0];
  const rawItems = code ? (liveData?.items || []) : (list ? (snapshot?.items_by_list[list.id] || []) : []);
  const sanitizedItems = useMemo(() => sanitizeShoppingList(rawItems), [rawItems]);
  const orderedItems = useSortedShoppingItems(sanitizedItems);

  const handleToggleItem = async (itemId: string, checked: boolean) => {
    if (code) {
      // Otimista
      setLiveData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          items: prev.items.map(item => item.id === itemId ? { ...item, checked } : item)
        };
      });
      const ok = await togglePublicItem(itemId, checked);
      if (!ok) notify.error("Erro ao sincronizar.");
    }
  };

  if (loading) {
    return (
      <div className="app-container flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (!snapshot || !list) {
    return (
      <div className="app-container flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="glass-card max-w-md w-full">
          <h2 className="text-white mb-4">Lista não encontrada</h2>
          <p className="text-slate-400 mb-6">O link pode estar quebrado ou expirado.</p>
          <button className="btn w-full" onClick={onClose}>
            Voltar para o App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container min-h-screen flex flex-col">
      <header className="header flex items-center gap-4">
        <button 
          onClick={onClose}
          className="bg-white/5 border-none rounded-full w-10 h-10 flex items-center justify-center text-slate-300 hover:bg-white/10"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl">{list.name}</h1>
          <p className="text-xs text-slate-400">Lista Compartilhada</p>
        </div>
        <div className="bg-blue-500/20 text-blue-400 p-2 rounded-lg">
          <Share2 size={20} />
        </div>
      </header>

      <main className="p-4 flex-1">
        <div className="glass-card mb-6 border-blue-500/20 ring-1 ring-blue-500/10">
          <div className="flex items-center gap-3 text-blue-400 mb-2">
            <ListChecks size={20} />
            <span className="font-bold text-sm uppercase tracking-wider">Itens da Lista</span>
          </div>
          <p className="text-slate-400 text-xs">
            Esta é uma visualização pública. Para salvar no seu app, entre ou crie uma conta.
          </p>
        </div>

        <div className="items-list gap-3">
          {orderedItems.map((item) => (
            <ShoppingListItem
              key={item.id}
              item={item}
              history={[]}
              historyMatchType="none"
              onToggle={() => handleToggleItem(item.id, !item.checked)} 
              onRemove={() => {}}
              readonly={!code} // Readonly apenas se for snapshot estático
            />
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3">
            <button className="btn btn-success w-full py-4 shadow-xl shadow-emerald-500/10" onClick={onClose}>
                Importar esta lista para meu App
            </button>
            <p className="text-center text-slate-500 text-xs">
                My Mercado - Seu assistente de compras inteligente
            </p>
        </div>
      </main>
    </div>
  );
}
