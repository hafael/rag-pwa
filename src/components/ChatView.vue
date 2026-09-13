<template>
  <div class="flex flex-col h-[calc(100dvh-150px)] sm:h-[calc(100vh-140px)] bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
    <!-- Chat Header -->
    <div class="p-3.5 sm:p-4 border-b border-slate-800/80 bg-slate-900/80 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
          <MessageSquare class="w-4 h-4" />
        </div>
        <div>
          <h3 class="text-xs sm:text-sm font-semibold text-slate-100 flex items-center gap-1.5 sm:gap-2">
            RAG Chat
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 truncate max-w-[120px] sm:max-w-none">
              {{ activeModelShortName }}
            </span>
          </h3>
          <p class="text-[11px] text-slate-400">
            BC: <span class="text-slate-300 font-medium">{{ activeKb?.name || 'Nenhuma selecionada' }}</span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-1.5">
        <!-- Badge de status do modelo no header - responsivo e visível no mobile -->
        <div class="flex items-center gap-1 sm:gap-1.5 text-[10px] px-1.5 sm:px-2 py-1 rounded-lg border max-w-[120px] sm:max-w-none"
          :class="{
            'bg-emerald-500/10 text-emerald-400 border-emerald-500/20': llmStatus === 'ready',
            'bg-indigo-500/10 text-indigo-400 border-indigo-500/20': llmStatus === 'loading' || llmStatus === 'generating',
            'bg-red-500/10 text-red-400 border-red-500/20': llmStatus === 'error',
            'bg-slate-800 text-slate-400 border-slate-700': llmStatus === 'idle'
          }"
        >
          <RefreshCw v-if="llmStatus === 'loading' || llmStatus === 'generating'" class="w-3 h-3 animate-spin shrink-0" />
          <CheckCircle2 v-else-if="llmStatus === 'ready'" class="w-3 h-3 shrink-0" />
          <AlertTriangle v-else-if="llmStatus === 'error'" class="w-3 h-3 shrink-0" />
          <Cpu v-else class="w-3 h-3 shrink-0" />
          <span class="truncate">{{
            llmStatus === 'ready' ? 'Modelo pronto' :
            llmStatus === 'loading' ? `Carregando ${llmLoadingProgress.progress}%` :
            llmStatus === 'generating' ? 'Gerando...' :
            llmStatus === 'error' ? 'Erro no modelo' :
            'Não carregado'
          }}</span>
        </div>

        <button
          @click="showPromptPreview = !showPromptPreview"
          class="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 hover:text-slate-100 text-xs flex items-center gap-1.5 transition"
          title="Inspecionar template de prompt anti-alucinação"
        >
          <ShieldAlert class="w-3.5 h-3.5 text-amber-400" />
          <span class="hidden sm:inline">Prompt Anti-Viés</span>
        </button>
        <button
          v-if="messages.length > 0"
          @click="$emit('clear-history')"
          class="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
          title="Limpar histórico de chat"
        >
          <Trash2 class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Melhoria 2+3: Banner de carregamento do modelo -->
    <div v-if="llmStatus === 'loading'" class="px-4 py-3 bg-indigo-950/80 border-b border-indigo-500/20 space-y-1.5">
      <div class="flex items-center justify-between text-xs">
        <span class="text-indigo-300 font-medium flex items-center gap-1.5">
          <RefreshCw class="w-3.5 h-3.5 animate-spin" />
          Carregando modelo de linguagem na WebGPU...
        </span>
        <span class="font-mono text-indigo-200 font-semibold">{{ llmLoadingProgress.progress }}%</span>
      </div>
      <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          class="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300 rounded-full"
          :style="{ width: `${llmLoadingProgress.progress}%` }"
        />
      </div>
    </div>

    <!-- Banner de Alerta se o Modelo Falhar ou não carregar na WebGPU -->
    <div v-if="llmStatus === 'error'" class="px-4 py-2.5 bg-red-950/80 border-b border-red-500/30 text-xs text-red-200 flex items-center justify-between gap-2 animate-fade-in">
      <div class="flex items-center gap-2 min-w-0">
        <AlertTriangle class="w-4 h-4 text-red-400 shrink-0" />
        <div class="truncate">
          <span class="font-semibold">WebLLM indisponível: </span>
          <span class="text-red-300 font-mono text-[11px]">{{ llmErrorMessage || 'Falha ao inicializar na WebGPU local.' }}</span>
        </div>
      </div>
      <button
        @click="$emit('retry-load-llm')"
        class="px-2.5 py-1 bg-red-800/60 hover:bg-red-700/60 text-white rounded-lg text-[11px] font-medium shrink-0 border border-red-500/40 transition flex items-center gap-1"
        title="Tentar recarregar o modelo na WebGPU"
      >
        <RefreshCw class="w-3 h-3" />
        <span>Recarregar</span>
      </button>
    </div>

    <!-- Modal/Gaveta de Inspeção do Prompt Anti-Viés -->
    <div v-if="showPromptPreview" class="p-4 bg-slate-950/90 border-b border-slate-800 text-xs animate-fade-in">
      <div class="flex items-center justify-between mb-2">
        <span class="font-semibold text-amber-400 flex items-center gap-1.5">
          <ShieldAlert class="w-4 h-4" />
          Template Formal de Prevenção a Alucinações (Seção 7 do Plano)
        </span>
        <button @click="showPromptPreview = false" class="text-slate-400 hover:text-slate-200">
          <X class="w-4 h-4" />
        </button>
      </div>
      <pre class="bg-slate-900 p-3 rounded-lg text-slate-300 font-mono text-[11px] overflow-x-auto border border-slate-800 leading-relaxed whitespace-pre-wrap">
[SISTEMA: MODO DE RESPOSTA ESTRITO E SEM ALUCINAÇÕES]
Você é um assistente de inteligência artificial de precisão. Sua tarefa é responder à pergunta do usuário utilizando EXCLUSIVAMENTE as evidências textuais fornecidas na seção CONTEXTO e as regras formais contidas na seção REGRAS ONTOLÓGICAS.

DIRETRIZES OBRIGATÓRIAS:
1. Responda APENAS com base nos fatos explicitados no CONTEXTO. Não utilize conhecimentos prévios externos.
2. Se o CONTEXTO não contiver dados suficientes para responder totalmente, declare: "Não há informações suficientes na base de conhecimento carregada para responder a esta questão."
3. Respeite estritamente os conceitos e equivalências definidos nas REGRAS ONTOLÓGICAS.
4. Mantenha um tom neutro, objetivo e direto, sem especulações.
      </pre>
    </div>

    <!-- Lista de Mensagens -->
    <div ref="chatContainerRef" class="flex-1 overflow-y-auto p-4 space-y-4">
      <div v-if="messages.length === 0" class="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
        <div class="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 mb-3">
          <Sparkles class="w-7 h-7 text-indigo-400/80" />
        </div>
        <h4 class="text-sm font-semibold text-slate-300">Assistente de pesquisa</h4>
        <p class="text-xs text-slate-500 max-w-md mt-1 mb-4">
          Faça perguntas sobre os documentos indexados na base "{{ activeKb?.name || 'padrão' }}". O motor utilizará busca híbrida (Dense + Sparse BM25 + Ontologias) baseada em IA totalmente no seu dispositivo. Nenhum documento ou parte é enviada para processamento externo em servidor remoto.
        </p>
        <div class="flex flex-wrap gap-2 justify-center max-w-lg">
          <button
            v-for="sug in suggestions"
            :key="sug"
            @click="inputText = sug"
            class="px-3 py-1.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg text-xs text-slate-300 text-left transition"
          >
            "{{ sug }}"
          </button>
        </div>
      </div>

      <div
        v-for="msg in messages"
        :key="msg.id"
        class="flex flex-col gap-1.5"
        :class="msg.role === 'user' ? 'items-end' : 'items-start'"
      >
        <div class="flex items-center gap-2 text-[10px] text-slate-500">
          <span>{{ msg.role === 'user' ? 'Você' : 'SLM Local (Edge AI)' }}</span>
          <span>•</span>
          <span>{{ new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
        </div>

        <div
          :class="msg.role === 'user'
            ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] sm:max-w-xl text-xs sm:text-sm shadow-md'
            : 'bg-slate-800/80 border border-slate-700/60 text-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[92%] sm:max-w-2xl text-xs sm:text-sm shadow-md'"
        >
          <!-- Resposta gerada — sempre visível -->
          <div class="whitespace-pre-wrap leading-relaxed">{{ msg.content }}</div>

          <!-- Melhoria 1: badge de origem — Gerado pelo LLM ou Fallback Estruturado -->
          <div
            v-if="msg.role === 'assistant' && msg.generatedByLlm !== null && msg.generatedByLlm !== undefined"
            class="mt-2 flex items-center gap-1.5 flex-wrap"
          >
            <span
              class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium border"
              :class="msg.generatedByLlm
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'"
            >
              <CheckCircle2 v-if="msg.generatedByLlm" class="w-2.5 h-2.5" />
              <AlertTriangle v-else class="w-2.5 h-2.5" />
              {{ msg.generatedByLlm ? 'Gerado pelo modelo (WebLLM)' : 'Fallback estruturado — sem inferência LLM' }}
            </span>
            <span
              v-if="!msg.generatedByLlm && msg.fallbackReason"
              class="text-[10px] text-amber-300/80 font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 max-w-full truncate"
              :title="msg.fallbackReason"
            >
              Motivo: {{ msg.fallbackReason }}
            </span>
          </div>

          <!-- Botão "Ver fontes" — aparece apenas em mensagens do assistente com chunks -->
          <div
            v-if="msg.role === 'assistant' && msg.retrievedChunks && msg.retrievedChunks.length > 0"
            class="mt-2.5"
          >
            <button
              @click="toggleSources(msg.id)"
              class="inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-300 hover:text-indigo-200 transition"
            >
              <Layers class="w-3.5 h-3.5" />
              <span>{{ openSourcesSet.has(msg.id) ? 'Ocultar fontes' : 'Ver fontes' }}</span>
              <component :is="openSourcesSet.has(msg.id) ? ChevronUp : ChevronDown" class="w-3.5 h-3.5" />
              <span class="text-slate-500 font-normal ml-0.5">({{ msg.retrievedChunks.length }})</span>
            </button>

            <!-- Painel de Fontes — colapsável -->
            <div v-if="openSourcesSet.has(msg.id)" class="mt-2.5 pt-2.5 border-t border-slate-700/60 text-[11px] text-slate-400 space-y-3">
              <!-- Cabeçalho das fontes -->
              <div class="flex items-center justify-between font-semibold text-indigo-300">
                <span class="flex items-center gap-1.5">
                  <Layers class="w-3.5 h-3.5 text-indigo-400" />
                  Fontes Recuperadas (Chunks Pais por RRF):
                </span>
                <span v-if="msg.ragStats" class="text-[10px] text-slate-400 font-normal">
                  Busca: {{ msg.ragStats.denseMatches }} densas / {{ msg.ragStats.sparseMatches }} esparsas
                </span>
              </div>

              <!-- Lista de Chunks Pais -->
              <div class="space-y-1.5">
                <div
                  v-for="(chunk, idx) in msg.retrievedChunks"
                  :key="idx"
                  class="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] space-y-1"
                >
                  <div class="flex items-center justify-between">
                    <div class="font-medium text-slate-200 flex items-center gap-1.5">
                      <span class="text-indigo-400">#{{ idx + 1 }}</span>
                      <span>{{ chunk.sectionTitle || 'Trecho ' + (idx + 1) }}</span>
                    </div>
                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                      Chunk Pai
                    </span>
                  </div>
                  <p class="text-slate-300 leading-snug line-clamp-3">{{ chunk.content }}</p>
                </div>
              </div>

              <!-- Detalhamento dos Chunks Filhos ranqueados por RRF -->
              <div v-if="msg.rankedChildren && msg.rankedChildren.length > 0" class="pt-2 border-t border-slate-800/80">
                <div class="text-[10px] font-semibold uppercase tracking-wider text-cyan-400 mb-1 flex items-center gap-1">
                  <GitCommit class="w-3 h-3" />
                  Chunks Filhos Ranqueados (RRF Fusão k=60):
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <div
                    v-for="(item, cIdx) in msg.rankedChildren.slice(0, 4)"
                    :key="cIdx"
                    class="text-[9px] font-mono px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5"
                  >
                    <span class="text-indigo-300 font-semibold">RRF: {{ (item.rrfScore * 1000).toFixed(2) }}</span>
                    <span v-if="item.denseSimilarity" class="text-emerald-300">Cos: {{ item.denseSimilarity.toFixed(2) }}</span>
                    <span v-if="item.sparseScore" class="text-amber-300">BM25: {{ item.sparseScore.toFixed(1) }}</span>
                    <span v-if="item.hasOntologyBoost" class="text-[8px] bg-cyan-500/20 text-cyan-300 px-1 rounded font-bold">
                      OWL Boost +25%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      <!-- Loading / Streaming Indicator -->
      <div v-if="isGenerating" class="flex items-center gap-2 text-xs text-indigo-400 bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 max-w-md">
        <RefreshCw class="w-3.5 h-3.5 animate-spin" />
        <span>Consultando vetores e executando inferência no WebLLM...</span>
      </div>
    </div>

    <!-- Input Bar -->
    <div class="p-3 sm:p-4 bg-slate-900/90 border-t border-slate-800">
      <!-- Melhoria 3: aviso amigável enquanto o modelo carrega -->
      <div v-if="webgpuAvailable && llmStatus === 'loading'" class="mb-2 flex items-center gap-2 text-[11px] text-indigo-300 bg-indigo-500/10 px-3 py-2 rounded-lg border border-indigo-500/20">
        <RefreshCw class="w-3 h-3 animate-spin shrink-0" />
        <span>Aguarde — modelo carregando na WebGPU ({{ llmLoadingProgress.progress }}%). Você poderá enviar perguntas em instantes.</span>
      </div>
      <form @submit.prevent="handleSend" class="flex items-center gap-2">
        <input
          v-model="inputText"
          type="text"
          :placeholder="(webgpuAvailable && llmStatus === 'loading') ? 'Aguardando o modelo carregar...' : 'Digite sua pergunta baseada no conhecimento indexado...'"
          :disabled="inputBlocked"
          class="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          :disabled="!inputText.trim() || inputBlocked"
          class="p-2.5 sm:px-4 sm:py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/20"
        >
          <Send class="w-4 h-4" />
          <span class="hidden sm:inline">Enviar</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, watch } from 'vue'
import { MessageSquare, ShieldAlert, Sparkles, Send, Layers, Trash2, RefreshCw, GitCommit, X, ChevronDown, ChevronUp, Cpu, AlertTriangle, CheckCircle2 } from '@lucide/vue'

const props = defineProps({
  activeKb: {
    type: Object,
    default: null
  },
  messages: {
    type: Array,
    default: () => []
  },
  isGenerating: {
    type: Boolean,
    default: false
  },
  llmStatus: {
    type: String,
    default: 'idle' // 'idle'|'loading'|'ready'|'generating'|'error'
  },
  llmLoadingProgress: {
    type: Object,
    default: () => ({ text: '', progress: 0 })
  },
  webgpuAvailable: {
    type: Boolean,
    default: false
  },
  currentModelId: {
    type: String,
    default: ''
  },
  llmErrorMessage: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['send-message', 'clear-history', 'retry-load-llm'])

// Nome amigável curto para exibição no cabeçalho do chat
const activeModelShortName = computed(() => {
  if (!props.currentModelId) return 'Llama-3.2-1B'
  const match = props.currentModelId.match(/^([a-zA-Z0-9.-]+?)(?:-[qQ]\d[a-zA-Z0-9_]+)?(?:-MLC)?$/)
  return match ? match[1] : props.currentModelId
})

// O envio é bloqueado enquanto o modelo ainda está sendo carregado
const inputBlocked = computed(() =>
  props.isGenerating || (props.webgpuAvailable && props.llmStatus === 'loading')
)

const inputText = ref('')
const showPromptPreview = ref(false)
const chatContainerRef = ref(null)

// Controla quais mensagens têm o painel de fontes aberto (por ID de mensagem)
const openSourcesSet = reactive(new Set())
function toggleSources(msgId) {
  if (openSourcesSet.has(msgId)) {
    openSourcesSet.delete(msgId)
  } else {
    openSourcesSet.add(msgId)
  }
}

const suggestions = [
  'Qual o resumo dos conceitos encontrados nos documentos?',
  'Quais são as relações e regras descritas na ontologia?',
  'Explique o objetivo principal da base indexada.'
]

function handleSend() {
  const query = inputText.value.trim()
  if (!query || inputBlocked.value) return
  emit('send-message', query)
  inputText.value = ''
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainerRef.value) {
      chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
    }
  })
}

watch(() => props.messages.length, () => {
  scrollToBottom()
})
</script>
