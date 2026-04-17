import { readFileSync } from "node:fs";
import type { ChannelConfig } from "./types.js";

type Config = {
    channels: ChannelConfig[];
};

function load(): Config {
    try {
        return JSON.parse(readFileSync("config.json", "utf-8")) as Config;
    }
    catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            return { channels: [] };
        }
        throw new Error("Failed to parse config.json — make sure it is valid JSON (see config.example.json).", { cause: err });
    }
}

export const { channels } = load();
