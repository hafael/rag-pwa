/**
 * Perfil de dispositivo para orquestração de memória GPU/RAM.
 * Baseado em UA, limites WebGPU (ex.: maxStorageBufferBindingSize) e suporte f16.
 */

const MOBILE_UA = /Android|iPhone|iPad|iPod/i

export function isMobileUserAgent(ua = navigator.userAgent || '') {
  return MOBILE_UA.test(ua)
}

/**
 * GPUs móveis (Adreno/Mali) expõem maxStorageBufferBindingSize ~128 MB.
 * WebLLM pede 1024 MB e faz fallback — sinal de perfil restrito.
 */
export function isLowVramGpu(hardware = {}) {
  const storageMB = hardware.webgpuDetails?.limits?.maxStorageBufferMB
  if (typeof storageMB === 'number' && storageMB > 0 && storageMB <= 256) {
    return true
  }
  return false
}

export function getDeviceProfile(hardware = {}) {
  const isMobile = isMobileUserAgent()
  const isLowVram = isLowVramGpu(hardware)
  const constrained = isMobile || isLowVram

  let modelId = 'Llama-3.2-1B-Instruct-q4f32_1-MLC'
  if (constrained) {
    modelId = 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC'
  } else if (hardware.hasF16) {
    modelId = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'
  }

  return {
    isMobile,
    isLowVram,
    constrained,
    modelId,
    /** Não carregar MiniLM durante chat — evita conflito com WebLLM na mesma GPU */
    skipDenseSearchInChat: constrained,
    /** Não pré-carregar SLM ao abrir aba Chat em dispositivos restritos */
    preloadLlmOnChatTab: !constrained,
    /** Descarregar SLM antes do RAG se já estiver na VRAM */
    unloadLlmBeforeRag: constrained,
    /** Liberar SLM após cada resposta para recuperar VRAM */
    unloadLlmAfterResponse: constrained,
    topParentK: constrained ? 1 : 3,
    topChildK: constrained ? 4 : 8
  }
}
