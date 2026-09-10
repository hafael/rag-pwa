<template>
  <div class="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
    <!-- Header Principal -->
    <Header
      :active-kb="activeKb"
      :hardware="hardware"
      @open-kb-selector="isKbModalOpen = true"
      @open-hardware-modal="isHardwareModalOpen = true"
    />

    <!-- Barra de Navegação de Abas -->
    <nav class="border-b border-slate-800 bg-slate-900/40 px-4 lg:px-6">
      <div class="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2">
        <button
          v-for="tab in navTabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="activeTab === tab.id
            ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10'
            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'"
          class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0"
        >
          <component :is="tab.icon" class="w-4 h-4" />
          <span>{{ tab.label }}</span>
        </button>
      </div>
    </nav>

    <!-- Conteúdo Principal -->
    <main class="flex-1 p-4 lg:p-6 max-w-7xl mx-auto w-full">
      <!-- Aba: Chat & RAG -->
      <ChatView
        v-if="activeTab === 'chat'"
        :active-kb="activeKb"
        :messages="messages"
        :is-generating="isGenerating"
        @send-message="handleSendMessage"
        @clear-history="handleClearHistory"
      />

      <!-- Aba: Documentos & Ingestão -->
      <DocumentsView
        v-else-if="activeTab === 'documents'"
        :active-kb="activeKb"
        :documents="documents"
        :stats="stats"
        @open-upload="isUploadModalOpen = true"
        @delete-doc="handleDeleteDocument"
      />

      <!-- Aba: Ontologias OWL -->
      <OntologyView
        v-else-if="activeTab === 'ontology'"
        :triples="triples"
        @open-upload-ontology="isUploadModalOpen = true"
      />

      <!-- Aba: Configurações & Hardware -->
      <SettingsView
        v-else-if="activeTab === 'settings'"
      />
    </main>

    <!-- Modais -->
    <KnowledgeBaseModal
      :is-open="isKbModalOpen"
      :list="knowledgeBases"
      :selected-id="activeKb?.id"
      @close="isKbModalOpen = false"
      @create="handleCreateKb"
      @select="handleSelectKb"
      @delete="handleDeleteKb"
    />

    <HardwareBanner
      :is-open="isHardwareModalOpen"
      :hardware="hardware"
      @close="isHardwareModalOpen = false"
    />

    <DocumentUploadModal
      :is-open="isUploadModalOpen"
      :is-processing="isProcessingUpload"
      @close="isUploadModalOpen = false"
      @upload="handleUploadDocument"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { MessageSquare, FileText, Network, Settings } from '@lucide/vue'
import Header from './components/Header.vue'
import HardwareBanner from './components/HardwareBanner.vue'
import KnowledgeBaseModal from './components/KnowledgeBaseModal.vue'
import DocumentUploadModal from './components/DocumentUploadModal.vue'
import DocumentsView from './components/DocumentsView.vue'
import ChatView from './components/ChatView.vue'
import OntologyView from './components/OntologyView.vue'
import SettingsView from './components/SettingsView.vue'
import { db, kbService, docService, chatService } from './db/index.js'
import { checkHardwareCapabilities } from './services/hardware.js'

const navTabs = [
  { id: 'chat', label: 'RAG Chat', icon: MessageSquare },
  { id: 'documents', label: 'Documentos & Ingestão', icon: FileText },
  { id: 'ontology', label: 'Ontologias OWL', icon: Network },
  { id: 'settings', label: 'Modelos & Edge', icon: Settings }
]

const activeTab = ref('documents')
const activeKb = ref(null)
const knowledgeBases = ref([])
const documents = ref([])
const triples = ref([])
const messages = ref([])
const stats = ref({ docCount: 0, parentCount: 0, childCount: 0, tripleCount: 0 })
const hardware = ref({
  webgpu: false,
  opfs: false,
  storageEstimate: { usageMB: 0, quotaMB: 0, percentUsed: 0 },
  crossOriginIsolated: false
})

const isKbModalOpen = ref(false)
const isHardwareModalOpen = ref(false)
const isUploadModalOpen = ref(false)
const isProcessingUpload = ref(false)
const isGenerating = ref(false)

onMounted(async () => {
  // 1. Diagnóstico de hardware
  hardware.value = await checkHardwareCapabilities()

  // 2. Carrega bases salvas
  await reloadKnowledgeBases()
})

async function reloadKnowledgeBases() {
  const kbs = await kbService.getAll()
  knowledgeBases.value = kbs

  if (kbs.length === 0) {
    // Cria base inicial padrão
    const defaultKb = await kbService.create(
      'Base de Conhecimento Geral',
      'Base inicial para ingestão de documentos e ontologias'
    )
    knowledgeBases.value = [defaultKb]
    activeKb.value = defaultKb
  } else if (!activeKb.value || !kbs.some(k => k.id === activeKb.value.id)) {
    activeKb.value = kbs[0]
  }

  await reloadActiveKbData()
}

async function reloadActiveKbData() {
  if (!activeKb.value) return
  const kbId = activeKb.value.id

  const [docs, kStats, msgs, tripList] = await Promise.all([
    docService.getByKb(kbId),
    kbService.getStats(kbId),
    chatService.getMessagesByKb(kbId),
    db.ontologyTriples.where({ kbId }).toArray()
  ])

  documents.value = docs
  stats.value = kStats
  messages.value = msgs
  triples.value = tripList
}

async function handleCreateKb({ name, description }) {
  const newKb = await kbService.create(name, description)
  await reloadKnowledgeBases()
  activeKb.value = newKb
  isKbModalOpen.value = false
}

async function handleSelectKb(kb) {
  activeKb.value = kb
  await reloadActiveKbData()
  isKbModalOpen.value = false
}

async function handleDeleteKb(id) {
  await kbService.delete(id)
  await reloadKnowledgeBases()
}

async function handleDeleteDocument(docId) {
  if (confirm('Deseja excluir este documento e todos os seus Chunks Pais e Filhos?')) {
    await docService.delete(docId)
    await reloadActiveKbData()
  }
}

async function handleClearHistory() {
  if (!activeKb.value) return
  await chatService.clearHistory(activeKb.value.id)
  messages.value = []
}

async function handleUploadDocument({ file, strategy, isOntology }) {
  if (!activeKb.value) return
  isProcessingUpload.value = true

  try {
    const textContent = await file.text()
    const docId = crypto.randomUUID()
    const kbId = activeKb.value.id

    if (isOntology) {
      // Processamento simples inicial de arquivo OWL/Turtle/RDF
      // Extração básica de triplas e declarações conceituais
      const lines = textContent.split('\n')
      const newTriples = []

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('#') || !trimmed) continue

        // Procura por declarações simples de classe ou triplas
        if (trimmed.includes('a ') || trimmed.includes('subClassOf') || trimmed.includes('rdf:type')) {
          const parts = trimmed.split(/\s+/)
          if (parts.length >= 3) {
            newTriples.push({
              id: crypto.randomUUID(),
              kbId,
              subject: parts[0].replace(/[<>;]/g, ''),
              predicate: parts[1].replace(/[<>;]/g, ''),
              object: parts.slice(2).join(' ').replace(/[<>;.]/g, '')
            })
          }
        }
      }

      if (newTriples.length > 0) {
        await db.ontologyTriples.bulkAdd(newTriples)
      }

      await db.documents.add({
        id: docId,
        kbId,
        fileName: file.name,
        fileSize: file.size,
        fileType: 'ontology',
        strategyUsed: 'Ontology Graph Extraction',
        parentCount: 0,
        childCount: newTriples.length,
        createdAt: Date.now()
      })
    } else {
      // Pipeline de Chunking Parent-Child inicial (Fase 1)
      const parentChunks = []
      const childChunks = []

      // Quebra de Chunks Pais (por seções / parágrafos)
      let rawParents = []
      if (strategy === 'section') {
        // Divisão por cabeçalhos (# ou quebras duplas)
        const sections = textContent.split(/\n(?=#{1,6}\s)/g)
        rawParents = sections.length > 1 ? sections : textContent.split('\n\n')
      } else if (strategy === 'paragraph') {
        rawParents = textContent.split('\n\n')
      } else {
        // Token / default
        const words = textContent.split(/\s+/)
        const pSize = 400
        for (let i = 0; i < words.length; i += pSize) {
          rawParents.push(words.slice(i, i + pSize).join(' '))
        }
      }

      // Para cada Chunk Pai, gera Chunks Filhos homogêneos (~100-120 palavras)
      rawParents.forEach((pText, pIdx) => {
        const trimmedParent = pText.trim()
        if (!trimmedParent) return

        const parentId = crypto.randomUUID()
        parentChunks.push({
          id: parentId,
          docId,
          kbId,
          sectionTitle: `Seção / Bloco ${pIdx + 1}`,
          content: trimmedParent,
          orderIndex: pIdx
        })

        // Geração dos Chunks Filhos correspondentes
        const childWords = trimmedParent.split(/\s+/)
        const cSize = 100
        const cOverlap = 20

        for (let j = 0; j < childWords.length; j += (cSize - cOverlap)) {
          const slice = childWords.slice(j, j + cSize).join(' ')
          if (slice.trim()) {
            childChunks.push({
              id: crypto.randomUUID(),
              parentId,
              docId,
              kbId,
              content: slice.trim(),
              orderIndex: j
            })
          }
        }
      })

      // Salva Documento, Chunks Pais e Chunks Filhos no IndexedDB
      await db.transaction('rw', [db.documents, db.parentChunks, db.childChunks], async () => {
        await db.documents.add({
          id: docId,
          kbId,
          fileName: file.name,
          fileSize: file.size,
          fileType: 'text',
          strategyUsed: strategy,
          parentCount: parentChunks.length,
          childCount: childChunks.length,
          createdAt: Date.now()
        })
        await db.parentChunks.bulkAdd(parentChunks)
        await db.childChunks.bulkAdd(childChunks)
      })
    }

    await reloadActiveKbData()
    isUploadModalOpen.value = false
  } catch (err) {
    console.error('Erro na ingestão do documento:', err)
    alert('Erro ao processar o arquivo: ' + err.message)
  } finally {
    isProcessingUpload.value = false
  }
}

async function handleSendMessage(query) {
  if (!activeKb.value) return
  const kbId = activeKb.value.id

  // 1. Adiciona mensagem do usuário
  await chatService.addMessage(kbId, 'user', query)
  messages.value = await chatService.getMessagesByKb(kbId)
  isGenerating.value = true

  try {
    // 2. Busca RAG simulada para a Fase 1 (recupera chunks locais correspondentes)
    const childList = await db.childChunks.where({ kbId }).toArray()
    let retrievedParents = []

    if (childList.length > 0) {
      // Busca léxica preliminar nos filhos para teste
      const terms = query.toLowerCase().split(/\s+/)
      const scored = childList.map(c => {
        let matches = 0
        terms.forEach(t => {
          if (c.content.toLowerCase().includes(t)) matches++
        })
        return { chunk: c, score: matches }
      }).filter(s => s.score > 0).sort((a, b) => b.score - a.score)

      if (scored.length > 0) {
        // Recupera Chunks Pais dos melhores filhos
        const topParentIds = [...new Set(scored.slice(0, 3).map(s => s.chunk.parentId))]
        retrievedParents = await db.parentChunks.where('id').anyOf(topParentIds).toArray()
      }
    }

    // Regras ontológicas ativas
    const activeTriples = await db.ontologyTriples.where({ kbId }).limit(5).toArray()

    // 3. Montagem da resposta respeitando as regras estritas anti-alucinação
    let responseText = ''
    if (retrievedParents.length > 0) {
      responseText = `Com base nas evidências dos documentos carregados na base "${activeKb.value.name}":\n\n` +
        retrievedParents.map((p, i) => `[Evidência ${i + 1}]: "${p.content.slice(0, 200)}..."`).join('\n\n') +
        `\n\n(Aviso: Na Fase 4, a geração textual final será sintetizada via WebLLM acelerado por WebGPU).`
    } else {
      responseText = 'Não há informações suficientes na base de conhecimento carregada para responder a esta questão com base nas evidências locais indexadas.'
    }

    await chatService.addMessage(kbId, 'assistant', responseText, {
      retrievedChunks: retrievedParents,
      ontologyRulesUsed: activeTriples
    })

    messages.value = await chatService.getMessagesByKb(kbId)
  } catch (err) {
    console.error('Erro ao processar consulta:', err)
  } finally {
    isGenerating.value = false
  }
}
</script>
