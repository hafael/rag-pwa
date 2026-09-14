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
    <nav class="border-b border-slate-800 bg-slate-900/40 px-2 sm:px-4 lg:px-6">
      <!-- Layout Mobile: Segmented control em 4 colunas sem scroll horizontal -->
      <div class="grid grid-cols-4 gap-1 p-1 bg-slate-900/90 rounded-xl border border-slate-800/80 my-1.5 sm:hidden">
        <button
          v-for="tab in navTabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="activeTab === tab.id
            ? 'bg-indigo-600/25 text-indigo-200 border-indigo-500/40 shadow-sm font-semibold'
            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 font-medium'"
          class="flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 rounded-lg text-[10px] border transition min-h-[44px]"
        >
          <component :is="tab.icon" class="w-3.5 h-3.5 shrink-0" />
          <span class="truncate w-full text-center leading-tight">
            {{ tab.shortLabel || tab.label }}
          </span>
        </button>
      </div>

      <!-- Layout Tablet & Desktop: Flex horizontal padrão -->
      <div class="hidden sm:flex items-center gap-1 sm:gap-2 overflow-x-auto py-2">
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
    <main class="flex-1 p-2.5 sm:p-4 lg:p-6 max-w-7xl mx-auto w-full">
      <!-- Aba: Chat & RAG -->
      <ChatView
        v-if="activeTab === 'chat'"
        :active-kb="activeKb"
        :messages="messages"
        :is-generating="isGenerating"
        :llm-status="llmStatus"
        :llm-loading-progress="llmLoadingProgress"
        :webgpu-available="hardware.webgpu"
        :current-model-id="webLlmService.currentModelId"
        :llm-error-message="llmErrorMessage"
        @send-message="handleSendMessage"
        @clear-history="handleClearHistory"
        @retry-load-llm="ensureLlmLoaded(true)"
      />

      <!-- Aba: Documentos & Ingestão -->
      <DocumentsView
        v-else-if="activeTab === 'documents'"
        :active-kb="activeKb"
        :documents="documents"
        :stats="stats"
        @open-upload="isUploadModalOpen = true"
        @delete-doc="handleDeleteDocument"
        @inspect-doc="handleInspectDocument"
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
        :hardware="hardware"
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
      :upload-progress="uploadProgress"
      @close="isUploadModalOpen = false"
      @upload="handleUploadDocument"
    />

    <ChunkInspectorModal
      :is-open="isInspectModalOpen"
      :document="selectedDocToInspect"
      :parents="inspectParents"
      :children="inspectChildren"
      @close="isInspectModalOpen = false"
    />
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { MessageSquare, FileText, Network, Settings } from '@lucide/vue'
import Header from './components/Header.vue'
import HardwareBanner from './components/HardwareBanner.vue'
import KnowledgeBaseModal from './components/KnowledgeBaseModal.vue'
import DocumentUploadModal from './components/DocumentUploadModal.vue'
import ChunkInspectorModal from './components/ChunkInspectorModal.vue'
import DocumentsView from './components/DocumentsView.vue'
import ChatView from './components/ChatView.vue'
import OntologyView from './components/OntologyView.vue'
import SettingsView from './components/SettingsView.vue'
import { db, kbService, docService, chatService } from './db/index.js'
import { checkHardwareCapabilities } from './services/hardware.js'
import { ingestionService } from './services/ingestion.js'
import { ontologyEngine } from './services/ontologyEngine.js'
import { hybridRagEngine } from './services/hybridRag.js'
import { webLlmService } from './services/webLlm.js'

const navTabs = [
  { id: 'chat', label: 'Chat', shortLabel: 'Chat', icon: MessageSquare },
  { id: 'documents', label: 'Documentos', shortLabel: 'Docs', icon: FileText },
  { id: 'ontology', label: 'Conceitos', shortLabel: 'Conceitos', icon: Network },
  { id: 'settings', label: 'Ajustes', shortLabel: 'Ajustes', icon: Settings }
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
const uploadProgress = ref({ stage: '', percent: 0 })

const isInspectModalOpen = ref(false)
const selectedDocToInspect = ref(null)
const inspectParents = ref([])
const inspectChildren = ref([])

const isGenerating = ref(false)

// Estado reativo do WebLLM — sincronizado com callbacks do serviço
const llmStatus = ref(webLlmService.status)           // 'idle'|'loading'|'ready'|'generating'|'error'
const llmLoadingProgress = ref(webLlmService.loadingProgress)
const llmErrorMessage = ref(webLlmService.errorMessage)

/** Inicia o carregamento do modelo, atualizando o estado reativo */
async function ensureLlmLoaded(force = false) {
  if (!hardware.value.webgpu) return
  if (!force && (llmStatus.value === 'ready' || llmStatus.value === 'loading')) return

  llmStatus.value = 'loading'
  llmErrorMessage.value = null
  try {
    await webLlmService.loadModel(webLlmService.currentModelId, (prog) => {
      llmLoadingProgress.value = prog
    })
    llmStatus.value = 'ready'
    llmErrorMessage.value = null
  } catch (err) {
    llmStatus.value = 'error'
    llmErrorMessage.value = err.message || 'Falha ao inicializar o modelo WebLLM'
    console.warn('Falha no pré-carregamento do modelo WebLLM:', err)
  }
}

// Melhoria 2: pré-carrega o modelo automaticamente ao entrar na aba Chat
watch(activeTab, (tab) => {
  if (tab === 'chat') {
    llmStatus.value = webLlmService.status
    llmErrorMessage.value = webLlmService.errorMessage
    ensureLlmLoaded()
  }
})

onMounted(async () => {
  // 1. Diagnóstico de hardware
  hardware.value = await checkHardwareCapabilities()

  // Perfil mobile: modelo ultra-leve (Fase 1). Desktop sem f16: fallback f32 1B.
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
  if (hardware.value.webgpu) {
    if (isMobile) {
      webLlmService.currentModelId = 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC'
    } else if (!hardware.value.hasF16) {
      webLlmService.currentModelId = 'Llama-3.2-1B-Instruct-q4f32_1-MLC'
    }
  }

  // 2. Carrega bases salvas
  await reloadKnowledgeBases()
})

async function reloadKnowledgeBases() {
  const kbs = await kbService.getAll()
  knowledgeBases.value = kbs

  if (kbs.length === 0) {
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

async function handleInspectDocument(doc) {
  selectedDocToInspect.value = doc
  const [pList, cList] = await Promise.all([
    db.parentChunks.where({ docId: doc.id }).sortBy('orderIndex'),
    db.childChunks.where({ docId: doc.id }).sortBy('orderIndex')
  ])
  inspectParents.value = pList
  inspectChildren.value = cList
  isInspectModalOpen.value = true
}

async function handleClearHistory() {
  if (!activeKb.value) return
  await chatService.clearHistory(activeKb.value.id)
  messages.value = []
}

async function handleUploadDocument({ file, strategy }) {
  if (!activeKb.value) return
  isProcessingUpload.value = true
  uploadProgress.value = { stage: 'Iniciando ingestão...', percent: 10 }

  try {
    await ingestionService.ingestFile(file, {
      kbId: activeKb.value.id,
      strategyType: strategy,
      onProgress: (prog) => {
        uploadProgress.value = prog
      }
    })

    await reloadActiveKbData()
    isUploadModalOpen.value = false
  } catch (err) {
    console.error('Erro na ingestão do documento:', err)
    alert('Erro ao processar o arquivo: ' + err.message)
  } finally {
    isProcessingUpload.value = false
    uploadProgress.value = { stage: '', percent: 0 }
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
    // 2. Query Expansion ontológico via OntologyEngine (Seção 4.2 do plano)
    const activeTriples = await db.ontologyTriples.where({ kbId }).toArray()
    const expansion = ontologyEngine.expandQuery(query, activeTriples)

    // 3. Execução da Busca RAG Híbrida Tripla (Dense Cosine + Sparse BM25 + RRF + OWL Boost)
    const isMobile = webLlmService.isMobileDevice()
    const ragResult = await hybridRagEngine.search({
      query,
      kbId,
      expandedTerms: expansion.expandedTerms,
      rulesMatched: expansion.rulesMatched,
      topChildK: isMobile ? 4 : 8,
      topParentK: isMobile ? 1 : 3
    })

    const retrievedParents = ragResult.retrievedParents

    // 4. Se não recuperou nenhum chunk, aplica a diretriz obrigatória de mitigação de alucinação
    if (retrievedParents.length === 0) {
      const emptyNotice = 'Não há informações suficientes na base de conhecimento carregada para responder a esta questão.'
      await chatService.addMessage(kbId, 'assistant', emptyNotice, {
        retrievedChunks: [],
        rankedChildren: [],
        ragStats: ragResult.stats,
        ontologyRulesUsed: expansion.rulesMatched
      })
      messages.value = await chatService.getMessagesByKb(kbId)
      return
    }

    // 5. Cria mensagem de streaming provisória para renderização reativa
    const tempMsg = {
      id: crypto.randomUUID(),
      kbId,
      role: 'assistant',
      content: '',
      retrievedChunks: retrievedParents,
      rankedChildren: ragResult.rankedChildren,
      ragStats: ragResult.stats,
      ontologyRulesUsed: expansion.rulesMatched,
      generatedByLlm: null, // será definido após a geração
      createdAt: Date.now()
    }
    messages.value.push(tempMsg)

    // 6. Tentativa de inferência local via WebLLM com streaming de tokens na WebGPU
    let assistantResponse = ''
    let streamSucceeded = false
    let failureReason = null

    try {
      if (hardware.value.webgpu) {
        llmStatus.value = 'generating'
        await webLlmService.generateStreamingAnswer({
          userQuery: query,
          parentChunks: retrievedParents,
          ontologicalRules: expansion.rulesMatched,
          onToken: (delta, full) => {
            tempMsg.content = full
            assistantResponse = full
          }
        })
        llmStatus.value = 'ready'
        llmErrorMessage.value = null
        streamSucceeded = true
      }
    } catch (llmErr) {
      failureReason = llmErr.message || String(llmErr)
      llmStatus.value = 'error'
      llmErrorMessage.value = failureReason
      console.warn('WebLLM streaming indisponível ou em fallback:', llmErr)
    }

    // Fallback estruturado de alta precisão se WebLLM não estiver disponível no hardware
    if (!streamSucceeded || !assistantResponse.trim()) {
      const formattedRules = ontologyEngine.formatOntologicalRules(expansion.rulesMatched)
      assistantResponse = `Com base nas evidências extraídas dos documentos da base "${activeKb.value.name}":\n\n` +
        retrievedParents.map((p, i) => `[Evidência ${i + 1} - ${p.sectionTitle}]:\n"${p.content}"`).join('\n\n')

      if (expansion.rulesMatched.length > 0) {
        assistantResponse += `\n\n[Regras Ontológicas Formais Validadas]:\n${formattedRules}`
      }
      tempMsg.content = assistantResponse
    }

    // Melhoria 1: persiste a flag de origem da resposta junto com a mensagem
    const generatedByLlm = streamSucceeded && !!assistantResponse.trim()
    tempMsg.generatedByLlm = generatedByLlm
    tempMsg.fallbackReason = generatedByLlm ? null : failureReason

    // 7. Persiste a mensagem completa no IndexedDB
    await chatService.addMessage(kbId, 'assistant', assistantResponse, {
      retrievedChunks: retrievedParents,
      rankedChildren: ragResult.rankedChildren,
      ragStats: ragResult.stats,
      ontologyRulesUsed: expansion.rulesMatched,
      generatedByLlm,
      fallbackReason: generatedByLlm ? null : failureReason
    })

    messages.value = await chatService.getMessagesByKb(kbId)
  } catch (err) {
    console.error('Erro ao processar consulta:', err)
  } finally {
    isGenerating.value = false
  }
}
</script>
