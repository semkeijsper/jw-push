export type ChannelConfig = {
    id: string;
    type: "production" | "development";
    name: string;
    langcode: string;
    locale: string;
    articleFeedUrl: string;
};

// Pins the WhatsApp Web build the bundled browser boots. whatsapp-web.js
// intercepts the page load of web.whatsapp.com and answers it with a stored
// index.html, so the browser pulls that build's JS chunks instead of today's.
// Note that WhatsApp expires a build roughly two months after its release.
export type WebVersionConfig = {
    version: string;
    cache: { type: "none" } | { type: "local"; path?: string } | { type: "remote"; remotePath: string };
};

export type CategoryInfoResponse = {
    category: Category;
};

export type LatestVideosResponse = {
    category: Category;
};

export type Category = {
    key: string;
    name: string;
    media?: Video[];
};

export type Video = {
    guid: string;
    naturalKey: string;
    languageAgnosticNaturalKey: string;
    primaryCategory: string;
    title: string;
    description?: string;
    firstPublished?: string;
    durationFormattedHHMM?: string;
    images?: Images;
};

type ImageSizes = Partial<Record<"xl" | "lg" | "md" | "sm" | "xs", string>>;

export type Images = {
    lss?: ImageSizes; // landscape standard
    lsr?: ImageSizes; // landscape retina (largest)
    pnr?: ImageSizes; // portrait narrow
    wss?: ImageSizes; // widescreen standard
    sqr?: ImageSizes; // square
};

export type AlertsInfoResponse = {
    alerts: Alert[];
    pagination: {
        totalCount: number;
        offset: number;
        limit: number;
    };
};

export type Alert = {
    guid: string;
    languageCode: string;
    title: string;
    body: string;
    type: string;
};

export type Article = {
    guid: string;
    title: string;
    link: string;
    imageUrl?: string;
};

export enum ContentType {
    Video = "video",
    Alert = "alert",
    Article = "article",
}

export type ContentTypeMap = {
    [ContentType.Video]: Video;
    [ContentType.Alert]: Alert;
    [ContentType.Article]: Article;
};
