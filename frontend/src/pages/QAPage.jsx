import { useState, useEffect, useRef } from "react";
import { askQuestion, getHistory } from "../api";
import { Send, MessageSquare, BookOpen, Loader } from "lucide-react";
import toast from "react-hot-toast";

const QUICK = [
  "What are the key risk indicators in this report?",
  "Summarise any unusual transactions or anomalies mentioned.",
  "What does the report say about revenue trends?",
  "Are there any compliance or regulatory concerns?",
  "Who are the key management personnel mentioned?",
  "What are the main business segments?",
];

export default function QAPage({ health }) {
  const [query, setQuery]     = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const bottomRef             = useRef(null);

  const loadHistory = async () => {
    try {
      const res = await getHistory();
      setHistory(res.data.history || []);
    } catch {}
  };

  useEffect(() => { loadHistory(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);

  const submit = async (q) => {
    const question = q || query.trim();
    if (!question) return;
    setQuery("");
    setLoading(true);
    try {
      const res = await askQuestion(question);
      setHistory(h => [...h, res.data]);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not get answer");
    }
    setLoading(false);
  };

  if (!health?.vector_store_ready) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>Document Q & A</h1>
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <MessageSquare size={40} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 15, color: "var(--text-muted)" }}>Upload a PDF document on the Overview page to enable Q&A.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "calc(100vh - 80px)" }}>
      <div style={{ animation: "fadeUp 0.5s ease forwards" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>Document Q & A</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>Ask anything about your uploaded financial documents</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, flex: 1, overflow: "hidden" }}>
        {/* Chat area */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0, overflow: "hidden" }}>
          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: 0 }}>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
              {history.length === 0 && !loading && (
                <div style={{ textAlign: "center", paddingTop: 40, color: "var(--text-muted)" }}>
                  <BookOpen size={36} style={{ margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "Syne", marginBottom: 6 }}>Ready to answer</div>
                  <div style={{ fontSize: 13 }}>Ask a question or pick one from the suggestions →</div>
                </div>
              )}

              {history.map((item, i) => (
                <div key={i} style={{ animation: "fadeUp 0.4s ease forwards" }}>
                  {/* Question */}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                    <div style={{
                      background: "var(--accent)",
                      color: "#fff",
                      padding: "10px 16px",
                      borderRadius: "14px 14px 4px 14px",
                      maxWidth: "75%",
                      fontSize: 14,
                      lineHeight: 1.5,
                      fontWeight: 500,
                    }}>
                      {item.query}
                    </div>
                  </div>

                  {/* Answer */}
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <MessageSquare size={14} style={{ color: "var(--accent)" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="card" style={{ padding: "14px 18px", background: "var(--bg-tertiary)" }}>
                        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
                          {item.answer}
                        </p>
                      </div>
                      {item.sources?.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                          {item.sources.map((s, si) => (
                            <span key={si} style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px" }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: "flex", gap: 10, animation: "fadeIn 0.3s ease" }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Loader size={14} style={{ color: "var(--accent)", animation: "spin 1s linear infinite" }} />
                  </div>
                  <div className="card shimmer" style={{ padding: "14px 18px", width: 200, height: 48 }} />
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="Ask a question about the documents..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && submit()}
                disabled={loading}
              />
              <button className="btn btn-primary" onClick={() => submit()} disabled={loading || !query.trim()}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Quick questions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, fontFamily: "Syne", color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12 }}>
              Quick Questions
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {QUICK.map((q, i) => (
                <button
                  key={i}
                  onClick={() => submit(q)}
                  disabled={loading}
                  style={{
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.4,
                    transition: "all 0.15s ease",
                    fontFamily: "DM Sans",
                  }}
                  onMouseEnter={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.color = "var(--text-primary)"; }}
                  onMouseLeave={e => { e.target.style.borderColor = "var(--border)"; e.target.style.color = "var(--text-secondary)"; }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, fontFamily: "Syne", color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>
              How RAG works
            </h3>
            {[
              ["1", "Your question is embedded into a vector"],
              ["2", "ChromaDB finds the 5 most relevant chunks"],
              ["3", "Chunks + question sent to Groq LLaMA3"],
              ["4", "Answer generated from document context only"],
            ].map(([n, t]) => (
              <div key={n} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--accent)", fontFamily: "Syne", minWidth: 16 }}>{n}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
