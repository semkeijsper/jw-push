import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { ContentType, type ContentTypeMap, type Article } from "./types.js";

export { ContentType };

type StateData = {
    pushedVideos: string[];
    pushedAlerts: string[];
    pushedArticles: string[];
    univAlerts: Record<string, string>; // guid -> WhatsApp message ID
}

export class BotState {
    private static readonly RUN_DIR = "run";
    private static readonly MAX_PUSHED = 500;

    private readonly stateFile: string;
    private pushedVideos: Set<string>;
    private pushedAlerts: Set<string>;
    private pushedArticles: Set<string>;
    private univAlerts: Map<string, string>;

    constructor(channelId: string) {
        this.stateFile = `${BotState.RUN_DIR}/${channelId}.json`;
        mkdirSync(BotState.RUN_DIR, { recursive: true });
        
        const data = BotState.load(this.stateFile);
        this.pushedVideos = new Set(data.pushedVideos);
        this.pushedAlerts = new Set(data.pushedAlerts);
        this.pushedArticles = new Set(data.pushedArticles);
        this.univAlerts = new Map(Object.entries(data.univAlerts));
    }

    isEmpty(): boolean {
        return this.pushedVideos.size === 0
            && this.pushedAlerts.size === 0
            && this.pushedArticles.size === 0;
    }

    hasPushed<T extends ContentType>(type: T, item: ContentTypeMap[T]): boolean {
        return this.setFor(type).has(this.itemKey(type, item));
    }

    markPushed<T extends ContentType>(type: T, item: ContentTypeMap[T]): void {
        this.setFor(type).add(this.itemKey(type, item));
        this.persist();
    }

    // Articles are deduplicated by link because the same article can be
    // re-published in the RSS feed with a different GUID.
    private itemKey<T extends ContentType>(type: T, item: ContentTypeMap[T]): string {
        if (type === ContentType.Article) {
            return (item as Article).link;
        }
        return item.guid;
    }

    getUnivAlertMessageId(guid: string): string | undefined {
        return this.univAlerts.get(guid);
    }

    setUnivAlert(guid: string, messageId: string): void {
        this.univAlerts.set(guid, messageId);
        this.persist();
    }

    deleteUnivAlert(guid: string): void {
        this.univAlerts.delete(guid);
        this.persist();
    }

    reset(): void {
        this.pushedVideos.clear();
        this.pushedAlerts.clear();
        this.pushedArticles.clear();
        this.univAlerts.clear();
    }

    private setFor(type: ContentType): Set<string> {
        switch (type) {
            case ContentType.Video: return this.pushedVideos;
            case ContentType.Alert: return this.pushedAlerts;
            case ContentType.Article: return this.pushedArticles;
        }
    }

    private persist(): void {
        BotState.save(this.stateFile, {
            pushedVideos: [...this.pushedVideos],
            pushedAlerts: [...this.pushedAlerts],
            pushedArticles: [...this.pushedArticles],
            univAlerts: Object.fromEntries(this.univAlerts),
        });
    }

    private static emptyState(): StateData {
        return { pushedVideos: [], pushedAlerts: [], pushedArticles: [], univAlerts: {} };
    }

    private static load(stateFile: string): StateData {
        if (!existsSync(stateFile)) {
            return BotState.emptyState();
        }
        try {
            return JSON.parse(readFileSync(stateFile, "utf-8")) as StateData;
        }
        catch {
            return BotState.emptyState();
        }
    }

    private static save(stateFile: string, state: StateData): void {
        // Keep only the most recent GUIDs per type to prevent unbounded file growth
        const trimmed: StateData = {
            pushedVideos: state.pushedVideos.slice(-BotState.MAX_PUSHED),
            pushedAlerts: state.pushedAlerts.slice(-BotState.MAX_PUSHED),
            pushedArticles: state.pushedArticles.slice(-BotState.MAX_PUSHED),
            univAlerts: state.univAlerts,
        };
        writeFileSync(stateFile, JSON.stringify(trimmed, null, 2));
    }
}
