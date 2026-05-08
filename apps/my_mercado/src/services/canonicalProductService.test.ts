import { beforeEach, describe, expect, it, vi } from "vitest";

import { mergeCanonicalProducts } from "./canonicalProductService";
import { getAuthenticatedSupabaseContext } from "./authService";

vi.mock("./authService", () => ({
  getAuthenticatedSupabaseContext: vi.fn(),
}));

function createRpcSupabaseMock(error: unknown = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ error }),
  };
}

function createAuthenticatedContext(
  client: ReturnType<typeof createRpcSupabaseMock>,
  userId: string,
): Awaited<ReturnType<typeof getAuthenticatedSupabaseContext>> {
  return {
    client,
    user: { id: userId },
  } as unknown as Awaited<ReturnType<typeof getAuthenticatedSupabaseContext>>;
}

describe("mergeCanonicalProducts", () => {
  const userId = "user-1";
  const primaryId = "primary-1";
  const secondaryId = "secondary-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates merge to atomic RPC with the authenticated user", async () => {
    const mock = createRpcSupabaseMock();
    vi.mocked(getAuthenticatedSupabaseContext).mockResolvedValue(
      createAuthenticatedContext(mock, userId),
    );

    await mergeCanonicalProducts(primaryId, secondaryId);

    expect(mock.rpc).toHaveBeenCalledWith("merge_canonical_products_atomic", {
      p_primary_id: primaryId,
      p_secondary_id: secondaryId,
      p_user_id: userId,
    });
  });

  it("throws when atomic RPC fails", async () => {
    const rpcError = new Error("Produto canonico primario nao encontrado");
    const mock = createRpcSupabaseMock(rpcError);
    vi.mocked(getAuthenticatedSupabaseContext).mockResolvedValue(
      createAuthenticatedContext(mock, userId),
    );

    await expect(mergeCanonicalProducts(primaryId, secondaryId)).rejects.toThrow(
      "Produto canonico primario nao encontrado",
    );
  });
});
