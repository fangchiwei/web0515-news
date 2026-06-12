#!/usr/bin/env node
/**
 * Fetches the latest news from Google RSS and stores a daily snapshot
 * in Upstash Redis.  Runs as a stand-alone GitHub Actions step so that
 * the cache is pre-populated before the first visitor of the day hits
 * the Render server.
 *
 * Required env vars (optional – script exits gracefully when absent):
 *   UPSTASH_REDIS_REST_URL   – Upstash REST base URL
 *   UPSTASH_REDIS_REST_TOKEN – Upstash REST token
 *
 * Optional env vars:
 *   FEED_URL       – RSS feed URL (default: Google News TW)
 *   NEWS_CACHE_KEY – Redis key for the snapshot (default: news:daily-snapshot)
 */

"use strict";

const { XMLParser } = require("fast-xml-parser");

const FEED_URL =
  process.env.FEED_URL ||
  "https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant";
const REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const NEWS_CACHE_KEY = process.env.NEWS_CACHE_KEY || "news:daily-snapshot";

function formatDateKey(date) {
  const fmt = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = fmt.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function splitTitleAndSource(title) {
  const idx = title.lastIndexOf(" - ");
  if (idx === -1) return { headline: title, source: "" };
  return {
    headline: title.slice(0, idx).trim(),
    source: title.slice(idx + 3).trim()
  };
}

async function fetchFreshNewsItems() {
  const response = await fetch(FEED_URL, {
    headers: { Accept: "application/rss+xml, text/xml, application/xml" }
  });

  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status}`);
  }

  const xmlText = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    processEntities: false,
    htmlEntities: false
  });

  const xml = parser.parse(xmlText);
  const rawItems = xml?.rss?.channel?.item ?? [];
  const itemList = Array.isArray(rawItems) ? rawItems : [rawItems];

  return itemList
    .map((raw) => {
      const titleRaw = String(raw?.title ?? "(No title)").trim();
      const link = String(raw?.link ?? "#").trim();
      const pubDate = String(raw?.pubDate ?? "").trim();
      const date = new Date(pubDate);

      if (Number.isNaN(date.getTime())) return null;

      const { headline, source } = splitTitleAndSource(titleRaw);
      return { headline, source, link, dateKey: formatDateKey(date) };
    })
    .filter(Boolean);
}

async function writeNewsSnapshot(items) {
  const body = JSON.stringify({ fetchedAt: new Date().toISOString(), items });

  const response = await fetch(
    `${REDIS_REST_URL}/set/${encodeURIComponent(NEWS_CACHE_KEY)}`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + REDIS_REST_TOKEN,
        "Content-Type": "text/plain"
      },
      body
    }
  );

  if (!response.ok) {
    throw new Error(`Redis set failed: ${response.status}`);
  }
}

async function main() {
  console.log("Fetching news from RSS feed\u2026");
  const items = await fetchFreshNewsItems();
  console.log(`Fetched ${items.length} news items.`);

  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) {
    console.log(
      "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set \u2013 " +
        "skipping Redis write (cache will be populated on first server request)."
    );
    return;
  }

  await writeNewsSnapshot(items);
  console.log(`Snapshot written to Redis key "${NEWS_CACHE_KEY}".`);
}

main().catch((err) => {
  console.error("cache-news failed:", err.message);
  process.exit(1);
});
