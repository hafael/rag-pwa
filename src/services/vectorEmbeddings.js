import { pipeline, env } from '@xenova/transformers'

// Configurações do Transformers.js para ambiente Web
env.allowLocalModels = false
env.useBrowserCache = true

export class EmbeddingService {
  constructor() {
    this.pipe = null
    this.isLoading = false
    this.modelName = 'Xenova/all-MiniLM-L6-v2'
    this.dimensions = 384
  }

  /**
   * Inicializa o pipeline de extração de características (Embeddings)
   */
  async initPipeline(onProgress) {
    if (this.pipe) return this.pipe
    if (this.isLoading) {
      while (this.isLoading) {
        await new Promise(r => setTimeout(r, 100))
      }
      return this.pipe
    }

    this.isLoading = true
    try {
      this.pipe = await pipeline('feature-extraction', this.modelName, {
        progress_callback: (prog) => {
          if (onProgress) {
            onProgress({
              status: prog.status,
              file: prog.file,
              progress: prog.progress || 0
            })
          }
        }
      })
      return this.pipe
    } finally {
      this.isLoading = false
    }
  }

  /**
   * Gera o vetor de embedding (384 dimensões) normalizado para um texto
   */
  async generateEmbedding(text) {
    const pipe = await this.initPipeline()
    // Utiliza mean pooling e normalização L2 nativa
    const output = await pipe(text, { pooling: 'mean', normalize: true })
    return Array.from(output.data)
  }

  /**
   * Gera embeddings em lote com relatório de progresso
   */
  async generateBatchEmbeddings(texts, onBatchProgress) {
    const embeddings = []
    for (let i = 0; i < texts.length; i++) {
      const emb = await this.generateEmbedding(texts[i])
      embeddings.push(emb)
      onBatchProgress?.({
        current: i + 1,
        total: texts.length,
        percent: Math.round(((i + 1) / texts.length) * 100)
      })
    }
    return embeddings
  }

  /**
   * Calcula a Similaridade de Cosseno entre dois vetores normalizados
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0
    let dotProduct = 0
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i]
    }
    return dotProduct
  }
}

export const embeddingService = new EmbeddingService()
