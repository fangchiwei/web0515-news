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
