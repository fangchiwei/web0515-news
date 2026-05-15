const express = require("express");
const cors = require("cors");
const axios = require("axios");
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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

app.use(cors({ origin: CORS_ORIGIN }));

let cache = {
  expiresAt: 0,
  items: []
};
let lastVisitAt = null;

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "web0515-news-api" });
});

// ── 股票新聞 ──────────────────────────────────────────────────

app.get("/api/yahoo-news/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const stockName = req.query.name || symbol;
    const url = /^\d{4}$/.test(symbol)
      ? `https://news.google.com/rss/search?q=${encodeURIComponent(stockName)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`
      : `https://news.google.com/rss/search?q=${encodeURIComponent(symbol)}&hl=en-US&gl=US&ceid=US:en`;

    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      timeout: 10000
    });

    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title>(.*?)<\/title>/;

    let match;
    while ((match = itemRegex.exec(response.data)) !== null && items.length < 5) {
      const titleMatch = titleRegex.exec(match[1]);
      if (titleMatch) {
        const title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
        if (title && title !== "Google News") {
          items.push(title);
        }
      }
    }

    res.json({ success: true, news: items, symbol });
  } catch (error) {
    const mockNews = [
      `${req.params.symbol} 股價動態更新`,
      `市場分析：${req.params.symbol} 最新動態`,
      `投資觀點：${req.params.symbol} 後市展望`
    ];
    res.json({ success: true, news: mockNews, symbol: req.params.symbol, isMock: true });
  }
});

app.post("/api/analyze-stock", async (req, res) => {
  const { stockCode, stockName, newsList = [] } = req.body;

  if (!GEMINI_API_KEY) {
    return res.status(503).json({
      success: false,
      message: "GEMINI_API_KEY 尚未設定，請在 Render 環境變數中加入此金鑰。"
    });
  }

  let prompt;
  if (newsList.length > 0) {
    prompt = `你是一位美股分析師，請針對以下新聞提供中文多空判斷與核心原因。以下是「${stockName}(${stockCode})」的最新新聞標題：\n\n${newsList.map((n, i) => `${i + 1}. ${n}`).join("\n")}`;
  } else {
    prompt = `請搜尋並分析股票「${stockName}(${stockCode})」的最新新聞和資訊。\n\n請提供：\n1. 📰 最近重要新聞摘要（3-5則）\n2. 📊 技術面或基本面重點\n3. 💡 多空分析與投資建議\n4. ⚠️ 風險提醒\n\n請使用繁體中文回覆，並以清楚的結構呈現。`;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    if (newsList.length === 0) {
      payload.tools = [{ google_search: {} }];
    }

    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 30000
    });

    const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.json({ success: true, content });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error?.response?.data?.error?.message || error.message
    });
  }
});

// ── 報告 Redis 儲存 ──────────────────────────────────────────

app.post("/api/save-report", async (req, res) => {
  const { stockCode, stockName, content } = req.body;
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
  const fileName = `${stockCode}_${stockName}_${timeStr}.txt`;

  const record = {
    stockCode,
    stockName,
    content,
    date: dateStr,
    fileName,
    createTime: now.toISOString(),
    displayTime: now.toLocaleString("zh-TW")
  };

  try {
    if (hasRedisPersistence()) {
      const reportKey = `report:${stockCode}:${dateStr}:${timeStr}`;
      await redisSet(reportKey, JSON.stringify(record));

      const historyKey = `history:${stockCode}`;
      let history = [];
      const raw = await redisGet(historyKey);
      if (raw) history = safeParseJson(raw) || [];

      history.unshift({ date: dateStr, fileName, createTime: record.createTime, displayTime: record.displayTime });
      if (history.length > 50) history = history.slice(0, 50);
      await redisSet(historyKey, JSON.stringify(history));
    }

    res.json({ success: true, message: "報告已儲存", path: `${dateStr}/${fileName}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/history/:stockCode", async (req, res) => {
  const { stockCode } = req.params;

  try {
    if (!hasRedisPersistence()) {
      return res.json({ success: true, history: [] });
    }

    const historyKey = `history:${stockCode}`;
    const raw = await redisGet(historyKey);
    const history = raw ? (safeParseJson(raw) || []) : [];

    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/report/:date/:fileName", async (req, res) => {
  const { date, fileName } = req.params;
  const stockCode = fileName.split("_")[0];
  const timeStr = fileName.replace(/^[^_]+_[^_]+_/, "").replace(".txt", "");

  try {
    if (!hasRedisPersistence()) {
      return res.status(404).json({ success: false, message: "未設定 Redis，無法讀取報告" });
    }

    const reportKey = `report:${stockCode}:${date}:${timeStr}`;
    const raw = await redisGet(reportKey);

    if (!raw) {
      return res.status(404).json({ success: false, message: "報告不存在" });
    }

    const record = safeParseJson(raw);
    res.json({ success: true, content: record?.content || raw });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── 台股清單 ─────────────────────────────────────────────────

const TW_STOCK_LIST = [
  { code: "2330", name: "台積電" }, { code: "2454", name: "聯發科" },
  { code: "3034", name: "聯詠" }, { code: "2308", name: "台達電" },
  { code: "1301", name: "台塑" }, { code: "1303", name: "南亞" },
  { code: "2881", name: "富邦金" }, { code: "2884", name: "玉山金" },
  { code: "1216", name: "統一" }, { code: "2912", name: "統一超" },
  { code: "2317", name: "鴻海" }, { code: "3711", name: "日月光" },
  { code: "3008", name: "大立光" }, { code: "2383", name: "台光電" },
  { code: "8299", name: "群聯" }, { code: "2891", name: "中信金" },
  { code: "6285", name: "啟碁" }, { code: "2433", name: "金像電" }
];

app.get("/api/tw-stock-list", (_req, res) => {
  res.json({ success: true, data: TW_STOCK_LIST });
});

app.get("/api/tw-stock-screening", async (req, res) => {
  const minScore = Number.parseInt(req.query.minScore, 10) || 60;
  const minWhaleScore = Number.parseInt(req.query.minWhaleScore, 10) || 0;

  try {
    const results = [];

    for (const stock of TW_STOCK_LIST) {
      try {
        const priceData = await fetchTwStockData(stock.code);
        const chipAnalysis = await calculateChipScore(stock.code, priceData);
        const whaleAnalysis = await buildWhaleAnalysis(stock.code, priceData);

        if (chipAnalysis.score >= minScore && whaleAnalysis.whaleScore >= minWhaleScore) {
          results.push({ code: stock.code, name: stock.name, price: priceData?.price || 0, change: priceData?.change || 0, volume: priceData?.volume || 0, ...chipAnalysis, ...whaleAnalysis });
        }

        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        console.error(`分析 ${stock.code} 失敗:`, err.message);
      }
    }

    results.sort((a, b) => b.whaleScore - a.whaleScore || b.score - a.score);
    res.json({ success: true, timestamp: new Date().toISOString(), count: results.length, data: results, criteria: { minScore, minWhaleScore, totalStocks: TW_STOCK_LIST.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
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

// ── 台股輔助函數 ─────────────────────────────────────────────

async function fetchTwStockData(stockCode) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${stockCode}&start_date=${today}&end_date=${today}`;
    const response = await axios.get(url, { timeout: 8000 });
    const data = response.data?.data;
    if (!data || data.length === 0) return generateMockStockData(stockCode);
    const latest = data[data.length - 1];
    const change = latest.open > 0 ? ((latest.close - latest.open) / latest.open) * 100 : 0;
    return { code: stockCode, price: latest.close, change: Math.round(change * 100) / 100, volume: latest.Trading_Volume, timestamp: new Date().toISOString() };
  } catch {
    return generateMockStockData(stockCode);
  }
}

function generateMockStockData(stockCode) {
  const seed = (parseInt(stockCode) * 12345) % 10000;
  const basePrice = 100 + (seed % 500);
  const volatility = ((seed * 7) % 10) - 5;
  return { code: stockCode, price: basePrice + (basePrice * volatility / 100), change: volatility + ((seed % 10) - 5) / 10, volume: 1000000 + (seed * 1000 % 50000000), timestamp: new Date().toISOString() };
}

async function calculateChipScore(stockCode, priceData) {
  const today = new Date();
  const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const dateStr = today.toISOString().split("T")[0];

  let historyData = [];
  try {
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${stockCode}&start_date=${startDate}&end_date=${dateStr}`;
    const r = await axios.get(url, { timeout: 5000 });
    historyData = r.data?.data || [];
  } catch {}

  let foreignInvestor = 0, domesticFunds = 0, marginCall = 0, volumeChange = 0, priceStrength = 0;

  if (priceData?.change !== undefined) {
    priceStrength = priceData.change > 2 ? 20 : priceData.change > 0 ? 10 : priceData.change > -2 ? -10 : -20;
  }

  if (historyData.length > 5) {
    const recent = historyData.slice(-5).reduce((s, d) => s + (d.Trading_Volume || 0), 0) / 5;
    const previous = historyData.slice(-10, -5).reduce((s, d) => s + (d.Trading_Volume || 0), 0) / 5;
    if (previous > 0) {
      const r = recent / previous;
      volumeChange = r > 1.2 ? 15 : r > 1 ? 10 : r > 0.8 ? -10 : -15;
    }

    const closesR = historyData.slice(-5).map(d => d.close).filter(Boolean);
    const closesP = historyData.slice(-10, -5).map(d => d.close).filter(Boolean);
    if (closesR.length && closesP.length) {
      const avgR = closesR.reduce((a, b) => a + b, 0) / closesR.length;
      const avgP = closesP.reduce((a, b) => a + b, 0) / closesP.length;
      const trend = ((avgR - avgP) / avgP) * 100;
      foreignInvestor = trend > 3 ? 20 : trend > 0 ? 15 : trend > -3 ? -15 : -20;
      domesticFunds = trend > 3 ? 15 : trend > 0 ? 10 : trend > -3 ? -10 : -15;
    }
  }

  marginCall = priceData?.change > 0 ? 10 : -10;

  const totalScore = Math.min(100, Math.max(0, 50 + foreignInvestor + domesticFunds + marginCall + volumeChange + priceStrength));
  return { score: Math.round(totalScore), indicators: { foreignInvestor, domesticFunds, marginCall, volumeChange, priceStrength }, analysis: getScoreAnalysis(totalScore) };
}

async function buildWhaleAnalysis(stockCode, priceData) {
  const today = new Date();
  const startDate = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const dateStr = today.toISOString().split("T")[0];

  let whaleScore = 50;
  let concentration = "未知";

  try {
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockHoldingSharesPer&data_id=${stockCode}&start_date=${startDate}&end_date=${dateStr}`;
    const r = await axios.get(url, { timeout: 5000 });
    const data = r.data?.data || [];
    if (data.length >= 2) {
      const latest = data[data.length - 1];
      const previous = data[data.length - 2];
      const whalePct = parseFloat(latest["over_400"] || 0) + parseFloat(latest["over_1000"] || 0);
      const prevWhalePct = parseFloat(previous["over_400"] || 0) + parseFloat(previous["over_1000"] || 0);
      const diff = whalePct - prevWhalePct;
      whaleScore = Math.min(100, Math.max(0, 50 + diff * 10 + (priceData?.change > 0 ? 5 : -5)));
      concentration = whalePct > 60 ? "高" : whalePct > 40 ? "中" : "低";
    }
  } catch {}

  return { whaleScore: Math.round(whaleScore), concentration, whaleAnalysis: getScoreAnalysis(whaleScore) };
}

function getScoreAnalysis(score) {
  if (score >= 80) return { level: "★★★★★", description: "籌碼面極佳", color: "#27ae60" };
  if (score >= 60) return { level: "★★★★☆", description: "籌碼面良好", color: "#2ecc71" };
  if (score >= 40) return { level: "★★★☆☆", description: "籌碼面一般", color: "#f39c12" };
  if (score >= 20) return { level: "★★☆☆☆", description: "籌碼面較弱", color: "#e67e22" };
  return { level: "★☆☆☆☆", description: "籌碼面極差", color: "#e74c3c" };
}

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

async function redisGet(key) {
  const response = await fetch(`${REDIS_REST_URL}/get/${encodeURIComponent(key)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${REDIS_REST_TOKEN}` }
  });
  if (!response.ok) throw new Error(`Redis get failed: ${response.status}`);
  const payload = await response.json();
  return typeof payload?.result === "string" ? payload.result : null;
}

async function redisSet(key, value) {
  const response = await fetch(`${REDIS_REST_URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_REST_TOKEN}`, "Content-Type": "text/plain" },
    body: value
  });
  if (!response.ok) throw new Error(`Redis set failed: ${response.status}`);
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
