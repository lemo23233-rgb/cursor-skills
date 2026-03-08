import { generateImages, generateOutlineAndScenes } from '../../services/ark'
import { getStory, saveStory } from '../../services/storage'
import type { Story } from '../../services/types'

function createId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

Page({
  data: {
    storyId: '' as string,
    topic: '',
    outline: '',
    scenes: [] as string[],
    generatingText: false,
    generatingImages: false,
  },
  onLoad(query: Record<string, string>) {
    const id = (query.id || '').trim()
    if (!id) return
    getStory(id).then(story => {
      if (!story) return
      this.setData({
        storyId: story.id,
        topic: story.topic || '',
        outline: story.outline || '',
        scenes: (story.scenes || []).length ? story.scenes : [''],
      })
    })
  },
  onTopicInput(e: WechatMiniprogram.TextareaInput) {
    this.setData({ topic: e.detail.value })
  },
  onOutlineInput(e: WechatMiniprogram.TextareaInput) {
    this.setData({ outline: e.detail.value })
  },
  onSceneInput(e: WechatMiniprogram.TextareaInput) {
    const idx = Number((e.currentTarget as any).dataset.index)
    const value = e.detail.value
    const next = [...this.data.scenes]
    next[idx] = value
    this.setData({ scenes: next })
  },
  addScene() {
    const next = [...this.data.scenes, '']
    this.setData({ scenes: next })
  },
  removeScene(e: WechatMiniprogram.BaseEvent) {
    const idx = Number((e.currentTarget as any).dataset.index)
    const next = this.data.scenes.filter((_, i) => i !== idx)
    this.setData({ scenes: next })
  },
  async generateText() {
    const topic = (this.data.topic || '').trim()
    if (!topic) {
      wx.showToast({ title: '请先输入主题', icon: 'none' })
      return
    }
    this.setData({ generatingText: true })
    wx.showLoading({ title: '正在生成大纲…', mask: true })
    try {
      const res = await generateOutlineAndScenes(topic)
      const outline = (res.outline || '').trim()
      const scenes = Array.isArray(res.scenes) ? res.scenes.filter(Boolean) : []
      this.setData({
        outline,
        scenes: scenes.length ? scenes : [''],
      })
      if (!outline && !scenes.length) {
        wx.showToast({ title: '未生成出有效内容，请重试', icon: 'none' })
      } else {
        // 草稿存库，支持后续继续生成插画
        const id = this.data.storyId || createId()
        const now = Date.now()
        let createdAt = now
        if (this.data.storyId) {
          const existing = await getStory(id)
          if (existing?.createdAt) createdAt = existing.createdAt
        }
        const story: Story = {
          id,
          topic,
          outline,
          scenes: scenes.length ? scenes : [''],
          images: [],
          createdAt,
          updatedAt: now,
        }
        await saveStory(story)
        this.setData({ storyId: id })
      }
    } catch (err: any) {
      const msg = err?.message || '生成失败'
      const isTimeout = /timed out|超时|504003|FUNCTIONS_TIME_LIMIT/i.test(msg)
      wx.showModal({
        title: '生成失败',
        content: isTimeout
          ? '请求超时。请将云函数 arkText 的超时时间设为 60 秒（云开发控制台 → 云函数 → 配置）后重试。'
          : msg,
        confirmText: '去设置',
        cancelText: '知道了',
        success: r => {
          if (r.confirm && /API Key|未配置/.test(msg)) {
            wx.navigateTo({ url: '/pages/settings/index' })
          }
        },
      })
    } finally {
      wx.hideLoading()
      this.setData({ generatingText: false })
    }
  },
  async generateImages() {
    const scenes = (this.data.scenes || []).map(s => (s || '').trim()).filter(Boolean)
    if (!scenes.length) {
      wx.showToast({ title: '请先完善分镜', icon: 'none' })
      return
    }
    this.setData({ generatingImages: true })
    wx.showLoading({ title: `正在生成第 1/${scenes.length} 张…`, mask: true })
    try {
      const res = await generateImages(scenes, (current, total) => {
        wx.showLoading({ title: `正在生成第 ${current}/${total} 张…`, mask: true })
      })
      const images = Array.isArray(res.images) ? res.images : []
      const id = this.data.storyId || createId()
      const now = Date.now()
      let createdAt = now
      if (this.data.storyId) {
        const existing = await getStory(id)
        if (existing?.createdAt) createdAt = existing.createdAt
      }
      const story: Story = {
        id,
        topic: (this.data.topic || '').trim(),
        outline: (this.data.outline || '').trim(),
        scenes,
        images,
        createdAt,
        updatedAt: now,
      }
      await saveStory(story)
      wx.navigateTo({ url: `/pages/story-detail/index?id=${encodeURIComponent(id)}` })
    } catch (err: any) {
      wx.showModal({
        title: '生成插画失败',
        content: err?.message || '请稍后重试',
        showCancel: false,
      })
    } finally {
      wx.hideLoading()
      this.setData({ generatingImages: false })
    }
  },
})

