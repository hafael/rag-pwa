# PLANO DE ARQUITETURA TÉCNICA: PWA RAG HÍBRIDO OFFLINE COM IA DE BORDA E ONTOLOGIAS OWL

## 1. VISÃO GERAL DO PROJETO

O objetivo principal deste projeto é projetar e implementar uma aplicação web progressiva (PWA) de **Recuperação de Informação e Geração Aumentada por Recuperação (RAG Híbrido)** operando inteiramente **client-side (Edge AI)**. 

A aplicação visa responder a consultas de forma precisa e contextualizada sobre bases de conhecimento locais do usuário, **mitigando vieses de alucinação e ambiguidades** através do uso integrado de **Ontologias formais (.owl / RDF)** e **Estratégias Adaptativas de Chunking (Parent-Child Pattern)**.

### Principais Pilares da Aplicação:
1. **Privacidade e Offline-First (Edge AI):** Todo o processamento de texto, geração de embeddings, parsing de ontologias e inferência do modelo de linguagem (SLM) ocorre 100% no navegador do dispositivo, via **WebGPU/WASM**, sem dependência de servidores ou chamadas a APIs pagas.
2. **Mitigação de Vieses e Desambiguação Semântica:** Uso de ontologias de domínio (TBox em OWL/RDF) para enriquecimento semântico da consulta (Query Expansion) e validação lógica formal das respostas.
3. **RAG Híbrido Triplo:** Combinação de Busca Densa (Embeddings vetoriais em WebGPU), Busca Esparsa (BM25 em JavaScript) e Pesagem por Grafo Ontológico, fundidos via **Reciprocal Rank Fusion (RRF)**.
4. **Ingestão Flexível de Documentos:** Pipeline de chunking dinâmico via *Strategy Pattern* com arquitetura **Parent-Child**, garantindo equivalência na comparação de densidade semântica entre documentos de diferentes naturezas (ex: artigos científicos vs. resenhas).
5. **Hospedagem Estática Sem Custos:** Distribuição via **GitHub Pages**, com suporte a cache local completo (Workbox) e persistência em **OPFS** (Origin Private File System) e **IndexedDB**.

---

## 2. ARQUITETURA TÉCNICA E STACK DE TECNOLOGIAS

### 2.1 Stack Tecnológica Selecionada

| Camada | Tecnologia / Biblioteca | Função e Propósito |
| :--- | :--- | :--- |
| **Interface de Usuário (UI)** | Vue 3 (Composition API) | Reatividade leve, controle de componentes e gerenciamento de estado estruturado. |
| **Estilização** | Tailwind CSS | Design responsivo, moderno e utility-first. |
| **PWA & Cacheing** | Vite PWA / Workbox | Gerenciamento de Service Worker, cache de assets estáticos para funcionamento offline. |
| **Infeência SLM (Edge)** | `@mlc-ai/web-llm` | Execução local de modelos de linguagem (Llama-3.2, Phi-3.5) acelerada via WebGPU. |
| **Embeddings Vetoriais** | `@xenova/transformers` | Geração local de embeddings (ex: `all-MiniLM-L6-v2`) via ONNX WebGPU/WASM. |
| **Engine Ontológico** | `n3` (N3.js) | Parsing assíncrono e de alto desempenho para arquivos OWL, Turtle, Triples e RDF/XML. |
| **Persistência Vetores/Metadados** | `dexie` (IndexedDB Wrapper) | Armazenamento reativo e veloz de chunks, vetores, índice BM25 e triplas RDF. |
| **Persistência de Pesos AI** | OPFS (Origin Private File System) | Armazenamento de alta performance para os arquivos de pesos binários dos modelos (1-3GB). |
| **Parsing de Documentos** | `pdfjs-dist`, `mammoth`, `marked` | Extração pura de texto no cliente para PDF, DOCX, TXT e Markdown. |

---

## 3. ARQUITETURA DO SISTEMA E FLUXO DE DADOS

```
                               ┌─────────────────────────┐
                               │   Interface do Usuário  │
                               │   (Vue 3 + Tailwind)    │
                               └───────────┬─────────────┘
                                           │
                               ┌───────────▼─────────────┐
                               │   Service Worker PWA    │
                               │   (Workbox / Cache)     │
                               └───────────┬─────────────┘
                                           │
 ┌─────────────────────────────────────────┴─────────────────────────────────────────┐
 │                                   WEB WORKERS                                    │
 │                                                                                   │
 │   ┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────────┐   │
 │   │  Engine Ontológico    │   │  Pipeline de Ingestão │   │ Motor RAG Híbrido │   │
 │   │       (N3.js)         │   │ (Parent-Child Strategy)│  │ (Dense+Sparse+RRF)│   │
 │   └───────────┬───────────┘   └───────────┬───────────┘   └─────────┬─────────┘   │
 └───────────────┼───────────────────────────┼─────────────────────────┼─────────────┘
                 │                           │                         │
 ┌───────────────▼───────────────────────────▼─────────────────────────▼─────────────┐
 │                            CAMADA DE ARMAZENAMENTO                                │
 │                                                                                   │
 │   ┌──────────────────────────────────────────┐   ┌────────────────────────────┐   │
 │   │         IndexedDB (Dexie.js)             │   │    OPFS (Private File Sys) │   │
 │   │ (Vetores, Chunks, Triplas, Índice BM25)  │   │  (Pesos Binários do SLM)   │   │
 │   └──────────────────────────────────────────┘   └────────────────────────────┘   │
 └───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. PIPELINE DO ENGINE ONTOLÓGICO (DESAMBIGUAÇÃO OWL/RDF)

A adição de uma Ontologia formal (.owl) visa atuar na **Camada TBox (Terminological Box)** do conhecimento, fornecendo regras e conceitos explícitos sem poluir desnecessariamente o espaço de embeddings.

### 4.1 Extração e Armazenamento do Grafo
1. O usuário realiza o upload do arquivo `.owl` (RDF/XML, Turtle ou N-Triples).
2. O worker de ontologia usa o `N3.js` para iterar assincronamente pelas triplas RDF.
3. Extraem-se:
   - **Classes (`rdfs:Class`, `owl:Class`)**
   - **Subclasses (`rdfs:subClassOf`)**
   - **Sinônimos e Rótulos (`rdfs:label`, `skos:altLabel`, `owl:equivalentClass`)**
   - **Propriedades e Relações de Domínio (`owl:ObjectProperty`)**
4. As estruturas extraídas são organizadas em tabelas otimizadas do IndexedDB.

### 4.2 Expandidor de Consultas (Query Expansion)
Ao receber uma consulta do usuário, antes do envio para a busca RAG:
1. Extraem-se as entidades chave da consulta.
2. O Grafo Ontológico é consultado para recuperar:
   - Equivalências e sinônimos estritos do domínio.
   - Conceitos-pai e conceitos-filho imediatos.
   - Definições e restrições formais atreladas ao conceito.
3. A consulta é enriquecida com estes termos expandidos, aumentando o *Recall* na busca semântica e esparsa sem gerar ambiguidades.

---

## 5. PIPELINE DE INGESTÃO E ESTRATÉGIA DE CHUNKING (PARENT-CHILD PATTERN)

Para evitar desbalanço entre documentos de granularidades diferentes (ex: artigos extensos vs. resenhas curtas), a aplicação implementa a **Estratégia Parent-Child (Pai-Filho)**.

### 5.1 O Padrão Parent-Child
- **Chunk Pai (Geração de Contexto):** O bloco estrutural nativo selecionado pelo usuário no upload do arquivo (por Seção, por Página ou por Parágrafo). Este é o trecho que será injetado no prompt do modelo para garantir coesão textual.
- **Chunk Filho (Indexação e Busca):** Divisões menores e homogêneas (janelas fixas de 100 a 150 palavras ou frases) geradas automaticamente a partir de cada Chunk Pai.
- **Propriedade Fundamental:** A Busca Densa (Vetores) e a Busca Esparsa (BM25) operam **apenas sobre os Chunks Filhos**. Quando um Chunk Filho obtém alta relevância, o sistema recupera o seu **Chunk Pai correspondente** para enviar ao SLM.

### 5.2 Opções do Strategy Pattern
O usuário seleciona o tipo de segmentação desejada no upload (individual ou em lote):

```javascript
// Estrutura de Interface do Strategy Pattern para Chunking
interface ChunkingStrategy {
  split(documentText: string, options: StrategyOptions): Promise<{
    parentChunks: ParentChunk[];
    childChunks: ChildChunk[];
  }>;
}
```

Estratégias Suportadas:
1. **Word/Token Strategy:** Divisão por contagem estrita de palavras com *overlap* configurável.
2. **Sentence Strategy:** Segmentação baseada no delimitador nativo `Intl.Segmenter` do JavaScript.
3. **Paragraph Strategy:** Quebra por marcadores de bloco de parágrafo (`\n\n`).
4. **Page Strategy:** Identificação de marcadores estruturais de página em documentos PDF.
5. **Section Strategy:** Parsing hierárquico baseado nos títulos (`H1-H6` em Markdown e marcações de seção em DOCX/PDF).

---

## 6. MOTOR DE RAG HÍBRIDO E FUSÃO RRF (RECIPROCAL RANK FUSION)

A busca por documentos relevantes é executada em três etapas simultâneas:

### 6.1 Busca Densa (Dense Vector Search)
- Modelo de Embedding: `all-MiniLM-L6-v2` executado via `@xenova/transformers` (WebGPU/WASM).
- Dimensão do Vetor: 384 dimensões.
- A distância é calculada sobre os vetores dos **Chunks Filhos** usando Cosine Similarity em um Web Worker para garantir 60 FPS na UI.

### 6.2 Busca Esparsa (BM25 JS)
- Algoritmo BM25 customizado e executado em JavaScript pura sobre o texto dos **Chunks Filhos**.
- Garante que termos técnicos exatos, nomes próprios, datas e siglas da ontologia não sejam ignorados caso o modelo de embedding falhe no mapeamento semântico.

### 6.3 Algoritmo de Fusão e Reordenação (RRF com Ontology Boost)
O score final de cada Chunk Filho é calculado combinando sua posição no ranking Denso ($r_{densa}$) e Esparso ($r_{esparsa}$):

$$RRF\_Score(d) = rac{1}{k + r_{densa}(d)} + rac{1}{k + r_{esparsa}(d)}$$

*Onde $k = 60$ é uma constante padrão de suavização.*

#### Ontology Boost Factor:
Se o Chunk Filho contiver termos ou instâncias diretamente validados pela Ontologia OWL ativa, o seu score recebe um fator multiplicador $B_{owl} = 1.25$, priorizando evidências formalmente respaldadas.

Após o cálculo dos scores dos Filhos, os **Chunks Pais únicos correspondentes aos N melhores Filhos** são selecionados e organizados para compor a Janela de Contexto do SLM.

---

## 7. ANTE-VIÉS E PROMPT ENGINEERING SYSTEM

Para prevenir alucinações e respostas enviesadas fora da base de conhecimento, o contexto montado para o modelo local segue uma estrutura de injeção rigorosa:

### 7.1 Template do Prompt de Sistema

```markdown
[SISTEMA: MODO DE RESPOSTA ESTRITO E SEM ALUCINAÇÕES]
Você é um assistente de inteligência artificial de precisão. Sua tarefa é responder à pergunta do usuário utilizando EXCLUSIVAMENTE as evidências textuais fornecidas na seção CONTEXTO e as regras formais contidas na seção REGRAS ONTOLÓGICAS.

DIRETRIZES OBRIGATÓRIAS:
1. Responda APENAS com base nos fatos explicitados no CONTEXTO. Não utilize conhecimentos prévios externos.
2. Se o CONTEXTO não contiver dados suficientes para responder totalmente à pergunta, declare explicitamente: "Não há informações suficientes na base de conhecimento carregada para responder a esta questão."
3. Respeite estritamente os conceitos e equivalências definidos nas REGRAS ONTOLÓGICAS.
4. Mantenha um tom neutro, objetivo e direto, sem especulações ou deduções não suportadas pelo texto.

[REGRAS ONTOLÓGICAS FORMIAIS]
{ontological_rules_extracted}

[CONTEXTO RECUPERADO (DOCUMENTOS PAIS)]
{retrieved_parent_chunks}

[PERGUNTA DO USUÁRIO]
{user_query}
```

---

## 8. ESTRUTURA DO ARMAZENAMENTO DE DADOS (INDEXEDDB SCHEMA)

O armazenamento local utiliza a biblioteca **Dexie.js** para gerenciar a persistência de forma reativa:

```typescript
// Configuração do Schema Dexie.js
import Dexie, { Table } from 'dexie';

export class AppDatabase extends Dexie {
  knowledgeBases!: Table<KnowledgeBase>;
  documents!: Table<DocumentMetadata>;
  parentChunks!: Table<ParentChunk>;
  childChunks!: Table<ChildChunk>;
  ontologyTriples!: Table<OntologyTriple>;

  constructor() {
    super('RagHybridDatabase');
    this.version(1).stores({
      knowledgeBases: 'id, name, createdAt',
      documents: 'id, kbId, fileName, strategyUsed',
      parentChunks: 'id, docId, kbId, sectionTitle',
      childChunks: 'id, parentId, docId, kbId',
      ontologyTriples: 'id, kbId, subject, predicate, object'
    });
  }
}
```

---

## 9. CONFIGURAÇÃO DE MODELOS LOCAIS (EDGE CONFIG)

O usuário pode escolher nas configurações do aplicativo qual modelo carregar, ajustando o uso de memória de acordo com seu hardware:

| Perfil de Hardware | Modelo Recomendado | VRAM/RAM Requerida | Engine Executiva |
| :--- | :--- | :--- | :--- |
| **Leve / Mobile** | Llama-3.2-1B-Instruct (`q4f16`) | ~1.5 GB | WebLLM (WebGPU) |
| **Equilibrado** | Phi-3.5-mini-instruct (`q4f16`) | ~2.5 GB | WebLLM (WebGPU) |
| **Alta Precisão** | DeepSeek-R1-Distill-Qwen-1.5B | ~2.0 GB | WebLLM (WebGPU) |
| **Embeddings** | `all-MiniLM-L6-v2` | ~120 MB | Transformers.js (ONNX) |

Os arquivos binários dos modelos baixados são mantidos em **OPFS**, permitindo que o PWA abra instantaneamente sem downloads repetidos após a primeira execução.

---

## 10. ROADMAP DE DESENVOLVIMENTO EM FASES

### Fase 1: Fundação PWA e Interface Vue 3 (Semanas 1-2)
- [x] Configuração do projeto Vue 3 com Vite, Tailwind CSS e Vite-PWA (Workbox).
- [x] Criação da interface para gestão de Bases de Conhecimento e Upload de Documentos.
- [x] Estruturação da persistência em IndexedDB (Dexie.js) e OPFS.

### Fase 2: Ingestão, Chunking e Ontologia (Semanas 3-4)
- [x] Implementação do módulo N3.js para parsing de arquivos `.owl` (RDF/Turtle).
- [x] Implementação do *Strategy Pattern* para Chunking de Documentos (Palavra, Frase, Parágrafo, Seção).
- [x] Construção da arquitetura **Parent-Child** no Worker de Ingestão.

### Fase 3: RAG Híbrido Client-Side (Semanas 5-6)
- [x] Integração de `@xenova/transformers` para geração local de embeddings via WebGPU.
- [x] Desenvolvimento do algoritmo de busca esparsa BM25 em JavaScript.
- [x] Implementação da fusão por **Reciprocal Rank Fusion (RRF)** com pesos ontológicos.

### Fase 4: Integração SLM Edge e Anti-Viés (Semanas 7-8)
- [x] Integração de `@mlc-ai/web-llm` com suporte ao Origin Private File System (OPFS).
- [x] Construção do gerador de prompts estritos para mitigação de vieses.
- [x] Sistema de Chat reativo com stream de tokens na interface Vue 3.

### Fase 5: Testes Offline e Deploy no GitHub Pages (Semana 9)
- [x] Validação do funcionamento 100% offline via Service Worker.
- [x] Testes de performance WebGPU em diferentes navegadores e dispositivos.
- [x] Build estático e automação de deploy via GitHub Actions no **GitHub Pages**.

---
*Plano de arquitetura técnica gerado para desenvolvimento e implementação do aplicativo PWA RAG Híbrido.*
