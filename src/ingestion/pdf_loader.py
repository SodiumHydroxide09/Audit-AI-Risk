"""
Layer 1 - PDF Ingestion
Reads PDF files from data/raw/ and extracts text page by page.
Uses PyMuPDF (fitz) for fast, accurate extraction.
"""

import fitz  # PyMuPDF
import os
from pathlib import Path


def load_pdf(file_path: str) -> list[dict]:
    """
    Load a single PDF and return a list of pages.
    Each page is a dict with 'page_number', 'text', and 'source'.
    """
    doc = fitz.open(file_path)
    pages = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text().strip()

        if text:  # skip blank pages
            pages.append({
                "page_number": page_num + 1,
                "text": text,
                "source": Path(file_path).name
            })

    doc.close()
    print(f"[PDF Loader] Loaded {len(pages)} pages from {Path(file_path).name}")
    return pages


def load_all_pdfs(folder_path: str = "data/raw") -> list[dict]:
    """
    Load all PDFs from a folder.
    Returns a combined list of all pages across all PDFs.
    """
    all_pages = []
    pdf_files = list(Path(folder_path).glob("*.pdf"))

    if not pdf_files:
        print(f"[PDF Loader] No PDF files found in {folder_path}")
        return []

    for pdf_file in pdf_files:
        pages = load_pdf(str(pdf_file))
        all_pages.extend(pages)

    print(f"[PDF Loader] Total pages loaded: {len(all_pages)}")
    return all_pages


if __name__ == "__main__":
    pages = load_all_pdfs("data/raw")
    if pages:
        print("\n--- Sample from first page ---")
        print(pages[0]["text"][:500])
