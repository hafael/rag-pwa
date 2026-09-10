import { BM25Index } from './bm25.js'
import { embeddingService } from './vectorEmbeddings.js'
import { db } from '../db/index.js'

/**
 * Motor de RAG Híbrido Triplo (Dense + Sparse BM25 + Ontology Boost + RRF)
 */
export class HybridRagEngine {
  constructor(k = 60, ontologyBoostFactor = 1.25) {
    this.k = k
    this.ontologyBoostFactor = ontologyBoostFactor
    this.bm25 = new BM25Index()
  }

  /**
   * Executa a busca híbrida completa e retorna os Chunks Pais selecionados
   */
  async search({
    query,
    kbId,
    expandedTerms = [],
    rulesMatched = [],
    topChildK = 10,
    topParentK = 3
  }) {
    // 1. Carrega todos os Chunks Filhos da Base de Conhecimento ativa
    const childChunks = await db.childChunks.where({ kbId }).toArray()
    if (childChunks.length === 0) {
      return {
        retrievedParents: [],
        rankedChildren: [],
        stats: { totalChildrenSearched: 0, denseMatches: 0, sparseMatches: 0 }
      }
    }

    // 2. Busca Esparsa (BM25)
    this.bm25.buildIndex(childChunks)
    // Busca combinando a consulta com termos enriquecidos pela ontologia
    const searchString = expandedTerms.length > 0
      ? `${query} ${expandedTerms.slice(0, 4).join(' ')}`
      : query

    const sparseResults = this.bm25.search(searchString, childChunks.length)
    const sparseRankMap = new Map()
    sparseResults.forEach((item, index) => {
      sparseRankMap.set(item.chunk.id, {
        rank: index + 1,
        score: item.score
      })
    })

    // 3. Busca Densa (Vetores de Embedding)
    const denseScores = []
    try {
      const queryEmbedding = await embeddingService.generateEmbedding(query)

      for (const chunk of childChunks) {
        if (chunk.embedding && Array.isArray(chunk.embedding)) {
          const sim = embeddingService.cosineSimilarity(queryEmbedding, chunk.embedding)
          if (sim > 0) {
            denseScores.push({ chunk, similarity: sim })
          }
        }
      }

      denseScores.sort((a, b) => b.similarity - a.similarity)
    } catch (e) {
      console.warn('Busca densa ignorada ou em fallback:', e)
    }

    const denseRankMap = new Map()
    denseScores.forEach((item, index) => {
      denseRankMap.set(item.chunk.id, {
        rank: index + 1,
        similarity: item.similarity
      })
    })

    // 4. Fusão RRF (Reciprocal Rank Fusion) com Ontology Boost
    const allCandidateIds = new Set([
      ...sparseRankMap.keys(),
      ...denseRankMap.keys()
    ])

    const rrfRanked = []

    for (const chunkId of allCandidateIds) {
      const chunk = childChunks.find(c => c.id === chunkId)
      if (!chunk) continue

      const denseInfo = denseRankMap.get(chunkId)
      const sparseInfo = sparseRankMap.get(chunkId)

      const denseRank = denseInfo ? denseInfo.rank : Infinity
      const sparseRank = sparseInfo ? sparseInfo.rank : Infinity

      // Fórmula padrão do RRF
      let rrfScore = 0
      if (denseRank !== Infinity) {
        rrfScore += 1 / (this.k + denseRank)
      }
      if (sparseRank !== Infinity) {
        rrfScore += 1 / (this.k + sparseRank)
      }

      // Verificação do Ontology Boost
      let hasOntologyBoost = false
      const chunkContentLower = chunk.content.toLowerCase()

      // Se contém termos validados pela ontologia
      if (expandedTerms.some(term => chunkContentLower.includes(term.toLowerCase()))) {
        hasOntologyBoost = true
        rrfScore *= this.ontologyBoostFactor
      }

      rrfRanked.push({
        chunk,
        rrfScore,
        denseRank: denseRank === Infinity ? null : denseRank,
        denseSimilarity: denseInfo ? denseInfo.similarity : null,
        sparseRank: sparseRank === Infinity ? null : sparseRank,
        sparseScore: sparseInfo ? sparseInfo.score : null,
        hasOntologyBoost
      })
    }

    // Ordena pelo RRF score final
    rrfRanked.sort((a, b) => b.rrfScore - a.rrfScore)
    const topChildren = rrfRanked.slice(0, topChildK)

    // 5. Recuperação dos Chunks Pais únicos (Parent-Child Pattern)
    const parentScoreMap = new Map() // parentId -> max RRF score
    for (const item of topChildren) {
      const pId = item.chunk.parentId
      const currentBest = parentScoreMap.get(pId) || 0
      if (item.rrfScore > currentBest) {
        parentScoreMap.set(pId, item.rrfScore)
      }
    }

    // Ordena os IDs dos pais pela relevância máxima dos seus filhos
    const sortedParentIds = [...parentScoreMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topParentK)
      .map(entry => entry[0])

    const retrievedParents = await db.parentChunks
      .where('id')
      .anyOf(sortedParentIds)
      .toArray()

    // Mantém a ordenação dos pais correspondente ao score de seus filhos
    retrievedParents.sort((a, b) => {
      const scoreA = parentScoreMap.get(a.id) || 0
      const scoreB = parentScoreMap.get(b.id) || 0
      return scoreB - scoreA
    })

    return {
      retrievedParents,
      rankedChildren: topChildren,
      stats: {
        totalChildrenSearched: childChunks.length,
        denseMatches: denseScores.length,
        sparseMatches: sparseResults.length,
        parentsRetrieved: retrievedParents.length
      }
    }
  }
}

export const hybridRagEngine = new HybridRagEngine()
