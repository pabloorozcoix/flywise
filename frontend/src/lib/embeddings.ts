/**
 * Embedding generation utility using Ollama's /api/embeddings endpoint.
 *
 * Generates 1536-dimension vector embeddings for text strings,
 * used for agent memory semantic search.
 */

/* c8 ignore next 2 -- env fallbacks */
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://ollama:11434";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "nomic-embed-text";

export interface EmbeddingResponse {
  embedding: number[];
}

/**
 * Generate a vector embedding for the given text using Ollama.
 *
 * @param text - The text to generate an embedding for
 * @param model - The embedding model to use (default: nomic-embed-text)
 * @returns A 1536-dimension vector embedding
 */
export async function generateEmbedding(
  text: string,
  model: string = EMBEDDING_MODEL
): Promise<number[]> {
  const response = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: text }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Ollama embedding request failed (${response.status}): ${errText}`
    );
  }

  const data: EmbeddingResponse = await response.json();

  if (!data.embedding || !Array.isArray(data.embedding)) {
    throw new Error("Invalid embedding response from Ollama");
  }

  return data.embedding;
}

/**
 * Generate embeddings for multiple texts in batch.
 *
 * @param texts - Array of texts to embed
 * @param model - The embedding model to use
 * @returns Array of embeddings in the same order as input texts
 */
export async function generateEmbeddings(
  texts: string[],
  model: string = EMBEDDING_MODEL
): Promise<number[][]> {
  const embeddings = await Promise.all(
    texts.map((text) => generateEmbedding(text, model))
  );
  return embeddings;
}
