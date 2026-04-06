import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const RUN_DIR = "run";
const STATE_FILE = `${RUN_DIR}/state.json`;

mkdirSync(RUN_DIR, { recursive: true });

const MAX_PUSHED = 500;

export enum ContentType {
    Video = "video",
    Alert = "alert",
    Article = "article",
}

interface StateData {
    pushedVideos: string[];
    pushedAlerts: string[];
    pushedArticles: string[];
    univAlerts: Record<string, string>; // guid -> WhatsApp message ID
}

function emptyState(): StateData {
    return { pushedVideos: [], pushedAlerts: [], pushedArticles: [], univAlerts: {} };
}

function load(): StateData {
    if (!existsSync(STATE_FILE)) {
        return emptyState();
    }
    try {
        return JSON.parse(readFileSync(STATE_FILE, "utf-8")) as StateData;
    } catch {
        return emptyState();
    }
}

function save(state: StateData): void {
    // Keep only the most recent GUIDs per type to prevent unbounded file growth
    if (state.pushedVideos.length > MAX_PUSHED) {
        state.pushedVideos = state.pushedVideos.slice(-MAX_PUSHED);
    }
    if (state.pushedAlerts.length > MAX_PUSHED) {
        state.pushedAlerts = state.pushedAlerts.slice(-MAX_PUSHED);
    }
    if (state.pushedArticles.length > MAX_PUSHED) {
        state.pushedArticles = state.pushedArticles.slice(-MAX_PUSHED);
    }
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export class BotState {
    private pushedVideos: Set<string>;
    private pushedAlerts: Set<string>;
    private pushedArticles: Set<string>;
    private univAlerts: Map<string, string>;

    constructor() {
        const data = load();
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

    hasPushed(type: ContentType, guid: string): boolean {
        return this.setFor(type).has(guid);
    }

    markPushed(type: ContentType, guid: string): void {
        this.setFor(type).add(guid);
        this.persist();
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

    private setFor(type: ContentType): Set<string> {
        switch (type) {
            case ContentType.Video: return this.pushedVideos;
            case ContentType.Alert: return this.pushedAlerts;
            case ContentType.Article: return this.pushedArticles;
        }
    }

    private persist(): void {
        save({
            pushedVideos: [...this.pushedVideos],
            pushedAlerts: [...this.pushedAlerts],
            pushedArticles: [...this.pushedArticles],
            univAlerts: Object.fromEntries(this.univAlerts),
        });
    }
}
