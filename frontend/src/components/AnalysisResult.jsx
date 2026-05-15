import React from "react";

function AnalysisResult({ loading, selectedStock, analysisResults }) {
  return (
    <>
      {loading && (
        <div style={{ marginTop: "30px", textAlign: "center", padding: "20px" }}>
          <div style={{ fontSize: "24px", marginBottom: "10px" }}>🔍</div>
          <p>正在分析 {selectedStock} 的最新資訊...</p>
          <p style={{ color: "#666", fontSize: "14px" }}>使用 AI 搜尋並整理新聞中，請稍候...</p>
        </div>
      )}

      {!loading && analysisResults.length > 0 && (
        <div style={{ marginTop: "30px" }}>
          <h3 style={{ padding: "15px", backgroundColor: "#4CAF50", color: "white", borderRadius: "5px 5px 0 0", margin: 0 }}>
            🤖 今日查詢結果（{analysisResults.length} 支）
          </h3>
          <div style={{ padding: "20px", border: "2px solid #4CAF50", borderTop: "none", borderRadius: "0 0 5px 5px", backgroundColor: "#f9f9f9" }}>
            {analysisResults.map((result) => (
              <div key={result.stockCode} style={{ marginBottom: "20px", backgroundColor: "white", border: "1px solid #ddd", borderRadius: "6px", overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", backgroundColor: "#e8f5e9", borderBottom: "1px solid #ddd", fontWeight: "bold" }}>
                  {result.stockCode} {result.stockName}
                  {result.isCached ? "（今日既有記錄）" : ""}
                  <span style={{ marginLeft: "10px", fontWeight: "normal", color: "#666", fontSize: "13px" }}>
                    {result.displayTime}
                  </span>
                </div>
                <div style={{ padding: "16px", whiteSpace: "pre-wrap", lineHeight: "1.8" }}>
                  {result.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default AnalysisResult;
