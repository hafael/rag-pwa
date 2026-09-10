<template>
  <div class="space-y-6">
    <div class="bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-800">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">
        <Settings class="w-5 h-5 text-indigo-400" />
        Configuração de Modelos Locais & Edge AI
      </h2>
      <p class="text-xs text-slate-400 mt-0.5">
        Selecione o modelo SLM executado 100% no dispositivo via WebGPU e gerencie o cache OPFS
      </p>
    </div>

    <!-- Tabela de Modelos SLM -->
    <div class="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
        <Cpu class="w-4 h-4 text-indigo-400" />
        Modelos de Linguagem de Borda (SLM) Suportados
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div
          v-for="model in supportedModels"
          :key="model.id"
          @click="selectedModel = model.id"
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
        Modelo de Embeddings Vetoriais
      </h3>
      <div class="p-3.5 rounded-xl bg-slate-800/30 border border-slate-800 flex items-center justify-between">
        <div>
          <div class="text-xs font-semibold text-slate-200">all-MiniLM-L6-v2 (ONNX WebGPU/WASM)</div>
          <p class="text-[11px] text-slate-400 mt-0.5">384 dimensões de vetor, ~120 MB de memória, alta velocidade para busca densa.</p>
        </div>
        <span class="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
          Integrado
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
import { ref } from 'vue'
import { Settings, Cpu, Layers, HardDrive, Trash2 } from '@lucide/vue'

const selectedModel = ref('Llama-3.2-1B-Instruct-q4f16')

const supportedModels = [
  {
    id: 'Llama-3.2-1B-Instruct-q4f16',
    name: 'Llama-3.2-1B-Instruct',
    description: 'Perfil Leve / Mobile. Menor uso de recursos e carregamento ágil no navegador.',
    vram: '~1.5 GB',
    recommended: true
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f16',
    name: 'Phi-3.5-mini-instruct',
    description: 'Perfil Equilibrado. Excelente raciocínio lógico e adesão estrita ao contexto.',
    vram: '~2.5 GB',
    recommended: false
  },
  {
    id: 'DeepSeek-R1-Distill-Qwen-1.5B',
    name: 'DeepSeek-R1-Distill-1.5B',
    description: 'Alta Precisão. Especializado em raciocínio encadeado passo a passo.',
    vram: '~2.0 GB',
    recommended: false
  }
]

function handleClearStorage() {
  if (confirm('Atenção: Isso excluirá todas as Bases de Conhecimento, Documentos, Chunks e Histórico do IndexedDB local. Deseja continuar?')) {
    indexedDB.deleteDatabase('RagHybridDatabase')
    location.reload()
  }
}
</script>
