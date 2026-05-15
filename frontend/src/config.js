// API base URL：指向你的 Render 後端
// 本機開發時可建立 .env.local 並設定 VITE_API_BASE_URL=http://localhost:3000
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://web0515-news.onrender.com";
