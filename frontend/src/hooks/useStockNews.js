import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config";

export function useStockNews() {
  const [analysisResults, setAnalysisResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStock, setSelectedStock] = useState("");

  const upsertAnalysisResult = ({ stockCode, stockName, content, displayTime, isCached }) => {
    setAnalysisResults((prev) => {
      const next = prev.filter((item) => item.stockCode !== stockCode);
      return [{ stockCode, stockName, content, displayTime, isCached }, ...next];
    });
  };

  const clearAnalysisResults = () => {
    setAnalysisResults([]);
  };

  const handleSearchNews = async (stockCode, stockName, forceUpdate = false) => {
    setLoading(true);
    setSelectedStock(`${stockCode} ${stockName}`);

    try {
      if (!forceUpdate) {
        const today = new Date().toISOString().split("T")[0];
        const historyResponse = await axios.get(
          `${API_BASE_URL}/api/history/${stockCode}`
        );

        if (historyResponse.data.success) {
          const todayRecords = historyResponse.data.history
            .filter((record) => record.date === today)
            .sort((a, b) => new Date(b.createTime) - new Date(a.createTime));

          if (todayRecords.length > 0) {
            const latestRecord = todayRecords[0];
            const reportResponse = await axios.get(
              `${API_BASE_URL}/api/report/${latestRecord.date}/${latestRecord.fileName}`
            );

            if (reportResponse.data.success) {
              upsertAnalysisResult({
                stockCode,
                stockName,
                content: reportResponse.data.content,
                displayTime: latestRecord.displayTime,
                isCached: true
              });
              setLoading(false);
              return;
            }
          }
        }
      }

      // 抓新聞
      const newsResponse = await axios.get(
        `${API_BASE_URL}/api/yahoo-news/${stockCode}?name=${encodeURIComponent(stockName)}`
      );
      const newsList =
        newsResponse.data.success && newsResponse.data.news.length > 0
          ? newsResponse.data.news
          : [];

      // 後端呼叫 Gemini 分析（API key 在後端）
      const analyzeResponse = await axios.post(
        `${API_BASE_URL}/api/analyze-stock`,
        { stockCode, stockName, newsList }
      );

      if (!analyzeResponse.data.success) {
        throw new Error(analyzeResponse.data.message || "AI 分析失敗");
      }

      const analysisText = analyzeResponse.data.content;
      upsertAnalysisResult({
        stockCode,
        stockName,
        content: analysisText,
        displayTime: new Date().toLocaleString("zh-TW"),
        isCached: false
      });

      // 儲存到後端（後端存到 Redis）
      await axios.post(`${API_BASE_URL}/api/save-report`, {
        stockCode,
        stockName,
        content: analysisText
      });
    } catch (error) {
      console.error("AI 分析失敗:", error);
      upsertAnalysisResult({
        stockCode,
        stockName,
        content: "❌ 分析失敗，請稍後再試。",
        displayTime: new Date().toLocaleString("zh-TW"),
        isCached: false
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    analysisResults,
    loading,
    selectedStock,
    handleSearchNews,
    clearAnalysisResults
  };
}
