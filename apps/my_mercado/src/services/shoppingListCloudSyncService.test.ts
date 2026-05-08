import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShoppingListsCloudSnapshot } from "../types/ui";

const { getUserMock, updateUserMock, getStateMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  updateUserMock: vi.fn(),
  getStateMock: vi.fn(),
}));

vi.mock("./supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
      updateUser: updateUserMock,
    },
  },
}));

vi.mock("../stores/useShoppingListStore", () => ({
  useShoppingListStore: {
    getState: getStateMock,
  },
}));

import { syncShoppingListsWithCloud } from "./shoppingListCloudSyncService";

function makeSnapshot(partial: Partial<ShoppingListsCloudSnapshot> = {}): ShoppingListsCloudSnapshot {
  return {
    version: 1,
    updated_at: "2026-04-01T12:00:00.000Z",
    active_list_id: "list-1",
    lists: [
      {
        id: "list-1",
        name: "Casa",
        created_at: "2026-04-01T10:00:00.000Z",
        updated_at: "2026-04-01T12:00:00.000Z",
      },
    ],
    items_by_list: {
      "list-1": [
        {
          id: "item-1",
          name: "Arroz",
          normalized_key: "ARROZ",
          checked: false,
          created_at: "2026-04-01T12:00:00.000Z",
        },
      ],
    },
    ...partial,
  };
}

describe("syncShoppingListsWithCloud", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pushes local snapshot when remote metadata is empty", async () => {
    const localSnapshot = makeSnapshot();

    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", user_metadata: {} } },
      error: null,
    });
    updateUserMock.mockResolvedValue({ error: null });

    getStateMock.mockReturnValue({
      getCloudSnapshot: () => localSnapshot,
      applyCloudSnapshot: vi.fn(),
    });

    const result = await syncShoppingListsWithCloud("user-1");

    expect(result).toEqual({ status: "pushed" });
    expect(updateUserMock).toHaveBeenCalledTimes(1);
    expect(updateUserMock.mock.calls[0][0]).toMatchObject({
      data: {
        mymercado_shopping_lists_v1: localSnapshot,
      },
    });
  });

  it("pulls remote snapshot when local is empty", async () => {
    const remoteSnapshot = makeSnapshot();
    const applyCloudSnapshot = vi.fn(() => true);

    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", user_metadata: { mymercado_shopping_lists_v1: remoteSnapshot } } },
      error: null,
    });

    getStateMock.mockReturnValue({
      getCloudSnapshot: () => null,
      applyCloudSnapshot,
    });

    const result = await syncShoppingListsWithCloud("user-1");

    expect(result).toEqual({ status: "pulled" });
    expect(applyCloudSnapshot).toHaveBeenCalledWith("user-1", remoteSnapshot);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("returns unchanged when local and remote snapshots are equivalent", async () => {
    const snapshot = makeSnapshot();

    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", user_metadata: { mymercado_shopping_lists_v1: snapshot } } },
      error: null,
    });

    getStateMock.mockReturnValue({
      getCloudSnapshot: () => snapshot,
      applyCloudSnapshot: vi.fn(() => true),
    });

    const result = await syncShoppingListsWithCloud("user-1");

    expect(result).toEqual({ status: "unchanged" });
    expect(updateUserMock).not.toHaveBeenCalled();
  });
});
