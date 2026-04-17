import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { ContentType, type Alert, type Article, type Video, type ChannelConfig } from "./types.js";
import type { Strings } from "./i18n.js";

// ---------- Mocks ----------

vi.mock("./api.js", () => ({
    fetchLatestVideos: vi.fn(),
    fetchAlerts: vi.fn(),
    fetchArticles: vi.fn(),
    fetchCategoryName: vi.fn(),
}));

vi.mock("whatsapp-web.js", () => ({
    default: {
        MessageMedia: {
            fromUrl: vi.fn(),
        },
    },
}));

// Stub the BotState class so we can inspect/force its behaviour per test.
type StateStub = {
    hasPushed: Mock;
    markPushed: Mock;
    isEmpty: Mock;
    reset: Mock;
    getUnivAlertMessageId: Mock;
    setUnivAlert: Mock;
    deleteUnivAlert: Mock;
};

const stateInstances: StateStub[] = [];

vi.mock("./state.js", async () => {
    const types = await import("./types.js");
    class BotState implements StateStub {
        hasPushed = vi.fn().mockReturnValue(false);
        markPushed = vi.fn();
        isEmpty = vi.fn().mockReturnValue(true);
        reset = vi.fn();
        getUnivAlertMessageId = vi.fn().mockReturnValue(undefined);
        setUnivAlert = vi.fn();
        deleteUnivAlert = vi.fn();
        constructor(channelId: string) {
            void channelId;
            stateInstances.push(this);
        }
    }
    return { BotState, ContentType: types.ContentType };
});

// Imported after mocks are declared above.
const api = await import("./api.js");
const whatsapp = await import("whatsapp-web.js");
const { JWBot } = await import("./bot.js");

// ---------- Test helpers ----------

const channel: ChannelConfig = {
    id: "abc@newsletter",
    type: "production",
    name: "Test",
    langcode: "E",
    locale: "en",
    articleFeedUrl: "https://feed",
};

const strings: Strings = {
    newVideo: "New video!",
    newArticle: "New article!",
    moreInfo: ">> info <<",
};

function makeClient(): { client: { sendMessage: Mock }; sendMessage: Mock } {
    const sendMessage = vi.fn();
    return { client: { sendMessage }, sendMessage };
}

function makeMessage(id: string): { id: { _serialized: string }; edit: Mock; delete: Mock } {
    return {
        id: { _serialized: id },
        edit: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
    };
}

const video = (guid: string, overrides: Partial<Video> = {}): Video => ({
    guid,
    naturalKey: "nk",
    languageAgnosticNaturalKey: "lank-" + guid,
    primaryCategory: "LatestVideos",
    title: "Video " + guid,
    ...overrides,
});

const alert = (guid: string, overrides: Partial<Alert> = {}): Alert => ({
    guid,
    languageCode: "E",
    title: "Alert " + guid,
    body: "Body",
    type: "news",
    ...overrides,
});

const article = (guid: string, link = `https://x/${guid}`): Article => ({
    guid,
    title: "Article " + guid,
    link,
});

// Typed accessor for private members we want to invoke in tests.
type BotInternals = {
    checkVideos: () => Promise<void>;
    checkAlerts: () => Promise<void>;
    checkArticles: () => Promise<void>;
    handleAlert: (a: Alert) => Promise<boolean>;
    sleep: (ms: number) => Promise<void>;
    state: StateStub;
    univAlertMessages: Map<string, ReturnType<typeof makeMessage>>;
    categoryCache: Map<string, string>;
};

type BuildBotResult = {
    bot: InstanceType<typeof JWBot>;
    internals: BotInternals;
    sendMessage: Mock;
    state: StateStub;
};

function buildBot(): BuildBotResult {
    const { client, sendMessage } = makeClient();
    stateInstances.length = 0;
    const bot = new JWBot(client as unknown as ConstructorParameters<typeof JWBot>[0], channel, strings);
    const internals = bot as unknown as BotInternals;
    // Short-circuit the 2s throttle so tests run quickly.
    vi.spyOn(internals, "sleep").mockResolvedValue(undefined);
    return { bot, internals, sendMessage, state: stateInstances[0] };
}

// Silence the channel-prefixed console logger.
beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => { /* noop */ });
    vi.spyOn(console, "error").mockImplementation(() => { /* noop */ });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(api.fetchLatestVideos).mockReset();
    vi.mocked(api.fetchAlerts).mockReset();
    vi.mocked(api.fetchArticles).mockReset();
    vi.mocked(api.fetchCategoryName).mockReset();
    vi.mocked(whatsapp.default.MessageMedia.fromUrl).mockReset();
});

// ---------- Tests ----------

describe("JWBot.checkVideos", () => {
    it("does nothing when the video endpoint returns null", async () => {
        const { internals, sendMessage } = buildBot();
        vi.mocked(api.fetchLatestVideos).mockResolvedValue(null);

        await internals.checkVideos();

        expect(sendMessage).not.toHaveBeenCalled();
    });

    it("does nothing when the category has no media", async () => {
        const { internals, sendMessage } = buildBot();
        vi.mocked(api.fetchLatestVideos).mockResolvedValue({ category: { key: "k", name: "n" } });

        await internals.checkVideos();

        expect(sendMessage).not.toHaveBeenCalled();
    });

    it("sends new videos in reverse API order (oldest first)", async () => {
        const { internals, sendMessage, state } = buildBot();
        const v1 = video("v1");
        const v2 = video("v2");
        // state.hasPushed returns false by default, so both will be sent.
        vi.mocked(api.fetchLatestVideos).mockResolvedValue({
            category: { key: "k", name: "Latest", media: [v2, v1] },
        });
        vi.mocked(api.fetchCategoryName).mockResolvedValue("Latest");

        await internals.checkVideos();

        expect(sendMessage).toHaveBeenCalledTimes(2);
        // API order [v2, v1] → reversed → v1 is sent first.
        const firstCaption = sendMessage.mock.calls[0][1] as string;
        expect(firstCaption).toContain("Video v1");
        expect(state.markPushed).toHaveBeenNthCalledWith(1, ContentType.Video, v1);
        expect(state.markPushed).toHaveBeenNthCalledWith(2, ContentType.Video, v2);
    });

    it("skips videos already recorded in state", async () => {
        const { internals, sendMessage, state } = buildBot();
        const v1 = video("v1");
        const v2 = video("v2");
        state.hasPushed.mockImplementation((_type: ContentType, v: Video) => v.guid === "v1");
        vi.mocked(api.fetchLatestVideos).mockResolvedValue({
            category: { key: "k", name: "n", media: [v2, v1] },
        });
        vi.mocked(api.fetchCategoryName).mockResolvedValue("Latest");

        await internals.checkVideos();

        expect(sendMessage).toHaveBeenCalledTimes(1);
        const caption = sendMessage.mock.calls[0][1] as string;
        expect(caption).toContain("Video v2");
    });

    it("falls back to text-only send when image fetch fails", async () => {
        const { internals, sendMessage } = buildBot();
        const v = video("v1", { images: { lsr: { xl: "https://img/x.jpg" } } });
        vi.mocked(api.fetchLatestVideos).mockResolvedValue({
            category: { key: "k", name: "n", media: [v] },
        });
        vi.mocked(api.fetchCategoryName).mockResolvedValue("Cat");
        vi.mocked(whatsapp.default.MessageMedia.fromUrl).mockRejectedValue(new Error("404"));

        await internals.checkVideos();

        // One send — text-only, second arg is the caption string.
        expect(sendMessage).toHaveBeenCalledTimes(1);
        const firstCall = sendMessage.mock.calls[0] as unknown[];
        expect(firstCall[0]).toBe(channel.id);
        expect(typeof firstCall[1]).toBe("string");
    });

    it("sends with an image when a thumbnail is available", async () => {
        const { internals, sendMessage } = buildBot();
        const v = video("v1", { images: { lsr: { xl: "https://img/x.jpg" } } });
        vi.mocked(api.fetchLatestVideos).mockResolvedValue({
            category: { key: "k", name: "n", media: [v] },
        });
        vi.mocked(api.fetchCategoryName).mockResolvedValue("Cat");
        const media = { mock: "media" };
        vi.mocked(whatsapp.default.MessageMedia.fromUrl).mockResolvedValue(media as never);

        await internals.checkVideos();

        expect(whatsapp.default.MessageMedia.fromUrl).toHaveBeenCalledWith(
            "https://img/x.jpg",
            { unsafeMime: true },
        );
        expect(sendMessage).toHaveBeenCalledWith(
            channel.id,
            media,
            expect.objectContaining({ caption: expect.any(String) as unknown, sendSeen: false }),
        );
    });

    it("skips overlapping invocations via the mutex", async () => {
        const { internals, sendMessage } = buildBot();
        let resolveFetch!: (value: null) => void;
        const pending = new Promise<null>(r => {
            resolveFetch = r;
        });
        vi.mocked(api.fetchLatestVideos).mockReturnValue(pending);

        const first = internals.checkVideos();
        const second = internals.checkVideos(); // should early-return because mutex is held
        resolveFetch(null);
        await Promise.all([first, second]);

        // The second call never triggered a second fetchLatestVideos invocation.
        expect(api.fetchLatestVideos).toHaveBeenCalledTimes(1);
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it("logs and recovers when the API call throws", async () => {
        const { internals } = buildBot();
        vi.mocked(api.fetchLatestVideos).mockRejectedValue(new Error("boom"));

        await expect(internals.checkVideos()).resolves.toBeUndefined();
        // Mutex must be released so a subsequent call can proceed.
        vi.mocked(api.fetchLatestVideos).mockResolvedValue(null);
        await expect(internals.checkVideos()).resolves.toBeUndefined();
        expect(api.fetchLatestVideos).toHaveBeenCalledTimes(2);
    });

    it("caches category lookups across videos sharing a primaryCategory", async () => {
        const { internals } = buildBot();
        const v1 = video("v1", { primaryCategory: "K" });
        const v2 = video("v2", { primaryCategory: "K" });
        vi.mocked(api.fetchLatestVideos).mockResolvedValue({
            category: { key: "k", name: "n", media: [v1, v2] },
        });
        vi.mocked(api.fetchCategoryName).mockResolvedValue("Resolved");

        await internals.checkVideos();

        // Second video reuses the cached name — only one network call.
        expect(api.fetchCategoryName).toHaveBeenCalledTimes(1);
        expect(api.fetchCategoryName).toHaveBeenCalledWith("K", "E");
    });
});

describe("JWBot.checkArticles", () => {
    it("sends each new article and records state", async () => {
        const { internals, sendMessage, state } = buildBot();
        vi.mocked(api.fetchArticles).mockResolvedValue([article("a1"), article("a2")]);

        await internals.checkArticles();

        expect(sendMessage).toHaveBeenCalledTimes(2);
        expect(state.markPushed).toHaveBeenCalledTimes(2);
    });

    it("skips previously pushed articles", async () => {
        const { internals, sendMessage, state } = buildBot();
        state.hasPushed.mockImplementation((_t: ContentType, a: Article) => a.guid === "a1");
        vi.mocked(api.fetchArticles).mockResolvedValue([article("a1"), article("a2")]);

        await internals.checkArticles();

        expect(sendMessage).toHaveBeenCalledTimes(1);
    });

    it("survives errors thrown while fetching articles", async () => {
        const { internals } = buildBot();
        vi.mocked(api.fetchArticles).mockRejectedValue(new Error("nope"));
        await expect(internals.checkArticles()).resolves.toBeUndefined();
    });

    it("sends article with image when imageUrl is present", async () => {
        const { internals, sendMessage } = buildBot();
        vi.mocked(api.fetchArticles).mockResolvedValue([
            { ...article("a1"), imageUrl: "https://img/1.jpg" },
        ]);
        const media = { kind: "media" };
        vi.mocked(whatsapp.default.MessageMedia.fromUrl).mockResolvedValue(media as never);

        await internals.checkArticles();

        expect(whatsapp.default.MessageMedia.fromUrl).toHaveBeenCalledWith(
            "https://img/1.jpg",
            { unsafeMime: true },
        );
        expect(sendMessage).toHaveBeenCalledWith(
            channel.id,
            media,
            expect.objectContaining({ caption: expect.any(String) as unknown }),
        );
    });

    it("skips overlapping invocations", async () => {
        const { internals } = buildBot();
        let resolve!: (a: Article[]) => void;
        const pending = new Promise<Article[]>(r => {
            resolve = r;
        });
        vi.mocked(api.fetchArticles).mockReturnValue(pending);
        const first = internals.checkArticles();
        const second = internals.checkArticles();
        resolve([]);
        await Promise.all([first, second]);
        expect(api.fetchArticles).toHaveBeenCalledTimes(1);
    });
});

describe("JWBot.handleAlert", () => {
    it("sends a fresh localized alert and marks state", async () => {
        const { internals, sendMessage, state } = buildBot();
        sendMessage.mockResolvedValue(makeMessage("msg-1"));
        const a = alert("g1");

        const sent = await internals.handleAlert(a);

        expect(sent).toBe(true);
        expect(state.markPushed).toHaveBeenCalledWith(ContentType.Alert, a);
        expect(state.setUnivAlert).not.toHaveBeenCalled();
    });

    it("tracks a universal alert in memory and persisted state", async () => {
        const { internals, sendMessage, state } = buildBot();
        const msg = makeMessage("serialized-id");
        sendMessage.mockResolvedValue(msg);
        const a = alert("g1", { languageCode: "univ" });

        const sent = await internals.handleAlert(a);

        expect(sent).toBe(true);
        expect(state.setUnivAlert).toHaveBeenCalledWith("g1", "serialized-id");
        expect(internals.univAlertMessages.get("g1")).toBe(msg);
    });

    it("does nothing when the alert is already recorded as pushed", async () => {
        const { internals, sendMessage, state } = buildBot();
        state.hasPushed.mockReturnValue(true);

        const sent = await internals.handleAlert(alert("g1"));

        expect(sent).toBe(false);
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it("edits the in-memory univ message when the localized version arrives", async () => {
        const { internals, state } = buildBot();
        const original = makeMessage("serialized-id");
        internals.univAlertMessages.set("g1", original);
        state.getUnivAlertMessageId.mockReturnValue("serialized-id");

        const sent = await internals.handleAlert(alert("g1", { languageCode: "E" }));

        // Returning false means "no channel notification was produced",
        // so the 2s throttle is skipped upstream.
        expect(sent).toBe(false);
        expect(original.edit).toHaveBeenCalledTimes(1);
        expect(original.delete).not.toHaveBeenCalled();
        expect(state.deleteUnivAlert).toHaveBeenCalledWith("g1");
        expect(internals.univAlertMessages.has("g1")).toBe(false);
    });

    it("falls back to delete+resend when editing the univ message fails", async () => {
        const { internals, sendMessage, state } = buildBot();
        const original = makeMessage("serialized-id");
        original.edit.mockRejectedValue(new Error("edit window expired"));
        internals.univAlertMessages.set("g1", original);
        state.getUnivAlertMessageId.mockReturnValue("serialized-id");
        sendMessage.mockResolvedValue(makeMessage("new-id"));

        const sent = await internals.handleAlert(alert("g1"));

        expect(sent).toBe(true);
        expect(original.delete).toHaveBeenCalledWith(true);
        expect(sendMessage).toHaveBeenCalledTimes(1);
        expect(state.deleteUnivAlert).toHaveBeenCalledWith("g1");
    });

    it("resends when the univ message pointer exists but the Message object is gone from memory", async () => {
        const { internals, sendMessage, state } = buildBot();
        // E.g. after a bot restart: state remembers the guid but the
        // in-memory Message reference is lost.
        state.getUnivAlertMessageId.mockReturnValue("serialized-id");
        sendMessage.mockResolvedValue(makeMessage("new-id"));

        const sent = await internals.handleAlert(alert("g1"));

        expect(sent).toBe(true);
        expect(sendMessage).toHaveBeenCalledTimes(1);
        expect(state.deleteUnivAlert).toHaveBeenCalledWith("g1");
    });

    it("does not edit when a second univ alert arrives for the same guid", async () => {
        const { internals, sendMessage, state } = buildBot();
        // A univ pointer exists but the incoming alert is also univ.
        // The edit-branch is gated on languageCode !== "univ", so we fall through
        // to the 'already pushed' branch.
        state.getUnivAlertMessageId.mockReturnValue("serialized-id");
        state.hasPushed.mockReturnValue(true);

        const sent = await internals.handleAlert(alert("g1", { languageCode: "univ" }));

        expect(sent).toBe(false);
        expect(sendMessage).not.toHaveBeenCalled();
    });
});

describe("JWBot.checkAlerts", () => {
    it("sleeps 2s between sends but not after an edit (edit returns false)", async () => {
        const { internals, sendMessage } = buildBot();
        const sleepSpy = internals.sleep as unknown as Mock;
        sleepSpy.mockClear();
        sendMessage.mockResolvedValue(makeMessage("m"));
        vi.mocked(api.fetchAlerts).mockResolvedValue({
            alerts: [alert("a1"), alert("a2")],
        });

        await internals.checkAlerts();

        // Two sends → exactly two sleep calls (one per send).
        expect(sleepSpy).toHaveBeenCalledTimes(2);
        expect(sleepSpy).toHaveBeenCalledWith(2000);
    });

    it("does nothing when the alerts endpoint returns null", async () => {
        const { internals, sendMessage } = buildBot();
        vi.mocked(api.fetchAlerts).mockResolvedValue(null);
        await internals.checkAlerts();
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it("processes alerts in reverse (oldest first)", async () => {
        const { internals, sendMessage } = buildBot();
        sendMessage.mockResolvedValue(makeMessage("m"));
        vi.mocked(api.fetchAlerts).mockResolvedValue({
            alerts: [alert("new"), alert("old")],
        });

        await internals.checkAlerts();

        const firstSent = sendMessage.mock.calls[0][1] as string;
        expect(firstSent).toContain("Alert old");
    });

    it("does not sleep after an in-place edit of a univ alert", async () => {
        const { internals, state } = buildBot();
        const sleepSpy = internals.sleep as unknown as Mock;
        sleepSpy.mockClear();
        const original = makeMessage("serialized-id");
        internals.univAlertMessages.set("g1", original);
        state.getUnivAlertMessageId.mockReturnValue("serialized-id");

        vi.mocked(api.fetchAlerts).mockResolvedValue({
            alerts: [alert("g1", { languageCode: "E" })],
        });

        await internals.checkAlerts();

        expect(original.edit).toHaveBeenCalledTimes(1);
        expect(sleepSpy).not.toHaveBeenCalled();
    });

    it("survives API errors without hanging the mutex", async () => {
        const { internals } = buildBot();
        vi.mocked(api.fetchAlerts).mockRejectedValue(new Error("boom"));
        await expect(internals.checkAlerts()).resolves.toBeUndefined();
        vi.mocked(api.fetchAlerts).mockResolvedValue(null);
        await expect(internals.checkAlerts()).resolves.toBeUndefined();
        expect(api.fetchAlerts).toHaveBeenCalledTimes(2);
    });
});

describe("JWBot.start", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("resets state when forceResend is passed", async () => {
        const { bot, state } = buildBot();
        // Stop the polling cascade before any real fetch fires.
        vi.mocked(api.fetchLatestVideos).mockResolvedValue(null);
        vi.mocked(api.fetchArticles).mockResolvedValue([]);
        vi.mocked(api.fetchAlerts).mockResolvedValue(null);

        await bot.start({ forceResend: true });

        expect(state.reset).toHaveBeenCalledTimes(1);
    });

    it("establishes a baseline by marking all current content as pushed", async () => {
        const { bot, state } = buildBot();
        vi.mocked(api.fetchLatestVideos).mockResolvedValue({
            category: { key: "k", name: "n", media: [video("v1")] },
        });
        vi.mocked(api.fetchAlerts).mockResolvedValue({ alerts: [alert("a1")] });
        vi.mocked(api.fetchArticles).mockResolvedValue([article("ar1")]);

        await bot.start({ baseline: true });

        expect(state.markPushed).toHaveBeenCalledWith(ContentType.Video, expect.objectContaining({ guid: "v1" }));
        expect(state.markPushed).toHaveBeenCalledWith(ContentType.Alert, expect.objectContaining({ guid: "a1" }));
        expect(state.markPushed).toHaveBeenCalledWith(ContentType.Article, expect.objectContaining({ guid: "ar1" }));
    });

    it("does not reset when forceResend is false", async () => {
        const { bot, state } = buildBot();
        vi.mocked(api.fetchLatestVideos).mockResolvedValue(null);
        vi.mocked(api.fetchArticles).mockResolvedValue([]);
        vi.mocked(api.fetchAlerts).mockResolvedValue(null);

        await bot.start({ forceResend: false });

        expect(state.reset).not.toHaveBeenCalled();
    });

    it("schedules alerts and articles with staggered delays", async () => {
        const { bot } = buildBot();
        vi.mocked(api.fetchLatestVideos).mockResolvedValue(null);
        vi.mocked(api.fetchArticles).mockResolvedValue([]);
        vi.mocked(api.fetchAlerts).mockResolvedValue(null);

        await bot.start();

        // Videos: fired immediately.
        expect(api.fetchLatestVideos).toHaveBeenCalledTimes(1);
        // Articles and alerts are deferred.
        expect(api.fetchArticles).not.toHaveBeenCalled();
        expect(api.fetchAlerts).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(15_000);
        expect(api.fetchArticles).toHaveBeenCalledTimes(1);
        expect(api.fetchAlerts).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(15_000);
        expect(api.fetchAlerts).toHaveBeenCalledTimes(1);
    });
});
