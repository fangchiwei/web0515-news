import React from "react";

function BatchRunSection({ batchRunning, batchProgress, batchStatus, handleBatchRun }) {
  return (
    <div style={{ marginTop: "20px", marginBottom: "20px" }}>
      <button
        onClick={handleBatchRun}
        disabled={batchRunning}
        style={{
          padding: "12px 24px",
          backgroundColor: batchRunning ? "#999" : "#FF9800",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: batchRunning ? "not-allowed" : "pointer",
          fontSize: "16px",
          fontWeight: "bold"
        }}
      >
        {batchRunning ? "⏳ 批次查詢中..." : "🚀 批次查詢全部股票"}
      </button>

      {batchRunning && (
        <div style={{ marginTop: "15px", padding: "15px", backgroundColor: "#fff3cd", border: "1px solid #ffc107", borderRadius: "5px" }}>
          <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
            進度：{batchProgress.current} / {batchProgress.total}
          </div>
          <div style={{ color: "#666" }}>{batchStatus}</div>
          <div style={{ marginTop: "10px", height: "10px", backgroundColor: "#e0e0e0", borderRadius: "5px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(batchProgress.current / batchProgress.total) * 100}%`, backgroundColor: "#4CAF50", transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {!batchRunning && batchStatus && (
        <div style={{ marginTop: "15px", padding: "15px", backgroundColor: "#d4edda", border: "1px solid #28a745", borderRadius: "5px", color: "#155724" }}>
          {batchStatus}
        </div>
      )}
    </div>
  );
}

export default BatchRunSection;
