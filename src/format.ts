import type { Video, Alert, Article } from "./types.js";
import type { Strings } from "./i18n.js";

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

// Strips all HTML tags without converting any to WhatsApp syntax.
// Used for alert titles so that <strong> tags don't produce double-bold
// markers when boldBeforePipe is applied afterwards.
function stripHtml(html: string): string {
    return html
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
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

export function formatVideo(video: Video, categoryName: string, strings: Strings, locale: string): string {
    const url = `https://www.jw.org/finder?locale=${locale}&lank=${video.languageAgnosticNaturalKey}`;
    const duration = video.durationFormattedHHMM ? ` (${video.durationFormattedHHMM})` : "";
    return `🎬 _${strings.newVideo}${duration}_\n\n*${categoryName.toLocaleUpperCase(locale)}* | ${video.title}\n\n${url}`;
}

export function formatArticle(article: Article, strings: Strings): string {
    return `📜 _${strings.newArticle}_\n\n${boldBeforePipe(article.title)}\n\n${article.link}`;
}

export function getArticleThumbnail(article: Article): string | undefined {
    return article.imageUrl;
}

export function formatAlert(alert: Alert, strings: Strings): string {
    const title = boldBeforePipe(stripHtml(alert.title));
    const body = htmlToWhatsApp(alert.body);
    return `🔔 ${title}\n\n${body}\n\n_${strings.moreInfo}_`;
}
