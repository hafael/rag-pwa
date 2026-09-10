/**
 * Motor de Busca Esparsa BM25 implementado em JavaScript Puro
 * Adequado para execução rápida client-side e Web Workers
 */

export class BM25Index {
  constructor(k1 = 1.2, b = 0.75) {
    this.k1 = k1
    this.b = b
    this.docs = [] // Array de { id, tokens, length, original }
    this.docCount = 0
    this.avgDocLength = 0
    this.docFrequencies = new Map() // termo -> número de documentos que o contém
  }

  /**
   * Tokenizador e normalizador de texto
   */
  tokenize(text) {
    if (!text) return []
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
      .replace(/[^\w\s-]/g, ' ') // remove pontuações mantendo hífen
      .split(/\s+/)
      .filter(token => token.length > 1) // ignora caracteres isolados
  }

  /**
   * Constrói o índice BM25 a partir de uma lista de Chunks Filhos
   */
  buildIndex(childChunks) {
    this.docs = []
    this.docFrequencies.clear()
    this.docCount = childChunks.length

    let totalTokens = 0

    for (const chunk of childChunks) {
      const tokens = this.tokenize(chunk.content)
      const docLength = tokens.length
      totalTokens += docLength

      const uniqueTokens = new Set(tokens)
      for (const token of uniqueTokens) {
        this.docFrequencies.set(token, (this.docFrequencies.get(token) || 0) + 1)
      }

      this.docs.push({
        id: chunk.id,
        parentId: chunk.parentId,
        docId: chunk.docId,
        kbId: chunk.kbId,
        content: chunk.content,
        tokens,
        docLength,
        rawChunk: chunk
      })
    }

    this.avgDocLength = this.docCount > 0 ? totalTokens / this.docCount : 0
  }

  /**
   * Calcula o IDF (Inverse Document Frequency) com suavização padrão de Robertson-Spärck Jones
   */
  calculateIdf(token) {
    const docFreq = this.docFrequencies.get(token) || 0
    // Fórmula padrão de BM25 com limite inferior para evitar valores negativos
    return Math.log(1 + (this.docCount - docFreq + 0.5) / (docFreq + 0.5))
  }

  /**
   * Executa a busca e retorna os documentos pontuados e ordenados
   */
  search(query, topK = 50) {
    if (this.docCount === 0) return []

    const queryTokens = this.tokenize(query)
    if (queryTokens.length === 0) return []

    const scores = []

    for (const doc of this.docs) {
      let docScore = 0

      // Conta frequência dos termos da query neste documento (TF)
      const termCounts = new Map()
      for (const t of doc.tokens) {
        termCounts.set(t, (termCounts.get(t) || 0) + 1)
      }

      for (const token of queryTokens) {
        const tf = termCounts.get(token) || 0
        if (tf === 0) continue

        const idf = this.calculateIdf(token)
        const numerator = tf * (this.k1 + 1)
        const denominator = tf + this.k1 * (1 - this.b + this.b * (doc.docLength / (this.avgDocLength || 1)))

        docScore += idf * (numerator / denominator)
      }

      if (docScore > 0) {
        scores.push({
          chunk: doc.rawChunk,
          score: docScore
        })
      }
    }

    // Ordena do maior score para o menor
    scores.sort((a, b) => b.score - a.score)
    return scores.slice(0, topK)
  }
}
