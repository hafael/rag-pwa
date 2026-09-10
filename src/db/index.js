import Dexie from 'dexie'

export class AppDatabase extends Dexie {
  constructor() {
    super('RagHybridDatabase')
    this.version(1).stores({
      knowledgeBases: 'id, name, createdAt, updatedAt',
      documents: 'id, kbId, fileName, strategyUsed, createdAt',
      parentChunks: 'id, docId, kbId, sectionTitle, orderIndex',
      childChunks: 'id, parentId, docId, kbId, orderIndex',
      ontologyTriples: 'id, kbId, subject, predicate, object',
      chatMessages: 'id, kbId, role, createdAt'
    })
  }
}

export const db = new AppDatabase()

/**
 * Operações auxiliares de gerenciamento de dados
 */

export const kbService = {
  async getAll() {
    return await db.knowledgeBases.orderBy('createdAt').reverse().toArray()
  },

  async getById(id) {
    return await db.knowledgeBases.get(id)
  },

  async create(name, description = '') {
    const id = crypto.randomUUID()
    const now = Date.now()
    const newKb = {
      id,
      name,
      description,
      activeOntologyName: null,
      createdAt: now,
      updatedAt: now
    }
    await db.knowledgeBases.add(newKb)
    return newKb
  },

  async delete(id) {
    return await db.transaction('rw', [
      db.knowledgeBases,
      db.documents,
      db.parentChunks,
      db.childChunks,
      db.ontologyTriples,
      db.chatMessages
    ], async () => {
      await db.childChunks.where({ kbId: id }).delete()
      await db.parentChunks.where({ kbId: id }).delete()
      await db.documents.where({ kbId: id }).delete()
      await db.ontologyTriples.where({ kbId: id }).delete()
      await db.chatMessages.where({ kbId: id }).delete()
      await db.knowledgeBases.delete(id)
    })
  },

  async getStats(kbId) {
    const [docCount, parentCount, childCount, tripleCount] = await Promise.all([
      db.documents.where({ kbId }).count(),
      db.parentChunks.where({ kbId }).count(),
      db.childChunks.where({ kbId }).count(),
      db.ontologyTriples.where({ kbId }).count()
    ])
    return { docCount, parentCount, childCount, tripleCount }
  }
}

export const docService = {
  async getByKb(kbId) {
    return await db.documents.where({ kbId }).reverse().sortBy('createdAt')
  },

  async delete(docId) {
    return await db.transaction('rw', [db.documents, db.parentChunks, db.childChunks], async () => {
      await db.childChunks.where({ docId }).delete()
      await db.parentChunks.where({ docId }).delete()
      await db.documents.delete(docId)
    })
  }
}

export const chatService = {
  async getMessagesByKb(kbId) {
    return await db.chatMessages.where({ kbId }).sortBy('createdAt')
  },

  async addMessage(kbId, role, content, extra = {}) {
    const msg = {
      id: crypto.randomUUID(),
      kbId,
      role,
      content,
      ...extra,
      createdAt: Date.now()
    }
    await db.chatMessages.add(msg)
    return msg
  },

  async clearHistory(kbId) {
    return await db.chatMessages.where({ kbId }).delete()
  }
}
