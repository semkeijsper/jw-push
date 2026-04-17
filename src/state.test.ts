import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentType } from "./types.js";
import type { Video, Alert, Article } from "./types.js";

// In-memory stub for node:fs used by state.ts. Each test gets a fresh store.
const store = new Map<string, string>();
const existing = new Set<string>();

vi.mock("node:fs", () => ({
    readFileSync: vi.fn((path: string) => {
        const v = store.get(path);
        if (v === undefined) {
            throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
        }
        return v;
    }),
    writeFileSync: vi.fn((path: string, data: string) => {
        store.set(path, data);
        existing.add(path);
    }),
    existsSync: vi.fn((path: string) => existing.has(path)),
    mkdirSync: vi.fn(),
}));

// Import AFTER the mock so state.ts picks up the mocked fs.
const { BotState } = await import("./state.js");

const video = (guid: string): Video => ({
    guid,
    naturalKey: "nk",
    languageAgnosticNaturalKey: "lank",
    primaryCategory: "cat",
    title: "t",
});

const alert = (guid: string, languageCode = "E"): Alert => ({
    guid,
    languageCode,
    title: "t",
    body: "b",
    type: "news",
});

const article = (guid: string, link: string): Article => ({
    guid,
    title: "t",
    link,
});

describe("BotState", () => {
    beforeEach(() => {
        store.clear();
        existing.clear();
    });

    describe("construction", () => {
        it("starts empty when no state file exists", () => {
            const s = new BotState("ch1");
            expect(s.isEmpty()).toBe(true);
        });

        it("loads persisted state from an existing file", () => {
            store.set("run/ch1.json", JSON.stringify({
                pushedVideos: ["v1"],
                pushedAlerts: [],
                pushedArticles: [],
                univAlerts: {},
            }));
            existing.add("run/ch1.json");

            const s = new BotState("ch1");
            expect(s.isEmpty()).toBe(false);
            expect(s.hasPushed(ContentType.Video, video("v1"))).toBe(true);
        });

        it("falls back to empty state when the file is invalid JSON", () => {
            store.set("run/ch1.json", "{ not json");
            existing.add("run/ch1.json");

            const s = new BotState("ch1");
            expect(s.isEmpty()).toBe(true);
        });

        it("uses the channel id to compose the state file path", async () => {
            const fs = await import("node:fs");
            const s = new BotState("abc@newsletter");
            s.markPushed(ContentType.Video, video("v1"));
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                "run/abc@newsletter.json",
                expect.any(String),
            );
        });

        it("creates the run directory on construction", async () => {
            const fs = await import("node:fs");
            new BotState("ch1");
            expect(fs.mkdirSync).toHaveBeenCalledWith("run", { recursive: true });
        });
    });

    describe("hasPushed / markPushed", () => {
        it("reports videos as not pushed until marked", () => {
            const s = new BotState("ch1");
            expect(s.hasPushed(ContentType.Video, video("v1"))).toBe(false);
            s.markPushed(ContentType.Video, video("v1"));
            expect(s.hasPushed(ContentType.Video, video("v1"))).toBe(true);
        });

        it("keeps sets per content type separate", () => {
            const s = new BotState("ch1");
            s.markPushed(ContentType.Video, video("x"));
            // Same guid, different type — must not cross-contaminate.
            expect(s.hasPushed(ContentType.Alert, alert("x"))).toBe(false);
        });

        it("dedupes articles by link, not by guid", () => {
            const s = new BotState("ch1");
            s.markPushed(ContentType.Article, article("guid-A", "https://x/1"));
            // Same link republished with a fresh guid — must be treated as pushed.
            expect(s.hasPushed(ContentType.Article, article("guid-B", "https://x/1"))).toBe(true);
            // Different link with same guid — must NOT be considered pushed.
            expect(s.hasPushed(ContentType.Article, article("guid-A", "https://x/2"))).toBe(false);
        });

        it("persists after every markPushed call", async () => {
            const fs = await import("node:fs");
            const s = new BotState("ch1");
            s.markPushed(ContentType.Video, video("v1"));
            s.markPushed(ContentType.Alert, alert("a1"));
            expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
        });
    });

    describe("isEmpty", () => {
        it("is true only when all content sets are empty", () => {
            const s = new BotState("ch1");
            expect(s.isEmpty()).toBe(true);
            s.markPushed(ContentType.Article, article("g", "l"));
            expect(s.isEmpty()).toBe(false);
        });

        it("ignores univAlerts for emptiness", () => {
            const s = new BotState("ch1");
            s.setUnivAlert("g", "msg-id");
            // Only content sets count toward "empty"; univ alert pointers do not.
            expect(s.isEmpty()).toBe(true);
        });
    });

    describe("reset", () => {
        it("clears all pushed sets", () => {
            const s = new BotState("ch1");
            s.markPushed(ContentType.Video, video("v1"));
            s.markPushed(ContentType.Alert, alert("a1"));
            s.markPushed(ContentType.Article, article("g", "l"));
            s.setUnivAlert("u1", "m1");

            s.reset();
            expect(s.isEmpty()).toBe(true);
            expect(s.getUnivAlertMessageId("u1")).toBeUndefined();
        });

        it("does not persist by itself — state is wiped only in memory", async () => {
            const fs = await import("node:fs");
            const s = new BotState("ch1");
            s.markPushed(ContentType.Video, video("v1"));
            vi.mocked(fs.writeFileSync).mockClear();
            s.reset();
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });
    });

    describe("univAlerts", () => {
        it("returns undefined for an unknown guid", () => {
            const s = new BotState("ch1");
            expect(s.getUnivAlertMessageId("missing")).toBeUndefined();
        });

        it("stores and retrieves a univ alert message id", () => {
            const s = new BotState("ch1");
            s.setUnivAlert("guid-1", "serialized-id");
            expect(s.getUnivAlertMessageId("guid-1")).toBe("serialized-id");
        });

        it("deletes a univ alert pointer", () => {
            const s = new BotState("ch1");
            s.setUnivAlert("g", "m");
            s.deleteUnivAlert("g");
            expect(s.getUnivAlertMessageId("g")).toBeUndefined();
        });

        it("persists univ alerts via writeFileSync", async () => {
            const fs = await import("node:fs");
            const s = new BotState("ch1");
            s.setUnivAlert("g", "m");
            const lastCall = vi.mocked(fs.writeFileSync).mock.calls.at(-1)!;
            const saved = JSON.parse(lastCall[1] as string) as { univAlerts: Record<string, string> };
            expect(saved.univAlerts).toEqual({ g: "m" });
        });
    });

    describe("persistence trimming", () => {
        it("caps each pushed list to the most recent 500 entries on save", async () => {
            const fs = await import("node:fs");
            const s = new BotState("ch1");
            for (let i = 0; i < 550; i++) {
                s.markPushed(ContentType.Video, video(`v${i}`));
            }
            const lastCall = vi.mocked(fs.writeFileSync).mock.calls.at(-1)!;
            const saved = JSON.parse(lastCall[1] as string) as { pushedVideos: string[] };
            expect(saved.pushedVideos).toHaveLength(500);
            // Most recent entries are kept (the oldest are dropped).
            expect(saved.pushedVideos[0]).toBe("v50");
            expect(saved.pushedVideos.at(-1)).toBe("v549");
        });

        it("does not trim univAlerts — those are keyed by live guids", async () => {
            const fs = await import("node:fs");
            const s = new BotState("ch1");
            for (let i = 0; i < 10; i++) {
                s.setUnivAlert(`g${i}`, `m${i}`);
            }
            const lastCall = vi.mocked(fs.writeFileSync).mock.calls.at(-1)!;
            const saved = JSON.parse(lastCall[1] as string) as { univAlerts: Record<string, string> };
            expect(Object.keys(saved.univAlerts)).toHaveLength(10);
        });
    });
});
