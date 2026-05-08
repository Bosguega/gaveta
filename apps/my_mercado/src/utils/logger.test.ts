/* eslint-disable no-console */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  const originalEnv = import.meta.env.DEV;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original env
    import.meta.env.DEV = originalEnv;
  });

  describe("em ambiente de desenvolvimento", () => {
    beforeEach(() => {
      import.meta.env.DEV = true;
    });

    describe("error", () => {
      it("deve logar erro com contexto", () => {
        const error = new Error("Test error");
        logger.error("TestContext", "Erro ocorreu", error);

        expect(console.error).toHaveBeenCalledWith("[TestContext] Erro ocorreu", error);
      });

      it("deve logar erro sem dados adicionais", () => {
        const error = new Error("Test error");
        logger.error("TestContext", "Erro ocorreu", error);

        expect(console.error).toHaveBeenCalled();
      });
    });

    describe("warn", () => {
      it("deve logar warning com contexto", () => {
        logger.warn("TestContext", "Warning message");

        expect(console.warn).toHaveBeenCalledWith("[TestContext] Warning message");
      });

      it("deve logar warning com dados adicionais", () => {
        const data = { key: "value" };
        logger.warn("TestContext", "Warning message", data);

        expect(console.warn).toHaveBeenCalledWith("[TestContext] Warning message", data);
      });
    });

    describe("info", () => {
      it("deve logar informacao sem dados", () => {
        logger.info("TestContext", "Info message");

        expect(console.log).toHaveBeenCalledWith("[TestContext] Info message");
      });

      it("deve logar informacao com dados", () => {
        const data = { key: "value" };
        logger.info("TestContext", "Info message", data);

        expect(console.log).toHaveBeenCalledWith("[TestContext] Info message", data);
      });
    });

    describe("debug", () => {
      it("deve logar debug sem dados", () => {
        logger.debug("TestContext", "Debug message");

        expect(console.debug).toHaveBeenCalledWith("[TestContext] Debug message");
      });

      it("deve logar debug com dados", () => {
        const data = { key: "value" };
        logger.debug("TestContext", "Debug message", data);

        expect(console.debug).toHaveBeenCalledWith("[TestContext] Debug message", data);
      });
    });
  });

  // Nota: O teste de produção não é trivial porque isDev é avaliado no momento do import
  // Na prática, o logger é testado manualmente em ambiente de produção durante o build
});
