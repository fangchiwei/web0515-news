import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

function TwStockScreening() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [minScore, setMinScore] = useState(60);
  const [minWhaleScore, setMinWhaleScore] = useState(60);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const fetchScreeningResults = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/tw-stock-screening?minScore=${minScore}&minWhaleScore=${minWhaleScore}`
        );
        const data = await response.json();

        if (data.success) {
          setStocks(data.data);
          setLastUpdated(new Date());
        } else {
          setError(data.message || "篩選失敗");
        }
      } catch (err) {
        setError(err.message);
        console.error("篩選失敗:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchScreeningResults();
  }, [minScore, minWhaleScore, refreshKey]);

  const handleScoreChange = (e) => {
    setMinScore(parseInt(e.target.value));
  };

  const handleWhaleScoreChange = (e) => {
    setMinWhaleScore(parseInt(e.target.value, 10));
  };

  const refreshData = () => {
    setLastUpdated(null);
    setRefreshKey((current) => current + 1);
  };

  const getColorByScore = (score) => {
    if (score >= 80) return "#27ae60";
    if (score >= 60) return "#2ecc71";
    if (score >= 40) return "#f39c12";
    if (score >= 20) return "#e67e22";
    return "#e74c3c";
  };

  const getStars = (score) => {
    if (score >= 80) return "★★★★★";
    if (score >= 60) return "★★★★☆";
    if (score >= 40) return "★★★☆☆";
    if (score >= 20) return "★★☆☆☆";
    return "★☆☆☆☆";
  };

  const containerStyle = { padding: "20px", maxWidth: "1400px", margin: "0 auto", fontFamily: "Arial, sans-serif" };
  const headerStyle = { marginBottom: "30px", borderBottom: "2px solid #2c3e50", paddingBottom: "15px" };
  const titleStyle = { fontSize: "24px", fontWeight: "bold", color: "#2c3e50", marginBottom: "10px" };
  const controlsStyle = { display: "flex", gap: "15px", alignItems: "center", marginBottom: "20px", flexWrap: "wrap" };
  const sliderContainerStyle = { display: "flex", alignItems: "center", gap: "10px" };
  const sliderStyle = { width: "200px", height: "6px", borderRadius: "3px", background: "#ddd", outline: "none" };
  const buttonStyle = { padding: "10px 20px", backgroundColor: "#3498db", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "14px", fontWeight: "bold", transition: "background-color 0.3s" };
  const refreshButtonStyle = { ...buttonStyle, backgroundColor: "#27ae60" };
  const statsStyle = { display: "flex", gap: "20px", marginBottom: "20px", flexWrap: "wrap" };
  const statBoxStyle = { backgroundColor: "#ecf0f1", padding: "15px", borderRadius: "4px", minWidth: "200px", textAlign: "center" };
  const statLabelStyle = { fontSize: "12px", color: "#7f8c8d", marginBottom: "5px" };
  const statValueStyle = { fontSize: "24px", fontWeight: "bold", color: "#2c3e50" };
  const tableStyle = { width: "100%", borderCollapse: "collapse", marginTop: "20px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" };
  const tableHeadStyle = { backgroundColor: "#34495e", color: "white" };
  const tableHeaderCellStyle = { padding: "15px", textAlign: "left", fontWeight: "bold", borderBottom: "2px solid #2c3e50" };
  const tableRowStyle = { borderBottom: "1px solid #ecf0f1" };
  const tableCellStyle = { padding: "12px 15px" };
  const scoreContainerStyle = { display: "flex", alignItems: "center", gap: "10px" };
  const scoreBarStyle = (score) => ({ display: "inline-block", width: `${score}px`, height: "20px", backgroundColor: getColorByScore(score), borderRadius: "2px", marginRight: "10px" });
  const indicatorStyle = { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px", marginTop: "10px", fontSize: "12px" };
  const indicatorItemStyle = { textAlign: "center", padding: "8px", backgroundColor: "#f5f5f5", borderRadius: "3px" };
  const positiveStyle = { color: "#27ae60", fontWeight: "bold" };
  const negativeStyle = { color: "#e74c3c", fontWeight: "bold" };
  const emptyStyle = { textAlign: "center", padding: "40px", color: "#7f8c8d", fontSize: "16px" };
  const errorStyle = { backgroundColor: "#ffe6e6", border: "1px solid #e74c3c", color: "#c0392b", padding: "15px", borderRadius: "4px", marginBottom: "20px" };
  const whaleBadgeStyle = (score) => ({ display: "inline-block", padding: "4px 10px", borderRadius: "999px", backgroundColor: score >= 75 ? "#d5f5e3" : score >= 60 ? "#fcf3cf" : "#f2f3f4", color: score >= 75 ? "#1e8449" : score >= 60 ? "#9a7d0a" : "#566573", fontSize: "12px", fontWeight: "bold" });

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>📊 台股籌碼面分析</div>
        <div style={{ fontSize: "14px", color: "#7f8c8d", marginTop: "5px" }}>
          {lastUpdated && `最後更新：${lastUpdated.toLocaleString("zh-TW")}`}
        </div>
      </div>

      {error && <div style={errorStyle}>⚠️ {error}</div>}

      <div style={controlsStyle}>
        <div style={sliderContainerStyle}>
          <label style={{ minWidth: "100px" }}>最低評分：</label>
          <input type="range" min="0" max="100" step="5" value={minScore} onChange={handleScoreChange} style={sliderStyle} />
          <span style={{ minWidth: "40px", fontWeight: "bold" }}>{minScore}</span>
        </div>
        <div style={sliderContainerStyle}>
          <label style={{ minWidth: "100px" }}>大戶門檻：</label>
          <input type="range" min="0" max="100" step="5" value={minWhaleScore} onChange={handleWhaleScoreChange} style={sliderStyle} />
          <span style={{ minWidth: "40px", fontWeight: "bold" }}>{minWhaleScore}</span>
        </div>
        <button onClick={refreshData} style={buttonStyle} disabled={loading}>
          {loading ? "更新中..." : "重新整理"}
        </button>
        <button onClick={refreshData} style={refreshButtonStyle} disabled={loading}>
          🔄 刷新
        </button>
      </div>

      <div style={statsStyle}>
        <div style={statBoxStyle}>
          <div style={statLabelStyle}>篩選結果</div>
          <div style={statValueStyle}>{stocks.length}</div>
        </div>
        <div style={statBoxStyle}>
          <div style={statLabelStyle}>最高大戶分數</div>
          <div style={statValueStyle}>{stocks.length > 0 ? stocks[0].whaleScore : "-"}</div>
        </div>
        <div style={statBoxStyle}>
          <div style={statLabelStyle}>平均評分</div>
          <div style={statValueStyle}>
            {stocks.length > 0 ? Math.round(stocks.reduce((sum, s) => sum + s.score, 0) / stocks.length) : "-"}
          </div>
        </div>
      </div>

      {stocks.length === 0 ? (
        <div style={emptyStyle}>{loading ? "加載中..." : `未找到評分 ≥ ${minScore} 的股票`}</div>
      ) : (
        <table style={tableStyle}>
          <thead style={tableHeadStyle}>
            <tr>
              <th style={tableHeaderCellStyle}>排名</th>
              <th style={tableHeaderCellStyle}>股票代號</th>
              <th style={tableHeaderCellStyle}>股票名稱</th>
              <th style={tableHeaderCellStyle}>股價</th>
              <th style={tableHeaderCellStyle}>漲跌%</th>
              <th style={tableHeaderCellStyle}>成交量</th>
              <th style={tableHeaderCellStyle}>大戶雷達</th>
              <th style={tableHeaderCellStyle}>籌碼面評分</th>
              <th style={tableHeaderCellStyle}>詳細指標</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock, index) => (
              <tr key={stock.code} style={tableRowStyle}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8f9fa")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
              >
                <td style={tableCellStyle}><strong>#{index + 1}</strong></td>
                <td style={tableCellStyle}><strong>{stock.code}</strong></td>
                <td style={tableCellStyle}>{stock.name}</td>
                <td style={tableCellStyle}>{stock.price > 0 ? `NT$${stock.price.toFixed(2)}` : "-"}</td>
                <td style={{ ...tableCellStyle, color: stock.change > 0 ? "#27ae60" : stock.change < 0 ? "#e74c3c" : "#000" }}>
                  {stock.change > 0 ? "+" : ""}{stock.change.toFixed(2)}%
                </td>
                <td style={tableCellStyle}>{stock.volume > 0 ? stock.volume.toLocaleString() : "-"}</td>
                <td style={tableCellStyle}>
                  <div style={{ fontWeight: "bold", marginBottom: "6px" }}>{stock.whaleScore}</div>
                  <div style={whaleBadgeStyle(stock.whaleScore)}>{stock.whaleProfile}</div>
                  <div style={{ fontSize: "12px", marginTop: "8px", lineHeight: 1.5 }}>
                    {(stock.whaleSignals || []).length > 0 ? stock.whaleSignals.join(" / ") : "無明顯大戶訊號"}
                  </div>
                </td>
                <td style={tableCellStyle}>
                  <div style={scoreContainerStyle}>
                    <div style={scoreBarStyle(stock.score)} />
                    <span style={{ fontWeight: "bold", color: getColorByScore(stock.score) }}>{stock.score}</span>
                  </div>
                  <div style={{ fontSize: "12px", marginTop: "5px" }}>{getStars(stock.score)}</div>
                </td>
                <td style={tableCellStyle}>
                  <div style={indicatorStyle}>
                    {[
                      { label: "外資", value: stock.indicators.foreignInvestor },
                      { label: "投信", value: stock.indicators.domesticFunds },
                      { label: "融資", value: stock.indicators.marginCall },
                      { label: "成交量", value: stock.indicators.volumeChange },
                      { label: "股價", value: stock.indicators.priceStrength }
                    ].map(({ label, value }) => (
                      <div key={label} style={indicatorItemStyle}>
                        <div>{label}</div>
                        <div style={value > 0 ? positiveStyle : negativeStyle}>
                          {value > 0 ? "+" : ""}{value}
                        </div>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default TwStockScreening;
