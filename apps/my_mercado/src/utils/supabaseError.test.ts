import { describe, expect, it } from "vitest";
import { ErrorCodes } from "./errorCodes";
import { mapSupabaseError } from "./supabaseError";

describe("mapSupabaseError", () => {
  it("maps not found errors to AppError", () => {
    const error = mapSupabaseError({ code: "PGRST116", message: "not found" }, "test");

    expect(error.code).toBe(ErrorCodes.NOT_FOUND);
    expect(error.context).toBe("test");
  });

  it("maps duplicate errors to domain-specific AppError", () => {
    const error = mapSupabaseError({ code: "23505", message: "duplicate" }, "test");

    expect(error.code).toBe(ErrorCodes.PRODUCT_ALREADY_EXISTS);
  });

  it("uses normalized package message as fallback", () => {
    const error = mapSupabaseError({ message: "database unavailable" }, "test");

    expect(error.message).toBe("database unavailable");
  });
});
