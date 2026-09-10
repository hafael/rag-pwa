<template>
  <header class="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-6 py-3">
    <div class="flex items-center justify-between gap-4">
      <!-- Logo & Título -->
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Layers class="w-5 h-5 text-white" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="font-bold text-slate-100 tracking-tight text-base sm:text-lg">
              EdgeRAG
            </h1>
          </div>
          <p class="text-xs text-slate-400 hidden sm:block">
            Busca com IA 100% offline
          </p>
        </div>
      </div>

      <!-- Status & Base Ativa -->
      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Indicador Base Ativa -->
        <button
          @click="$emit('open-kb-selector')"
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700/80 bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-200 transition"
          title="Alternar base de conhecimento"
        >
          <Database class="w-3.5 h-3.5 text-indigo-400" />
          <span class="max-w-[120px] truncate font-medium">
            {{ activeKb ? activeKb.name : 'Nenhuma Base' }}
          </span>
          <span class="text-[10px] text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded">
            Trocar
          </span>
        </button>

        <!-- WebGPU Badge -->
        <div
          :class="hardware?.webgpu ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium"
        >
          <Cpu class="w-3.5 h-3.5" />
          <span class="hidden md:inline">{{ hardware?.webgpu ? 'WebGPU Ativa' : 'WebGPU Ausente' }}</span>
        </div>

        <!-- Botão de Diagnóstico de Hardware -->
        <button
          @click="$emit('open-hardware-modal')"
          class="p-2 rounded-lg border border-slate-700/80 bg-slate-800/60 hover:bg-slate-800 text-slate-300 transition"
          title="Ver diagnóstico de hardware e armazenamento"
        >
          <Info class="w-4 h-4" />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { Layers, Database, Cpu, Info } from '@lucide/vue'

defineProps({
  activeKb: {
    type: Object,
    default: null
  },
  hardware: {
    type: Object,
    default: () => ({ webgpu: false })
  }
})

defineEmits(['open-kb-selector', 'open-hardware-modal'])
</script>
