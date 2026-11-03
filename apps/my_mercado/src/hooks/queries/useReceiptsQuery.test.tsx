import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { useReceiptsQuery, useInfiniteReceiptsQuery, useReceiptItemsQuery } from "./useReceiptsQuery";
import * as services from "../../services";
import type { Receipt, ReceiptItem } from "../../types/domain";

vi.mock("../../services", () => ({
  getReceiptsPaginated: vi.fn(),
  getReceiptItemsFromDB: vi.fn(),
  getAllReceiptsFromDB: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe("useReceiptsQuery and useInfiniteReceiptsQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("busca página de notas com opções corretas incluindo itens", async () => {
    const mockReceipt = {
      id: "r1",
      establishment: "Mercado A",
      date: "2026-11-01",
      items: [],
    } as unknown as Receipt;

    vi.mocked(services.getReceiptsPaginated).mockResolvedValueOnce({
      data: [mockReceipt],
      hasMore: false,
      total: 1,
    });

    const { result } = renderHook(() => useReceiptsQuery(1, 10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(services.getReceiptsPaginated).toHaveBeenCalledWith(
      1,
      10,
      expect.any(Object),
      { includeItems: true }
    );
    expect(result.current.data?.data).toHaveLength(1);
  });

  it("busca query infinita passando includeItems: true por padrão", async () => {
    const mockReceipt = {
      id: "r1",
      establishment: "Mercado A",
      date: "2026-11-01",
      items: [],
    } as unknown as Receipt;

    vi.mocked(services.getReceiptsPaginated).mockResolvedValueOnce({
      data: [mockReceipt],
      hasMore: true,
      total: 2,
    });

    const { result } = renderHook(() => useInfiniteReceiptsQuery(10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(services.getReceiptsPaginated).toHaveBeenCalledWith(
      1,
      10,
      expect.any(Object),
      { includeItems: true }
    );
    expect(result.current.data?.pages[0].data).toHaveLength(1);
    expect(result.current.hasNextPage).toBe(true);
  });

  it("busca itens sob demanda com useReceiptItemsQuery", async () => {
    const mockItem = {
      id: "i1",
      name: "Leite",
      price: 5,
      quantity: 1,
    } as unknown as ReceiptItem;

    vi.mocked(services.getReceiptItemsFromDB).mockResolvedValueOnce([mockItem]);

    const { result } = renderHook(() => useReceiptItemsQuery("r1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(services.getReceiptItemsFromDB).toHaveBeenCalledWith("r1");
    expect(result.current.data).toHaveLength(1);
  });
});