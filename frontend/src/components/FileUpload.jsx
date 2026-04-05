import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, CheckCircle, Loader, Play, X } from "lucide-react";
import { uploadPDF, uploadTable } from "../api";
import toast from "react-hot-toast";

export default function FileUpload({ onSuccess }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [tableFile, setTableFile] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleProcess = async () => {
    if (!pdfFile && !tableFile) {
      toast.error("Please select at least one file first");
      return;
    }
    setProcessing(true);
    try {
      if (pdfFile) {
        const res = await uploadPDF(pdfFile);
        toast.success(`PDF loaded — ${res.data.pages_loaded} pages, ${res.data.chunks_created} chunks`);
      }
      if (tableFile) {
        const res = await uploadTable(tableFile);
        toast.success(`Table loaded — ${res.data.tables_added} table(s) processed`);
      }
      onSuccess?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Processing failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <DropZone
        label="Financial Report (PDF)"
        accept={{ "application/pdf": [".pdf"] }}
        stagedFile={pdfFile}
        onDrop={files => setPdfFile(files[0])}
        onClear={() => setPdfFile(null)}
        hint="Annual reports, audit documents"
        disabled={processing}
      />
      <DropZone
        label="Financial Table (CSV / Excel)"
        accept={{ "text/csv": [".csv"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] }}
        stagedFile={tableFile}
        onDrop={files => setTableFile(files[0])}
        onClear={() => setTableFile(null)}
        hint="Transaction data, financial statements"
        disabled={processing}
      />
      <button
        className="btn btn-primary"
        style={{
          width: "100%",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "Syne",
          padding: "12px 16px",
          marginTop: 4,
          opacity: (!pdfFile && !tableFile) || processing ? 0.5 : 1,
          cursor: (!pdfFile && !tableFile) || processing ? "not-allowed" : "pointer",
        }}
        onClick={handleProcess}
        disabled={(!pdfFile && !tableFile) || processing}
      >
        {processing ? (
          <>
            <Loader size={15} style={{ animation: "spin 1s linear infinite" }} />
            Processing...
          </>
        ) : (
          <>
            <Play size={15} />
            Process Documents
          </>
        )}
      </button>
    </div>
  );
}

function DropZone({ label, accept, stagedFile, onDrop, onClear, hint, disabled }) {
  const [active, setActive] = useState(false);

  const onDropCb = useCallback(files => {
    setActive(false);
    if (files[0]) onDrop(files);
  }, [onDrop]);

  const { getRootProps, getInputProps } = useDropzone({
    accept,
    multiple: false,
    onDrop: onDropCb,
    onDragEnter: () => setActive(true),
    onDragLeave: () => setActive(false),
    disabled,
  });

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "Syne", color: "var(--text-secondary)", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div
        {...getRootProps()}
        className={`dropzone${active ? " active" : ""}`}
        style={{ padding: "20px 16px", opacity: disabled ? 0.6 : 1 }}
      >
        <input {...getInputProps()} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          {stagedFile ? (
            <CheckCircle size={22} style={{ color: "var(--success)" }} />
          ) : (
            <Upload size={22} style={{ color: "var(--text-muted)" }} />
          )}
          <div style={{ fontSize: 13, color: stagedFile ? "var(--success)" : "var(--text-secondary)", fontWeight: 500 }}>
            {stagedFile ? stagedFile.name : "Drop file or click to browse"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{hint}</div>
        </div>
      </div>
      {stagedFile && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            marginTop: 4, fontSize: 11, color: "var(--text-muted)",
            background: "none", border: "none", cursor: "pointer",
            padding: "2px 4px",
          }}
        >
          <X size={12} /> Remove
        </button>
      )}
    </div>
  );
}
