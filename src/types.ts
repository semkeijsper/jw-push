type ImageSizes = Partial<Record<"xl" | "lg" | "md" | "sm" | "xs", string>>;

export interface Images {
    lss?: ImageSizes; // landscape standard
    lsr?: ImageSizes; // landscape retina (largest)
    pnr?: ImageSizes; // portrait narrow
    wss?: ImageSizes; // widescreen standard
    sqr?: ImageSizes; // square
}

export interface Video {
    guid: string;
    naturalKey: string;
    languageAgnosticNaturalKey: string;
    primaryCategory: string;
    title: string;
    description?: string;
    firstPublished?: string;
    durationFormattedHHMM?: string;
    images?: Images;
}

export interface Category {
    key: string;
    name: string;
    media?: Video[];
}

export interface LatestVideosResponse {
    category: Category;
}

export interface Alert {
    guid: string;
    languageCode: string;
    title: string;
    body: string;
    type: string;
}

export interface Article {
    guid: string;
    title: string;
    link: string;
}

export interface AlertsInfoResponse {
    alerts: Alert[];
}

export interface CategoryInfoResponse {
    category: Category;
}
