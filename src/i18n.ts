export type Strings = {
    newVideo: string;
    newArticle: string;
    moreInfo: string;
};

const i18n: Record<string, Strings> = {
    nl: {
        newVideo: "Nieuwe video!",
        newArticle: "Nieuw artikel!",
        moreInfo: ">> Meer informatie op jw.org/nl <<",
    },
    en: {
        newVideo: "New video!",
        newArticle: "New article!",
        moreInfo: ">> More information at jw.org/en <<",
    },
};

const fallback: Strings = i18n.en;

export function getStrings(locale: string): Strings {
    return i18n[locale] ?? fallback;
}
