/**
 * Implementação do Strategy Pattern para Chunking de Documentos
 * com Arquitetura Parent-Child (Pai-Filho)
 */

export class BaseChunkingStrategy {
  constructor(name) {
    this.name = name
  }

  /**
   * Método abstrato que divide o texto do documento em Chunks Pais
   */
  splitParents(documentText) {
    throw new Error('Método splitParents deve ser implementado pela estratégia concreta')
  }

  /**
   * Gera os Chunks Filhos homogêneos (100 a 150 palavras com overlap)
   * vinculados a cada Chunk Pai correspondente
   */
  generateChildChunks(parentChunks, childWordSize = 120, overlapWords = 25) {
    const childChunks = []

    for (const parent of parentChunks) {
      const words = parent.content.split(/\s+/).filter(Boolean)

      if (words.length <= childWordSize) {
        // Se o pai já for pequeno, cria um único filho com o conteúdo integral
        childChunks.push({
          id: crypto.randomUUID(),
          parentId: parent.id,
          docId: parent.docId,
          kbId: parent.kbId,
          content: parent.content,
          orderIndex: 0,
          wordCount: words.length
        })
        continue
      }

      let orderIdx = 0
      const step = Math.max(1, childWordSize - overlapWords)

      for (let i = 0; i < words.length; i += step) {
        const slice = words.slice(i, i + childWordSize)
        if (slice.length === 0) break

        const childText = slice.join(' ')
        childChunks.push({
          id: crypto.randomUUID(),
          parentId: parent.id,
          docId: parent.docId,
          kbId: parent.kbId,
          content: childText,
          orderIndex: orderIdx++,
          wordCount: slice.length
        })

        if (i + childWordSize >= words.length) break
      }
    }

    return childChunks
  }

  /**
   * Executa o pipeline completo: gera Pais e Filhos
   */
  async split(documentText, { docId, kbId, childWordSize = 120, overlapWords = 25 } = {}) {
    const rawParents = this.splitParents(documentText)

    const parentChunks = rawParents.map((item, idx) => ({
      id: crypto.randomUUID(),
      docId,
      kbId,
      sectionTitle: item.title || `Seção ${idx + 1}`,
      content: item.text.trim(),
      orderIndex: idx,
      wordCount: item.text.split(/\s+/).filter(Boolean).length
    })).filter(p => p.content.length > 0)

    const childChunks = this.generateChildChunks(parentChunks, childWordSize, overlapWords)

    return {
      parentChunks,
      childChunks
    }
  }
}

/**
 * 1. Estratégia por Seção / Título (Hierárquico)
 * Identifica títulos Markdown (#, ##, ###) ou cabeçalhos estruturais
 */
export class SectionChunkingStrategy extends BaseChunkingStrategy {
  constructor() {
    super('section')
  }

  splitParents(documentText) {
    // Regex para identificar cabeçalhos Markdown (# Heading)
    const headerRegex = /(?:^|\n)(#{1,6}\s+[^\n]+)/g
    const matches = [...documentText.matchAll(headerRegex)]

    if (matches.length === 0) {
      // Fallback para divisão de parágrafos caso não encontre títulos
      return new ParagraphChunkingStrategy().splitParents(documentText)
    }

    const sections = []
    let lastIndex = 0
    let currentTitle = 'Introdução / Início'

    for (const match of matches) {
      const matchIndex = match.index
      if (matchIndex > lastIndex) {
        const body = documentText.substring(lastIndex, matchIndex).trim()
        if (body) {
          sections.push({ title: currentTitle, text: body })
        }
      }
      currentTitle = match[1].replace(/^#{1,6}\s+/, '').trim()
      lastIndex = matchIndex + match[0].length
    }

    // Última seção restante
    const remaining = documentText.substring(lastIndex).trim()
    if (remaining) {
      sections.push({ title: currentTitle, text: remaining })
    }

    return sections
  }
}

/**
 * 2. Estratégia por Parágrafo
 * Segmenta Chunks Pais por marcadores de bloco (\n\n+)
 */
export class ParagraphChunkingStrategy extends BaseChunkingStrategy {
  constructor() {
    super('paragraph')
  }

  splitParents(documentText) {
    const rawBlocks = documentText.split(/\n\s*\n+/)
    const parents = []

    let currentAccumulator = []
    let currentWordCount = 0
    let blockIndex = 1

    for (const block of rawBlocks) {
      const trimmed = block.trim()
      if (!trimmed) continue

      const words = trimmed.split(/\s+/).length
      currentAccumulator.push(trimmed)
      currentWordCount += words

      // Agrupa parágrafos muito curtos para que o Chunk Pai tenha pelo menos ~150 palavras
      if (currentWordCount >= 150) {
        parents.push({
          title: `Parágrafo ${blockIndex++}`,
          text: currentAccumulator.join('\n\n')
        })
        currentAccumulator = []
        currentWordCount = 0
      }
    }

    if (currentAccumulator.length > 0) {
      parents.push({
        title: `Parágrafo ${blockIndex}`,
        text: currentAccumulator.join('\n\n')
      })
    }

    return parents
  }
}

/**
 * 3. Estratégia por Sentença (Gramatical via Intl.Segmenter)
 */
export class SentenceChunkingStrategy extends BaseChunkingStrategy {
  constructor(locale = 'pt-BR') {
    super('sentence')
    this.locale = locale
  }

  splitParents(documentText) {
    let sentences = []

    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter(this.locale, { granularity: 'sentence' })
      for (const seg of segmenter.segment(documentText)) {
        const s = seg.segment.trim()
        if (s) sentences.push(s)
      }
    } else {
      // Fallback por regex
      sentences = documentText.split(/(?<=[.?!])\s+/).map(s => s.trim()).filter(Boolean)
    }

    // Agrupa sentenças em blocos pai de ~300 palavras
    const parents = []
    let currentGroup = []
    let wordCount = 0
    let groupIdx = 1

    for (const sent of sentences) {
      const count = sent.split(/\s+/).length
      currentGroup.push(sent)
      wordCount += count

      if (wordCount >= 250) {
        parents.push({
          title: `Bloco de Sentenças ${groupIdx++}`,
          text: currentGroup.join(' ')
        })
        currentGroup = []
        wordCount = 0
      }
    }

    if (currentGroup.length > 0) {
      parents.push({
        title: `Bloco de Sentenças ${groupIdx}`,
        text: currentGroup.join(' ')
      })
    }

    return parents
  }
}

/**
 * 4. Estratégia por Contagem de Palavras / Janela Deslizante
 */
export class WordTokenChunkingStrategy extends BaseChunkingStrategy {
  constructor(parentSize = 450, parentOverlap = 50) {
    super('tokens')
    this.parentSize = parentSize
    this.parentOverlap = parentOverlap
  }

  splitParents(documentText) {
    const words = documentText.split(/\s+/).filter(Boolean)
    const parents = []
    let idx = 1
    const step = Math.max(1, this.parentSize - this.parentOverlap)

    for (let i = 0; i < words.length; i += step) {
      const slice = words.slice(i, i + this.parentSize)
      if (slice.length === 0) break

      parents.push({
        title: `Janela de Palavras ${idx++} (${slice.length} palavras)`,
        text: slice.join(' ')
      })

      if (i + this.parentSize >= words.length) break
    }

    return parents
  }
}

/**
 * 5. Estratégia por Página (específica para documentos PDF)
 */
export class PageChunkingStrategy extends BaseChunkingStrategy {
  constructor() {
    super('page')
  }

  splitParents(documentText) {
    const pageRegex = /--- \[Página (\d+)\] ---/g
    const matches = [...documentText.matchAll(pageRegex)]

    if (matches.length === 0) {
      return new SectionChunkingStrategy().splitParents(documentText)
    }

    const pages = []
    for (let i = 0; i < matches.length; i++) {
      const pageNum = matches[i][1]
      const startIndex = matches[i].index + matches[i][0].length
      const endIndex = i + 1 < matches.length ? matches[i + 1].index : documentText.length
      const pageContent = documentText.substring(startIndex, endIndex).trim()

      if (pageContent) {
        pages.push({
          title: `Página ${pageNum}`,
          text: pageContent
        })
      }
    }

    return pages
  }
}

/**
 * Factory do Strategy Pattern
 */
export function createChunkingStrategy(strategyType) {
  switch (strategyType) {
    case 'section':
      return new SectionChunkingStrategy()
    case 'paragraph':
      return new ParagraphChunkingStrategy()
    case 'sentence':
      return new SentenceChunkingStrategy()
    case 'page':
      return new PageChunkingStrategy()
    case 'tokens':
    default:
      return new WordTokenChunkingStrategy()
  }
}
