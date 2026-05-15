import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShoppingListsCloudSnapshot } from "../types/ui";

const { pushSnapshotMock, pullSnapshotMock, getStateMock } = vi.hoisted(() => ({
  pushSnapshotMock: vi.fn(),
  pullSnapshotMock: vi.fn(),
  getStateMock: vi.fn(),
}));

vi.mock("./supabaseClient", () => ({
  supabase: {},
  isSupabaseConfigured: true,
}));

vi.mock("./shoppingListSnapshotService", () => ({
  pushSnapshot: pushSnapshotMock,
  pullSnapshot: pullSnapshotMock,
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

  it("pushes local snapshot when remote is empty", async () => {
    const localSnapshot = makeSnapshot();

    pullSnapshotMock.mockResolvedValue(null);
    pushSnapshotMock.mockResolvedValue(undefined);

    getStateMock.mockReturnValue({
      getCloudSnapshot: () => localSnapshot,
      applyCloudSnapshot: vi.fn(),
    });

    const result = await syncShoppingListsWithCloud("user-1");

    expect(result).toEqual({ status: "pushed" });
    expect(pushSnapshotMock).toHaveBeenCalledTimes(1);
    expect(pushSnapshotMock).toHaveBeenCalledWith("user-1", localSnapshot);
  });

  it("pulls remote snapshot when local is empty", async () => {
    const remoteSnapshot = makeSnapshot();
    const applyCloudSnapshot = vi.fn(() => true);

    pullSnapshotMock.mockResolvedValue(remoteSnapshot);

    getStateMock.mockReturnValue({
      getCloudSnapshot: () => null,
      applyCloudSnapshot,
    });

    const result = await syncShoppingListsWithCloud("user-1");

    expect(result).toEqual({ status: "pulled" });
    expect(applyCloudSnapshot).toHaveBeenCalledWith("user-1", remoteSnapshot);
    expect(pushSnapshotMock).not.toHaveBeenCalled();
  });

  it("returns unchanged when local and remote snapshots are equivalent", async () => {
    const snapshot = makeSnapshot();

    pullSnapshotMock.mockResolvedValue(snapshot);

    getStateMock.mockReturnValue({
      getCloudSnapshot: () => snapshot,
      applyCloudSnapshot: vi.fn(() => true),
    });

    const result = await syncShoppingListsWithCloud("user-1");

    expect(result).toEqual({ status: "unchanged" });
    expect(pushSnapshotMock).not.toHaveBeenCalled();
  });


  it("skips sync for local-only users", async () => {
    const result = await syncShoppingListsWithCloud("__local__");

    expect(result).toEqual({ status: "skipped", reason: "no_user" });
  });
});