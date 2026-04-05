from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from src.anomaly.detector import get_anomaly_summary, run_anomaly_detection
from src.ingestion.pdf_loader import load_pdf
from src.preprocessing.chunker import build_vector_store, chunk_pages
from src.rag.rag_engine import ask as rag_ask
from src.report.report_generator import generate_report

BASE_DIR = Path(__file__).resolve().parent.parent
CHROMA_DIR = BASE_DIR / "chromadb"
DATA_PROCESSED_DIR = BASE_DIR / "data" / "processed"

app = FastAPI(title="Audit Risk AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app_state: dict[str, Any] = {
    "collection": None,
    "anomaly_results": [],
    "rag_history": [],
    "vector_store_built": False,
}


def _df_to_json_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    if df is None or df.empty:
        return []

    df_norm = df.copy()
    df_norm = df_norm.where(pd.notnull(df_norm), None)

    records = df_norm.to_dict(orient="records")
    for r in records:
        for k, v in list(r.items()):
            if isinstance(v, np.generic):
                r[k] = v.item()
    return records


def _get_table_flagged_rows(table_index: int) -> dict[str, Any]:
    if table_index < 0 or table_index >= len(app_state["anomaly_results"]):
        raise HTTPException(status_code=404, detail="table_index out of range")

    result = app_state["anomaly_results"][table_index]
    df: pd.DataFrame = result["dataframe"]
    if "is_anomaly" not in df.columns:
        raise HTTPException(status_code=400, detail="No anomaly flags available for this table")

    flagged_df = df[df["is_anomaly"] == True]
    records = _df_to_json_records(flagged_df)
    return {
        "source": result.get("source"),
        "sheet": result.get("sheet"),
        "n_flagged": int(len(flagged_df)),
        "flagged_rows": int(len(flagged_df)),
        "rows": records,
        "data": records,
    }


@app.get("/api/")
def health() -> dict[str, Any]:
    return {
        "vector_store_ready": bool(app_state.get("vector_store_built") and app_state.get("collection") is not None),
        "anomaly_results_count": len(app_state.get("anomaly_results") or []),
        "rag_history_count": len(app_state.get("rag_history") or []),
    }


@app.post("/api/upload/pdf")
async def upload_pdf(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a .pdf file")

    suffix = Path(file.filename).suffix or ".pdf"
    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            tmp.write(await file.read())

        pages = load_pdf(tmp_path)
        chunks = chunk_pages(pages)
        collection = build_vector_store(chunks)

        app_state["collection"] = collection
        app_state["vector_store_built"] = True

        return {
            "message": "PDF processed successfully",
            "pages_loaded": int(len(pages)),
            "chunks_created": int(len(chunks)),
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/api/upload/table")
async def upload_table(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in {".csv", ".xlsx"}:
        raise HTTPException(status_code=400, detail="Please upload a .csv or .xlsx file")

    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            tmp.write(await file.read())

        tables: list[dict[str, Any]] = []
        if suffix == ".csv":
            df = pd.read_csv(tmp_path)
            tables.append({"source": file.filename, "sheet": "main", "dataframe": df})
        else:
            sheets = pd.read_excel(tmp_path, sheet_name=None)
            for sheet_name, df in sheets.items():
                tables.append({"source": file.filename, "sheet": sheet_name, "dataframe": df})

        results = run_anomaly_detection(tables, log_to_mlflow=False)
        for res in results:
            app_state["anomaly_results"] = [
                r for r in app_state["anomaly_results"]
                if not (r.get("source") == res.get("source") and r.get("sheet") == res.get("sheet"))
            ]
        app_state["anomaly_results"].extend(results)

        return {
            "message": "Table(s) processed successfully",
            "tables_added": int(len(results)),
            "total_tables": int(len(app_state["anomaly_results"])),
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


class AskRequest(BaseModel):
    question: str


@app.post("/api/ask")
def ask_endpoint(payload: AskRequest) -> dict[str, Any]:
    question = (payload.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="question must be non-empty")

    if not app_state.get("vector_store_built") or app_state.get("collection") is None:
        raise HTTPException(status_code=400, detail="Vector store is not ready. Upload a PDF first.")

    result = rag_ask(question, app_state["collection"])
    app_state["rag_history"].append(result)

    return {
        "query": result.get("query"),
        "answer": result.get("answer"),
        "sources": result.get("sources", []),
        "chunks_used": result.get("chunks_used"),
    }


@app.get("/api/ask/history")
def ask_history() -> list[dict[str, Any]]:
    return app_state.get("rag_history") or []


@app.get("/api/anomaly/summary")
def anomaly_summary() -> dict[str, Any]:
    results = app_state.get("anomaly_results") or []
    if not results:
        return {
            "total_tables": 0,
            "total_anomalies": 0,
            "total_zscore_flags": 0,
            "high_risk_tables": 0,
            "summary": [],
        }
    summary_df = get_anomaly_summary(results)
    records = _df_to_json_records(summary_df)
    return {
        "total_tables": len(records),
        "total_anomalies": int(summary_df["IF Anomalies"].sum()),
        "total_zscore_flags": int(summary_df["Z-Score Flags"].sum()),
        "high_risk_tables": int((summary_df["Risk Level"] == "HIGH").sum()),
        "summary": records,
    }


@app.get("/api/anomaly/flagged/{table_index}")
def anomaly_flagged(table_index: int) -> dict[str, Any]:
    return _get_table_flagged_rows(table_index)


@app.get("/api/report/generate")
def report_generate() -> FileResponse:
    anomaly_results: list[dict[str, Any]] = app_state.get("anomaly_results") or []
    rag_history: list[dict[str, Any]] = app_state.get("rag_history") or []

    if not anomaly_results and not rag_history:
        raise HTTPException(status_code=400, detail="Nothing to generate a report from. Upload data and ask at least one question.")

    DATA_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    report_path = DATA_PROCESSED_DIR / "risk_report.pdf"

    anomaly_summary_df = get_anomaly_summary(anomaly_results) if anomaly_results else pd.DataFrame()

    generate_report(
        rag_results=rag_history,
        anomaly_summary=anomaly_summary_df,
        anomaly_tables=anomaly_results,
        output_path=str(report_path),
    )

    return FileResponse(
        path=str(report_path),
        media_type="application/pdf",
        filename="audit_risk_report.pdf",
    )


@app.post("/api/reset")
def reset() -> dict[str, Any]:
    app_state["collection"] = None
    app_state["anomaly_results"] = []
    app_state["rag_history"] = []
    app_state["vector_store_built"] = False

    if CHROMA_DIR.exists():
        shutil.rmtree(CHROMA_DIR, ignore_errors=True)

    return {"message": "API state cleared and chromadb folder deleted"}