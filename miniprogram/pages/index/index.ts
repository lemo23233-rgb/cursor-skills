import { getApiKey, getRecentStories } from '../../services/storage'
import type { Story } from '../../services/types'

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const m = d.getMonth() + 1
  const day = d.getDate()
  const h = d.getHours()
  const min = d.getMinutes()
  return `${m}月${day}日 ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

type RecentDisplay = {
  id: string
  topic: string
  outlineShort: string
  sceneCount: number
  updatedAt: number
  updatedAtText: string
  coverUrl: string
  charCount: number
}

function toRecentDisplay(s: Story): RecentDisplay {
  const fullText = (s.outline || '') + (s.scenes || []).join('')
  const outline = s.outline || ''
  return {
    id: s.id,
    topic: s.topic || '',
    outlineShort: outline,
    sceneCount: (s.scenes || []).length,
    updatedAt: s.updatedAt || 0,
    updatedAtText: formatTime(s.updatedAt || s.createdAt || 0),
    coverUrl: (s.images || [])[0] || '',
    charCount: fullText.length,
  }
}

Component({
  data: {
    hasApiKey: false,
    recentList: [] as RecentDisplay[],
    loading: true,
    loadError: '',
  },
  pageLifetimes: {
    show() {
      const app = getApp<IAppOption>()
      const apiKey = getApiKey()
      this.setData({
        hasApiKey: typeof apiKey === 'string' && apiKey.trim().length > 0,
      })
      // 优先使用页面数据（navigateBack 场景）
      const { recentList, loadError } = this.data
      if (recentList.length > 0 || loadError) {
        return
      }
      // 其次使用全局缓存（reLaunch 从详情返回主页场景）
      const cached = app.globalData.indexRecentCache
      if (cached) {
        this.setData({
          recentList: cached.recentList || [],
          loadError: cached.loadError || '',
          loading: false,
        })
        return
      }
      this.setData({ loading: true, loadError: '' })
      getRecentStories()
        .then(stories => {
          const recentList = (stories || []).map(toRecentDisplay)
          app.globalData.indexRecentCache = { recentList, loadError: '' }
          this.setData({
            recentList,
            loading: false,
            loadError: '',
          })
        })
        .catch(err => {
          const msg = err?.message || '加载失败'
          app.globalData.indexRecentCache = { recentList: [], loadError: msg }
          this.setData({
            recentList: [],
            loading: false,
            loadError: msg,
          })
        })
    },
  },
  methods: {
    goCreate() {
      if (!this.data.hasApiKey) {
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
    goSettings() {
      wx.navigateTo({ url: '/pages/settings/index' })
    },
    goRecent(e: WechatMiniprogram.BaseEvent) {
      const item = (e.currentTarget as any).dataset.item as RecentDisplay | undefined
      if (!item) {
        wx.showToast({ title: '暂无最近作品', icon: 'none' })
        return
      }
      // 无插画则进创作页继续编辑，有插画则进详情
      if (!item.coverUrl) {
        wx.navigateTo({ url: `/pages/create/index?id=${encodeURIComponent(item.id)}` })
      } else {
        wx.navigateTo({ url: `/pages/story-detail/index?id=${encodeURIComponent(item.id)}` })
      }
    },
    goStoryList() {
      wx.navigateTo({ url: '/pages/story-list/index' })
    },
  },
})
