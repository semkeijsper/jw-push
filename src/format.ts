import type { Video, Alert, Article } from "./types.js";
import { config } from "./config.js";

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

function boldBeforePipe(text: string): string {
    const match = /^([^|]+?)\s*\|\s*(.+)$/.exec(text);
    return match !== null ? `*${match[1]}* | ${match[2]}` : `*${text}*`;
}

export function getVideoThumbnail(video: Video): string | undefined {
    const { lsr, lss, wss, sqr } = video.images ?? {};
    return lsr?.xl ?? lss?.lg ?? wss?.lg ?? sqr?.lg;
}

export function formatVideo(video: Video, categoryName: string): string {
    const url = `https://www.jw.org/finder?locale=${config.locale}&lank=${video.languageAgnosticNaturalKey}`;
    const duration = video.durationFormattedHHMM ? ` (${video.durationFormattedHHMM})` : "";
    return `🎬 _Nieuwe video!${duration}_\n\n*${categoryName.toLocaleUpperCase()}* | ${video.title}\n\n${url}`;
}

export function formatArticle(article: Article): string {
    return `📜 _Nieuw artikel!_\n\n${boldBeforePipe(article.title)}\n\n${article.link}`;
}

export function formatAlert(alert: Alert): string {
    const title = htmlToWhatsApp(alert.title);
    const body = htmlToWhatsApp(alert.body);
    const footer = `_>> Meer informatie op jw.org/${config.locale} <<_`;
    return `🔔 ${boldBeforePipe(title)}\n\n${body}\n\n${footer}`;
}
