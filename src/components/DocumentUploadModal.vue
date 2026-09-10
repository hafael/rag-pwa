<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-slate-800">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <UploadCloud class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-semibold text-slate-100">Ingestão de Documentos</h3>
            <p class="text-xs text-slate-400">Adicione textos, artigos ou ontologias OWL para processamento local</p>
          </div>
        </div>
        <button
          @click="$emit('close')"
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="mt-4 space-y-4">
        <!-- Seleção de Arquivo -->
        <div>
          <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Arquivo Local
          </label>
          <div
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
            :class="isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700/80 bg-slate-950/60 hover:border-slate-600'"
            class="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center"
            @click="fileInputRef?.click()"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept=".txt,.md,.markdown,.pdf,.docx,.owl,.rdf,.ttl,.n3"
              class="hidden"
              @change="handleFileChange"
            />
            <FileText class="w-8 h-8 text-indigo-400/80 mb-2" />
            <p v-if="!selectedFile" class="text-xs text-slate-300 font-medium">
              Clique para selecionar ou arraste arquivos aqui
            </p>
            <p v-else class="text-xs text-indigo-300 font-semibold truncate max-w-xs">
              {{ selectedFile.name }} ({{ formatFileSize(selectedFile.size) }})
            </p>
            <span class="text-[10px] text-slate-500 mt-1">
              Suporta TXT, Markdown, PDF, DOCX e Ontologias OWL/RDF/TTL
            </span>
          </div>
        </div>

        <!-- Estratégia de Chunking (Parent-Child Pattern) -->
        <div v-if="!isOntologyFile">
          <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Estratégia de Chunking (Padrão Parent-Child)
          </label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              v-for="st in strategies"
              :key="st.id"
              @click="selectedStrategy = st.id"
              :class="selectedStrategy === st.id ? 'border-indigo-500 bg-indigo-500/10 text-slate-100 ring-1 ring-indigo-500' : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'"
              class="p-2.5 rounded-xl border text-left transition flex flex-col justify-between"
            >
              <div>
                <div class="text-xs font-semibold flex items-center justify-between">
                  <span>{{ st.title }}</span>
                  <span v-if="st.recommended" class="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-normal">Recomendado</span>
                </div>
                <p class="text-[10px] text-slate-400 mt-1 leading-snug">{{ st.desc }}</p>
              </div>
            </button>
          </div>
        </div>

        <!-- Aviso especial se for Ontologia -->
        <div v-else class="p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 flex items-start gap-2.5">
          <Network class="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div class="text-xs">
            <span class="font-semibold text-cyan-300">Arquivo Ontológico Detectado</span>
            <p class="text-slate-300 mt-0.5">
              Este arquivo será processado via engine N3.js para extrair Classes, Subclasses e Triplas de domínio para expansão semântica e anti-viés.
            </p>
          </div>
        </div>

        <!-- Barra de Progresso da Ingestão (Web Worker) -->
        <div v-if="isProcessing" class="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 space-y-2 animate-fade-in">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-indigo-300 flex items-center gap-2">
              <RefreshCw class="w-3.5 h-3.5 animate-spin" />
              {{ uploadProgress?.stage || 'Processando no Web Worker...' }}
            </span>
            <span class="font-mono text-indigo-200 font-semibold">{{ uploadProgress?.percent || 50 }}%</span>
          </div>
          <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300 rounded-full"
              :style="{ width: `${uploadProgress?.percent || 50}%` }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Ações -->
      <div class="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
        <span class="text-[11px] text-slate-500">
          Processamento 100% no cliente (Web Worker)
        </span>
        <div class="flex gap-2">
          <button
            @click="$emit('close')"
            :disabled="isProcessing"
            class="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50 transition"
          >
            Cancelar
          </button>
          <button
            @click="handleSubmit"
            :disabled="!selectedFile || isProcessing"
            class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
          >
            <UploadCloud class="w-4 h-4" />
            <span>{{ isProcessing ? 'Processando...' : 'Iniciar Ingestão' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { UploadCloud, FileText, Network, RefreshCw, X } from '@lucide/vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  isProcessing: {
    type: Boolean,
    default: false
  },
  uploadProgress: {
    type: Object,
    default: () => ({ stage: '', percent: 0 })
  }
})

const emit = defineEmits(['close', 'upload'])

const fileInputRef = ref(null)
const selectedFile = ref(null)
const isDragging = ref(false)
const selectedStrategy = ref('section')

const strategies = [
  {
    id: 'section',
    title: 'Por Seção / Título (Hierárquico)',
    desc: 'Cria Chunk Pai por cabeçalhos e Chunks Filhos de 120 palavras.',
    recommended: true
  },
  {
    id: 'paragraph',
    title: 'Por Parágrafo',
    desc: 'Segmenta Chunks Pai por quebras duplas de linha.'
  },
  {
    id: 'sentence',
    title: 'Por Sentença (Intl.Segmenter)',
    desc: 'Segmenta por períodos gramaticais completos.'
  },
  {
    id: 'page',
    title: 'Por Página (Documentos PDF)',
    desc: 'Separa Chunks Pais por marcadores estruturais de página.'
  },
  {
    id: 'tokens',
    title: 'Janela de Palavras Fixas',
    desc: 'Blocos de 450 palavras no Pai e 120 palavras no Filho com overlap.'
  }
]

const isOntologyFile = computed(() => {
  if (!selectedFile.value) return false
  const ext = selectedFile.value.name.split('.').pop().toLowerCase()
  return ['owl', 'rdf', 'ttl', 'n3'].includes(ext)
})

function handleFileChange(event) {
  const files = event.target.files
  if (files && files[0]) {
    selectedFile.value = files[0]
  }
}

function handleDrop(event) {
  isDragging.value = false
  const files = event.dataTransfer.files
  if (files && files[0]) {
    selectedFile.value = files[0]
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function handleSubmit() {
  if (!selectedFile.value) return
  emit('upload', {
    file: selectedFile.value,
    strategy: isOntologyFile.value ? 'ontology' : selectedStrategy.value,
    isOntology: isOntologyFile.value
  })
}
</script>
