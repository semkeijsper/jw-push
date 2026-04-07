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

const force = args.has("--force");
const baseline = args.has("--baseline");

client.on("ready", () => {
    console.log("WhatsApp client ready.");
    for (const channel of channels) {
        const strings = getStrings(channel.locale);
        const bot = new JWBot(client, channel, strings);
        void bot.start({
            forceResend: force && channel.type === "development",
            baseline,
        });
    }
});

await client.initialize();
