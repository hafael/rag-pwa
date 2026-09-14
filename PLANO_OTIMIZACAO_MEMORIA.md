# Plano de Otimização de Memória — EdgeRAG PWA

> **Problema:** Galaxy S22 Ultra (e dispositivos Android similares) não conseguem gerar respostas via WebLLM por estouro de memória GPU (`GPUBuffer.mapAsync` / OOM).
>
> **Objetivo:** Viabilizar inferência local em mobile reduzindo pressão de VRAM/RAM sem sacrificar a arquitetura Edge AI.

---

## Diagnóstico resumido

| Fator | Impacto |
|-------|---------|
| `context_window_size` invertido (mobile 3072 > desktop 2048) | Alto |
| Dois modelos simultâneos (WebLLM + MiniLM embeddings) | Alto |
| Modelo padrão 1B em hardware que deveria usar 0.5B | Alto |
| Prompt de sistema verboso + 3 chunks pais | Médio |
| Retry de OOM sem downgrade de modelo/contexto | Médio |

---

## Fases

### Fase 1 — Correções imediatas (alto impacto, baixo esforço)

- [x] Corrigir `contextWindow`: mobile **1536**, desktop **4096** (`webLlm.js`)
- [x] Default mobile → `Qwen2.5-0.5B-Instruct-q4f32_1-MLC` (`App.vue`)
- [x] Truncar contexto no mobile: **512 chars**, **1 chunk pai** (`webLlm.js`, `App.vue`)
- [x] `max_tokens` mobile: **128** (retry: **64**) (`webLlm.js`)
- [x] Prompt compacto no mobile (`webLlm.js`)

**Status:** ✅ Concluída — 2026-09-14

---

### Fase 2 — Orquestração de memória

- [ ] Adicionar `dispose()` em `EmbeddingService` (`vectorEmbeddings.js`)
- [ ] Sequenciar fluxo: RAG → `dispose()` embeddings → inferência LLM (`App.vue`)
- [ ] (Opcional) Descarregar LLM após resposta em mobile

**Status:** ⏳ Pendente

---

### Fase 3 — RAG mais leve no mobile

- [ ] BM25-only no mobile (pular busca densa durante chat) (`hybridRag.js`)
- [ ] `topParentK: 1` no mobile (`App.vue`)
- [ ] Lazy load de chunks filhos
- [ ] Worker dedicado para embeddings

**Status:** ⏳ Pendente

---

### Fase 4 — Detecção inteligente de hardware

- [ ] Serviço `modelProfile.js` com perfis automáticos baseados em `hardware.js`
- [ ] Seleção de modelo/contexto/RAG mode por `maxBufferSizeMB` e UA

**Status:** ⏳ Pendente

---

### Fase 5 — Fallback gracioso

- [ ] Mensagem clara quando GPU insuficiente
- [ ] Botão "Tentar com modelo menor"
- [ ] Modo "Somente RAG" nas configurações

**Status:** ⏳ Pendente

---

## Estimativa de consumo (S22 Ultra)

| Componente | Antes | Após Fase 1 |
|-----------|-------|-------------|
| WebLLM | Llama 1B, ctx 3072 (~1,4 GB) | Qwen 0.5B, ctx 1536 (~0,8 GB) |
| Embeddings simultâneos | ~120 MB | ~120 MB (Fase 2 libera) |
| KV cache | ~250 MB | ~125 MB |
| **Total estimado** | **~1,9 GB ❌** | **~1,0 GB ✅** |

---

## Histórico

| Data | Fase | Notas |
|------|------|-------|
| 2026-09-14 | — | Plano criado a partir de análise do código |
| 2026-09-14 | 1 | Correções imediatas implementadas |
