import { createChunkingStrategy } from '../services/chunkingStrategies.js'
import { OntologyEngine } from '../services/ontologyEngine.js'

/**
 * Web Worker dedicado à Ingestão e Processamento Pesado
 * Evita bloqueio da UI durante chunking, contagem de tokens e parsing N3
 */
self.onmessage = async (e) => {
  const { type, payload } = e.data

  try {
    if (type === 'PROCESS_CHUNKING') {
      const { text, strategyType, docId, kbId, options } = payload

      self.postMessage({
        type: 'PROGRESS',
        stage: 'Executando estratégia de chunking (Parent-Child)...',
        percent: 40
      })

      const strategy = createChunkingStrategy(strategyType)
      const { parentChunks, childChunks } = await strategy.split(text, {
        docId,
        kbId,
        childWordSize: options?.childWordSize || 120,
        overlapWords: options?.overlapWords || 25
      })

      self.postMessage({
        type: 'PROGRESS',
        stage: 'Chunks pais e filhos gerados com sucesso',
        percent: 90
      })

      self.postMessage({
        type: 'CHUNKING_SUCCESS',
        payload: {
          parentChunks,
          childChunks,
          parentCount: parentChunks.length,
          childCount: childChunks.length
        }
      })
    } else if (type === 'PARSE_ONTOLOGY') {
      const { text, kbId } = payload

      self.postMessage({
        type: 'PROGRESS',
        stage: 'Iniciando parser N3.js para arquivo ontológico...',
        percent: 30
      })

      const engine = new OntologyEngine()
      const { triples, stats } = await engine.parse(text)

      const formattedTriples = triples.map(t => ({
        id: crypto.randomUUID(),
        kbId,
        subject: t.subject,
        predicate: t.predicate,
        object: t.object,
        rawTriple: `${t.rawSubject} ${t.rawPredicate} ${t.rawObject}`
      }))

      self.postMessage({
        type: 'PROGRESS',
        stage: 'Triplas ontológicas normalizadas',
        percent: 90
      })

      self.postMessage({
        type: 'ONTOLOGY_SUCCESS',
        payload: {
          triples: formattedTriples,
          stats
        }
      })
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error.message || 'Erro durante execução no Web Worker'
    })
  }
}
