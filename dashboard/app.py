"""
Dashboard - Streamlit App
The main UI for the Audit Risk Intelligence System.

This version calls the FastAPI backend instead of invoking `src/*` functions directly.
Run with: streamlit run dashboard/app.py
"""

import sys
import os
from pathlib import Path
from typing import Any, Optional

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import requests
import streamlit as st

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BACKEND_URL = "http://localhost:8001/api"


def get_health() -> Optional[dict[str, Any]]:
    try:
        resp = requests.get(f"{BACKEND_URL}/", timeout=5)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException:
        return None


def api_post(endpoint: str, **kwargs) -> Optional[Any]:
    url = f"{BACKEND_URL}{endpoint}"
    try:
        resp = requests.post(url, timeout=300, **kwargs)
    except requests.exceptions.RequestException as e:
        st.error(f"API POST failed: {e}")
        return None

    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text
        st.error(f"API POST {endpoint} failed: {detail}")
        return None

    content_type = resp.headers.get("content-type", "")
    if content_type.startswith("application/json"):
        return resp.json()
    return resp.text


def api_get(endpoint: str) -> Optional[Any]:
    url = f"{BACKEND_URL}{endpoint}"
    try:
        resp = requests.get(url, timeout=300)
    except requests.exceptions.RequestException as e:
        st.error(f"API GET failed: {e}")
        return None

    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text
        st.error(f"API GET {endpoint} failed: {detail}")
        return None

    content_type = resp.headers.get("content-type", "")
    if content_type.startswith("application/json"):
        return resp.json()
    # Used by the report endpoint which returns application/pdf bytes
    return resp.content


def refresh_anomaly_summary() -> None:
    resp = api_get("/anomaly/summary")
    if resp is None:
        return
    # The endpoint now returns a nested object; extract the summary list for the dataframe
    records = resp.get("summary", []) if isinstance(resp, dict) else resp
    st.session_state.anomaly_summary_records = records
    st.session_state.anomaly_summary_df = pd.DataFrame(records)


def refresh_rag_history() -> None:
    history = api_get("/ask/history")
    if history is None:
        return
    st.session_state.rag_history = history


# --- Page Config ---
st.set_page_config(
    page_title="Audit Risk Intelligence",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- Styling ---
st.markdown(
    """
<style>
    .risk-high { color: #dc3545; font-weight: bold; }
    .risk-medium { color: #fd7e14; font-weight: bold; }
    .risk-low { color: #28a745; font-weight: bold; }
    .metric-card { background: #f8f9fa; padding: 1rem; border-radius: 8px; }
</style>
""",
    unsafe_allow_html=True,
)


# --- Session State ---
if "backend_health" not in st.session_state:
    st.session_state.backend_health = None
if "anomaly_summary_records" not in st.session_state:
    st.session_state.anomaly_summary_records = []
if "anomaly_summary_df" not in st.session_state:
    st.session_state.anomaly_summary_df = pd.DataFrame()
if "rag_history" not in st.session_state:
    st.session_state.rag_history = []


# --- Sidebar ---
with st.sidebar:
    st.image("https://img.icons8.com/color/96/audit.png", width=60)
    st.title("Audit Risk AI")
    st.caption("Powered by Groq + ChromaDB + Streamlit")
    st.divider()

    st.subheader("Backend Status")
    health = get_health()
    st.session_state.backend_health = health
    if health is not None:
        st.success("Backend connected")
    else:
        st.error("Backend not running")

    st.divider()

    st.subheader("Upload Documents")
    pdf_files = st.file_uploader(
        "Financial Reports (PDF)", type=["pdf"], accept_multiple_files=True
    )
    excel_files = st.file_uploader(
        "Financial Tables (Excel/CSV)", type=["xlsx", "csv"], accept_multiple_files=True
    )

    process_btn = st.button("Process Documents", type="primary", use_container_width=True)
    st.divider()

    st.subheader("Quick Audit Questions")
    quick_questions = [
        "What are the key risk indicators in this report?",
        "Summarise unusual transactions or anomalies mentioned.",
        "What does the report say about revenue trends?",
        "Are there any compliance or regulatory concerns?",
        "What are the main findings and recommendations?",
    ]
    selected_question = st.selectbox("Select a question", [""] + quick_questions)

    st.divider()

    reset_btn = st.button("Reset (clear API state)", type="secondary", use_container_width=True)


# --- Main Area ---
st.title("AI-Powered Audit & Risk Intelligence System")
st.caption("Upload financial documents → detect anomalies → ask questions → download risk report")

tab1, tab2, tab3, tab4 = st.tabs(["📊 Overview", "🔴 Anomaly Detection", "💬 Document Q&A", "📄 Risk Report"])


# ============================================================
# Reset
# ============================================================
if reset_btn:
    with st.spinner("Resetting backend..."):
        api_post("/reset")

    st.session_state.rag_history = []
    st.session_state.anomaly_summary_records = []
    st.session_state.anomaly_summary_df = pd.DataFrame()
    st.session_state.backend_health = get_health()
    refresh_anomaly_summary()
    refresh_rag_history()
    st.rerun()


# ============================================================
# TAB 1: Overview / Process Documents
# ============================================================
with tab1:
    if process_btn:
        if st.session_state.backend_health is None:
            st.error("Backend not running at http://localhost:8000")
        elif not pdf_files and not excel_files:
            st.warning("Please upload at least one PDF or Excel/CSV file.")
        else:
            with st.spinner("Processing documents in backend..."):
                if pdf_files:
                    for uploaded_pdf in pdf_files:
                        files = {
                            "file": (
                                uploaded_pdf.name,
                                uploaded_pdf.getvalue(),
                                "application/pdf",
                            )
                        }
                        api_post("/upload/pdf", files=files)

                if excel_files:
                    for uploaded_excel in excel_files:
                        # Backend determines CSV vs Excel by filename extension
                        mime = uploaded_excel.type or "application/octet-stream"
                        files = {"file": (uploaded_excel.name, uploaded_excel.getvalue(), mime)}
                        api_post("/upload/table", files=files)

            # Refresh health + summaries
            st.session_state.backend_health = get_health()
            refresh_anomaly_summary()
            refresh_rag_history()

            st.success("Processing complete.")

    # Summary metrics
    if st.session_state.anomaly_summary_df is not None and not st.session_state.anomaly_summary_df.empty:
        summary = st.session_state.anomaly_summary_df
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Tables Analysed", len(summary))
        col2.metric("Total Anomalies", int(summary["IF Anomalies"].sum()))
        col3.metric("Z-Score Flags", int(summary["Z-Score Flags"].sum()))
        high_risk = len(summary[summary["Risk Level"] == "HIGH"])
        col4.metric("High Risk Tables", high_risk, delta=f"{high_risk} need review" if high_risk else None)

        st.subheader("Risk Overview")
        fig = px.bar(
            summary,
            x="Source",
            y="IF Anomalies",
            color="Risk Level",
            color_discrete_map={"HIGH": "#dc3545", "MEDIUM": "#fd7e14", "LOW": "#28a745"},
            title="Anomalies per Data Source",
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("Upload documents and click **Process Documents** to begin.")


# ============================================================
# TAB 2: Anomaly Detection
# ============================================================
with tab2:
    st.subheader("Anomaly Detection Results")

    if st.session_state.anomaly_summary_df is None or st.session_state.anomaly_summary_df.empty:
        st.info("No anomaly results yet. Upload Excel/CSV files and process them.")
    else:
        summary_df = st.session_state.anomaly_summary_df.reset_index(drop=True)

        # Show flagged rows per table
        for i in range(len(summary_df)):
            source = summary_df.loc[i, "Source"]
            sheet = summary_df.loc[i, "Sheet"]
            n_anomalies = summary_df.loc[i, "IF Anomalies"]

            with st.expander(f"📋 {source} — {sheet} ({n_anomalies} anomalies)"):
                flagged_resp = api_get(f"/anomaly/flagged/{i}")
                if not flagged_resp or not flagged_resp.get("rows"):
                    st.write("No anomalies detected in this table.")
                else:
                    rows_df = pd.DataFrame(flagged_resp.get("rows", []))
                    st.write(f"**{len(rows_df)} anomalous rows detected:**")

                    display_cols = [c for c in rows_df.columns if c not in ["zscore_flag"]]
                    if "max_zscore" in rows_df.columns:
                        st.dataframe(
                            rows_df[display_cols],
                            use_container_width=True,
                        )
                    else:
                        st.dataframe(rows_df[display_cols], use_container_width=True)

                    # Optional: scatter plot of anomaly scores if column exists
                    if "anomaly_score" in rows_df.columns:
                        fig = go.Figure()
                        fig.add_trace(
                            go.Scatter(
                                x=list(range(len(rows_df))),
                                y=rows_df["anomaly_score"],
                                mode="markers",
                                name="Anomalies",
                                marker=dict(color="#dc3545", size=8, symbol="x"),
                            )
                        )
                        fig.update_layout(
                            title="Anomaly Scores (flagged rows)",
                            height=300,
                        )
                        st.plotly_chart(fig, use_container_width=True, key=f"anomaly_plot_{i}")


# ============================================================
# TAB 3: RAG Q&A
# ============================================================
with tab3:
    st.subheader("Document Question & Answer")

    vector_store_ready = bool(st.session_state.backend_health and st.session_state.backend_health.get("vector_store_ready"))
    if not vector_store_ready:
        st.info("Upload PDF files and process them to enable Q&A.")
    else:
        # Pre-fill from sidebar quick questions
        default_q = selected_question if selected_question else ""
        user_query = st.text_input(
            "Ask a question about your documents:",
            value=default_q,
            placeholder="e.g. What are the key risk indicators?",
        )

        if st.button("Ask", type="primary") and user_query:
            with st.spinner("Searching documents and generating answer..."):
                api_post("/ask", json={"question": user_query})
                refresh_rag_history()

        # Display Q&A history
        if st.session_state.rag_history:
            for result in reversed(st.session_state.rag_history):
                with st.container():
                    st.markdown(f"**Q: {result.get('query')}**")
                    st.markdown(result.get("answer", ""))
                    sources = result.get("sources") or []
                    if sources:
                        st.caption("Sources: " + " | ".join(sources))
                    st.divider()


# ============================================================
# TAB 4: Report Generation
# ============================================================
with tab4:
    st.subheader("Generate Risk Report")

    if not st.session_state.rag_history and (
        st.session_state.anomaly_summary_df is None or st.session_state.anomaly_summary_df.empty
    ):
        st.info("Process documents and run at least one Q&A query before generating a report.")
    else:
        st.write("Click below to generate a full PDF risk report combining anomaly results and Q&A findings.")

        if st.button("Generate PDF Report", type="primary"):
            with st.spinner("Generating report..."):
                try:
                    response = requests.get(f"{BACKEND_URL}/report/generate", timeout=300)
                    response.raise_for_status()
                except requests.exceptions.RequestException as e:
                    st.error(f"Report generation failed: {e}")
                    response = None

                if response is not None:
                    st.download_button(
                        label="Download Risk Report PDF",
                        data=response.content,
                        file_name="audit_risk_report.pdf",
                        mime="application/pdf",
                        type="primary",
                    )
                    st.success("Report generated successfully!")

