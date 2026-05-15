import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config";

export function useStockHistory() {
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [historyStock, setHistoryStock] = useState({ code: "", name: "" });
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleShowHistory = async (stockCode, stockName) => {
    setHistoryStock({ code: stockCode, name: stockName });
    setShowHistory(true);
    setLoadingHistory(true);

    try {
      const response = await axios.get(`${API_BASE_URL}/api/history/${stockCode}`);
      if (response.data.success) {
        setHistoryList(response.data.history);
      }
    } catch (error) {
      console.error("取得歷史記錄失敗:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewHistory = async (date, fileName) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/report/${date}/${fileName}`
      );
      if (response.data.success) {
        const newWindow = window.open("", "_blank", "width=1000,height=800");
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>${historyStock.name}(${historyStock.code}) - ${date}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", sans-serif; padding: 50px; max-width: 1000px; margin: 0 auto; background-color: #f5f5f5; line-height: 1.8; }
              .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
              .content { background: white; padding: 30px; border-radius: 10px; white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <div class="header"><h1>${historyStock.name}(${historyStock.code})</h1><p>${date}</p></div>
            <div class="content">${response.data.content}</div>
          </body>
          </html>
        `);
      }
    } catch (error) {
      console.error("讀取歷史記錄失敗:", error);
    }
  };

  return {
    showHistory,
    setShowHistory,
    historyList,
    historyStock,
    loadingHistory,
    handleShowHistory,
    handleViewHistory
  };
}
