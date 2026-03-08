import { getApiKey, getLastStory } from '../../services/storage'
import type { Story } from '../../services/types'

type RecentDisplay = {
  id: string
  topic: string
  outlineShort: string
  sceneCount: number
  updatedAt: number
  coverUrl: string
  charCount: number
}

function toRecentDisplay(s: Story | null): RecentDisplay | null {
  if (!s || !s.id) return null
  const fullText = (s.outline || '') + (s.scenes || []).join('')
  const outline = s.outline || ''
  return {
    id: s.id,
    topic: s.topic || '',
    outlineShort: outline.length > 20 ? outline.slice(0, 20) + '...' : outline,
    sceneCount: (s.scenes || []).length,
    updatedAt: s.updatedAt || 0,
    coverUrl: (s.images || [])[0] || '',
    charCount: fullText.length,
  }
}

Component({
  data: {
    hasApiKey: false,
    recent: null as RecentDisplay | null,
    loading: true,
    loadError: '',
  },
  pageLifetimes: {
    show() {
      const apiKey = getApiKey()
      this.setData({
        hasApiKey: typeof apiKey === 'string' && apiKey.trim().length > 0,
      })
      // 已加载过则不重新请求（从别处返回首页不刷新）
      const { recent, loadError } = this.data
      if (recent !== null || loadError) {
        return
      }
      this.setData({ loading: true, loadError: '' })
      getLastStory()
        .then(story => {
          this.setData({
            recent: toRecentDisplay(story),
            loading: false,
            loadError: '',
          })
        })
        .catch(err => {
          this.setData({
            recent: null,
            loading: false,
            loadError: err?.message || '加载失败',
          })
        })
    },
  },
  methods: {
    goCreate() {
      wx.navigateTo({ url: '/pages/create/index' })
    },
    goSettings() {
      wx.navigateTo({ url: '/pages/settings/index' })
    },
    goRecent() {
      const { recent } = this.data
      if (!recent) {
        wx.showToast({ title: '暂无最近作品', icon: 'none' })
        return
      }
      // 无插画则进创作页继续编辑，有插画则进详情
      if (!recent.coverUrl) {
        wx.navigateTo({ url: `/pages/create/index?id=${encodeURIComponent(recent.id)}` })
      } else {
        wx.navigateTo({ url: `/pages/story-detail/index?id=${encodeURIComponent(recent.id)}` })
      }
    },
    goStoryList() {
      wx.navigateTo({ url: '/pages/story-list/index' })
    },
  },
})
