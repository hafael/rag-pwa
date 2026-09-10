<template>
  <div class="space-y-6">
    <div class="bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-800">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">
        <Settings class="w-5 h-5 text-indigo-400" />
        Configuração de Modelos Locais & Edge AI
      </h2>
      <p class="text-xs text-slate-400 mt-0.5">
        Selecione o modelo SLM executado 100% no dispositivo via WebGPU e gerencie o cache de pesos
      </p>
    </div>

    <!-- Tabela de Modelos SLM com Controles de Inicialização -->
    <div class="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Cpu class="w-4 h-4 text-indigo-400" />
            Modelos de Linguagem de Borda (SLM) Suportados
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">
            Status Atual do SLM:
            <span :class="statusClass" class="font-semibold px-2 py-0.5 rounded text-[11px] ml-1">
              {{ statusLabel }}
            </span>
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            v-if="llmStatus === 'ready'"
            @click="handleUnload"
            class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl text-xs font-medium border border-slate-700 transition"
          >
            Descarregar da VRAM
          </button>
          <button
            v-else
            @click="handleLoadModel"
            :disabled="llmStatus === 'loading'"
            class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-md shadow-indigo-600/20"
          >
            <RefreshCw v-if="llmStatus === 'loading'" class="w-3.5 h-3.5 animate-spin" />
            <Play v-else class="w-3.5 h-3.5" />
            <span>{{ llmStatus === 'loading' ? 'Inicializando...' : 'Carregar Modelo na WebGPU' }}</span>
          </button>
        </div>
      </div>

      <!-- Barra de Progresso de Download do Modelo -->
      <div v-if="llmStatus === 'loading'" class="mb-5 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="text-indigo-300 font-medium truncate max-w-sm">
            {{ loadingProgress.text || 'Baixando pesos quantizados e compilando shaders...' }}
          </span>
          <span class="font-mono text-indigo-200 font-semibold">{{ loadingProgress.progress }}%</span>
        </div>
        <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            class="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300 rounded-full"
            :style="{ width: `${loadingProgress.progress}%` }"
          ></div>
        </div>
        <p class="text-[10px] text-slate-400">
          Nota: O download é realizado uma única vez. Os pesos são cacheados localmente no navegador via OPFS/Cache API.
        </p>
      </div>

      <div v-if="errorMessage" class="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-2">
        <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <span class="font-semibold">Erro ao carregar modelo:</span>
          <p class="mt-0.5 text-slate-300">{{ errorMessage }}</p>
        </div>
      </div>

      <!-- Cards de Modelos -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div
          v-for="model in supportedModels"
          :key="model.id"
          @click="selectModel(model.id)"
          :class="selectedModel === model.id ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500' : 'border-slate-800 bg-slate-800/30 hover:border-slate-700'"
          class="p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between"
        >
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-200">{{ model.name }}</span>
              <span v-if="model.recommended" class="text-[9px] font-semibold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                Padrão
              </span>
            </div>
            <p class="text-xs text-slate-400 mt-1.5 leading-relaxed">{{ model.description }}</p>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span class="text-slate-400">VRAM Requerida:</span>
            <span class="font-mono text-indigo-300 font-semibold">{{ model.vram }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Configuração de Embeddings -->
    <div class="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2">
        <Layers class="w-4 h-4 text-cyan-400" />
        Modelo de Embeddings Vetoriais (Busca Densa)
      </h3>
      <div class="p-3.5 rounded-xl bg-slate-800/30 border border-slate-800 flex items-center justify-between">
        <div>
          <div class="text-xs font-semibold text-slate-200">all-MiniLM-L6-v2 (ONNX WebGPU/WASM)</div>
          <p class="text-[11px] text-slate-400 mt-0.5">
            384 dimensões de vetor, ~120 MB de memória, alta velocidade para busca densa e RRF.
          </p>
        </div>
        <span class="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
          Integrado & Ativo
        </span>
      </div>
    </div>

    <!-- Gestão de Cache e OPFS -->
    <div class="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
        <HardDrive class="w-4 h-4 text-violet-400" />
        Persistência Local (IndexedDB & OPFS)
      </h3>
      <p class="text-xs text-slate-400 mb-4">
        Os vetores de documentos, metadados e histórico são salvos no IndexedDB do navegador. Os pesos dos modelos são cacheados no Origin Private File System (OPFS).
      </p>

      <div class="flex items-center gap-3">
        <button
          @click="handleClearStorage"
          class="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
        >
          <Trash2 class="w-4 h-4" />
          Limpar Banco IndexedDB
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Settings, Cpu, Layers, HardDrive, Trash2, RefreshCw, Play, AlertCircle } from '@lucide/vue'
import { webLlmService } from '../services/webLlm.js'

const selectedModel = ref(webLlmService.currentModelId)
const llmStatus = ref(webLlmService.status)
const loadingProgress = ref(webLlmService.loadingProgress)
const errorMessage = ref(null)

const supportedModels = [
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama-3.2-1B-Instruct',
    description: 'Perfil Leve / Mobile. Menor uso de recursos e carregamento ágil no navegador.',
    vram: '~1.5 GB',
    recommended: true
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    name: 'Phi-3.5-mini-instruct',
    description: 'Perfil Equilibrado. Excelente raciocínio lógico e adesão estrita ao contexto.',
    vram: '~2.5 GB',
    recommended: false
  },
  {
    id: 'DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC',
    name: 'DeepSeek-R1-Distill-1.5B',
    description: 'Alta Precisão. Especializado em raciocínio encadeado passo a passo.',
    vram: '~2.0 GB',
    recommended: false
  }
]

const statusLabel = computed(() => {
  switch (llmStatus.value) {
    case 'ready': return 'Pronto na WebGPU'
    case 'loading': return 'Carregando Pesos...'
    case 'error': return 'Erro de Inicialização'
    case 'generating': return 'Gerando Resposta...'
    case 'idle':
    default: return 'Não Carregado'
  }
})

const statusClass = computed(() => {
  switch (llmStatus.value) {
    case 'ready': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    case 'loading': return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
    case 'error': return 'bg-red-500/10 text-red-400 border border-red-500/20'
    case 'generating': return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
    case 'idle':
    default: return 'bg-slate-800 text-slate-400 border border-slate-700'
  }
})

async function selectModel(id) {
  if (selectedModel.value === id) return
  selectedModel.value = id
  if (llmStatus.value === 'ready') {
    await webLlmService.unload()
    llmStatus.value = 'idle'
  }
}

async function handleLoadModel() {
  errorMessage.value = null
  llmStatus.value = 'loading'
  try {
    await webLlmService.loadModel(selectedModel.value, (prog) => {
      loadingProgress.value = prog
    })
    llmStatus.value = 'ready'
  } catch (err) {
    llmStatus.value = 'error'
    errorMessage.value = err.message
  }
}

async function handleUnload() {
  await webLlmService.unload()
  llmStatus.value = 'idle'
}

function handleClearStorage() {
  if (confirm('Atenção: Isso excluirá todas as Bases de Conhecimento, Documentos, Chunks e Histórico do IndexedDB local. Deseja continuar?')) {
    indexedDB.deleteDatabase('RagHybridDatabase')
    location.reload()
  }
}
</script>
