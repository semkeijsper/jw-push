import type { Video, Alert, Article } from "./types.js";

function htmlToWhatsApp(html: string): string {
    return html
        .replace(/<strong>(.*?)<\/strong>/gis, "*$1*")
        .replace(/<em>(.*?)<\/em>/gis, "_$1_")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

export function getVideoThumbnail(video: Video): string | undefined {
    const { lsr, lss, wss, sqr } = video.images ?? {};
    return lsr?.xl ?? lss?.lg ?? wss?.lg ?? sqr?.lg;
}

export function formatVideo(video: Video, categoryName: string): string {
    const url = `https://www.jw.org/finder?locale=nl&lank=${video.languageAgnosticNaturalKey}`;
    const duration = video.durationFormattedHHMM ? ` (${video.durationFormattedHHMM})` : "";
    return `*${categoryName.toLocaleUpperCase()} | ${video.title}*${duration}\n${url}`;
}

export function formatArticle(article: Article): string {
    return `*${article.title}*\n${article.link}`;
}

export function formatAlert(alert: Alert): string {
    const title = htmlToWhatsApp(alert.title);
    const body = htmlToWhatsApp(alert.body);
    return `*${title}*\n\n${body}`;
}
