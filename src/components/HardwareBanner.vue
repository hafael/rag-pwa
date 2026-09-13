<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative overflow-hidden">
      <!-- Header do Modal -->
      <div class="flex items-center justify-between pb-4 border-b border-slate-800">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Cpu class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-semibold text-slate-100">Diagnóstico de Hardware & Edge AI</h3>
            <p class="text-xs text-slate-400">Verificação de aceleração local e persistência</p>
          </div>
        </div>
        <button
          @click="$emit('close')"
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Métricas -->
      <div class="mt-5 space-y-3.5 text-sm">
        <!-- WebGPU -->
        <div class="p-3.5 rounded-xl border bg-slate-800/40" :class="hardware.webgpu ? 'border-emerald-500/20' : 'border-amber-500/20'">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="w-2.5 h-2.5 rounded-full" :class="hardware.webgpu ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'"></span>
              <span class="font-medium text-slate-200">Aceleração WebGPU</span>
            </div>
            <span :class="hardware.webgpu ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'" class="text-xs font-semibold px-2 py-0.5 rounded">
              {{ hardware.webgpu ? 'Compatível & Ativo' : 'Não Detectado' }}
            </span>
          </div>
          <div v-if="hardware.webgpuDetails" class="mt-2 space-y-1 text-xs text-slate-400">
            <p>
              Dispositivo: <span class="text-slate-300 font-mono">{{ hardware.webgpuDetails.vendor }} ({{ hardware.webgpuDetails.architecture }})</span>
            </p>
            <p class="flex items-center gap-1.5 flex-wrap">
              <span>Extensão Float16 (shader-f16):</span>
              <span
                class="px-1.5 py-0.5 rounded text-[11px] font-medium"
                :class="hardware.webgpuDetails.hasF16 ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'"
              >
                {{ hardware.webgpuDetails.hasF16 ? 'Suportado (f16 ativo)' : 'Indisponível (usando modelos f32 compatíveis com mobile)' }}
              </span>
            </p>
          </div>
          <p v-else-if="!hardware.webgpu" class="text-xs text-amber-300/80 mt-2">
            Atenção: O WebLLM necessita de um navegador com WebGPU habilitado (Chrome 113+, Edge 113+ ou Safari 18+).
          </p>
        </div>

        <!-- OPFS -->
        <div class="p-3.5 rounded-xl border bg-slate-800/40" :class="hardware.opfs ? 'border-emerald-500/20' : 'border-amber-500/20'">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <HardDrive class="w-4 h-4 text-cyan-400" />
              <span class="font-medium text-slate-200">Origin Private File System (OPFS)</span>
            </div>
            <span :class="hardware.opfs ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'" class="text-xs font-semibold px-2 py-0.5 rounded">
              {{ hardware.opfs ? 'Disponível' : 'Indisponível' }}
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-1.5">
            Permite salvar pesos binários de modelos de linguagem (1 a 3 GB) com leitura em alta velocidade.
          </p>
        </div>

        <!-- Armazenamento Local -->
        <div class="p-3.5 rounded-xl border border-slate-800 bg-slate-800/40">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2.5">
              <Database class="w-4 h-4 text-violet-400" />
              <span class="font-medium text-slate-200">Cota de Armazenamento Local</span>
            </div>
            <span class="text-xs text-slate-400">
              {{ hardware.storageEstimate.usageMB }} MB usados de {{ hardware.storageEstimate.quotaMB }} MB
            </span>
          </div>
          <div class="w-full h-2 bg-slate-700/60 rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-500"
              :style="{ width: `${Math.min(hardware.storageEstimate.percentUsed || 1, 100)}%` }"
            ></div>
          </div>
        </div>

        <!-- Isolamento Cross-Origin -->
        <div class="p-3.5 rounded-xl border border-slate-800 bg-slate-800/40">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <ShieldCheck class="w-4 h-4 text-indigo-400" />
              <span class="font-medium text-slate-200">Cross-Origin Isolation (COOP/COEP)</span>
            </div>
            <span :class="hardware.crossOriginIsolated ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 bg-slate-800'" class="text-xs font-semibold px-2 py-0.5 rounded">
              {{ hardware.crossOriginIsolated ? 'Habilitado (SharedArrayBuffer Ativo)' : 'Padrão' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Rodapé -->
      <div class="mt-6 flex justify-end">
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
import { Cpu, HardDrive, Database, ShieldCheck, X } from '@lucide/vue'

defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  hardware: {
    type: Object,
    required: true
  }
})

defineEmits(['close'])
</script>
