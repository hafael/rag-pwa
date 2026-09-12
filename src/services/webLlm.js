import { CreateMLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm'

/**
 * Serviço de Gerenciamento do SLM de Borda com WebLLM (WebGPU)
 */
export class WebLlmService {
  constructor() {
    this.engine = null
    this.currentModelId = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC'
    this.status = 'idle' // 'idle' | 'loading' | 'ready' | 'generating' | 'error'
    this.loadingProgress = { text: '', progress: 0 }
    this.errorMessage = null
  }

  /**
   * Inicializa o modelo no navegador via WebGPU
   */
  async loadModel(modelId = this.currentModelId, onProgress) {
    if (this.engine && this.currentModelId === modelId && this.status === 'ready') {
      return this.engine
    }

    if (!('gpu' in navigator)) {
      throw new Error('Seu navegador não possui suporte a WebGPU. Por favor, use o Chrome 113+, Edge 113+ ou Safari 18+ com WebGPU habilitado.')
    }

    this.status = 'loading'
    this.currentModelId = modelId
    this.errorMessage = null

    const appConfig = { ...prebuiltAppConfig, cacheBackend: "indexeddb" };

    try {
      this.engine = await CreateMLCEngine(modelId, {
        initProgressCallback: (report) => {
          this.loadingProgress = {
            text: report.text,
            progress: Math.round((report.progress || 0) * 100)
          }
          onProgress?.(this.loadingProgress)
        },
        appConfig
      })

      this.status = 'ready'
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
      this.status = 'ready'
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
