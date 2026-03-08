import { getApiKey } from './storage'

const CALL_TIMEOUT_MS = 70000

type CloudFnResult<T> = T & {
  error?: {
    code?: string
    message?: string
    details?: { hint?: string; preview?: string; contentLength?: number }
  }
}

function callCloudFunctionRaw<T>(name: string, data: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: res => {
        const result = (res.result || {}) as CloudFnResult<T>
        if (result && (result as any).error) {
          const e = (result as any).error || {}
          const msg = e.message || '云函数返回错误'
          const hint = e.details?.hint || e.details?.preview
          reject(new Error(hint ? `${msg}（${typeof hint === 'string' ? hint.slice(0, 80) : ''}）` : msg))
          return
        }
        resolve(result as T)
      },
      fail: err => reject(err),
    })
  })
}

async function callCloudFunction<T>(name: string, data: Record<string, unknown>): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('请求超时，请检查网络或稍后重试')), CALL_TIMEOUT_MS)
  })
  return Promise.race([callCloudFunctionRaw<T>(name, data), timeout])
}

export async function generateOutlineAndScenes(topic: string): Promise<{ outline: string; scenes: string[] }> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('未配置 API Key，请先到设置页保存')
  return callCloudFunction('arkText', { apiKey, topic })
}

/**
 * 每张图单独调用云函数，避免多图一次生成超过 60 秒限制
 */
export async function generateImages(
  scenes: string[],
  onProgress?: (current: number, total: number) => void
): Promise<{ images: string[] }> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('未配置 API Key，请先到设置页保存')
  const images: string[] = []
  const total = scenes.length
  for (let i = 0; i < total; i++) {
    onProgress?.(i + 1, total)
    const res = await callCloudFunction<{ images: string[] }>('arkImage', {
      apiKey,
      scenes: [scenes[i]],
    })
    const list = Array.isArray(res?.images) ? res.images : []
    images.push(list[0] || '')
  }
  return { images }
}

