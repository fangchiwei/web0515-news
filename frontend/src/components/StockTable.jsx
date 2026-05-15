import React from "react";

function StockTable({ stocks, handleSearchNews, handleShowHistory }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
      <thead>
        <tr style={{ backgroundColor: "#f0f0f0" }}>
          <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "left" }}>股票代號</th>
          <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "left" }}>股票名稱</th>
          <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center" }}>功能</th>
        </tr>
      </thead>
      <tbody>
        {stocks.map((stock) => (
          <tr key={stock.code}>
            <td style={{ padding: "12px", border: "1px solid #ddd" }}>{stock.code}</td>
            <td style={{ padding: "12px", border: "1px solid #ddd" }}>{stock.name}</td>
            <td style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center" }}>
              <button
                onClick={() => handleSearchNews(stock.code, stock.name, false)}
                style={{ padding: "8px 16px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", marginRight: "8px" }}
              >
                查詢新聞
              </button>
              <button
                onClick={() => handleSearchNews(stock.code, stock.name, true)}
                style={{ padding: "8px 16px", backgroundColor: "#FF5722", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", marginRight: "8px" }}
                title="強制重新查詢，即使今天已有記錄"
              >
                🔄 強制更新
              </button>
              <button
                onClick={() => handleShowHistory(stock.code, stock.name)}
                style={{ padding: "8px 16px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
              >
                📜 歷史
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default StockTable;
