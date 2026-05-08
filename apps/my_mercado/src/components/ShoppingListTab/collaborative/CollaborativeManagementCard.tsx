import { KeyRound, Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { useCollaborativeShoppingListActions } from "../../../hooks/shoppingList/useCollaborativeShoppingListActions";
import type { CollaborativeShoppingList, CollaborativeShoppingListMember } from "../../../types/domain";

type CollaborativeActions = ReturnType<typeof useCollaborativeShoppingListActions>;

interface CollaborativeManagementCardProps {
  onSwitchToLocal?: () => void;
  activeList: CollaborativeShoppingList | null;
  collaborativeLists: CollaborativeShoppingList[];
  collaborativeMembers: CollaborativeShoppingListMember[];
  sessionUserId: string | null;
  setActiveListId: (next: string | null) => void;
  onCreateList: () => void;
  onRenameList: () => void;
  onJoinByCode: () => void;
  actions: CollaborativeActions;
}

export function CollaborativeManagementCard({
  onSwitchToLocal,
  activeList,
  collaborativeLists,
  collaborativeMembers,
  sessionUserId,
  setActiveListId,
  onCreateList,
  onRenameList,
  onJoinByCode,
  actions,
}: CollaborativeManagementCardProps) {
  return (
    <div className="glass-card mb-4 p-3">
      <div className="shopping-collab-top-actions">
        <button
          className="btn bg-white/10 shadow-none hover:bg-white/20"
          onClick={onSwitchToLocal}
        >
          Voltar para Lista Local
        </button>
        <button
          className="btn bg-white/10 shadow-none hover:bg-white/20"
          onClick={onJoinByCode}
        >
          <KeyRound size={15} /> Entrar por codigo
        </button>
      </div>

      <div className="shopping-list-toolbar">
        <select
          className="search-input"
          value={activeList?.id || ""}
          onChange={(event) => setActiveListId(event.target.value || null)}
          aria-label="Selecionar lista colaborativa"
        >
          {collaborativeLists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name} ({list.role || "membro"})
            </option>
          ))}
        </select>
        <button className="btn px-[0.7rem] py-2" onClick={onCreateList}>
          <Plus size={15} /> Nova
        </button>
        <button
          className="btn px-[0.7rem] py-2 bg-white/10 shadow-none hover:bg-white/20"
          onClick={onRenameList}
          disabled={!activeList}
        >
          <Pencil size={15} /> Renomear
        </button>
        <button
          className="btn px-[0.7rem] py-2 bg-red-500/10 shadow-none text-red-400 hover:bg-red-500/20"
          onClick={() => activeList && actions.confirmDeleteList(activeList.id, activeList.name)}
          disabled={!activeList || activeList.role !== "owner"}
        >
          <Trash2 size={15} /> Excluir
        </button>
      </div>

      {activeList && (
        <>
          <div className="mt-0.5 p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 flex flex-wrap gap-2 items-center">
            <span className="text-sky-300 text-[0.82rem]">
              Codigo: <strong>{activeList.share_code}</strong>
            </span>
            <button
              className="btn px-2 py-1.5 bg-white/10 shadow-none hover:bg-white/20 text-xs"
              onClick={() => actions.handleCopyShareCode(activeList.share_code)}
            >
              Copiar codigo
            </button>
            <button
              className="btn px-2 py-1.5 bg-white/10 shadow-none hover:bg-white/20 text-xs"
              onClick={() => actions.handleRegenerateCode(activeList.id)}
              disabled={activeList.role !== "owner"}
            >
              <RefreshCcw size={13} /> Novo codigo
            </button>
            <span className="text-sky-200 text-[0.74rem]">
              Modo colaborativo em tempo real
            </span>
          </div>

          <div className="mt-2 p-2.5 rounded-xl bg-sky-600/10 border border-sky-600/20">
            <div className="text-sky-200 text-[0.78rem] uppercase mb-1.5 font-bold">
              Membros ({collaborativeMembers.length})
            </div>
            <div className="flex flex-col gap-1.5">
              {collaborativeMembers.map((member) => (
                <div key={member.user_id} className="shopping-member-row">
                  <span className="text-slate-200 text-sm">
                    {member.user_id === sessionUserId ? "Voce" : `${member.user_id.slice(0, 8)}...`}
                  </span>
                  <select
                    className="search-input min-h-[32px] px-2 py-1"
                    value={member.role === "owner" ? "owner" : member.role}
                    disabled={
                      activeList.role !== "owner" ||
                      member.role === "owner"
                    }
                    onChange={(event) =>
                      actions.handleChangeMemberRole(
                        activeList.id,
                        member.user_id,
                        event.target.value as "editor" | "viewer",
                      )
                    }
                  >
                    {member.role === "owner" && <option value="owner">owner</option>}
                    <option value="editor">editor</option>
                    <option value="viewer">viewer</option>
                  </select>
                  <button
                    className="btn px-2 py-1 bg-red-500/15 shadow-none text-red-300 hover:bg-red-500/25 text-xs"
                    disabled={
                      activeList.role !== "owner" ||
                      member.role === "owner"
                    }
                    onClick={() => actions.handleRemoveMember(activeList.id, member.user_id)}
                  >
                    Remover
                  </button>
                  <button
                    className="btn px-2 py-1 bg-emerald-500/15 shadow-none text-emerald-300 hover:bg-emerald-500/25 text-xs"
                    disabled={
                      activeList.role !== "owner" ||
                      member.role === "owner"
                    }
                    onClick={() =>
                      actions.confirmTransferOwnership(activeList.id, member.user_id)
                    }
                  >
                    Tornar owner
                  </button>
                </div>
              ))}
            </div>
            {activeList.role !== "owner" && (
              <div className="mt-2 flex justify-end">
                <button
                  className="btn px-2.5 py-1.5 bg-red-500/15 shadow-none text-red-300 hover:bg-red-500/25 text-sm"
                  onClick={() => actions.handleLeaveList(activeList.id, sessionUserId!)}
                >
                  Sair da lista
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
