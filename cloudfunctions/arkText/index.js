const cloud = require('wx-server-sdk')
cloud.init()

const https = require('https')

const DEFAULT_BASE_URL = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'
const TEXT_MODEL = process.env.ARK_TEXT_MODEL || process.env.ARK_TEXT_MODEL_ID || ''
const REQUEST_TIMEOUT_MS = 60000

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
      reject(new Error('请求火山方舟超时'))
    })
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

/** 从方舟/OpenAI 兼容的多种响应结构中取出首条文本内容 */
function extractContent(json) {
  if (!json || typeof json !== 'object') return ''
  const c = json.choices?.[0]
  if (c?.message?.content) return String(c.message.content)
  if (c?.delta?.content) return String(c.delta.content)
  const data = json.data
  if (data?.choices?.[0]?.message?.content) return String(data.choices[0].message.content)
  if (json.message?.content) return String(json.message.content)
  if (json.text) return String(json.text)
  if (json.result?.text) return String(json.result.text)
  return ''
}

function extractJsonObject(text) {
  const s = String(text || '')
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  const snippet = s.slice(start, end + 1)
  try {
    return JSON.parse(snippet)
  } catch {
    return null
  }
}

// 微信云函数入口：必须为 async (event, context)，见 https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/functions/getting-started.html
exports.main = async (event, context) => {
  try {
    // 微信文档：event 即为 callFunction 传入的 data 对象；兼容 event.data / event.body（HTTP 触发）
    let payload = event && typeof event.data !== 'undefined' ? event.data : event || {}
    if ((!payload.apiKey && !payload.topic) && event && event.body) {
      const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body
      payload = body || payload
    }
    const apiKey = (typeof payload.apiKey === 'string' ? payload.apiKey : '').trim()
    const topic = (typeof payload.topic === 'string' ? payload.topic : '').trim()

    console.log('[arkText] event keys:', typeof event === 'object' && event ? Object.keys(event) : 'null')
    console.log('[arkText] hasApiKey:', !!apiKey, 'hasTopic:', !!topic, 'TEXT_MODEL:', TEXT_MODEL ? 'set' : 'empty')

    if (!apiKey) {
      return { error: { code: 'INVALID_ARGUMENT', message: '缺少 apiKey，请先在设置页配置' } }
    }
    if (!topic) {
      return { error: { code: 'INVALID_ARGUMENT', message: '缺少 topic（故事主题/梗概）' } }
    }
    if (!TEXT_MODEL) {
      return { error: { code: 'CONFIG_MISSING', message: '云函数未配置 ARK_TEXT_MODEL（文本模型 ID）' } }
    }

    const url = `${DEFAULT_BASE_URL}/chat/completions`
    console.log('[arkText] calling', url)

    const messages = [
      {
        role: 'system',
        content:
          '你是一个故事分镜编剧。根据用户主题生成故事大纲与分镜文案。' +
          '必须只输出 JSON，不要任何多余文字。JSON schema：{"outline":"...","scenes":["...","..."]}。' +
          'scenes 固定输出 4-6 条，每条 30-80 字，便于连环画生成。' +
          '避免违法违规内容，保持积极健康。'
      },
      { role: 'user', content: `主题：${topic}` },
    ]

    const body = {
      model: TEXT_MODEL,
      messages,
      temperature: 0.7,
    }

    const json = await requestJson(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    })
    console.log('[arkText] upstream response received, choices:', json?.choices?.length)

    const content = extractContent(json)
    const parsed = extractJsonObject(content)
    const outline = (parsed?.outline || '').toString().trim()
    const scenes = Array.isArray(parsed?.scenes) ? parsed.scenes.map(s => String(s || '').trim()).filter(Boolean) : []

    if (!outline || scenes.length < 2) {
      const detailMsg = content ? `返回长度 ${content.length}，前 200 字：${content.slice(0, 200)}` : '模型返回内容为空'
      return {
        error: {
          code: 'PARSE_FAILED',
          message: '文本模型返回内容解析失败，请检查云函数环境变量 ARK_TEXT_MODEL 是否已配置且与火山方舟文档一致',
          details: { contentLength: (content || '').length, preview: (content || '').slice(0, 300), hint: detailMsg },
        },
      }
    }

    return { outline, scenes }
  } catch (err) {
    return {
      error: {
        code: 'UPSTREAM_ERROR',
        message: err?.message || '上游请求失败',
      },
    }
  }
}

