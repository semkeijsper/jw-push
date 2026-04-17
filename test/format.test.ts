import { describe, it, expect } from "vitest";
import {
    getVideoUrl,
    getVideoThumbnail,
    getArticleThumbnail,
    formatVideo,
    formatArticle,
    formatAlert,
} from "../src/format.js";
import type { Video, Alert, Article } from "../src/types.js";
import type { Strings } from "../src/i18n.js";

const strings: Strings = {
    newVideo: "New video!",
    newArticle: "New article!",
    moreInfo: ">> More information at jw.org/en <<",
};

function makeVideo(overrides: Partial<Video> = {}): Video {
    return {
        guid: "g",
        naturalKey: "nk",
        languageAgnosticNaturalKey: "lank-1",
        primaryCategory: "LatestVideos",
        title: "A Title",
        ...overrides,
    };
}

describe("getVideoUrl", () => {
    it("builds the jw.org/finder URL from languageAgnosticNaturalKey and locale", () => {
        const url = getVideoUrl(makeVideo({ languageAgnosticNaturalKey: "docid-1" }), "en");
        expect(url).toBe("https://www.jw.org/finder?locale=en&lank=docid-1");
    });

    it("uses the provided locale verbatim", () => {
        const url = getVideoUrl(makeVideo(), "nl");
        expect(url).toContain("locale=nl");
    });
});

describe("getVideoThumbnail", () => {
    it("returns undefined when no images are present", () => {
        expect(getVideoThumbnail(makeVideo())).toBeUndefined();
    });

    it("returns undefined when images object is empty", () => {
        expect(getVideoThumbnail(makeVideo({ images: {} }))).toBeUndefined();
    });

    it("prefers lsr.xl over all other sizes", () => {
        const video = makeVideo({
            images: {
                lsr: { xl: "LSR_XL", lg: "LSR_LG" },
                lss: { lg: "LSS_LG" },
                wss: { lg: "WSS_LG" },
                sqr: { lg: "SQR_LG" },
            },
        });
        expect(getVideoThumbnail(video)).toBe("LSR_XL");
    });

    it("falls back to lss.lg when lsr.xl is missing", () => {
        const video = makeVideo({
            images: {
                lsr: { lg: "LSR_LG" }, // no xl
                lss: { lg: "LSS_LG" },
                wss: { lg: "WSS_LG" },
            },
        });
        expect(getVideoThumbnail(video)).toBe("LSS_LG");
    });

    it("falls back to wss.lg when lsr.xl and lss.lg are missing", () => {
        const video = makeVideo({
            images: {
                wss: { lg: "WSS_LG" },
                sqr: { lg: "SQR_LG" },
            },
        });
        expect(getVideoThumbnail(video)).toBe("WSS_LG");
    });

    it("falls back to sqr.lg last", () => {
        const video = makeVideo({ images: { sqr: { lg: "SQR_LG" } } });
        expect(getVideoThumbnail(video)).toBe("SQR_LG");
    });
});

describe("formatVideo", () => {
    it("includes duration in parentheses when provided", () => {
        const v = makeVideo({ title: "Talk", durationFormattedHHMM: "12:34" });
        const out = formatVideo(v, "latest", strings, "en");
        expect(out).toContain("(12:34)");
        expect(out).toContain("New video!");
    });

    it("omits duration parentheses when absent", () => {
        const v = makeVideo({ title: "Talk" });
        const out = formatVideo(v, "latest", strings, "en");
        expect(out).not.toContain("()");
        expect(out).not.toContain("( )");
    });

    it("uppercases the category name using the locale", () => {
        const v = makeVideo({ title: "Talk" });
        // Turkish 'i' uppercases to 'İ' under the tr locale — proves toLocaleUpperCase uses the locale.
        const out = formatVideo(v, "istanbul", strings, "tr");
        expect(out).toContain("İSTANBUL");
    });

    it("embeds the canonical video URL", () => {
        const v = makeVideo({ languageAgnosticNaturalKey: "pub-42" });
        const out = formatVideo(v, "cat", strings, "en");
        expect(out).toContain("https://www.jw.org/finder?locale=en&lank=pub-42");
    });
});

describe("formatArticle", () => {
    const article: Article = {
        guid: "g",
        title: "Section | Headline",
        link: "https://www.jw.org/en/some-article",
    };

    it("bolds the section before the pipe and keeps the rest plain", () => {
        const out = formatArticle(article, strings);
        expect(out).toContain("*Section* | Headline");
    });

    it("bolds the whole title when there is no pipe", () => {
        const out = formatArticle({ ...article, title: "No Pipe Here" }, strings);
        expect(out).toContain("*No Pipe Here*");
    });

    it("includes the article link", () => {
        const out = formatArticle(article, strings);
        expect(out).toContain(article.link);
    });

    it("starts with the article emoji and i18n label", () => {
        const out = formatArticle(article, strings);
        expect(out.startsWith("📜 _New article!_")).toBe(true);
    });
});

describe("getArticleThumbnail", () => {
    it("returns the imageUrl when set", () => {
        expect(getArticleThumbnail({
            guid: "g", title: "t", link: "l", imageUrl: "https://img/x.jpg",
        })).toBe("https://img/x.jpg");
    });

    it("returns undefined when imageUrl is not set", () => {
        expect(getArticleThumbnail({ guid: "g", title: "t", link: "l" })).toBeUndefined();
    });
});

describe("formatAlert", () => {
    it("bolds the part of the title before a pipe", () => {
        const alert: Alert = {
            guid: "g",
            languageCode: "E",
            title: "Region | Incident",
            body: "A short note.",
            type: "news",
        };
        const out = formatAlert(alert, strings);
        expect(out).toContain("*Region* | Incident");
    });

    it("strips HTML tags from the title without converting to WhatsApp markup", () => {
        const alert: Alert = {
            guid: "g",
            languageCode: "E",
            title: "<strong>Bold</strong> | Rest",
            body: "body",
            type: "news",
        };
        const out = formatAlert(alert, strings);
        // The <strong> in the title must NOT become **Bold**; only the
        // boldBeforePipe pass should add markers.
        expect(out).toContain("*Bold* | Rest");
        expect(out).not.toContain("**Bold**");
    });

    it("converts <strong> in the body to *bold*", () => {
        const alert: Alert = {
            guid: "g", languageCode: "E", title: "t", body: "Say <strong>hello</strong>.", type: "news",
        };
        const out = formatAlert(alert, strings);
        expect(out).toContain("Say *hello*.");
    });

    it("converts <em> in the body to _italic_", () => {
        const alert: Alert = {
            guid: "g", languageCode: "E", title: "t", body: "<em>note</em>", type: "news",
        };
        const out = formatAlert(alert, strings);
        expect(out).toContain("_note_");
    });

    it("converts <br> to newlines", () => {
        const alert: Alert = {
            guid: "g", languageCode: "E", title: "t", body: "a<br/>b<br>c", type: "news",
        };
        const out = formatAlert(alert, strings);
        expect(out).toContain("a\nb\nc");
    });

    it("decodes HTML entities in the body", () => {
        const alert: Alert = {
            guid: "g",
            languageCode: "E",
            title: "t",
            body: "Visit the&nbsp;branch office &amp; read more at jw.org &lt;section&gt;",
            type: "news",
        };
        const out = formatAlert(alert, strings);
        expect(out).toContain("Visit the branch office & read more at jw.org <section>");
    });

    it("collapses 3+ consecutive newlines into exactly 2", () => {
        const alert: Alert = {
            guid: "g", languageCode: "E", title: "t", body: "a<br/><br/><br/><br/>b", type: "news",
        };
        const out = formatAlert(alert, strings);
        // The body portion only has one blank line (two newlines) between a and b.
        expect(out).toMatch(/a\n\nb/);
        expect(out).not.toMatch(/a\n\n\nb/);
    });

    it("appends the localized 'more info' footer", () => {
        const alert: Alert = {
            guid: "g", languageCode: "E", title: "t", body: "body", type: "news",
        };
        const out = formatAlert(alert, strings);
        expect(out.endsWith(`_${strings.moreInfo}_`)).toBe(true);
    });

    it("starts with the bell emoji", () => {
        const alert: Alert = {
            guid: "g", languageCode: "E", title: "t", body: "body", type: "news",
        };
        expect(formatAlert(alert, strings).startsWith("🔔 ")).toBe(true);
    });
});
