<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-slate-800">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Database class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-semibold text-slate-100">Bases de Conhecimento</h3>
            <p class="text-xs text-slate-400">Organize seus documentos e ontologias em bases isoladas</p>
          </div>
        </div>
        <button
          @click="$emit('close')"
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Formulário de Criação -->
      <form @submit.prevent="handleCreate" class="mt-4 p-3.5 rounded-xl border border-slate-800 bg-slate-800/30">
        <h4 class="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Plus class="w-3.5 h-3.5 text-indigo-400" />
          Nova Base de Conhecimento
        </h4>
        <div class="space-y-2.5">
          <div>
            <input
              v-model="newKbName"
              type="text"
              placeholder="Ex: Artigos Médicos 2026, Documentação Técnica..."
              class="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              required
            />
          </div>
          <div>
            <input
              v-model="newKbDescription"
              type="text"
              placeholder="Descrição ou domínio (opcional)"
              class="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
          <button
            type="submit"
            :disabled="!newKbName.trim()"
            class="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition"
          >
            <Plus class="w-4 h-4" />
            Criar Base de Conhecimento
          </button>
        </div>
      </form>

      <!-- Lista de Bases Existentes -->
      <div class="mt-4">
        <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Bases Salvas ({{ list.length }})
        </h4>

        <div v-if="list.length === 0" class="text-center py-6 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
          Nenhuma base de conhecimento criada ainda. Crie uma acima para começar.
        </div>

        <div v-else class="max-h-60 overflow-y-auto space-y-2 pr-1">
          <div
            v-for="kb in list"
            :key="kb.id"
            :class="selectedId === kb.id ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-800 bg-slate-800/20 hover:border-slate-700'"
            class="p-3 rounded-xl border flex items-center justify-between gap-3 transition"
          >
            <div class="cursor-pointer flex-1 min-w-0" @click="handleSelect(kb)">
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-slate-200 truncate">{{ kb.name }}</span>
                <span v-if="selectedId === kb.id" class="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                  Ativa
                </span>
              </div>
              <p v-if="kb.description" class="text-[11px] text-slate-400 truncate mt-0.5">{{ kb.description }}</p>
              <div class="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                <span>Criada em: {{ new Date(kb.createdAt).toLocaleDateString('pt-BR') }}</span>
              </div>
            </div>

            <div class="flex items-center gap-1">
              <button
                v-if="selectedId !== kb.id"
                @click="handleSelect(kb)"
                class="px-2.5 py-1 text-xs text-indigo-300 hover:text-indigo-200 bg-slate-800 hover:bg-slate-700 rounded-md transition"
              >
                Ativar
              </button>
              <button
                @click="handleDelete(kb.id)"
                class="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition"
                title="Excluir base e dados associados"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Rodapé -->
      <div class="mt-6 flex justify-end">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
        >
          Concluído
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Database, Plus, Trash2, X } from '@lucide/vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  list: {
    type: Array,
    default: () => []
  },
  selectedId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close', 'create', 'select', 'delete'])

const newKbName = ref('')
const newKbDescription = ref('')

function handleCreate() {
  if (!newKbName.value.trim()) return
  emit('create', {
    name: newKbName.value.trim(),
    description: newKbDescription.value.trim()
  })
  newKbName.value = ''
  newKbDescription.value = ''
}

function handleSelect(kb) {
  emit('select', kb)
}

function handleDelete(id) {
  if (confirm('Tem certeza que deseja excluir esta Base de Conhecimento e todos os seus documentos e embeddings?')) {
    emit('delete', id)
  }
}
</script>
