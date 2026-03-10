const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const https = require('https')

const DEFAULT_BASE_URL = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'
const IMAGE_MODEL = process.env.ARK_IMAGE_MODEL || process.env.ARK_IMAGE_MODEL_ID || ''
const REQUEST_TIMEOUT_MS = 90000
// 火山方舟图片接口要求总像素至少 3686400（如 1920x1920），不能使用 1024x1024
const DEFAULT_SIZE = '1920x1920'

function requestJson(url, { method = 'POST', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : ''
    const reqHeaders = {
      ...headers,
      'Content-Type': headers['Content-Type'] || 'application/json',
    }
    if (bodyStr) reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr, 'utf8')
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method,
        headers: reqHeaders,
      },
      res => {
        let raw = ''
        res.setEncoding('utf8')
        res.on('data', chunk => (raw += chunk))
        res.on('end', () => {
          const status = res.statusCode || 0
          let json
          try {
            json = raw ? JSON.parse(raw) : {}
          } catch (e) {
            return reject(new Error(`上游返回非 JSON（status=${status}）`))
          }
          if (status >= 200 && status < 300) return resolve(json)
          const msg = json?.error?.message || json?.message || raw || `上游请求失败（status=${status}）`
          const err = new Error(msg)
          err.statusCode = status
          err.upstream = json
          return reject(err)
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy()
      reject(new Error('请求火山方舟图片接口超时'))
    })
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

function normalizePrompt(scene, style) {
  const s = String(scene || '').trim()
  const st = String(style || '').trim()
  const styleBlock = st ? `统一风格要求：${st}\n` : '统一风格要求：连贯一致的插画风格、角色外观一致、画面干净、适合连环画。\n'
  return `${styleBlock}分镜画面描述：${s}`
}

/** 从 URL 下载图片为 Buffer */
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    https.get(
      url,
      {
        headers: { 'User-Agent': 'WeChat-MiniProgram' },
      },
      res => {
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      }
    ).on('error', reject)
  })
}

/** 上传到云存储，返回 fileID */
async function uploadToCloudStorage(imgData, cloudPath) {
  const result = await cloud.uploadFile({
    cloudPath,
    fileContent: imgData,
  })
  return result.fileID
}

exports.main = async (event, context) => {
  try {
    const payload = event && typeof event.data !== 'undefined' ? event.data : event || {}
    const apiKey = (typeof payload.apiKey === 'string' ? payload.apiKey : '').trim()
    const scenes = Array.isArray(payload.scenes) ? payload.scenes : []
    const size = typeof payload.size === 'string' && payload.size.trim() ? payload.size.trim() : DEFAULT_SIZE
    const style = typeof payload.style === 'string' ? payload.style : ''
    const storyId = typeof payload.storyId === 'string' ? payload.storyId.trim() : ''
    const sceneIndex = typeof payload.sceneIndex === 'number' ? payload.sceneIndex : 0

    console.log('[arkImage] event keys:', typeof event === 'object' && event ? Object.keys(event) : 'null')
    console.log('[arkImage] hasApiKey:', !!apiKey, 'scenesCount:', scenes.length, 'IMAGE_MODEL:', IMAGE_MODEL ? 'set' : 'empty')

    if (!apiKey) {
      return { error: { code: 'INVALID_ARGUMENT', message: '缺少 apiKey，请先在设置页配置' } }
    }
    if (!scenes.length) {
      return { error: { code: 'INVALID_ARGUMENT', message: '缺少 scenes（分镜列表）' } }
    }
    if (!IMAGE_MODEL) {
      return { error: { code: 'CONFIG_MISSING', message: '云函数未配置 ARK_IMAGE_MODEL（图片模型 ID，如 doubao-seedream-4.5 对应 ID）' } }
    }

    const url = `${DEFAULT_BASE_URL}/images/generations`
    const images = []
    for (let i = 0; i < scenes.length; i++) {
      const scene = String(scenes[i] || '').trim()
      if (!scene) {
        images.push('')
        continue
      }
      console.log('[arkImage] calling', url, 'scene', i + 1, '/', scenes.length)

      const body = {
        model: IMAGE_MODEL,
        prompt: normalizePrompt(scene, style),
        size,
      }

      const json = await requestJson(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
      })

      const item = json?.data?.[0] || {}
      const imgUrl = item.url || item.image_url
      const b64 = item.b64_json || item.base64 || item.image_base64
      let imgData = null
      if (b64) {
        imgData = Buffer.from(b64, 'base64')
      } else if (imgUrl) {
        imgData = await downloadImage(imgUrl)
      }
      if (!imgData || imgData.length === 0) {
        images.push('')
        continue
      }
      const cloudPath = storyId
        ? `stories/${storyId}/${sceneIndex}.png`
        : `stories/temp/${Date.now()}_${sceneIndex}.png`
      const fileID = await uploadToCloudStorage(imgData, cloudPath)
      images.push(fileID)
    }
    console.log('[arkImage] upstream done, images count:', images.length)
    return { images }
  } catch (err) {
    return {
      error: {
        code: 'UPSTREAM_ERROR',
        message: err?.message || '上游请求失败',
      },
    }
  }
}

