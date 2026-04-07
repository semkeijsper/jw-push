import { readFileSync } from "node:fs";
import type { ChannelConfig } from "./types.js";

type Config = {
    channels: ChannelConfig[];
};

function load(): Config {
    try {
        return JSON.parse(readFileSync("config.json", "utf-8")) as Config;
    }
    catch {
        throw new Error("Failed to load config.json — make sure it exists and is valid JSON (see config.example.json).");
    }
}

export const { channels } = load();
