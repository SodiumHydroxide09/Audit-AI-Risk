"""
Layer 2 - Preprocessing: Chunking + Embedding
Splits extracted PDF text into chunks and converts them to vector embeddings.
Stores embeddings in ChromaDB for later retrieval by the RAG engine.
"""

import chromadb
from chromadb.utils import embedding_functions
from pathlib import Path


# --- Configuration ---
CHUNK_SIZE = 500        # characters per chunk
CHUNK_OVERLAP = 50      # overlap between chunks to preserve context
CHROMA_PATH = "chromadb"
COLLECTION_NAME = "audit_documents"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"  # free, runs locally via sentence-transformers


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """
    Split a long text string into overlapping chunks.
    Overlap helps preserve context across chunk boundaries.
    """
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += chunk_size - overlap

    return chunks


def chunk_pages(pages: list[dict]) -> list[dict]:
    """
    Take the list of pages from the PDF loader and chunk each page's text.
    Returns a flat list of chunk dicts with metadata.
    """
    all_chunks = []

    for page in pages:
        chunks = chunk_text(page["text"])
        for i, chunk in enumerate(chunks):
            all_chunks.append({
                "id": f"{page['source']}_p{page['page_number']}_c{i}",
                "text": chunk,
                "source": page["source"],
                "page_number": page["page_number"]
            })

    print(f"[Chunker] Created {len(all_chunks)} chunks from {len(pages)} pages")
    return all_chunks


def build_vector_store(chunks: list[dict]) -> chromadb.Collection:
    """
    Embed all chunks and store them in ChromaDB.
    Uses a local sentence-transformers model — no API key needed.
    """
    # Set up ChromaDB with persistent storage
    client = chromadb.PersistentClient(path=CHROMA_PATH)

    # Use local embedding model
    embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL
    )

    # Create or get existing collection
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_fn
    )

    # Add chunks in batches
    batch_size = 100
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        collection.add(
            ids=[c["id"] for c in batch],
            documents=[c["text"] for c in batch],
            metadatas=[{
                "source": c["source"],
                "page_number": c["page_number"]
            } for c in batch]
        )
        print(f"[Embedder] Stored batch {i // batch_size + 1} ({len(batch)} chunks)")

    print(f"[Embedder] Vector store ready — {collection.count()} total chunks stored")
    return collection


def load_vector_store() -> chromadb.Collection:
    """
    Load an existing ChromaDB collection (after first run).
    Call this instead of build_vector_store() once the DB is built.
    """
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL
    )
    collection = client.get_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_fn
    )
    print(f"[Embedder] Loaded existing vector store — {collection.count()} chunks")
    return collection


if __name__ == "__main__":
    # Test chunking with dummy text
    sample_text = "This is a test financial report. " * 50
    chunks = chunk_text(sample_text)
    print(f"Sample chunks created: {len(chunks)}")
    print(f"First chunk: {chunks[0][:100]}")
