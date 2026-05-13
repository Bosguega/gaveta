import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  supabase: {},
}));

vi.mock("./supabaseClient", () => ({
  supabase: mocks.supabase,
}));

vi.mock("@bosguega/supabase", () => {
  class SupabaseError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "SupabaseError";
    }
  }

  return {
    invoke: mocks.invoke,
    SupabaseError,
  };
});

describe("fetchNfceHtmlFromEdge", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
  });

  it("returns html on successful edge response", async () => {
    mocks.invoke.mockResolvedValue({
      success: true,
      html: "<html></html>",
      source: "sefaz",
      status: 200,
    });

    const { fetchNfceHtmlFromEdge } = await import("./nfceEdgeFetch");

    await expect(fetchNfceHtmlFromEdge("https://example.com")).resolves.toEqual({
      ok: true,
      html: "<html></html>",
    });
    expect(mocks.invoke).toHaveBeenCalledWith(
      mocks.supabase,
      "fetch-nfce",
      expect.objectContaining({ body: { url: "https://example.com" } }),
    );
  });

  it("returns edge business errors as detail", async () => {
    mocks.invoke.mockResolvedValue({
      success: false,
      error: "FETCH_FAILED",
      message: "sefaz unavailable",
      status: 503,
    });

    const { fetchNfceHtmlFromEdge } = await import("./nfceEdgeFetch");

    await expect(fetchNfceHtmlFromEdge("https://example.com")).resolves.toEqual({
      ok: false,
      detail: "FETCH_FAILED: sefaz unavailable",
    });
  });
});
