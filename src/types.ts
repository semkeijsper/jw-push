type ImageSizes = Partial<Record<"xl" | "lg" | "md" | "sm" | "xs", string>>;

export type Images = {
    lss?: ImageSizes; // landscape standard
    lsr?: ImageSizes; // landscape retina (largest)
    pnr?: ImageSizes; // portrait narrow
    wss?: ImageSizes; // widescreen standard
    sqr?: ImageSizes; // square
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

export type Category = {
    key: string;
    name: string;
    media?: Video[];
};

export type LatestVideosResponse = {
    category: Category;
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
};

export type AlertsInfoResponse = {
    alerts: Alert[];
};

export type CategoryInfoResponse = {
    category: Category;
};
