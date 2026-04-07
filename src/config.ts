export const config = {
    channelId: process.env.CHANNEL_ID ?? "123456789123456789@newsletter",
    language: process.env.LANGUAGE ?? "E",
    locale: process.env.LOCALE ?? "en",
    articleFeedUrl: process.env.ARTICLE_FEED_URL ?? "https://www.jw.org/en/whats-new/rss/WhatsNewWebArticles/feed.xml",
};
