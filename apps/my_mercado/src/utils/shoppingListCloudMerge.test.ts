import { describe, expect, it } from "vitest";
import type { ShoppingListsCloudSnapshot } from "../types/ui";
import {
  isSameShoppingListSnapshot,
  mergeShoppingListSnapshots,
} from "./shoppingListCloudMerge";

function makeSnapshot(
  partial: Partial<ShoppingListsCloudSnapshot>,
): ShoppingListsCloudSnapshot {
  return {
    version: 1,
    updated_at: "2026-04-01T00:00:00.000Z",
    active_list_id: "list-1",
    lists: [],
    items_by_list: {},
    ...partial,
  };
}

describe("shoppingListCloudMerge", () => {
  it("merges distinct lists from local and remote", () => {
    const local = makeSnapshot({
      lists: [
        {
          id: "list-1",
          name: "Casa",
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-01T00:00:00.000Z",
        },
      ],
      items_by_list: {
        "list-1": [
          {
            id: "i-1",
            name: "Arroz",
            normalized_key: "arroz",
            checked: false,
            created_at: "2026-03-01T00:00:00.000Z",
          },
        ],
      },
    });

    const remote = makeSnapshot({
      lists: [
        {
          id: "list-2",
          name: "Feira",
          created_at: "2026-03-02T00:00:00.000Z",
          updated_at: "2026-03-02T00:00:00.000Z",
        },
      ],
      items_by_list: {
        "list-2": [
          {
            id: "i-2",
            name: "Banana",
            normalized_key: "banana",
            checked: false,
            created_at: "2026-03-02T00:00:00.000Z",
          },
        ],
      },
    });

    const merged = mergeShoppingListSnapshots(local, remote);
    expect(merged.lists.map((list) => list.id).sort()).toEqual(["list-1", "list-2"]);
    expect(merged.items_by_list["list-1"]).toHaveLength(1);
    expect(merged.items_by_list["list-2"]).toHaveLength(1);
  });

  it("uses newer version when same list id exists on both sides", () => {
    const local = makeSnapshot({
      lists: [
        {
          id: "list-1",
          name: "Casa",
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-03T00:00:00.000Z",
        },
      ],
      items_by_list: {
        "list-1": [
          {
            id: "i-1",
            name: "Macarrao",
            normalized_key: "macarrao",
            checked: false,
            created_at: "2026-03-03T00:00:00.000Z",
          },
        ],
      },
    });

    const remote = makeSnapshot({
      lists: [
        {
          id: "list-1",
          name: "Casa Remota",
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-04T00:00:00.000Z",
        },
      ],
      items_by_list: {
        "list-1": [
          {
            id: "i-9",
            name: "Cafe",
            normalized_key: "cafe",
            checked: false,
            created_at: "2026-03-04T00:00:00.000Z",
          },
        ],
      },
    });

    const merged = mergeShoppingListSnapshots(local, remote);
    expect(merged.lists[0].name).toBe("Casa Remota");
    expect(merged.items_by_list["list-1"][0].name).toBe("Cafe");
  });

  it("considers snapshots equal despite ordering differences", () => {
    const a = makeSnapshot({
      lists: [
        {
          id: "list-2",
          name: "B",
          created_at: "2026-03-02T00:00:00.000Z",
          updated_at: "2026-03-02T00:00:00.000Z",
        },
        {
          id: "list-1",
          name: "A",
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-01T00:00:00.000Z",
        },
      ],
      items_by_list: {
        "list-1": [],
        "list-2": [],
      },
    });

    const b = makeSnapshot({
      lists: [
        {
          id: "list-1",
          name: "A",
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-01T00:00:00.000Z",
        },
        {
          id: "list-2",
          name: "B",
          created_at: "2026-03-02T00:00:00.000Z",
          updated_at: "2026-03-02T00:00:00.000Z",
        },
      ],
      items_by_list: {
        "list-2": [],
        "list-1": [],
      },
    });

    expect(isSameShoppingListSnapshot(a, b)).toBe(true);
  });
});
