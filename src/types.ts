export type ChannelConfig = {
    id: string;
    type: "production" | "development";
    name: string;
    langcode: string;
    locale: string;
    articleFeedUrl: string;
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
