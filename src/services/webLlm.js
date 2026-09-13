import { CreateMLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm'

const F16_TO_F32_FALLBACKS = {
  'Qwen2.5-1.5B-Instruct-q4f16_1-MLC': 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
  'Llama-3.2-1B-Instruct-q4f16_1-MLC': 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
  'Qwen2.5-0.5B-Instruct-q4f16_1-MLC': 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC',
  'Phi-3.5-mini-instruct-q4f16_1-MLC': 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
  'DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC': 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC'
}

/**
 * Serviço de Gerenciamento do SLM de Borda com WebLLM (WebGPU)
 */
export class WebLlmService {
  constructor() {
    this.engine = null
    // Modelo padrão otimizado para compatibilidade multiplataforma (mobile & desktop)
    this.currentModelId = 'Llama-3.2-1B-Instruct-q4f32_1-MLC'
    this.status = 'idle' // 'idle' | 'loading' | 'ready' | 'generating' | 'error'
    this.loadingProgress = { text: '', progress: 0 }
    this.errorMessage = null
  }

  /**
   * Resolve o ID do modelo considerando o suporte a shader-f16 do hardware local
   */
  async resolveCompatibleModelId(targetModelId) {
    if (!('gpu' in navigator)) return targetModelId

    try {
      const adapter = await navigator.gpu.requestAdapter()
      const hasF16 = adapter?.features?.has('shader-f16') || false
      if (!hasF16) {
        if (F16_TO_F32_FALLBACKS[targetModelId]) {
          const compatibleId = F16_TO_F32_FALLBACKS[targetModelId]
          console.warn(`[WebLLM] Dispositivo sem suporte a 'shader-f16'. Redirecionando ${targetModelId} para versão compatível 32-bit: ${compatibleId}`)
          return compatibleId
        }
      }
    } catch (e) {
      console.warn('[WebLLM] Erro ao inspecionar features do adaptador:', e)
    }

    return targetModelId
  }

  /**
   * Inicializa o modelo no navegador via WebGPU
   */
  async loadModel(modelId = this.currentModelId, onProgress) {
    if (!('gpu' in navigator)) {
      this.status = 'error'
      this.errorMessage = 'Seu navegador não possui suporte a WebGPU. Por favor, use o Chrome 113+, Edge 113+ ou Safari 18+ com WebGPU habilitado.'
      throw new Error(this.errorMessage)
    }

    const resolvedModelId = await this.resolveCompatibleModelId(modelId)

    if (this.engine && this.currentModelId === resolvedModelId && this.status === 'ready') {
      return this.engine
    }

    this.status = 'loading'
    this.currentModelId = resolvedModelId
    this.errorMessage = null

    // Cache API é o backend primário mais estável em navegadores mobile/PWA
    const appConfig = { ...prebuiltAppConfig, cacheBackend: "cache" };

    try {
      this.engine = await CreateMLCEngine(resolvedModelId, {
        initProgressCallback: (report) => {
          this.loadingProgress = {
            text: report.text,
            progress: Math.round((report.progress || 0) * 100)
          }
          onProgress?.(this.loadingProgress)
        },
        appConfig
      }, {
        // Reduz o KV Cache de 4096 para 2048 para evitar estouro de VRAM em GPUs mobile unificadas
        context_window_size: 2048
      })

      this.status = 'ready'
      this.errorMessage = null
      return this.engine
    } catch (err) {
      this.status = 'error'
      this.errorMessage = err.message || 'Erro ao carregar o modelo WebLLM'
      console.error('Falha na inicialização do WebLLM:', err)
      throw err
    }
  }

  /**
   * Constrói o Prompt de Sistema Estrito Anti-Alucinação (Seção 7.1 do Plano)
   */
  buildStrictSystemPrompt({ ontologicalRules, parentChunks }) {
    const rulesText = ontologicalRules && ontologicalRules.length > 0
      ? ontologicalRules.map(r => r.rule ? `- ${r.rule}` : `- Conceito [${r.concept}]`).join('\n')
      : 'Nenhuma regra formal específica de domínio cadastrada.'

    const contextText = parentChunks && parentChunks.length > 0
      ? parentChunks.map((p, idx) => `[EVIDÊNCIA ${idx + 1} - ${p.sectionTitle || 'Documento'}]:\n${p.content}`).join('\n\n')
      : 'Nenhum contexto textual relevante encontrado na base.'

    return `[SISTEMA: MODO DE RESPOSTA ESTRITO E SEM ALUCINAÇÕES]
Você é um assistente de inteligência artificial de precisão. Sua tarefa é responder à pergunta do usuário utilizando EXCLUSIVAMENTE as evidências textuais fornecidas na seção CONTEXTO e as regras formais contidas na seção REGRAS ONTOLÓGICAS.

DIRETRIZES OBRIGATÓRIAS:
1. Responda APENAS com base nos fatos explicitados no CONTEXTO. Não utilize conhecimentos prévios externos.
2. Se o CONTEXTO não contiver dados suficientes para responder totalmente à pergunta, declare explicitamente: "Não há informações suficientes na base de conhecimento carregada para responder a esta questão."
3. Respeite estritamente os conceitos e equivalências definidos nas REGRAS ONTOLÓGICAS.
4. Mantenha um tom neutro, objetivo e direto, sem especulações ou deduções não suportadas pelo texto.
5. Responda em língua portuguesa com clareza.

[REGRAS ONTOLÓGICAS FORMAIS]
${rulesText}

[CONTEXTO RECUPERADO (DOCUMENTOS PAIS)]
${contextText}`
  }

  /**
   * Gera a resposta com Streaming de tokens via WebGPU
   */
  async generateStreamingAnswer({
    userQuery,
    parentChunks,
    ontologicalRules,
    onToken,
    onProgress
  }) {
    // Garante que o motor está carregado
    if (!this.engine || this.status !== 'ready') {
      await this.loadModel(this.currentModelId, onProgress)
    }

    const systemPrompt = this.buildStrictSystemPrompt({
      ontologicalRules,
      parentChunks
    })

    this.status = 'generating'

    try {
      const completion = await this.engine.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery }
        ],
        stream: true,
        temperature: 0.1, // Temperatura baixa para máxima determinação e mitigação de alucinações
        max_tokens: 1024
      })

      let fullResponse = ''
      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content || ''
        if (delta) {
          fullResponse += delta
          onToken?.(delta, fullResponse)
        }
      }

      this.status = 'ready'
      return fullResponse
    } catch (err) {
      this.status = 'error'
      this.errorMessage = err.message || 'Erro durante a inferência na WebGPU'
      console.error('Falha na geração de resposta WebLLM:', err)
      throw err
    }
  }

  /**
   * Descarrega o modelo atual da VRAM / WebGPU
   */
  async unload() {
    if (this.engine) {
      try {
        await this.engine.unload()
      } catch (e) {
        console.warn('Erro ao descarregar engine WebLLM:', e)
      }
      this.engine = null
      this.status = 'idle'
      this.loadingProgress = { text: '', progress: 0 }
    }
  }
}

export const webLlmService = new WebLlmService()
