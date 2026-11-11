import { afterEach, describe, expect, it, vi } from "vitest";
import { extractEmissionDate, getFallbackDateAtMidnight } from "./htmlParser";

describe("NFC-e date extraction", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses midnight when the source contains a date but no time", () => {
    expect(extractEmissionDate("Data de Emissão: 10/09/2026")).toBe(
      "10/09/2026 00:00:00",
    );
  });

  it("preserves an explicitly printed time", () => {
    expect(extractEmissionDate("Data de Emissão: 10/09/2026 14:35")).toBe(
      "10/09/2026 14:35:00",
    );
  });

  it("uses today's date at midnight when no date is available", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 10, 17, 42, 31));

    expect(getFallbackDateAtMidnight()).toBe("10/09/2026 00:00:00");
  });
});
