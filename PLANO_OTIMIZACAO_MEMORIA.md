# Plano de Otimização de Memória — EdgeRAG PWA

> **Problema:** Galaxy S22 Ultra (e dispositivos Android similares) não conseguem gerar respostas via WebLLM por estouro de memória GPU (`GPUBuffer.mapAsync` / `DEVICE_LOST`).
>
> **Objetivo:** Viabilizar inferência local em mobile reduzindo pressão de VRAM/RAM sem sacrificar a arquitetura Edge AI.

---

## Análise do log (S22 Ultra — 2026-09-14)

| Log | Interpretação |
|-----|---------------|
| `maxStorageBufferBindingSize … requested=1024MB, limit=128MB` | GPU Adreno com limite severo (~128 MB). Perfil **low-VRAM**. |
| Stack `initPipeline → generateEmbedding → search` | MiniLM carregado **durante o chat** enquanto WebLLM já ocupava a GPU. **Causa raiz confirmada.** |
| `VK_ERROR_DEVICE_LOST` / `Device was lost` | GPU reiniciada — estado irrecuperável sem reload da página. |
| Retry `unload()` → `Tokenizer instance already deleted` | Retry em engine corrompida piorava o estado. **Corrigido na Fase 2.** |
| `CreateComputePipelines failed` no retry | Segunda tentativa impossível após device lost. |

**Conclusão:** Fase 1 sozinha não bastava. Fase 2 + BM25-only no chat (item da Fase 3) são obrigatórios para o S22.

---

## Diagnóstico resumido

| Fator | Impacto |
|-------|---------|
| Dois modelos simultâneos (WebLLM + MiniLM) | **Crítico** — confirmado no log |
| `maxStorageBufferBindingSize` = 128 MB no Adreno | **Crítico** |
| Pré-carregamento do SLM na aba Chat | Alto |
| `context_window_size` invertido (corrigido Fase 1) | Alto |
| Retry após device lost | Médio — corrigido Fase 2 |

---

## Fases

### Fase 1 — Correções imediatas

- [x] Corrigir `contextWindow`: mobile **1536**, desktop **4096**
- [x] Default mobile → `Qwen2.5-0.5B-Instruct-q4f32_1-MLC`
- [x] Truncar contexto no mobile: **512 chars**, **1 chunk pai**
- [x] `max_tokens` mobile: **128** (retry: **64**)
- [x] Prompt compacto no mobile

**Status:** ✅ Concluída — 2026-09-14

---

### Fase 2 — Orquestração de memória

- [x] `dispose()` em `EmbeddingService` (`vectorEmbeddings.js`)
- [x] Fluxo chat: descarregar SLM → RAG → `dispose()` embeddings → carregar SLM → inferir (`App.vue`)
- [x] Descarregar SLM após resposta em perfil restrito (`App.vue`)
- [x] Não pré-carregar SLM na aba Chat em mobile/low-VRAM (`App.vue`, `deviceProfile.js`)
- [x] Descarregar SLM antes de embeddings na ingestão (`ingestion.js`)
- [x] Tratar `device lost` sem retry de `unload()` (`webLlm.js`)
- [x] BM25-only no chat em perfil restrito — adiantado da Fase 3 (`hybridRag.js`, `deviceProfile.js`)

**Status:** ✅ Concluída — 2026-09-14

---

### Fase 3 — RAG mais leve no mobile

- [x] BM25-only no mobile durante chat (`hybridRag.js` + `deviceProfile.js`)
- [x] `topParentK: 1` no mobile (`App.vue` via perfil)
- [ ] Lazy load de chunks filhos
- [ ] Worker dedicado para embeddings

**Status:** 🔄 Parcialmente concluída — 2026-09-14

---

### Fase 4 — Detecção inteligente de hardware

- [x] Serviço `deviceProfile.js` com perfis automáticos
- [ ] Expor perfil na UI (Ajustes / Hardware Banner)
- [ ] Persistir preferência manual de modelo

**Status:** 🔄 Parcialmente concluída — 2026-09-14

---

### Fase 5 — Fallback gracioso

- [ ] Mensagem clara quando GPU insuficiente (parcial: erro em `webLlm.js`)
- [ ] Botão "Recarregar página" no banner de erro
- [ ] Modo "Somente RAG" nas configurações

**Status:** ⏳ Pendente

---

## Fluxo de chat (perfil restrito — pós Fase 2)

```
Usuário envia pergunta
    → [se SLM carregado] unload WebLLM
    → RAG BM25-only (sem MiniLM)
    → embeddingService.dispose()
    → loadModel (Qwen 0.5B)
    → generateStreamingAnswer()
    → [opcional] unload WebLLM
```

---

## Estimativa de consumo (S22 Ultra)

| Componente | Antes | Após Fase 2 |
|-----------|-------|-------------|
| WebLLM + MiniLM simultâneos | ~1,2 GB ❌ | **Nunca juntos** ✅ |
| WebLLM (Qwen 0.5B, ctx 1536) | — | ~0,8 GB |
| MiniLM durante chat | ~120 MB ❌ | **0 MB** ✅ |
| **Pico de VRAM** | **~1,9 GB** | **~0,8 GB** |

---

## Histórico

| Data | Fase | Notas |
|------|------|-------|
| 2026-09-14 | — | Plano criado |
| 2026-09-14 | 1 | Correções imediatas implementadas |
| 2026-09-14 | — | Log S22 analisado: conflito WebLLM+MiniLM confirmado |
| 2026-09-14 | 2 | Orquestração de memória + deviceProfile + BM25-only chat |
