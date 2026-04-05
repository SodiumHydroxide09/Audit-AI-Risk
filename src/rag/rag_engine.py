"""
Layer 3 - RAG Engine
Retrieves relevant document chunks from ChromaDB,
then sends them to Groq's LLM to generate an answer.
This is the core question-answering system of the project.
"""

import os
from dotenv import load_dotenv
from groq import Groq
import chromadb
from chromadb.utils import embedding_functions

load_dotenv()

# --- Configuration ---
CHROMA_PATH = "chromadb"
COLLECTION_NAME = "audit_documents"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
GROQ_MODEL = "llama-3.3-70b-versatile"   # fast and free on Groq
TOP_K = 5                        # number of chunks to retrieve per query


def get_collection() -> chromadb.Collection:
    """Load the ChromaDB collection."""
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL
    )
    return client.get_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_fn
    )


def retrieve_chunks(query: str, collection: chromadb.Collection, top_k: int = TOP_K) -> list[dict]:
    """
    Search ChromaDB for the most relevant chunks to the query.
    Returns a list of matching chunks with their metadata.
    """
    results = collection.query(
        query_texts=[query],
        n_results=top_k
    )

    chunks = []
    for i in range(len(results["documents"][0])):
        chunks.append({
            "text": results["documents"][0][i],
            "source": results["metadatas"][0][i].get("source", "unknown"),
            "page": results["metadatas"][0][i].get("page_number", "?"),
            "score": results["distances"][0][i] if results.get("distances") else None
        })

    return chunks


def build_prompt(query: str, chunks: list[dict]) -> str:
    """
    Build the final prompt by injecting retrieved chunks as context.
    Uses a structured system prompt tuned for financial risk analysis.
    """
    context = "\n\n".join([
        f"[Source: {c['source']}, Page {c['page']}]\n{c['text']}"
        for c in chunks
    ])

    prompt = f"""You are a financial audit assistant at a Big 4 consulting firm.
Your job is to analyse financial documents and identify risks, anomalies, and key findings.
Answer the question below using ONLY the provided document context.
If the answer is not in the context, say "Not found in the provided documents."
Be precise, structured, and highlight any risk flags clearly.

--- DOCUMENT CONTEXT ---
{context}

--- QUESTION ---
{query}

--- YOUR ANALYSIS ---"""

    return prompt


def ask(query: str, collection: chromadb.Collection = None) -> dict:
    """
    Main RAG function. Given a query:
    1. Retrieves relevant chunks from ChromaDB
    2. Builds a prompt with context
    3. Sends to Groq LLM
    4. Returns the answer with sources
    """
    if collection is None:
        collection = get_collection()

    # Step 1: Retrieve
    chunks = retrieve_chunks(query, collection)

    if not chunks:
        return {
            "query": query,
            "answer": "No relevant documents found in the vector store.",
            "sources": []
        }

    # Step 2: Build prompt
    prompt = build_prompt(query, chunks)

    # Step 3: Call Groq
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,   # low temperature = more factual, less creative
        max_tokens=1024
    )

    answer = response.choices[0].message.content

    # Step 4: Return result
    sources = list(set([f"{c['source']} (page {c['page']})" for c in chunks]))

    return {
        "query": query,
        "answer": answer,
        "sources": sources,
        "chunks_used": len(chunks)
    }


if __name__ == "__main__":
    # Test with a sample query (requires vector store to be built first)
    test_queries = [
        "What are the key risk indicators in this report?",
        "Summarise any unusual transactions or financial anomalies.",
        "What does the report say about revenue trends?"
    ]

    collection = get_collection()
    for query in test_queries:
        print(f"\nQ: {query}")
        result = ask(query, collection)
        print(f"A: {result['answer'][:300]}...")
        print(f"Sources: {result['sources']}")
