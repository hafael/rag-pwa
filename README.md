# RAG Híbrido PWA — Edge AI & Ontologias OWL

Uma aplicação web progressiva (PWA) de Recuperação Aumentada por Recuperação (RAG Híbrido) operando inteiramente **client-side (Edge AI)**, sem dependência de servidores externos, APIs pagas ou nuvem.

---

## ✨ Funcionalidades Principais

| Pilar | Descrição |
|:---|:---|
| **Privacidade & Offline-First** | Todo o processamento ocorre 100% no navegador via WebGPU / WASM |
| **RAG Híbrido Triplo** | Busca Densa (Embeddings) + Esparsa (BM25) + Grafo Ontológico, fundidos via RRF |
| **Anti-Alucinação Formal** | Prompt de sistema estrito com ontologias OWL como TBox de validação |
| **Parent-Child Chunking** | Strategy Pattern com 5 estratégias de segmentação para equalizar granularidades |
| **SLM Local (WebGPU)** | Inferência de Llama-3.2, Phi-3.5 e DeepSeek-R1 via `@mlc-ai/web-llm` |
| **Hospedagem Gratuita** | Deploy estático no GitHub Pages com automação via GitHub Actions |

---

## 🧱 Stack Tecnológica

| Camada | Tecnologia |
|:---|:---|
| **UI** | Vue 3 (Composition API) + Tailwind CSS v4 |
| **PWA** | Vite PWA / Workbox + COI Service Worker |
| **Inferência SLM** | `@mlc-ai/web-llm` (WebGPU) |
| **Embeddings** | `@xenova/transformers` — all-MiniLM-L6-v2 (384 dim) |
| **Ontologia** | `n3` — N3.js para OWL/RDF/Turtle |
| **Busca Esparsa** | BM25 customizado em JavaScript puro |
| **Fusão de Ranking** | Reciprocal Rank Fusion (RRF) k=60 + Ontology Boost ×1.25 |
| **Persistência** | Dexie.js (IndexedDB) + OPFS |
| **Parsers** | pdfjs-dist (PDF) · mammoth (DOCX) · marked (Markdown) |

---

## 🚀 Executar Localmente

```bash
# Clonar o repositório
git clone https://github.com/SEU_USUARIO/rag-pwa.git
cd rag-pwa

# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev
```

Acesse em `http://localhost:5173`.

> **Importante:** A aceleração WebGPU para inferência local (WebLLM) requer **Chrome 113+**, **Edge 113+** ou **Safari 18+** com WebGPU habilitado.

---

## 🏗️ Build de Produção

```bash
npm run build
npm run preview
```

---

## 📁 Estrutura do Projeto

```
rag-pwa/
├── .github/workflows/deploy.yml    # CI/CD automático — GitHub Pages
├── public/
│   ├── coi-serviceworker.js        # Cross-Origin Isolation para SharedArrayBuffer
│   └── icon.svg                    # Ícone PWA
├── src/
│   ├── components/                 # Componentes Vue 3
│   │   ├── Header.vue              # Barra superior + status WebGPU
│   │   ├── ChatView.vue            # Chat RAG com streaming de tokens
│   │   ├── DocumentsView.vue       # Gerenciador de documentos + stats
│   │   ├── DocumentUploadModal.vue # Upload + seleção de estratégia de chunking
│   │   ├── ChunkInspectorModal.vue # Inspetor visual Parent-Child
│   │   ├── KnowledgeBaseModal.vue  # CRUD de Bases de Conhecimento
│   │   ├── OntologyView.vue        # Visualizador de triplas + Query Expansion
│   │   ├── HardwareBanner.vue      # Diagnóstico WebGPU / OPFS
│   │   └── SettingsView.vue        # Configuração de modelos + VRAM
│   ├── db/
│   │   └── index.js                # Schema Dexie.js (IndexedDB) + serviços CRUD
│   ├── services/
│   │   ├── hardware.js             # Detecção de WebGPU, OPFS e cota de storage
│   │   ├── extractors.js           # Extratores de PDF, DOCX, Markdown, OWL
│   │   ├── chunkingStrategies.js   # Strategy Pattern: Section/Paragraph/Sentence/Page/Token
│   │   ├── ingestion.js            # Orquestrador de ingestão + Web Worker
│   │   ├── ontologyEngine.js       # Engine N3.js: TBox, Query Expansion, anti-viés
│   │   ├── bm25.js                 # Motor BM25 JavaScript puro (busca esparsa)
│   │   ├── vectorEmbeddings.js     # Embeddings all-MiniLM-L6-v2 + Cosseno
│   │   ├── hybridRag.js            # RAG Híbrido: Dense + BM25 + RRF + OWL Boost
│   │   └── webLlm.js               # WebLLM: inferência local + prompt anti-alucinação
│   ├── workers/
│   │   └── ingestion.worker.js     # Web Worker: chunking + parsing ontológico
│   ├── App.vue                     # Orquestrador principal
│   ├── main.js                     # Entrada da aplicação + registro do PWA
│   └── style.css                   # Tailwind CSS v4 + scrollbar customizada
├── index.html                      # Raiz HTML com coi-serviceworker
└── vite.config.js                  # Vite + PWA + manualChunks + base relativa
```

---

## 🔄 Fluxo de RAG Híbrido

```
Consulta do Usuário
        │
        ▼
┌───────────────────────┐
│  Query Expansion (OWL)│  — Ontologias TBox expandem sinônimos e classes
│  via OntologyEngine   │
└──────────┬────────────┘
           │ Consulta Enriquecida
     ┌─────┴──────┐
     │            │
     ▼            ▼
┌─────────┐  ┌─────────────┐
│ Dense   │  │ Sparse BM25 │  — Buscam em paralelo sobre os Chunks Filhos
│ Cosine  │  │ JavaScript  │
└────┬────┘  └──────┬──────┘
     │               │
     └──────┬────────┘
            ▼
┌────────────────────────┐
│  RRF Fusion k=60       │  — RRF(d) = 1/(k+r_dense) + 1/(k+r_sparse)
│  + Ontology Boost ×1.25│  — Multiplica chunks com termos OWL validados
└──────────┬─────────────┘
           │ Top-K Chunks Filhos
           ▼
┌────────────────────────┐
│  Recupera Chunks Pais  │  — Parent-Child: o contexto real vai para o SLM
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────────────────────────┐
│  Prompt Anti-Alucinação Estrito (Seção 7)  │
│  + Regras Ontológicas Formais              │
│  + Contexto Recuperado (Chunks Pais)       │
└──────────┬─────────────────────────────────┘
           ▼
┌────────────────────────┐
│  WebLLM Edge Inference │  — Llama-3.2 / Phi-3.5 / DeepSeek via WebGPU
│  Streaming de Tokens   │
└────────────────────────┘
```

---

## 🗄️ Schema IndexedDB (Dexie.js)

| Tabela | Descrição |
|:---|:---|
| `knowledgeBases` | Bases de conhecimento isoladas |
| `documents` | Metadados + estratégia de chunking |
| `parentChunks` | Blocos de contexto para o SLM |
| `childChunks` | Segmentos de busca com embedding vetorial |
| `ontologyTriples` | Triplas RDF/OWL extraídas pelo N3.js |
| `chatMessages` | Histórico de conversas por base |

---

## 📊 Fórmula RRF com Ontology Boost

$$RRF\_Score(d) = \left[\frac{1}{k + r_{dense}(d)} + \frac{1}{k + r_{sparse}(d)}\right] \times B_{owl}$$

Onde:
- $k = 60$ — constante padrão de suavização
- $r_{dense}(d)$ — posição no ranking de similaridade de cosseno
- $r_{sparse}(d)$ — posição no ranking BM25
- $B_{owl} = 1.25$ — boost para chunks com termos validados pela ontologia OWL ativa

---

## 🌐 Deploy no GitHub Pages

O deploy é totalmente automatizado via GitHub Actions. Basta:

1. **Criar** o repositório no GitHub e fazer push da branch `main`.
2. **Ativar** o GitHub Pages nas configurações do repositório (`Settings → Pages → Source: GitHub Actions`).
3. Qualquer novo push para `main` dispara automaticamente o build e o deploy.

---

## 🛡️ Cross-Origin Isolation (WebGPU & SharedArrayBuffer)

O `coi-serviceworker.js` incluído em `public/` injeta automaticamente os cabeçalhos:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: credentialless`

Isso garante que o `SharedArrayBuffer` e os Web Workers de alto desempenho funcionem em hospedagens estáticas (como GitHub Pages) sem configuração de servidor.

---

## 📋 Roadmap de Desenvolvimento

- [x] **Fase 1** — Scaffold PWA Vue 3, Tailwind, Dexie.js, Diagnóstico de Hardware
- [x] **Fase 2** — N3.js, Parsers (PDF/DOCX/MD), Strategy Pattern, Web Worker de Ingestão
- [x] **Fase 3** — Embeddings Vetoriais, BM25 Puro, RRF + Ontology Boost
- [x] **Fase 4** — WebLLM Edge, Prompt Anti-Alucinação, Streaming de Tokens
- [x] **Fase 5** — COI Service Worker, Deploy GitHub Actions, README, Build Final

---

*Projeto desenvolvido com foco em privacidade, inferência local e rigor semântico formal.*
