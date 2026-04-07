import Whatsapp from "whatsapp-web.js";
const { Client, LocalAuth } = Whatsapp;

import qrcode from "qrcode-terminal";
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

const skipBaseline = args.has("--force");

client.on("ready", () => {
    console.log("WhatsApp client ready.");
    const bot = new JWBot(client);
    void bot.start({ skipBaseline });
});

await client.initialize();
