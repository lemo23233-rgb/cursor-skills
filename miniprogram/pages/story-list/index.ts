import { getStories } from '../../services/storage'
import type { Story } from '../../services/types'

type ListItemDisplay = {
  id: string
  topic: string
  outlineShort: string
  sceneCount: number
  coverUrl: string
  charCount: number
}

function toListItem(s: Story): ListItemDisplay {
  const outline = s.outline || ''
  const fullText = outline + (s.scenes || []).join('')
  return {
    id: s.id,
    topic: s.topic || '',
    outlineShort: outline.length > 20 ? outline.slice(0, 20) + '...' : outline,
    sceneCount: (s.scenes || []).length,
    coverUrl: (s.images || [])[0] || '',
    charCount: fullText.length,
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
    const { list, loadError } = this.data
    if (list.length > 0 || loadError) {
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
    wx.navigateTo({ url: '/pages/create/index' })
  },
})
