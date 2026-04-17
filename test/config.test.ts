import { describe, it, expect, vi, beforeEach } from "vitest";

const readFileSync = vi.fn();

vi.mock("node:fs", () => ({
    readFileSync: (...args: unknown[]) => readFileSync(...args) as unknown,
}));

async function loadConfig(): Promise<typeof import("../src/config.js")> {
    vi.resetModules();
    return await import("../src/config.js");
}

describe("config loader", () => {
    beforeEach(() => {
        readFileSync.mockReset();
    });

    it("exports the channels array from a valid config.json", async () => {
        readFileSync.mockReturnValue(JSON.stringify({
            channels: [
                {
                    id: "123@newsletter",
                    type: "production",
                    name: "English",
                    langcode: "E",
                    locale: "en",
                    articleFeedUrl: "https://feed",
                },
            ],
        }));

        const { channels } = await loadConfig();
        expect(channels).toHaveLength(1);
        expect(channels[0].id).toBe("123@newsletter");
        expect(readFileSync).toHaveBeenCalledWith("config.json", "utf-8");
    });

    it("returns an empty channels list when config.json is missing", async () => {
        readFileSync.mockImplementation(() => {
            throw Object.assign(new Error("not found"), { code: "ENOENT" });
        });
        const { channels } = await loadConfig();
        expect(channels).toEqual([]);
    });

    it("throws a descriptive error when config.json is present but invalid JSON", async () => {
        readFileSync.mockReturnValue("{ definitely not json");
        await expect(loadConfig()).rejects.toThrow(/Failed to parse config\.json/);
    });

    it("re-throws non-ENOENT filesystem errors wrapped in a parse-hint message", async () => {
        readFileSync.mockImplementation(() => {
            throw Object.assign(new Error("permission denied"), { code: "EACCES" });
        });
        await expect(loadConfig()).rejects.toThrow(/Failed to parse config\.json/);
    });
});
