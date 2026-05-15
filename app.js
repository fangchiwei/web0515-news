const FEED_URL = "https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant";
const PROXY_URL = "https://api.allorigins.win/raw?url=";

const statusEl = document.getElementById("status");
const todayDateEl = document.getElementById("todayDate");
const yesterdayDateEl = document.getElementById("yesterdayDate");
const todayListEl = document.getElementById("todayList");
const yesterdayListEl = document.getElementById("yesterdayList");
const refreshBtn = document.getElementById("refreshBtn");

refreshBtn.addEventListener("click", () => {
  void loadHeadlines();
});

void loadHeadlines();

async function loadHeadlines() {
  setStatus("載入中...");
  refreshBtn.disabled = true;

  try {
    const rssText = await fetchRssText();
    const items = parseRssItems(rssText);

    const { todayKey, yesterdayKey } = getTaiwanDateKeys();
    todayDateEl.textContent = todayKey;
    yesterdayDateEl.textContent = yesterdayKey;

    const todayItems = items.filter((item) => item.dateKey === todayKey).slice(0, 12);
    const yesterdayItems = items.filter((item) => item.dateKey === yesterdayKey).slice(0, 12);

    renderList(todayListEl, todayItems);
    renderList(yesterdayListEl, yesterdayItems);

    setStatus(`更新完成，共讀取 ${items.length} 筆新聞。`);
  } catch (error) {
    renderError(todayListEl, "讀取失敗，請稍後再試。");
    renderError(yesterdayListEl, "讀取失敗，請稍後再試。");
    setStatus("新聞來源暫時不可用，請按重新整理重試。");
    console.error(error);
  } finally {
    refreshBtn.disabled = false;
  }
}

async function fetchRssText() {
  const target = `${PROXY_URL}${encodeURIComponent(FEED_URL)}`;
  const response = await fetch(target, {
    method: "GET",
    headers: {
      Accept: "application/rss+xml, text/xml, application/xml, text/plain"
    }
  });

  if (!response.ok) {
    throw new Error(`Network error: ${response.status}`);
  }

  return response.text();
}

function parseRssItems(rssText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(rssText, "text/xml");
  const itemNodes = Array.from(xml.querySelectorAll("item"));

  return itemNodes
    .map((node) => {
      const titleRaw = node.querySelector("title")?.textContent?.trim() ?? "(無標題)";
      const link = node.querySelector("link")?.textContent?.trim() ?? "#";
      const pubDate = node.querySelector("pubDate")?.textContent?.trim() ?? "";
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

function renderList(container, items) {
  container.innerHTML = "";

  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "今天沒有讀到符合條件的新聞。";
    container.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");

    const a = document.createElement("a");
    a.href = item.link;
    a.textContent = item.headline;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    li.appendChild(a);

    if (item.source) {
      const source = document.createElement("div");
      source.className = "source";
      source.textContent = item.source;
      li.appendChild(source);
    }

    container.appendChild(li);
  });
}

function renderError(container, message) {
  container.innerHTML = "";
  const li = document.createElement("li");
  li.className = "error";
  li.textContent = message;
  container.appendChild(li);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function getTaiwanDateKeys() {
  const now = new Date();
  const todayKey = formatDateKey(now);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);

  return { todayKey, yesterdayKey };
}

function formatDateKey(date) {
  const fmt = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = fmt.formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;

  return `${y}-${m}-${d}`;
}
