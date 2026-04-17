import { describe, it, expect } from "vitest";
import { getStrings } from "../src/i18n.js";

describe("getStrings", () => {
    it("returns English strings for 'en' locale", () => {
        const strings = getStrings("en");
        expect(strings).toEqual({
            newVideo: "New video!",
            newArticle: "New article!",
            moreInfo: ">> More information at jw.org/en <<",
        });
    });

    it("returns Dutch strings for 'nl' locale", () => {
        const strings = getStrings("nl");
        expect(strings).toEqual({
            newVideo: "Nieuwe video!",
            newArticle: "Nieuw artikel!",
            moreInfo: ">> Meer informatie op jw.org/nl <<",
        });
    });

    it("falls back to English for an unknown locale", () => {
        const strings = getStrings("xx");
        expect(strings.newVideo).toBe("New video!");
    });

    it("falls back to English for an empty locale", () => {
        const strings = getStrings("");
        expect(strings.newVideo).toBe("New video!");
    });

    it("is case sensitive — 'EN' does not match 'en'", () => {
        const strings = getStrings("EN");
        // 'EN' is not a registered locale, so fallback (English) is returned.
        expect(strings.newVideo).toBe("New video!");
    });
});
