import Whatsapp from "whatsapp-web.js";
const { Client, LocalAuth } = Whatsapp;
import qrcode from "qrcode-terminal";

import { channels } from "./config.js";
import { getStrings } from "./i18n.js";
import { JWBot } from "./bot.js";

const args = new Set(process.argv);

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: args.has("--linux") ? "/usr/bin/chromium" : undefined,
    },
});

client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
});

const listMode = args.has("--list-channels") || channels.length === 0;
const force = args.has("--force");
const baseline = args.has("--baseline");

client.on("ready", () => {
    console.log("WhatsApp client ready.");

    if (listMode) {
        void listChannels();
        return;
    }

    for (const channel of channels) {
        const strings = getStrings(channel.locale);
        const bot = new JWBot(client, channel, strings);
        void bot.start({
            forceResend: force && channel.type === "development",
            baseline,
        });
    }
});

async function listChannels(): Promise<void> {
    if (channels.length === 0 && !args.has("--list-channels")) {
        console.log("No channels configured in config.json — listing all visible WhatsApp Channels.\n");
    }

    const found = await client.getChannels();

    if (found.length === 0) {
        console.log("No WhatsApp Channels found for this account.");
    }
    else {
        console.log(`Found ${found.length} channel(s):\n`);
        for (const ch of found) {
            console.log(`  ${ch.name}`);
            console.log(`  ${ch.id._serialized}\n`);
        }
        console.log("Copy the desired channel ID into config.json.");
    }

    process.exit(0);
}

await client.initialize();
