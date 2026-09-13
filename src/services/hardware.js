/**
 * Utilitários para detecção de capacidades de hardware (WebGPU, OPFS, Storage Quota)
 */

export async function checkHardwareCapabilities() {
  const result = {
    webgpu: false,
    webgpuDetails: null,
    opfs: false,
    storageEstimate: {
      usageMB: 0,
      quotaMB: 0,
      percentUsed: 0
    },
    webWorkers: typeof Worker !== 'undefined',
    crossOriginIsolated: window.crossOriginIsolated || false
  }

  // 1. WebGPU check
  if ('gpu' in navigator) {
    try {
      const adapter = await navigator.gpu.requestAdapter()
      if (adapter) {
        result.webgpu = true
        // Extrai informações seguras do adaptador
        const info = adapter.info || (await adapter.requestAdapterInfo?.()) || {}
        const hasF16 = Boolean(adapter.features?.has('shader-f16'))
        result.hasF16 = hasF16

        // Testa instanciação de GPUDevice de forma segura e libera imediatamente o contexto
        let deviceCreated = false
        try {
          const probeDevice = await adapter.requestDevice()
          if (probeDevice) {
            deviceCreated = true
            probeDevice.destroy?.()
          }
        } catch (deviceErr) {
          console.warn('Alerta ao instanciar GPUDevice de teste:', deviceErr)
        }

        result.webgpuDetails = {
          vendor: info.vendor || 'Dispositivo compatível',
          architecture: info.architecture || 'WebGPU padrão',
          description: info.description || '',
          hasF16,
          deviceCreated,
          limits: {
            maxBufferSizeMB: Math.round((adapter.limits?.maxBufferSize || 0) / (1024 * 1024)),
            maxStorageBufferMB: Math.round((adapter.limits?.maxStorageBufferBindingSize || 0) / (1024 * 1024))
          }
        }
        console.log('WebGPU capabilities detectadas:', result.webgpuDetails)
      } else {
        console.warn('Nenhum adaptador WebGPU disponível.')
      }
    } catch (e) {
      console.warn('WebGPU check falhou:', e)
    }
  }

  // 2. OPFS (Origin Private File System) check
  if ('storage' in navigator && 'getDirectory' in navigator.storage) {
    try {
      const root = await navigator.storage.getDirectory()
      result.opfs = Boolean(root)
    } catch (e) {
      console.warn('OPFS check falhou:', e)
    }
  }

  // 3. Storage Quota check
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate()
      const usageMB = Math.round((estimate.usage || 0) / (1024 * 1024))
      const quotaMB = Math.round((estimate.quota || 0) / (1024 * 1024))
      const percentUsed = quotaMB > 0 ? Math.round((usageMB / quotaMB) * 100) : 0

      result.storageEstimate = {
        usageMB,
        quotaMB,
        percentUsed
      }
    } catch (e) {
      console.warn('Storage estimate falhou:', e)
    }
  }

  return result
}
