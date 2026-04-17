import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockInstance } from "vitest";
import { createLogger } from "./logger.js";

describe("createLogger", () => {
    let logSpy: MockInstance<typeof console.log>;
    let errorSpy: MockInstance<typeof console.error>;

    beforeEach(() => {
        logSpy = vi.spyOn(console, "log").mockImplementation(() => { /* noop */ });
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => { /* noop */ });
    });

    it("prefixes log output with the channel name in square brackets", () => {
        const logger = createLogger("English");
        logger.log("hello");
        expect(logSpy).toHaveBeenCalledWith("[English]", "hello");
    });

    it("prefixes error output with the channel name", () => {
        const logger = createLogger("Dutch");
        logger.error("boom");
        expect(errorSpy).toHaveBeenCalledWith("[Dutch]", "boom");
    });

    it("passes through multiple arguments", () => {
        const logger = createLogger("ch");
        const err = new Error("bad");
        logger.error("failed:", err, 42);
        expect(errorSpy).toHaveBeenCalledWith("[ch]", "failed:", err, 42);
    });

    it("handles empty names", () => {
        const logger = createLogger("");
        logger.log("x");
        expect(logSpy).toHaveBeenCalledWith("[]", "x");
    });

    it("returns independent loggers per call", () => {
        const a = createLogger("A");
        const b = createLogger("B");
        a.log("1");
        b.log("2");
        expect(logSpy).toHaveBeenNthCalledWith(1, "[A]", "1");
        expect(logSpy).toHaveBeenNthCalledWith(2, "[B]", "2");
    });
});
