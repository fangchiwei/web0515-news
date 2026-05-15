import React from "react";

function HistoryModal({ showHistory, setShowHistory, historyStock, loadingHistory, historyList, handleViewHistory }) {
  if (!showHistory) return null;

  return (
    <div
      onClick={() => setShowHistory(false)}
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: "white", padding: "30px", borderRadius: "10px", maxWidth: "800px", width: "90%", maxHeight: "80vh", overflow: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ margin: 0 }}>📜 {historyStock.name}({historyStock.code}) 歷史記錄</h3>
          <button onClick={() => setShowHistory(false)} style={{ padding: "8px 16px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
            關閉
          </button>
        </div>

        {loadingHistory ? (
          <p style={{ textAlign: "center", padding: "20px" }}>載入中...</p>
        ) : historyList.length === 0 ? (
          <p style={{ textAlign: "center", padding: "20px", color: "#666" }}>尚無歷史記錄</p>
        ) : (
          <div>
            {historyList.map((item, index) => (
              <div
                key={index}
                onClick={() => handleViewHistory(item.date, item.fileName)}
                style={{ padding: "15px", border: "1px solid #ddd", borderRadius: "5px", marginBottom: "10px", cursor: "pointer", backgroundColor: "#f9f9f9" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e3f2fd")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f9f9f9")}
              >
                <div style={{ fontWeight: "bold", marginBottom: "5px" }}>📅 {item.displayTime}</div>
                <div style={{ fontSize: "14px", color: "#666" }}>{item.fileName}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryModal;
