# web0515-news

前端部署在 GitHub Pages，後端 Node.js API 部署在 Render（免費方案可用）。

## 1) 本機執行

```bash
npm install
node server.js
```

本機 API：
- `http://localhost:3000/api/health`
- `http://localhost:3000/api/headlines`

## 2) 部署後端到 Render

1. 到 Render 建立帳號，選 New + > Web Service。
2. 連接 GitHub，選擇這個 repository：`fangchiwei/web0515-news`。
3. Build Command：`npm install`
4. Start Command：`node server.js`
5. Environment（可選）：
   - `CORS_ORIGIN=https://fangchiwei.github.io`
6. 建立後會得到網址，例如：`https://web0515-news-api.onrender.com`

## 3) 設定前端呼叫你的 API

編輯 `config.js`：

```js
window.NEWS_API_BASE_URL = "https://你的-render-網址";
```

例如：

```js
window.NEWS_API_BASE_URL = "https://web0515-news-api.onrender.com";
```

## 4) 推上 GitHub

```bash
git add .
git commit -m "Add Node.js API and frontend API config"
git push
```

## 5) GitHub Pages

到 repository Settings > Pages：
- Source：Deploy from a branch
- Branch：`main` / `(root)`

網站網址：
- `https://fangchiwei.github.io/web0515-news/`

## 補充

- 免費 Render 服務可能會休眠，第一次請求會稍慢。
- 若要更安全，將 `CORS_ORIGIN` 限制成你的 Pages 網域。

## 永久保存上次訪客時間（免費）

若你要讓「上一次有人進入」在 Render 重啟後仍保留，建議使用 Upstash Redis（免費方案可用）。

1. 到 Upstash 建立 Redis Database。
2. 取得兩個值：
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. 到 Render 服務的 Environment 加入：
   - `UPSTASH_REDIS_REST_URL=...`
   - `UPSTASH_REDIS_REST_TOKEN=...`
   - `VISIT_META_KEY=visit:last-at`（可選）

設定完成後，`/api/visit-meta` 會改用 Redis 儲存；若未設定則自動退回記憶體模式。

## 每天自動抓新聞寫入 Redis

專案已內建 GitHub Actions 排程檔 [daily-news-cache.yml](.github/workflows/daily-news-cache.yml)，每天會呼叫一次後端 API，把最新新聞快照寫進 Redis。

### Render 環境變數

請在 Render 加入：

- `NEWS_JOB_TOKEN=你自訂的一串隨機字串`
- `NEWS_CACHE_KEY=news:daily-snapshot`（可選）

### GitHub Secrets

到 GitHub repository 的 Settings > Secrets and variables > Actions，新增：

- `NEWS_CACHE_JOB_URL=https://web0515-news.onrender.com/api/jobs/cache-news`
- `NEWS_JOB_TOKEN=和 Render 一樣的字串`

### 排程時間

- workflow 目前設定為每天 UTC 00:05 執行
- 台灣時間約為每天 08:05

### 手動測試

你也可以手動呼叫：

```bash
curl -X POST \
   -H "Authorization: Bearer 你的NEWS_JOB_TOKEN" \
   https://web0515-news.onrender.com/api/jobs/cache-news
```

成功後，`/api/headlines` 會優先讀 Redis 內的新聞快照；如果 Redis 沒資料或讀取失敗，才會即時重新抓新聞。
