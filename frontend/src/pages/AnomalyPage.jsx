import { useEffect, useState } from "react";
import { getAnomalySummary, getFlaggedRows } from "../api";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

export default function AnomalyPage({ health }) {
  const [summary, setSummary]   = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [flagged, setFlagged]   = useState({});
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!health?.anomaly_results_count) return;
    getAnomalySummary().then(r => setSummary(r.data)).catch(() => {});
  }, [health]);

  const toggleTable = async (i) => {
    if (expanded === i) { setExpanded(null); return; }
    setExpanded(i);
    if (flagged[i]) return;
    setLoading(true);
    try {
      const res = await getFlaggedRows(i);
      setFlagged(f => ({ ...f, [i]: res.data }));
    } catch {}
    setLoading(false);
  };

  if (!health?.anomaly_results_count) {
    return (
      <Empty message="Upload a CSV or Excel file to run anomaly detection." />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ animation: "fadeUp 0.5s ease forwards" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
          Anomaly Detection
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
          Isolation Forest + Z-Score statistical analysis on your financial tables
        </p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {[
            { label: "Tables", value: summary.total_tables,       cls: "accent"  },
            { label: "Anomalies", value: summary.total_anomalies, cls: "danger"  },
            { label: "Z-Flags", value: summary.total_zscore_flags, cls: "warning" },
            { label: "High Risk", value: summary.high_risk_tables, cls: "danger"  },
          ].map(({ label, value, cls }, i) => (
            <div key={label} className={`metric-card ${cls}`} style={{ animation: "fadeUp 0.5s ease forwards", animationDelay: `${i * 80}ms`, opacity: 0 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "Syne", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
                {label}
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "Syne", color: "var(--text-primary)" }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Anomaly explanation */}
      <div className="card" style={{ padding: 20, display: "flex", gap: 20, flexWrap: "wrap" }}>
        {[
          { color: "var(--danger)",  label: "Isolation Forest", desc: "Flags rows that are statistically isolated from the rest of the data — harder to isolate = normal, easy to isolate = anomaly" },
          { color: "var(--warning)", label: "Z-Score > 3σ",     desc: "Flags values that are more than 3 standard deviations from the column mean — the classic statistical outlier rule" },
        ].map(({ color, label, desc }) => (
          <div key={label} style={{ display: "flex", gap: 12, flex: 1, minWidth: 240 }}>
            <div style={{ width: 3, background: color, borderRadius: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Syne", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tables */}
      {summary?.summary?.map((row, i) => (
        <div key={i} className="card" style={{ overflow: "hidden", animation: "fadeUp 0.5s ease forwards", animationDelay: `${i * 100}ms`, opacity: 0 }}>
          {/* Table header */}
          <div
            onClick={() => toggleTable(i)}
            style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderBottom: expanded === i ? "1px solid var(--border)" : "none" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ padding: 8, borderRadius: 8, background: "var(--bg-tertiary)" }}>
                <AlertTriangle size={16} style={{ color: row["IF Anomalies"] > 0 ? "var(--danger)" : "var(--text-muted)" }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Syne" }}>
                  {row.Source} — {row.Sheet}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {row["Total Rows"]} rows · {row["IF Anomalies"]} anomalies · {row["Z-Score Flags"]} z-flags
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className={`badge-${row["Risk Level"]?.toLowerCase()}`} style={{ padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: "Syne" }}>
                {row["Risk Level"]}
              </span>
              {expanded === i ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />}
            </div>
          </div>

          {/* Expanded flagged rows */}
          {expanded === i && (
            <div style={{ overflowX: "auto" }}>
              {loading && !flagged[i] ? (
                <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading flagged rows...</div>
              ) : flagged[i]?.flagged_rows === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No anomalies detected in this table.</div>
              ) : flagged[i]?.data?.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      {Object.keys(flagged[i].data[0]).map(k => (
                        <th key={k}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {flagged[i].data.map((row, ri) => (
                      <tr key={ri} className="anomaly">
                        {Object.values(row).map((v, vi) => (
                          <td key={vi}>{typeof v === "number" ? v.toLocaleString() : String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Empty({ message }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>Anomaly Detection</h1>
      <div className="card" style={{ padding: 48, textAlign: "center" }}>
        <AlertTriangle size={40} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
        <div style={{ fontSize: 15, color: "var(--text-muted)" }}>{message}</div>
      </div>
    </div>
  );
}
