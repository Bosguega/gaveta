import { beforeEach, describe, expect, it } from "vitest";
import { useShoppingListStore } from "./useShoppingListStore";

const STORAGE_KEY = "@MyMercado:shopping-list";

describe("useShoppingListStore", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    useShoppingListStore.setState({ dataByUser: {} });
  });

  it("creates a default list for a user", () => {
    const lists = useShoppingListStore.getState().getLists("user-1");
    expect(lists).toHaveLength(1);
    expect(lists[0].name).toBe("Lista Principal");
  });

  it("can create and switch active lists", () => {
    const store = useShoppingListStore.getState();
    const created = store.createList("user-1", "Feira");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const lists = store.getLists("user-1");
    expect(lists.map((l) => l.name)).toContain("Feira");
    expect(store.getActiveListId("user-1")).toBe(created.listId);
  });

  it("rejects empty item names", () => {
    const result = useShoppingListStore.getState().addItem("user-1", "   ");
    expect(result).toEqual({ ok: false, reason: "empty" });
  });

  it("prevents duplicate pending items in the same list", () => {
    const store = useShoppingListStore.getState();
    const listId = store.getActiveListId("user-1");

    const first = store.addItem("user-1", "Arroz", undefined, listId);
    expect(first.ok).toBe(true);

    const duplicate = store.addItem("user-1", "arroz", undefined, listId);
    expect(duplicate).toEqual({ ok: false, reason: "duplicate" });
  });

  it("allows same item in different lists", () => {
    const store = useShoppingListStore.getState();
    const defaultListId = store.getActiveListId("user-1");
    const secondList = store.createList("user-1", "Mensal");
    expect(secondList.ok).toBe(true);
    if (!secondList.ok) return;

    expect(store.addItem("user-1", "Leite", undefined, defaultListId).ok).toBe(true);
    expect(store.addItem("user-1", "Leite", undefined, secondList.listId).ok).toBe(true);
  });

  it("toggles checked state and checked_at timestamp", () => {
    const store = useShoppingListStore.getState();
    const listId = store.getActiveListId("user-1");
    const added = store.addItem("user-1", "Cafe", undefined, listId);
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    store.toggleChecked("user-1", added.item.id, listId);
    let currentItems = useShoppingListStore.getState().getItems("user-1", listId);
    expect(currentItems[0].checked).toBe(true);
    expect(currentItems[0].checked_at).toBeTruthy();

    store.toggleChecked("user-1", added.item.id, listId);
    currentItems = useShoppingListStore.getState().getItems("user-1", listId);
    expect(currentItems[0].checked).toBe(false);
    expect(currentItems[0].checked_at).toBeUndefined();
  });

  it("clears checked items and can clear all items", () => {
    const store = useShoppingListStore.getState();
    const listId = store.getActiveListId("user-1");
    const a = store.addItem("user-1", "Leite", undefined, listId);
    const b = store.addItem("user-1", "Pao", undefined, listId);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    store.toggleChecked("user-1", a.item.id, listId);
    store.clearChecked("user-1", listId);

    let currentItems = useShoppingListStore.getState().getItems("user-1", listId);
    expect(currentItems).toHaveLength(1);
    expect(currentItems[0].name).toBe("Pao");

    store.clearAll("user-1", listId);
    currentItems = useShoppingListStore.getState().getItems("user-1", listId);
    expect(currentItems).toHaveLength(0);
  });

  it("prevents deleting the last remaining list", () => {
    const store = useShoppingListStore.getState();
    const onlyListId = store.getActiveListId("user-1");
    const result = store.deleteList("user-1", onlyListId);
    expect(result).toEqual({ ok: false, reason: "last_list" });
  });

  it("moves and copies items between lists", () => {
    const store = useShoppingListStore.getState();
    const sourceListId = store.getActiveListId("user-1");
    const secondList = store.createList("user-1", "Feira");
    expect(secondList.ok).toBe(true);
    if (!secondList.ok) return;

    const added = store.addItem("user-1", "Banana", "6", sourceListId);
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const moved = store.moveItemToList(
      "user-1",
      added.item.id,
      secondList.listId,
      sourceListId,
    );
    expect(moved.ok).toBe(true);
    expect(store.getItems("user-1", sourceListId)).toHaveLength(0);
    expect(store.getItems("user-1", secondList.listId)).toHaveLength(1);

    const secondItemId = store.getItems("user-1", secondList.listId)[0].id;
    const copiedBack = store.copyItemToList(
      "user-1",
      secondItemId,
      sourceListId,
      secondList.listId,
    );
    expect(copiedBack.ok).toBe(true);
    expect(store.getItems("user-1", secondList.listId)).toHaveLength(1);
    expect(store.getItems("user-1", sourceListId)).toHaveLength(1);
  });

  it("rejects copy/move to same list", () => {
    const store = useShoppingListStore.getState();
    const listId = store.getActiveListId("user-1");
    const added = store.addItem("user-1", "Tomate", undefined, listId);
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const copied = store.copyItemToList("user-1", added.item.id, listId, listId);
    const moved = store.moveItemToList("user-1", added.item.id, listId, listId);
    expect(copied).toEqual({ ok: false, reason: "same_list" });
    expect(moved).toEqual({ ok: false, reason: "same_list" });
  });

  it("exports and applies cloud snapshot", () => {
    const store = useShoppingListStore.getState();
    const listId = store.getActiveListId("user-1");
    const added = store.addItem("user-1", "Macarrao", "1", listId);
    expect(added.ok).toBe(true);

    const snapshot = store.getCloudSnapshot("user-1");
    expect(snapshot).toBeTruthy();
    expect(snapshot?.version).toBe(1);

    useShoppingListStore.setState({ dataByUser: {} });

    const applied = store.applyCloudSnapshot("user-2", snapshot);
    expect(applied).toBe(true);
    expect(store.getItems("user-2")).toHaveLength(1);
    expect(store.getItems("user-2")[0].name).toBe("Macarrao");
  });
});
