import { getApiKey, getStories } from '../../services/storage'
import type { Story } from '../../services/types'

type ListItemDisplay = {
  id: string
  topic: string
  outlineShort: string
  sceneCount: number
  coverUrl: string
  charCount: number
  updatedAtText: string
}

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const m = d.getMonth() + 1
  const day = d.getDate()
  const h = d.getHours()
  const min = d.getMinutes()
  return `${m}月${day}日 ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function toListItem(s: Story): ListItemDisplay {
  const outline = s.outline || ''
  const fullText = outline + (s.scenes || []).join('')
  return {
    id: s.id,
    topic: s.topic || '',
    outlineShort: outline,
    sceneCount: (s.scenes || []).length,
    coverUrl: (s.images || [])[0] || '',
    charCount: fullText.length,
    updatedAtText: formatTime(s.updatedAt || s.createdAt || 0),
  }
}

Page({
  data: {
    list: [] as ListItemDisplay[],
    loading: true,
    loadError: '',
  },
  onShow() {
    // 已加载过则不重新请求（从别处返回作品列表不刷新）
    const { loadError, loading } = this.data
    if (loadError || !loading) {
      return
    }
    this.setData({ loading: true, loadError: '' })
    getStories()
      .then(stories => {
        const list = (stories || []).map(toListItem)
        this.setData({ list, loading: false, loadError: '' })
      })
      .catch(err => {
        this.setData({
          list: [],
          loading: false,
          loadError: err?.message || '加载失败',
        })
      })
  },
  openDetail(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget as any).dataset.id
    const item = (e.currentTarget as any).dataset.item as ListItemDisplay | undefined
    if (!id) return
    // 无插画则进创作页继续编辑，有插画则进详情
    if (item && !item.coverUrl) {
      wx.navigateTo({ url: `/pages/create/index?id=${encodeURIComponent(id)}` })
    } else {
      wx.navigateTo({ url: `/pages/story-detail/index?id=${encodeURIComponent(id)}` })
    }
  },
  goCreate() {
    const apiKey = getApiKey()
    if (!apiKey || !apiKey.trim()) {
      wx.showModal({
        title: '需要配置',
        content: '需在设置中配置 API Key 方可使用创作功能',
        confirmText: '去设置',
        cancelText: '取消',
        success: r => {
          if (r.confirm) wx.navigateTo({ url: '/pages/settings/index' })
        },
      })
      return
    }
    wx.navigateTo({ url: '/pages/create/index' })
  },
})
