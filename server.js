const express = require("express");
const cors = require("cors");
const { XMLParser } = require("fast-xml-parser");

const app = express();
const port = process.env.PORT || 3000;
const FEED_URL = process.env.FEED_URL || "https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const CACHE_MS = 5 * 60 * 1000;
const DEFAULT_LIMIT = 12;

app.use(cors({ origin: CORS_ORIGIN }));

let cache = {
  expiresAt: 0,
  items: []
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "web0515-news-api" });
});

app.get("/api/headlines", async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10) || DEFAULT_LIMIT;
    const maxItems = Math.max(1, Math.min(limit, 30));

    const items = await getNewsItems();
    const { todayKey, yesterdayKey } = getTaiwanDateKeys();

    const todayItems = items.filter((item) => item.dateKey === todayKey).slice(0, maxItems);
    const yesterdayItems = items.filter((item) => item.dateKey === yesterdayKey).slice(0, maxItems);

    res.json({
      todayKey,
      yesterdayKey,
      total: items.length,
      todayItems,
      yesterdayItems
    });
  } catch (error) {
    res.status(500).json({
      error: "failed_to_fetch_news",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.listen(port, () => {
  console.log(`News API running on port ${port}`);
});

async function getNewsItems() {
  const now = Date.now();

  if (cache.expiresAt > now && cache.items.length > 0) {
    return cache.items;
  }

  const response = await fetch(FEED_URL, {
    headers: {
      Accept: "application/rss+xml, text/xml, application/xml"
    }
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

  const mapped = itemList
    .map((raw) => {
      const titleRaw = String(raw?.title ?? "(No title)").trim();
      const link = String(raw?.link ?? "#").trim();
      const pubDate = String(raw?.pubDate ?? "").trim();
      const date = new Date(pubDate);

      if (Number.isNaN(date.getTime())) {
        return null;
      }

      const { headline, source } = splitTitleAndSource(titleRaw);

      return {
        headline,
        source,
        link,
        dateKey: formatDateKey(date)
      };
    })
    .filter(Boolean);

  cache = {
    expiresAt: now + CACHE_MS,
    items: mapped
  };

  return mapped;
}

function splitTitleAndSource(title) {
  const idx = title.lastIndexOf(" - ");

  if (idx === -1) {
    return { headline: title, source: "" };
  }

  return {
    headline: title.slice(0, idx).trim(),
    source: title.slice(idx + 3).trim()
  };
}

function getTaiwanDateKeys() {
  const now = new Date();
  const todayKey = formatDateKey(now);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  return {
    todayKey,
    yesterdayKey: formatDateKey(yesterday)
  };
}

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
