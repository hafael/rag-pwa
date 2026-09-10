<template>
  <div class="space-y-6">
    <!-- Top Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-800">
      <div>
        <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">
          <FileText class="w-5 h-5 text-indigo-400" />
          Documentos & Base Local
        </h2>
        <p class="text-xs text-slate-400 mt-0.5">
          Base: <span class="text-indigo-300 font-semibold">{{ activeKb?.name || 'Selecione uma Base' }}</span>
        </p>
      </div>

      <div class="flex items-center gap-2.5">
        <button
          @click="$emit('open-upload')"
          class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
        >
          <Plus class="w-4 h-4" />
          Novo Documento / OWL
        </button>
      </div>
    </div>

    <!-- Estatísticas da Base Ativa -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
      <div class="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40">
        <span class="text-[11px] font-medium text-slate-400">Total Documentos</span>
        <div class="text-xl font-bold text-slate-100 mt-1">{{ stats.docCount }}</div>
      </div>
      <div class="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40">
        <span class="text-[11px] font-medium text-slate-400">Chunks Pai (Contexto)</span>
        <div class="text-xl font-bold text-indigo-400 mt-1">{{ stats.parentCount }}</div>
      </div>
      <div class="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40">
        <span class="text-[11px] font-medium text-slate-400">Chunks Filho (Busca)</span>
        <div class="text-xl font-bold text-cyan-400 mt-1">{{ stats.childCount }}</div>
      </div>
      <div class="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40">
        <span class="text-[11px] font-medium text-slate-400">Triplas OWL Ativas</span>
        <div class="text-xl font-bold text-emerald-400 mt-1">{{ stats.tripleCount }}</div>
      </div>
    </div>

    <!-- Lista de Documentos -->
    <div class="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
      <div class="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Documentos Indexados</h3>
        <span class="text-xs text-slate-500">{{ documents.length }} arquivo(s)</span>
      </div>

      <div v-if="documents.length === 0" class="text-center py-16 px-4">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3">
          <FileText class="w-6 h-6" />
        </div>
        <h4 class="text-sm font-semibold text-slate-300">Nenhum documento na base atual</h4>
        <p class="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
          Faça upload de arquivos PDF, DOCX, TXT, Markdown ou Ontologias OWL para habilitar a busca semântica offline.
        </p>
        <button
          @click="$emit('open-upload')"
          class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition"
        >
          <Plus class="w-4 h-4" />
          Adicionar Primeiro Documento
        </button>
      </div>

      <div v-else class="divide-y divide-slate-800/60">
        <div
          v-for="doc in documents"
          :key="doc.id"
          class="p-4 hover:bg-slate-800/20 transition flex items-center justify-between gap-4"
        >
          <div class="flex items-start gap-3 min-w-0">
            <div class="p-2.5 rounded-xl bg-slate-800/60 text-indigo-400 shrink-0 mt-0.5">
              <FileCode v-if="doc.fileType === 'ontology'" class="w-5 h-5 text-cyan-400" />
              <FileText v-else class="w-5 h-5" />
            </div>
            <div class="min-w-0">
              <h4 class="text-xs font-semibold text-slate-200 truncate">{{ doc.fileName }}</h4>
              <div class="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-400 mt-1">
                <span>{{ formatFileSize(doc.fileSize) }}</span>
                <span>•</span>
                <span class="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-medium text-slate-300">
                  Estratégia: {{ doc.strategyUsed }}
                </span>
                <span>•</span>
                <span class="text-indigo-300">{{ doc.parentCount || 0 }} Chunks Pais</span>
                <span>/</span>
                <span class="text-cyan-300">{{ doc.childCount || 0 }} Filhos</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button
              v-if="doc.fileType !== 'ontology'"
              @click="$emit('inspect-doc', doc)"
              class="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              title="Inspecionar Chunks Pais e Filhos"
            >
              <Layers class="w-3.5 h-3.5" />
              <span class="hidden sm:inline">Ver Chunks</span>
            </button>
            <button
              @click="$emit('delete-doc', doc.id)"
              class="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
              title="Remover documento e seus chunks"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { FileText, FileCode, Plus, Trash2, Layers } from '@lucide/vue'

defineProps({
  activeKb: {
    type: Object,
    default: null
  },
  documents: {
    type: Array,
    default: () => []
  },
  stats: {
    type: Object,
    default: () => ({ docCount: 0, parentCount: 0, childCount: 0, tripleCount: 0 })
  }
})

defineEmits(['open-upload', 'delete-doc', 'inspect-doc'])

function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>
