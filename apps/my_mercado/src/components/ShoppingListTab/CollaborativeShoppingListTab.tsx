import { ListChecks, Plus } from "lucide-react";
import { ShoppingListItem } from "../ShoppingListItem";
import ConfirmDialog from "../ConfirmDialog";
import InputDialog from "../InputDialog";
import { CollaborativeAuthRequired } from "./collaborative/CollaborativeAuthRequired";
import { CollaborativeHeader } from "./collaborative/CollaborativeHeader";
import { CollaborativeManagementCard } from "./collaborative/CollaborativeManagementCard";
import { useCollaborativeTabController } from "./collaborative/useCollaborativeTabController";

interface CollaborativeShoppingListTabProps {
  onSwitchToLocal?: () => void;
}

/**
 * Componente de Lista de Compras Colaborativa
 * Gerencia listas de compras compartilhadas em tempo real
 */
export function CollaborativeShoppingListTab({ onSwitchToLocal }: CollaborativeShoppingListTabProps) {
  const {
    sessionUserId,
    isAuthenticated,
    activeList,
    setActiveListId,
    collaborativeLists,
    collaborativeItems,
    collaborativeMembers,
    orderedItems,
    suggestions,
    itemName,
    setItemName,
    showSuggestions,
    setShowSuggestions,
    itemQty,
    setItemQty,
    collabInputDialog,
    setCollabInputDialog,
    actions,
    checkedCount,
    pendingCount,
    handleAddItem,
    handleCreateList,
    handleRenameList,
    handleJoinByCode,
    handleConfirmCollabInput,
  } = useCollaborativeTabController();

  if (!isAuthenticated) {
    return <CollaborativeAuthRequired />;
  }

  return (
    <div>
      <CollaborativeHeader
        pendingCount={pendingCount}
        totalCount={collaborativeItems.length}
        checkedCount={checkedCount}
        onClearChecked={() => activeList && actions.confirmClearChecked(activeList.id)}
        onClearAll={() => activeList && actions.confirmClearAll(activeList.id)}
      />

      <CollaborativeManagementCard
        onSwitchToLocal={onSwitchToLocal}
        activeList={activeList}
        collaborativeLists={collaborativeLists}
        collaborativeMembers={collaborativeMembers}
        sessionUserId={sessionUserId}
        setActiveListId={setActiveListId}
        onCreateList={handleCreateList}
        onRenameList={handleRenameList}
        onJoinByCode={handleJoinByCode}
        actions={actions}
      />

      <form className="glass-card mb-4 relative z-20" onSubmit={handleAddItem}>
        <div className="shopping-add-form-row">
          <div className="relative">
            <input
              className="search-input"
              placeholder="Ex: Arroz, Leite, Cafe..."
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 z-[100] mt-2 bg-[#1e293b] border border-white/10 rounded-xl p-1 max-h-64 overflow-auto shadow-2xl animated-item">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.key}
                    className="p-3 hover:bg-white/10 cursor-pointer rounded-lg text-[0.9rem] text-slate-200 transition-colors flex justify-between items-center"
                    onClick={() => {
                      setItemName(suggestion.label);
                      setShowSuggestions(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{suggestion.label}</span>
                      {suggestion.category && (
                        <span className="text-[0.65rem] text-slate-500 uppercase tracking-wider">
                          {suggestion.category}
                        </span>
                      )}
                    </div>
                    {suggestion.count > 0 && (
                      <span className="text-[0.7rem] bg-blue-500/20 px-2 py-1 rounded text-blue-400 font-bold">
                        {suggestion.count}x
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <input
            className="search-input"
            placeholder="Qtd"
            value={itemQty}
            onChange={(e) => setItemQty(e.target.value)}
          />
        </div>

        <button
          className="btn w-full"
          type="submit"
          disabled={!activeList?.id}
        >
          <Plus size={18} />
          Adicionar Item
        </button>
      </form>

      <div className="items-list gap-3.5">
        {orderedItems.length === 0 ? (
          <div className="glass-card text-center py-12 px-4">
            <ListChecks size={44} color="#334155" />
            <h3 className="text-slate-200 mt-3">Sua lista esta vazia</h3>
            <p className="text-slate-400 text-sm mt-1">
              Adicione itens para acompanhar o que falta pegar no mercado.
            </p>
          </div>
        ) : (
          orderedItems.map((item) => (
            <ShoppingListItem
              key={item.id}
              item={item}
              history={[]}
              historyMatchType="none"
              onToggle={() => activeList && actions.handleToggleItem(activeList.id, item.id, !item.checked)}
              onRemove={() => activeList && actions.handleRemoveItem(activeList.id, item.id)}
              currentUserId={sessionUserId}
            />
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(actions.confirmDialog)}
        title={actions.confirmDialog?.title || ""}
        message={actions.confirmDialog?.message || ""}
        confirmText={actions.confirmDialog?.confirmText}
        cancelText={actions.confirmDialog?.cancelText}
        danger={actions.confirmDialog?.danger}
        busy={false}
        onCancel={actions.closeConfirm}
        onConfirm={async () => {
          await actions.confirmDialog?.onConfirm?.();
          actions.closeConfirm();
        }}
      />

      <InputDialog
        isOpen={Boolean(collabInputDialog)}
        title={
          collabInputDialog?.mode === "rename"
            ? "Renomear lista colaborativa"
            : collabInputDialog?.mode === "join"
              ? "Entrar por codigo"
              : "Nova lista colaborativa"
        }
        message={
          collabInputDialog?.mode === "join"
            ? "Informe o codigo de compartilhamento da lista."
            : "Informe um nome para a lista."
        }
        placeholder={collabInputDialog?.mode === "join" ? "Codigo da lista" : "Nome da lista"}
        initialValue={collabInputDialog?.initialValue || ""}
        confirmText={
          collabInputDialog?.mode === "rename"
            ? "Renomear"
            : collabInputDialog?.mode === "join"
              ? "Entrar"
              : "Criar"
        }
        onCancel={() => setCollabInputDialog(null)}
        onConfirm={handleConfirmCollabInput}
      />
    </div>
  );
}
