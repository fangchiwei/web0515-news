const express = require("express");
const cors = require("cors");
const { XMLParser } = require("fast-xml-parser");

const app = express();
const port = process.env.PORT || 3000;
const FEED_URL = process.env.FEED_URL || "https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const CACHE_MS = 5 * 60 * 1000;
const DEFAULT_LIMIT = 12;
const REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const VISIT_META_KEY = process.env.VISIT_META_KEY || "visit:last-at";
const NEWS_CACHE_KEY = process.env.NEWS_CACHE_KEY || "news:daily-snapshot";
const NEWS_JOB_TOKEN = process.env.NEWS_JOB_TOKEN || "";

app.use(cors({ origin: CORS_ORIGIN }));

let cache = {
  expiresAt: 0,
  items: []
};
let lastVisitAt = null;

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "web0515-news-api" });
});

app.get("/api/visit-meta", async (_req, res) => {
  try {
    const nowIso = new Date().toISOString();
    const previousVisitAt = await readLastVisitAt();

    await writeLastVisitAt(nowIso);

    res.json({
      previousVisitAt,
      currentVisitAt: nowIso,
      hasPrevious: Boolean(previousVisitAt),
      persistence: hasRedisPersistence() ? "redis" : "memory"
    });
  } catch (error) {
    res.status(500).json({
      error: "failed_to_read_visit_meta",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
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

app.post("/api/jobs/cache-news", async (req, res) => {
  if (!isAuthorizedJobRequest(req)) {
    res.status(401).json({
      error: "unauthorized",
      message: "Missing or invalid job token"
    });
    return;
  }

  try {
    const items = await getNewsItems({ forceRefresh: true });
    const { todayKey, yesterdayKey } = getTaiwanDateKeys();

    res.json({
      ok: true,
      total: items.length,
      todayKey,
      yesterdayKey,
      persistence: hasRedisPersistence() ? "redis" : "memory"
    });
  } catch (error) {
    res.status(500).json({
      error: "failed_to_cache_news",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.listen(port, () => {
  console.log(`News API running on port ${port}`);
});

async function getNewsItems(options = {}) {
  const now = Date.now();
  const { forceRefresh = false } = options;

  if (!forceRefresh && cache.expiresAt > now && cache.items.length > 0) {
    return cache.items;
  }

  if (!forceRefresh) {
    let storedItems = [];

    try {
      storedItems = await readNewsSnapshot();
    } catch (error) {
      console.warn("Failed to read news snapshot from Redis:", error);
    }

    if (storedItems.length > 0) {
      cache = {
        expiresAt: now + CACHE_MS,
        items: storedItems
      };

      return storedItems;
    }
  }

  const mapped = await fetchFreshNewsItems();

  cache = {
    expiresAt: now + CACHE_MS,
    items: mapped
  };

  try {
    await writeNewsSnapshot(mapped);
  } catch (error) {
    console.warn("Failed to write news snapshot to Redis:", error);
  }

  return mapped;
}

async function fetchFreshNewsItems() {
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

function hasRedisPersistence() {
  return Boolean(REDIS_REST_URL && REDIS_REST_TOKEN);
}

function isAuthorizedJobRequest(req) {
  if (!NEWS_JOB_TOKEN) {
    return true;
  }

  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  return token === NEWS_JOB_TOKEN;
}

async function readLastVisitAt() {
  if (!hasRedisPersistence()) {
    return lastVisitAt;
  }

  const response = await fetch(
    `${REDIS_REST_URL}/get/${encodeURIComponent(VISIT_META_KEY)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${REDIS_REST_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Redis get failed: ${response.status}`);
  }

  const payload = await response.json();
  return typeof payload?.result === "string" ? payload.result : null;
}

async function writeLastVisitAt(isoTime) {
  lastVisitAt = isoTime;

  if (!hasRedisPersistence()) {
    return;
  }

  const response = await fetch(
    `${REDIS_REST_URL}/set/${encodeURIComponent(VISIT_META_KEY)}/${encodeURIComponent(isoTime)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${REDIS_REST_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Redis set failed: ${response.status}`);
  }
}

async function readNewsSnapshot() {
  if (!hasRedisPersistence()) {
    return [];
  }

  const response = await fetch(
    `${REDIS_REST_URL}/get/${encodeURIComponent(NEWS_CACHE_KEY)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${REDIS_REST_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Redis get failed: ${response.status}`);
  }

  const payload = await response.json();
  const parsed = safeParseJson(payload?.result);

  if (!parsed || !Array.isArray(parsed.items)) {
    return [];
  }

  return parsed.items;
}

async function writeNewsSnapshot(items) {
  if (!hasRedisPersistence()) {
    return;
  }

  const body = JSON.stringify({
    fetchedAt: new Date().toISOString(),
    items
  });

  const response = await fetch(`${REDIS_REST_URL}/set/${encodeURIComponent(NEWS_CACHE_KEY)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_REST_TOKEN}`,
      "Content-Type": "text/plain"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Redis set failed: ${response.status}`);
  }
}

function safeParseJson(value) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
