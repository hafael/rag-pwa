<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl relative">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Layers class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-semibold text-slate-100">
              Inspetor de chunks Parent-Child
            </h3>
            <p class="text-xs text-slate-400">
              Documento: <span class="text-indigo-300 font-medium">{{ document?.fileName }}</span>
              ({{ parents.length }} Pais / {{ children.length }} Filhos)
            </p>
          </div>
        </div>
        <button
          @click="$emit('close')"
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Lista de Chunks Pais com Filhos aninhados -->
      <div class="flex-1 overflow-y-auto mt-4 pr-1 space-y-4">
        <div v-if="parents.length === 0" class="text-center py-12 text-xs text-slate-500">
          Nenhum chunk encontrado para este documento.
        </div>

        <div
          v-for="(parent, pIdx) in parents"
          :key="parent.id"
          class="border border-slate-800 rounded-xl bg-slate-950/50 p-4 space-y-3"
        >
          <!-- Cabeçalho do Chunk Pai -->
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-indigo-400">
                Chunk pai #{{ pIdx + 1 }}: {{ parent.sectionTitle }}
              </span>
              <span class="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-medium">
                Contexto para o SLM
              </span>
            </div>
            <span class="text-[11px] text-slate-400">
              {{ parent.content.split(/\s+/).length }} palavras
            </span>
          </div>

          <!-- Conteúdo do Chunk Pai -->
          <p class="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/60 whitespace-pre-wrap">
            {{ parent.content }}
          </p>

          <!-- Chunks Filhos associados -->
          <div class="pt-2">
            <div class="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <GitCommit class="w-3.5 h-3.5" />
              Chunks filhos vinculados (indexação & busca vetorial):
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                v-for="(child, cIdx) in getChildrenForParent(parent.id)"
                :key="child.id"
                class="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300"
              >
                <div class="flex items-center justify-between text-cyan-300/80 text-[10px] font-mono mb-1">
                  <span>Filho #{{ cIdx + 1 }}</span>
                  <span>{{ child.content.split(/\s+/).length }} palavras</span>
                </div>
                <p class="text-slate-400 line-clamp-3 leading-snug">
                  "{{ child.content }}"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rodapé -->
      <div class="mt-4 pt-3 border-t border-slate-800 flex justify-end shrink-0">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
        >
          Fechar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Layers, GitCommit, X } from '@lucide/vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  document: {
    type: Object,
    default: null
  },
  parents: {
    type: Array,
    default: () => []
  },
  children: {
    type: Array,
    default: () => []
  }
})

defineEmits(['close'])

function getChildrenForParent(parentId) {
  return props.children.filter(c => c.parentId === parentId)
}
</script>
