// Checks whether a given WhatsApp Web build still exposes the internal modules
// that whatsapp-web.js needs in order to send an image to a channel.
//
// No WhatsApp login is required and nothing is sent anywhere: the script boots
// each build far enough for its module registry to exist (the QR screen) and
// then asks it for the modules Injected/Utils.js calls on the media path.
//
//   node scripts/probe-web-version.mjs                     # the default bisect set
//   node scripts/probe-web-version.mjs 2.3000.1042852868-alpha ...
//
// Set CHROMIUM_PATH to use a system Chromium (e.g. /usr/bin/chromium on a server).

import { createRequire } from "node:module";

// puppeteer is whatsapp-web.js's dependency, not ours, so under pnpm's strict
// layout it has to be resolved through that package rather than from here.
const require = createRequire(import.meta.url);
const puppeteer = createRequire(require.resolve("whatsapp-web.js"))("puppeteer");

const WA_URL = "https://web.whatsapp.com/";
const ARCHIVE = "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html";

// Bisect candidates between the last build known to embed images (3 Jul 2026)
// and the first known to fail (19 Jul 2026).
const DEFAULT_VERSIONS = [
    "2.3000.1042611748-alpha", // 3 Jul — last known good
    "2.3000.1042852868-alpha", // 8 Jul
    "2.3000.1043053164-alpha", // 13 Jul
    "2.3000.1043263898-alpha", // 16 Jul
    "2.3000.1043441279-alpha", // 19 Jul — known bad
];

// module -> the exports Injected/Utils.js actually calls when sending media
const PROBES = {
    WAWebMediaOpaqueData: ["createFromData"],
    WAWebPrepRawMedia: ["prepRawMedia"],
    WAWebMediaStorage: ["getOrCreateMediaObject"],
    WAWebMmsMediaTypes: ["msgToMediaType", "castToV4"],
    WAWebMediaDataUtils: ["shouldUseMediaCache"],
    WAWebMediaInMemoryBlobCache: ["InMemoryMediaBlobCache"],
    WAMediaCalculateFilehash: ["getRandomFilehash"],
    WAWebMediaMmsV4Upload: ["uploadMedia", "uploadUnencryptedMedia"],
    WAWebNewsletterSendMessageJob: ["sendNewsletterMessageJob"],
    WAWebNewsletterUpdateMsgsRecordsJob: ["addNewsletterMsgsRecords", "updateNewsletterMsgRecord"],
    WAWebMsgDataFromModel: ["msgDataFromMsgModel"],
    WAWebChatGetters: ["getIsNewsletter", "getIsBroadcast"],
    WAWebCollections: ["Msg"],
    WAWebWidFactory: ["createWid"],
};

async function fetchBuild(version) {
    const res = await fetch(ARCHIVE.replace("{version}", version));
    if (!res.ok) {
        throw new Error(`archive returned ${res.status} for ${version}`);
    }
    return await res.text();
}

async function probe(browser, version) {
    const html = await fetchBuild(version);
    const page = await browser.newPage();
    try {
        await page.setUserAgent(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.67 Safari/537.36",
        );

        // The same interception whatsapp-web.js uses to pin a build: answer the
        // page load with the archived index.html so the browser pulls that
        // build's JS chunks instead of today's.
        await page.setRequestInterception(true);
        page.on("request", (req) => {
            if (req.url() === WA_URL) {
                req.respond({ status: 200, contentType: "text/html", body: html });
            }
            else {
                req.continue();
            }
        });

        await page.goto(WA_URL, { waitUntil: "load", timeout: 120_000 });
        await page.waitForFunction("typeof window.require === 'function'", { timeout: 120_000 });

        return await page.evaluate((probes) => {
            const modules = {};
            for (const [name, exports] of Object.entries(probes)) {
                try {
                    const mod = window.require(name);
                    if (!mod) {
                        modules[name] = "MODULE NULL";
                        continue;
                    }
                    const missing = exports.filter(e => mod[e] === undefined);
                    modules[name] = missing.length ? `MISSING ${missing.join(",")}` : "ok";
                }
                catch (e) {
                    modules[name] = `NOT FOUND (${e?.message ?? e})`.slice(0, 70);
                }
            }
            return modules;
        }, PROBES);
    }
    finally {
        await page.close().catch(() => { /* already gone */ });
    }
}

const versions = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_VERSIONS;

const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const results = {};
try {
    for (const version of versions) {
        process.stdout.write(`probing ${version} ... `);
        try {
            results[version] = await probe(browser, version);
            const broken = Object.values(results[version]).filter(v => v !== "ok").length;
            console.log(broken === 0 ? "all modules present" : `${broken} module(s) missing or changed`);
        }
        catch (e) {
            results[version] = null;
            console.log(`FAILED (${e.message})`);
        }
    }
}
finally {
    await browser.close();
}

console.log("\n--- modules that differ between builds ---");
const names = Object.keys(PROBES);
let anyDiff = false;
for (const name of names) {
    const row = versions.map(v => results[v]?.[name] ?? "?");
    if (new Set(row).size > 1) {
        anyDiff = true;
        console.log(`\n${name}`);
        versions.forEach((v, i) => console.log(`  ${v.padEnd(26)} ${row[i]}`));
    }
}
if (!anyDiff) {
    console.log("none — every probed module resolves identically in all builds,");
    console.log("so the breakage is in a module's behaviour rather than its name.");
}
