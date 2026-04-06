import Whatsapp from "whatsapp-web.js";
const { Client, LocalAuth } = Whatsapp;

import qrcode from "qrcode-terminal";
import { JWBot } from "./bot.js";

const client = new Client({
    authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
});

const skipBaseline = process.argv.includes("--force");

client.on("ready", () => {
    console.log("WhatsApp client ready.");
    const bot = new JWBot(client);
    void bot.start({ skipBaseline });
});

await client.initialize();
