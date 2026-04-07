import Parser from "rss-parser";
import type { LatestVideosResponse, AlertsInfoResponse, CategoryInfoResponse, Article } from "./types.js";

const BASE_URL = "https://data.jw-api.org";
const CDN_URL = "https://b.jw-cdn.org";
const rssParser = new Parser();

async function fetchWithRetry(url: string, options?: RequestInit, maxRetries = 5): Promise<string> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(url, options);
            if (res.status === 503 && attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 500));
                continue;
            }
            if (!res.ok) {
                return "";
            }
            return await res.text();
        }
        catch {
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 500));
                continue;
            }
            return "";
        }
    }
    return "";
}

async function fetchJwt(): Promise<string> {
    const text = await fetchWithRetry(`${CDN_URL}/tokens/jworg.jwt`);
    return text.trim();
}

export async function fetchLatestVideos(language: string): Promise<LatestVideosResponse | null> {
    const url = `${BASE_URL}/mediator/v1/categories/${language}/LatestVideos?detailed=1&clientType=www`;
    const text = await fetchWithRetry(url);
    if (!text) {
        return null;
    }
    return JSON.parse(text) as LatestVideosResponse;
}

export async function fetchAlerts(language: string): Promise<AlertsInfoResponse | null> {
    const token = await fetchJwt();
    const url = `${BASE_URL}/alerts/list?type=news&lang=${language}`;
    const text = await fetchWithRetry(url, {
        headers: { "Authorization": `Bearer ${token}` },
    });
    if (!text) {
        return null;
    }
    return JSON.parse(text) as AlertsInfoResponse;
}

export async function fetchArticles(feedUrl: string): Promise<Article[]> {
    try {
        const feed = await rssParser.parseURL(feedUrl);
        return feed.items
            .filter(item => item.guid && item.title && item.link)
            .map(item => ({
                guid: item.guid!,
                title: item.title!,
                link: item.link!,
            }));
    }
    catch {
        return [];
    }
}

export async function fetchCategoryName(categoryKey: string, language: string): Promise<string> {
    const url = `${BASE_URL}/mediator/v1/categories/${language}/${categoryKey}?limit=1`;
    const text = await fetchWithRetry(url);
    if (!text) {
        return categoryKey;
    }
    const data = JSON.parse(text) as CategoryInfoResponse;
    return data.category?.name ?? categoryKey;
}
