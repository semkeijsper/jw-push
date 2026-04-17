import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Stub for rss-parser — the class itself is a default export with a parseURL method.
const parseURL = vi.fn();
vi.mock("rss-parser", () => ({
    default: class {
        parseURL = parseURL;
    },
}));

// Import after mocks are set up.
const { fetchLatestVideos, fetchAlerts, fetchArticles, fetchCategoryName } = await import("./api.js");

function mockFetchOnce(body: string, init: { status?: number; ok?: boolean } = {}): void {
    const status = init.status ?? 200;
    const ok = init.ok ?? (status >= 200 && status < 300);
    vi.mocked(fetch).mockResolvedValueOnce({
        ok,
        status,
        text: () => Promise.resolve(body),
    } as Response);
}

describe("api module", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn());
        // Replace real timers so that retry backoff doesn't stall the suite.
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        parseURL.mockReset();
    });

    describe("fetchLatestVideos", () => {
        it("returns the parsed JSON payload on success", async () => {
            mockFetchOnce(JSON.stringify({ category: { key: "LatestVideos", name: "Latest" } }));
            const data = await fetchLatestVideos("E");
            expect(data?.category.name).toBe("Latest");
        });

        it("calls the mediator URL with the given language code", async () => {
            mockFetchOnce(JSON.stringify({ category: { key: "k", name: "n" } }));
            await fetchLatestVideos("O");
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining("/categories/O/LatestVideos"),
                undefined,
            );
        });

        it("returns null when the request consistently fails", async () => {
            vi.mocked(fetch).mockRejectedValue(new Error("network down"));
            const data = await fetchLatestVideos("E");
            expect(data).toBeNull();
            // Initial attempt + 5 retries = 6 total.
            expect(fetch).toHaveBeenCalledTimes(6);
        });

        it("returns null when the server responds with a non-OK status", async () => {
            mockFetchOnce("", { status: 500, ok: false });
            const data = await fetchLatestVideos("E");
            expect(data).toBeNull();
        });

        it("retries on 503 until success", async () => {
            mockFetchOnce("", { status: 503, ok: false });
            mockFetchOnce("", { status: 503, ok: false });
            mockFetchOnce(JSON.stringify({ category: { key: "k", name: "ok" } }));
            const data = await fetchLatestVideos("E");
            expect(data?.category.name).toBe("ok");
            expect(fetch).toHaveBeenCalledTimes(3);
        });
    });

    describe("fetchAlerts", () => {
        it("fetches a JWT first and includes it as a Bearer header", async () => {
            mockFetchOnce("my-token\n");
            mockFetchOnce(JSON.stringify({ alerts: [] }));
            await fetchAlerts("E");

            expect(fetch).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining("/tokens/jworg.jwt"),
                undefined,
            );
            expect(fetch).toHaveBeenNthCalledWith(
                2,
                expect.stringContaining("/alerts/list?type=news&lang=E"),
                { headers: { Authorization: "Bearer my-token" } },
            );
        });

        it("returns the parsed alerts payload", async () => {
            mockFetchOnce("tok");
            mockFetchOnce(JSON.stringify({ alerts: [{ guid: "g", languageCode: "E", title: "t", body: "b", type: "news" }] }));
            const data = await fetchAlerts("E");
            expect(data?.alerts[0].guid).toBe("g");
        });

        it("returns null when the alerts endpoint fails", async () => {
            mockFetchOnce("tok");
            mockFetchOnce("", { status: 500, ok: false });
            const data = await fetchAlerts("E");
            expect(data).toBeNull();
        });
    });

    describe("fetchCategoryName", () => {
        it("returns the resolved category name on success", async () => {
            mockFetchOnce(JSON.stringify({ category: { key: "Morning", name: "Morning Worship" } }));
            const name = await fetchCategoryName("Morning", "E");
            expect(name).toBe("Morning Worship");
        });

        it("falls back to the category key when the response has no name", async () => {
            mockFetchOnce(JSON.stringify({ category: { key: "X" } }));
            const name = await fetchCategoryName("SomeKey", "E");
            expect(name).toBe("SomeKey");
        });

        it("falls back to the category key when the request fails", async () => {
            mockFetchOnce("", { status: 500, ok: false });
            const name = await fetchCategoryName("FallbackKey", "E");
            expect(name).toBe("FallbackKey");
        });

        it("requests the per-language category endpoint", async () => {
            mockFetchOnce(JSON.stringify({ category: { key: "k", name: "n" } }));
            await fetchCategoryName("SomeKey", "O");
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining("/categories/O/SomeKey?limit=1"),
                undefined,
            );
        });
    });

    describe("fetchArticles", () => {
        it("maps RSS items to Article objects", async () => {
            parseURL.mockResolvedValue({
                items: [
                    {
                        guid: "g1",
                        title: "Title 1",
                        link: "https://x/1",
                        content: "<img src=\"https://img/sqs_sm.jpg\"/> hello",
                    },
                ],
            });
            const articles = await fetchArticles("https://feed");
            expect(articles).toEqual([
                {
                    guid: "g1",
                    title: "Title 1",
                    link: "https://x/1",
                    imageUrl: "https://img/lsr_xl.jpg",
                },
            ]);
        });

        it("returns an empty array when the parser throws", async () => {
            parseURL.mockRejectedValue(new Error("bad feed"));
            const articles = await fetchArticles("https://feed");
            expect(articles).toEqual([]);
        });

        it("filters out items missing guid, title, or link", async () => {
            parseURL.mockResolvedValue({
                items: [
                    { guid: "g1", title: "ok", link: "https://x/1" },
                    { title: "no-guid", link: "https://x/2" },
                    { guid: "g3", link: "https://x/3" },
                    { guid: "g4", title: "no-link" },
                ],
            });
            const articles = await fetchArticles("https://feed");
            expect(articles).toHaveLength(1);
            expect(articles[0].guid).toBe("g1");
        });

        it("leaves imageUrl undefined when no <img> tag is present in content", async () => {
            parseURL.mockResolvedValue({
                items: [{ guid: "g", title: "t", link: "l", content: "plain text only" }],
            });
            const articles = await fetchArticles("https://feed");
            expect(articles[0].imageUrl).toBeUndefined();
        });

        it("leaves imageUrl undefined when content is missing", async () => {
            parseURL.mockResolvedValue({
                items: [{ guid: "g", title: "t", link: "l" }],
            });
            const articles = await fetchArticles("https://feed");
            expect(articles[0].imageUrl).toBeUndefined();
        });

        it("does not replace substrings when 'sqs_sm' is absent from the image URL", async () => {
            parseURL.mockResolvedValue({
                items: [{ guid: "g", title: "t", link: "l", content: "<img src=\"https://img/other.jpg\"/>" }],
            });
            const articles = await fetchArticles("https://feed");
            expect(articles[0].imageUrl).toBe("https://img/other.jpg");
        });
    });
});
