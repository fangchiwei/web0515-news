import { useState } from "react";
import StockTable from "./components/StockTable";
import HistoryModal from "./components/HistoryModal";
import BatchRunSection from "./components/BatchRunSection";
import AnalysisResult from "./components/AnalysisResult";
import TwStockScreening from "./components/TwStockScreening";
import { useStockNews } from "./hooks/useStockNews";
import { useStockHistory } from "./hooks/useStockHistory";

function App() {
  const [currentView, setCurrentView] = useState("us-stocks");

  const [stocks] = useState([
    { code: "NVDA", name: "英偉達" },
    { code: "EOSE", name: "EOSE" },
    { code: "ASTS", name: "ASTS" },
    { code: "TSM", name: "TSM" },
    { code: "CRCL", name: "CIRCLE" },
    { code: "AVGO", name: "AVGO" },
    { code: "SNDK", name: "SNDK" },
    { code: "NBIS", name: "NBIUS" },
    { code: "LEU", name: "LEU" },
    { code: "UUUU", name: "UUUU" }
  ]);

  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchStatus, setBatchStatus] = useState("");

  const { analysisResults, loading, selectedStock, handleSearchNews, clearAnalysisResults } =
    useStockNews();
  const {
    showHistory,
    setShowHistory,
    historyList,
    historyStock,
    loadingHistory,
    handleShowHistory,
    handleViewHistory
  } = useStockHistory();

  const handleBatchRun = async () => {
    if (batchRunning) return;

    const confirmed = window.confirm(
      `確定要查詢全部 ${stocks.length} 支股票的新聞嗎？\n這可能需要一些時間。`
    );
    if (!confirmed) return;

    setBatchRunning(true);
    setBatchProgress({ current: 0, total: stocks.length });
    clearAnalysisResults();

    for (let i = 0; i < stocks.length; i++) {
      const stock = stocks[i];
      setBatchProgress({ current: i + 1, total: stocks.length });
      setBatchStatus(`正在查詢 ${stock.name}(${stock.code})...`);

      try {
        await handleSearchNews(stock.code, stock.name);
        if (i < stocks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`${stock.name} 查詢失敗:`, error);
      }
    }

    setBatchRunning(false);
    setBatchStatus("✅ 全部查詢完成！");
    alert("所有股票查詢完成！");

    setTimeout(() => {
      setBatchProgress({ current: 0, total: 0 });
      setBatchStatus("");
    }, 3000);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      {/* 導航菜單 */}
      <div
        style={{
          backgroundColor: "#2c3e50",
          padding: "0",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          position: "sticky",
          top: 0,
          zIndex: 100
        }}
      >
        <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              onClick={() => setCurrentView("us-stocks")}
              style={{
                padding: "20px 30px",
                backgroundColor: currentView === "us-stocks" ? "#3498db" : "transparent",
                color: "white",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: currentView === "us-stocks" ? "bold" : "normal",
                transition: "background-color 0.3s",
                borderBottom: currentView === "us-stocks" ? "3px solid #3498db" : "none"
              }}
              onMouseEnter={(e) => {
                if (currentView !== "us-stocks") e.target.style.backgroundColor = "#34495e";
              }}
              onMouseLeave={(e) => {
                if (currentView !== "us-stocks") e.target.style.backgroundColor = "transparent";
              }}
            >
              🌍 美股新聞查詢
            </button>
            <button
              onClick={() => setCurrentView("tw-stocks")}
              style={{
                padding: "20px 30px",
                backgroundColor: currentView === "tw-stocks" ? "#27ae60" : "transparent",
                color: "white",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: currentView === "tw-stocks" ? "bold" : "normal",
                transition: "background-color 0.3s",
                borderBottom: currentView === "tw-stocks" ? "3px solid #27ae60" : "none"
              }}
              onMouseEnter={(e) => {
                if (currentView !== "tw-stocks") e.target.style.backgroundColor = "#34495e";
              }}
              onMouseLeave={(e) => {
                if (currentView !== "tw-stocks") e.target.style.backgroundColor = "transparent";
              }}
            >
              🇹🇼 台股籌碼面分析
            </button>
          </div>
        </div>
      </div>

      {/* 內容區域 */}
      <div style={{ padding: "50px 20px", maxWidth: "1400px", margin: "0 auto" }}>
        {currentView === "us-stocks" ? (
          <>
            <h2>美股新聞查詢系統</h2>

            <BatchRunSection
              batchRunning={batchRunning}
              batchProgress={batchProgress}
              batchStatus={batchStatus}
              handleBatchRun={handleBatchRun}
            />

            <StockTable
              stocks={stocks}
              handleSearchNews={handleSearchNews}
              handleShowHistory={handleShowHistory}
            />

            <HistoryModal
              showHistory={showHistory}
              setShowHistory={setShowHistory}
              historyStock={historyStock}
              loadingHistory={loadingHistory}
              historyList={historyList}
              handleViewHistory={handleViewHistory}
            />

            <AnalysisResult
              loading={loading}
              selectedStock={selectedStock}
              analysisResults={analysisResults}
            />
          </>
        ) : (
          <TwStockScreening />
        )}
      </div>
    </div>
  );
}

export default App;
