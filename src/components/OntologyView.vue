<template>
  <div class="space-y-6">
    <!-- Top Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-800">
      <div>
        <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Network class="w-5 h-5 text-cyan-400" />
          Engine Ontológico (TBox OWL/RDF)
        </h2>
        <p class="text-xs text-slate-400 mt-0.5">
          Desambiguação semântica, taxonomia de classes e expansão controlada de consultas
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="$emit('open-upload-ontology')"
          class="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition"
        >
          <Plus class="w-4 h-4" />
          Carregar Arquivo .OWL / .TTL
        </button>
      </div>
    </div>

    <!-- Simulador de Expansão de Consulta (Query Expansion) -->
    <div class="p-4 sm:p-5 bg-slate-900/50 rounded-2xl border border-slate-800">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
          <Sparkles class="w-4 h-4" />
          Simulador de Query Expansion (Seção 4.2 do Plano)
        </h3>
        <span class="text-[11px] text-slate-500">Expansão de termos via Grafo</span>
      </div>
      <p class="text-xs text-slate-400 mb-3">
        Teste como uma consulta do usuário é enriquecida com sinônimos, classes equivalentes e conceitos da ontologia antes de disparar o RAG.
      </p>

      <div class="flex gap-2">
        <input
          v-model="testQuery"
          type="text"
          placeholder="Digite um termo para testar expansão ontológica..."
          class="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
        <button
          @click="runExpansionTest"
          class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium rounded-xl transition"
        >
          Testar
        </button>
      </div>

      <!-- Resultado da Expansão -->
      <div v-if="expansionResult" class="mt-4 p-3.5 rounded-xl bg-slate-950/80 border border-cyan-500/20 text-xs">
        <div class="font-semibold text-cyan-300 mb-1">Consulta Enriquecida com Sucesso:</div>
        <p class="text-slate-200 font-mono text-[11px] bg-slate-900 p-2.5 rounded-lg border border-slate-800">
          {{ expansionResult }}
        </p>
      </div>
    </div>

    <!-- Triplas e Conceitos Carregados -->
    <div class="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
      <div class="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">
          Triplas e Relações Ontológicas Indexadas
        </h3>
        <span class="text-xs text-slate-500">{{ triples.length }} tripla(s)</span>
      </div>

      <div v-if="triples.length === 0" class="text-center py-14 px-4">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3">
          <Network class="w-6 h-6" />
        </div>
        <h4 class="text-sm font-semibold text-slate-300">Nenhuma ontologia carregada</h4>
        <p class="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
          Carregue um arquivo .owl, .rdf ou .ttl para registrar o vocabulário conceitual e as regras de domínio.
        </p>
        <button
          @click="$emit('open-upload-ontology')"
          class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition"
        >
          <Plus class="w-4 h-4" />
          Adicionar Arquivo .OWL
        </button>
      </div>

      <div v-else class="divide-y divide-slate-800/60 max-h-96 overflow-y-auto">
        <div
          v-for="t in triples"
          :key="t.id"
          class="p-3.5 hover:bg-slate-800/20 text-xs font-mono flex items-center justify-between gap-3"
        >
          <div class="flex items-center gap-2 truncate">
            <span class="text-indigo-300 font-semibold truncate">{{ t.subject }}</span>
            <span class="text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-500/10 text-[10px]">{{ t.predicate }}</span>
            <span class="text-emerald-300 truncate">{{ t.object }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Network, Plus, Sparkles } from '@lucide/vue'

const props = defineProps({
  triples: {
    type: Array,
    default: () => []
  }
})

defineEmits(['open-upload-ontology'])

const testQuery = ref('')
const expansionResult = ref(null)

function runExpansionTest() {
  if (!testQuery.value.trim()) return
  const term = testQuery.value.trim().toLowerCase()
  // Procura correspondências no grafo
  const matched = props.triples.filter(t =>
    t.subject.toLowerCase().includes(term) ||
    t.object.toLowerCase().includes(term)
  )

  if (matched.length > 0) {
    const related = matched.map(m => `[${m.predicate}: ${m.object}]`).join(' ')
    expansionResult.value = `(${testQuery.value}) OR ${related}`
  } else {
    expansionResult.value = `Nenhuma relação formal encontrada para "${testQuery.value}". Usando termos originais.`
  }
}
</script>
