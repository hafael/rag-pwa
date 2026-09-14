import { extractTextFromFile } from './extractors.js'
import { db } from '../db/index.js'
import { createChunkingStrategy } from './chunkingStrategies.js'
import { OntologyEngine } from './ontologyEngine.js'

/**
 * Serviço de orquestração de ingestão de documentos e ontologias
 */
export class IngestionService {
  constructor() {
    this.worker = null
    this.initWorker()
  }

  initWorker() {
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(
          new URL('../workers/ingestion.worker.js', import.meta.url),
          { type: 'module' }
        )
      } catch (e) {
        console.warn('Falha ao inicializar Web Worker, usando execução síncrona na main thread:', e)
      }
    }
  }

  /**
   * Processa o arquivo completo (extração, chunking ou parsing ontológico e persistência)
   */
  async ingestFile(file, { kbId, strategyType = 'section', onProgress } = {}) {
    onProgress?.({ stage: 'Extraindo conteúdo textual...', percent: 15 })

    // 1. Extração do conteúdo
    const extracted = await extractTextFromFile(file)
    const docId = crypto.randomUUID()
    const now = Date.now()

    if (extracted.type === 'ontology') {
      onProgress?.({ stage: 'Processando triplas e regras ontológicas (N3.js)...', percent: 45 })
      const result = await this.parseOntologyAsync(extracted.rawText, kbId)

      onProgress?.({ stage: 'Persistindo triplas no IndexedDB...', percent: 85 })
      await db.transaction('rw', [db.documents, db.ontologyTriples], async () => {
        await db.documents.add({
          id: docId,
          kbId,
          fileName: file.name,
          fileSize: file.size,
          fileType: 'ontology',
          strategyUsed: 'Ontology Graph (N3.js)',
          parentCount: 0,
          childCount: result.triples.length,
          createdAt: now
        })

        if (result.triples.length > 0) {
          await db.ontologyTriples.bulkAdd(result.triples)
        }
      })

      onProgress?.({ stage: 'Ingestão ontológica concluída!', percent: 100 })
      return {
        docId,
        type: 'ontology',
        triplesCount: result.triples.length,
        stats: result.stats
      }
    } else {
      onProgress?.({ stage: 'Segmentando em Chunks Pais e Filhos...', percent: 45 })
      const { parentChunks, childChunks } = await this.processChunkingAsync(
        extracted.rawText,
        strategyType,
        docId,
        kbId
      )

      onProgress?.({ stage: 'Gerando embeddings vetoriais (all-MiniLM-L6-v2)...', percent: 55 })
      try {
        const { getDeviceProfile } = await import('./deviceProfile.js')
        const { webLlmService } = await import('./webLlm.js')
        if (getDeviceProfile().constrained && webLlmService.status === 'ready') {
          await webLlmService.unload()
        }

        const { embeddingService } = await import('./vectorEmbeddings.js')
        for (let i = 0; i < childChunks.length; i++) {
          try {
            const emb = await embeddingService.generateEmbedding(childChunks[i].content)
            childChunks[i].embedding = emb
          } catch (e) {
            console.warn('Falha ao gerar embedding para o chunk:', i, e)
          }

          const pct = 55 + Math.round(((i + 1) / childChunks.length) * 25)
          onProgress?.({
            stage: `Vetorizando Chunks Filhos (${i + 1}/${childChunks.length})...`,
            percent: Math.min(pct, 80)
          })
        }
      } catch (err) {
        console.warn('Erro ao carregar serviço de embeddings:', err)
      }

      onProgress?.({ stage: 'Salvando no banco IndexedDB (Dexie)...', percent: 85 })
      await db.transaction('rw', [db.documents, db.parentChunks, db.childChunks], async () => {
        await db.documents.add({
          id: docId,
          kbId,
          fileName: file.name,
          fileSize: file.size,
          fileType: extracted.type,
          strategyUsed: strategyType,
          parentCount: parentChunks.length,
          childCount: childChunks.length,
          createdAt: now
        })

        if (parentChunks.length > 0) {
          await db.parentChunks.bulkAdd(parentChunks)
        }
        if (childChunks.length > 0) {
          await db.childChunks.bulkAdd(childChunks)
        }
      })

      onProgress?.({ stage: 'Ingestão de documento concluída!', percent: 100 })
      return {
        docId,
        type: 'document',
        parentCount: parentChunks.length,
        childCount: childChunks.length
      }
    }
  }

  /**
   * Executa chunking no Worker ou na thread principal em fallback
   */
  async processChunkingAsync(text, strategyType, docId, kbId) {
    if (this.worker) {
      return new Promise((resolve, reject) => {
        const handler = (e) => {
          const { type, payload, error } = e.data
          if (type === 'CHUNKING_SUCCESS') {
            this.worker.removeEventListener('message', handler)
            resolve(payload)
          } else if (type === 'ERROR') {
            this.worker.removeEventListener('message', handler)
            reject(new Error(error))
          }
        }
        this.worker.addEventListener('message', handler)
        this.worker.postMessage({
          type: 'PROCESS_CHUNKING',
          payload: { text, strategyType, docId, kbId }
        })
      })
    }

    // Fallback caso não haja Web Worker
    const strategy = createChunkingStrategy(strategyType)
    return await strategy.split(text, { docId, kbId })
  }

  /**
   * Executa parsing ontológico no Worker ou na thread principal em fallback
   */
  async parseOntologyAsync(text, kbId) {
    if (this.worker) {
      return new Promise((resolve, reject) => {
        const handler = (e) => {
          const { type, payload, error } = e.data
          if (type === 'ONTOLOGY_SUCCESS') {
            this.worker.removeEventListener('message', handler)
            resolve(payload)
          } else if (type === 'ERROR') {
            this.worker.removeEventListener('message', handler)
            reject(new Error(error))
          }
        }
        this.worker.addEventListener('message', handler)
        this.worker.postMessage({
          type: 'PARSE_ONTOLOGY',
          payload: { text, kbId }
        })
      })
    }

    // Fallback síncrono
    const engine = new OntologyEngine()
    const { triples, stats } = await engine.parse(text)
    const formatted = triples.map(t => ({
      id: crypto.randomUUID(),
      kbId,
      subject: t.subject,
      predicate: t.predicate,
      object: t.object,
      rawTriple: `${t.rawSubject} ${t.rawPredicate} ${t.rawObject}`
    }))
    return { triples: formatted, stats }
  }
}

export const ingestionService = new IngestionService()
