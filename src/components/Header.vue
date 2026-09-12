<template>
  <header class="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-2.5 sm:px-4 lg:px-6 py-2 sm:py-2.5">
    <div class="flex items-center justify-between gap-2 sm:gap-4">
      <!-- Logo & Título -->
      <div class="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <div class="h-8 w-8 sm:h-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 flex items-center justify-center shadow-md shadow-indigo-500/20">
          <Layers class="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <div>
          <div class="flex items-center gap-1.5">
            <h1 class="font-bold text-slate-100 tracking-tight text-sm sm:text-base">
              EdgeRAG
            </h1>
          </div>
          <p class="text-[10px] text-slate-400 hidden sm:block">
            Busca com IA 100% offline
          </p>
        </div>
      </div>

      <!-- Status & Base Ativa -->
      <div class="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
        <!-- Indicador Base Ativa -->
        <button
          @click="$emit('open-kb-selector')"
          class="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-700/80 bg-slate-800/60 hover:bg-slate-800 text-slate-200 transition min-w-0"
          title="Alternar base de conhecimento"
        >
          <Database class="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span class="max-w-[75px] xs:max-w-[105px] sm:max-w-[140px] md:max-w-[180px] truncate font-medium text-[11px] sm:text-xs">
            {{ activeKb ? activeKb.name : 'Nenhuma Base' }}
          </span>
          <ChevronDown class="w-3 h-3 text-slate-400 shrink-0" />
          <span class="hidden md:inline text-[10px] text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded">
            Trocar
          </span>
        </button>

        <!-- Botão Unificado de Hardware & WebGPU -->
        <button
          @click="$emit('open-hardware-modal')"
          :class="hardware?.webgpu
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'"
          class="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border text-[11px] sm:text-xs font-medium transition shrink-0"
          title="Diagnóstico de Hardware, WebGPU e Armazenamento (Clique para detalhes)"
        >
          <Cpu class="w-3.5 h-3.5 shrink-0" />
          <span
            class="w-1.5 h-1.5 rounded-full shrink-0"
            :class="hardware?.webgpu ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'"
          ></span>
          <span class="hidden md:inline">{{ hardware?.webgpu ? 'WebGPU Ativa' : 'WebGPU Ausente' }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { Layers, Database, Cpu, ChevronDown } from '@lucide/vue'

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
