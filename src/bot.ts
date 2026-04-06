import Whatsapp from "whatsapp-web.js";
import type { Client, Message } from "whatsapp-web.js";
import { config } from "./config.js";
import { fetchLatestVideos, fetchAlerts, fetchArticles, fetchCategoryName } from "./api.js";
import { BotState, ContentType } from "./state.js";
import { formatVideo, formatAlert, formatArticle, getVideoThumbnail } from "./format.js";

const { MessageMedia } = Whatsapp;

export class JWBot {
    private state: BotState;
    private categoryCache = new Map<string, string>();
    private univAlertMessages = new Map<string, Message>(); // in-memory guid -> Message

    constructor(private client: Client) {
        this.state = new BotState();
    }

    private async send(text: string): Promise<Message> {
        return await this.client.sendMessage(config.channelId, text, { sendSeen: false });
    }

    private async sendWithImage(imageUrl: string, caption: string): Promise<Message> {
        const media = await MessageMedia.fromUrl(imageUrl, { unsafeMime: true });
        return await this.client.sendMessage(config.channelId, media, { caption, sendSeen: false });
    }

    async start(options?: { skipBaseline?: boolean }): Promise<void> {
        if (options?.skipBaseline) {
            console.log("--force: skipping baseline, will send current content.");
        } else if (this.state.isEmpty()) {
            await this.establishBaseline();
        } else {
            console.log("Resuming from saved state.");
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

        console.log("Polling started.");
    }

    private async establishBaseline(): Promise<void> {
        console.log("First run: establishing baseline...");

        const [videoData, alertData, articles] = await Promise.all([
            fetchLatestVideos(),
            fetchAlerts(),
            fetchArticles(),
        ]);

        if (videoData?.category?.media) {
            for (const video of videoData.category.media) {
                this.state.markPushed(ContentType.Video, video.guid);
            }
        }

        if (alertData?.alerts) {
            for (const alert of alertData.alerts) {
                this.state.markPushed(ContentType.Alert, alert.guid);
            }
        }

        for (const article of articles) {
            this.state.markPushed(ContentType.Article, article.guid);
        }

        console.log("Baseline established. Starting polls...");
    }

    private async checkVideos(): Promise<void> {
        try {
            const data = await fetchLatestVideos();
            if (!data?.category?.media) {
                return;
            }

            for (const video of [...data.category.media].reverse()) {
                if (this.state.hasPushed(ContentType.Video, video.guid)) {
                    continue;
                }

                const categoryName = await this.getCategoryName(video.primaryCategory);
                const caption = formatVideo(video, categoryName);
                const thumbnailUrl = getVideoThumbnail(video);
                if (thumbnailUrl) {
                    try {
                        await this.sendWithImage(thumbnailUrl, caption);
                    } catch {
                        await this.send(caption);
                    }
                } else {
                    await this.send(caption);
                }
                this.state.markPushed(ContentType.Video, video.guid);
                console.log(`Sent video: ${video.title}`);
            }
        } catch (e) {
            console.error("Error in checkVideos:", e);
        }
    }

    private async checkAlerts(): Promise<void> {
        try {
            const data = await fetchAlerts();
            if (!data?.alerts) {
                return;
            }

            for (const alert of [...data.alerts].reverse()) {
                const existingMsgId = this.state.getUnivAlertMessageId(alert.guid);

                if (existingMsgId && alert.languageCode !== "univ") {
                    // This is the localized version of a previously sent "univ" alert
                    const oldMessage = this.univAlertMessages.get(alert.guid);
                    const edited = oldMessage !== undefined
                        && await oldMessage.edit(formatAlert(alert)).catch(() => null) !== null;

                    if (!edited) {
                        // Edit window expired or message not in memory — delete and resend
                        if (oldMessage !== undefined) {
                            await oldMessage.delete(true).catch(() => null);
                        }
                        await this.send(formatAlert(alert));
                    }
                    this.univAlertMessages.delete(alert.guid);
                    this.state.deleteUnivAlert(alert.guid);
                    console.log(`Updated alert ${alert.guid} (${edited ? "edited" : "replaced"})`);
                    continue;
                }

                if (!this.state.hasPushed(ContentType.Alert, alert.guid)) {
                    const msg = await this.send(formatAlert(alert));
                    this.state.markPushed(ContentType.Alert, alert.guid);

                    if (alert.languageCode === "univ") {
                        this.univAlertMessages.set(alert.guid, msg);
                        this.state.setUnivAlert(alert.guid, msg.id._serialized);
                    }

                    console.log(`Sent alert ${alert.guid} (lang: ${alert.languageCode})`);
                }
            }
        } catch (e) {
            console.error("Error in checkAlerts:", e);
        }
    }

    private async checkArticles(): Promise<void> {
        try {
            const articles = await fetchArticles();
            for (const article of [...articles].reverse()) {
                if (this.state.hasPushed(ContentType.Article, article.guid)) {
                    continue;
                }
                await this.send(formatArticle(article));
                this.state.markPushed(ContentType.Article, article.guid);
                console.log(`Sent article: ${article.title}`);
            }
        } catch (e) {
            console.error("Error in checkArticles:", e);
        }
    }

    private async getCategoryName(key: string): Promise<string> {
        if (this.categoryCache.has(key)) {
            return this.categoryCache.get(key)!;
        }
        const name = await fetchCategoryName(key);
        this.categoryCache.set(key, name);
        return name;
    }
}
