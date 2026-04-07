import Whatsapp from "whatsapp-web.js";
import type { Client, Message } from "whatsapp-web.js";
import { fetchLatestVideos, fetchAlerts, fetchArticles, fetchCategoryName } from "./api.js";
import { BotState } from "./state.js";
import { ContentType, type Alert, type Video, type ChannelConfig } from "./types.js";
import { type Strings } from "./i18n.js";
import { formatVideo, formatAlert, formatArticle, getVideoThumbnail } from "./format.js";

const { MessageMedia } = Whatsapp;

export class JWBot {
    private state: BotState;
    private categoryCache = new Map<string, string>();
    private univAlertMessages = new Map<string, Message>(); // in-memory guid -> Message

    constructor(
        private client: Client,
        private channel: ChannelConfig,
        private strings: Strings,
    ) {
        this.state = new BotState(channel.id);
    }

    private async send(text: string): Promise<Message> {
        return await this.client.sendMessage(this.channel.id, text, { sendSeen: false });
    }

    private async sendWithImage(imageUrl: string, caption: string): Promise<Message> {
        const media = await MessageMedia.fromUrl(imageUrl, { unsafeMime: true });
        return await this.client.sendMessage(this.channel.id, media, { caption, sendSeen: false });
    }

    async start(options?: { forceResend?: boolean; baseline?: boolean }): Promise<void> {
        if (options?.forceResend) {
            this.state.reset();
            console.log(`[${this.channel.id}] --force: resending all current content.`);
        }
        else if (options?.baseline) {
            await this.establishBaseline();
        }
        else if (!this.state.isEmpty()) {
            console.log(`[${this.channel.id}] Resuming from saved state.`);
        }

        // Check videos immediately, then every minute
        void this.checkVideos();
        setInterval(() => void this.checkVideos(), 60_000);

        // Check articles every minute, but after 15 seconds
        setTimeout(() => {
            void this.checkArticles();
            setInterval(() => void this.checkArticles(), 60_000);
        }, 15_000);

        // Check alerts every minute, but after 30 seconds
        setTimeout(() => {
            void this.checkAlerts();
            setInterval(() => void this.checkAlerts(), 60_000);
        }, 30_000);

        console.log(`[${this.channel.id}] Polling started.`);
    }

    private async establishBaseline(): Promise<void> {
        console.log(`[${this.channel.id}] First run: establishing baseline...`);

        const [videoData, alertData, articles] = await Promise.all([
            fetchLatestVideos(this.channel.language),
            fetchAlerts(this.channel.language),
            fetchArticles(this.channel.articleFeedUrl),
        ]);

        if (videoData?.category?.media) {
            for (const video of videoData.category.media) {
                this.state.markPushed(ContentType.Video, video);
            }
        }

        if (alertData?.alerts) {
            for (const alert of alertData.alerts) {
                this.state.markPushed(ContentType.Alert, alert);
            }
        }

        for (const article of articles) {
            this.state.markPushed(ContentType.Article, article);
        }

        console.log(`[${this.channel.id}] Baseline established. Starting polls...`);
    }

    private async sendVideo(video: Video, categoryName: string): Promise<void> {
        const caption = formatVideo(video, categoryName, this.strings, this.channel.locale);
        const thumbnailUrl = getVideoThumbnail(video);
        if (thumbnailUrl) {
            try {
                await this.sendWithImage(thumbnailUrl, caption);
                return;
            }
            catch { /* fall through to text-only */ }
        }
        await this.send(caption);
    }

    private async checkVideos(): Promise<void> {
        try {
            const data = await fetchLatestVideos(this.channel.language);
            if (!data?.category?.media) {
                return;
            }

            for (const video of [...data.category.media].reverse()) {
                if (this.state.hasPushed(ContentType.Video, video)) {
                    continue;
                }

                const categoryName = await this.getCategoryName(video.primaryCategory);
                await this.sendVideo(video, categoryName);
                this.state.markPushed(ContentType.Video, video);
                console.log(`[${this.channel.id}] Sent video: ${video.title}`);
            }
        }
        catch (e) {
            console.error(`[${this.channel.id}] Error in checkVideos:`, e);
        }
    }

    private async handleAlert(alert: Alert): Promise<void> {
        const existingMsgId = this.state.getUnivAlertMessageId(alert.guid);

        if (existingMsgId && alert.languageCode !== "univ") {
            // This is the localized version of a previously sent "univ" alert
            const oldMessage = this.univAlertMessages.get(alert.guid);
            const edited = oldMessage !== undefined
                && await oldMessage.edit(formatAlert(alert, this.strings)).catch(() => null) !== null;

            if (!edited) {
                // Edit window expired or message not in memory — delete and resend
                if (oldMessage !== undefined) {
                    await oldMessage.delete(true).catch(() => null);
                }
                await this.send(formatAlert(alert, this.strings));
            }
            this.univAlertMessages.delete(alert.guid);
            this.state.deleteUnivAlert(alert.guid);
            console.log(`[${this.channel.id}] Updated alert ${alert.guid} (${edited ? "edited" : "replaced"})`);
            return;
        }

        if (!this.state.hasPushed(ContentType.Alert, alert)) {
            const msg = await this.send(formatAlert(alert, this.strings));
            this.state.markPushed(ContentType.Alert, alert);

            if (alert.languageCode === "univ") {
                this.univAlertMessages.set(alert.guid, msg);
                this.state.setUnivAlert(alert.guid, msg.id._serialized);
            }

            console.log(`[${this.channel.id}] Sent alert ${alert.guid} (lang: ${alert.languageCode})`);
        }
    }

    private async checkAlerts(): Promise<void> {
        try {
            const data = await fetchAlerts(this.channel.language);
            if (!data?.alerts) {
                return;
            }

            for (const alert of [...data.alerts].reverse()) {
                await this.handleAlert(alert);
            }
        }
        catch (e) {
            console.error(`[${this.channel.id}] Error in checkAlerts:`, e);
        }
    }

    private async checkArticles(): Promise<void> {
        try {
            const articles = await fetchArticles(this.channel.articleFeedUrl);
            for (const article of [...articles].reverse()) {
                if (this.state.hasPushed(ContentType.Article, article)) {
                    continue;
                }
                await this.send(formatArticle(article, this.strings));
                this.state.markPushed(ContentType.Article, article);
                console.log(`[${this.channel.id}] Sent article: ${article.title}`);
            }
        }
        catch (e) {
            console.error(`[${this.channel.id}] Error in checkArticles:`, e);
        }
    }

    private async getCategoryName(key: string): Promise<string> {
        const cached = this.categoryCache.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const name = await fetchCategoryName(key, this.channel.language);
        this.categoryCache.set(key, name);
        return name;
    }
}
