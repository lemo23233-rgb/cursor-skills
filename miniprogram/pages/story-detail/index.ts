import { getStory } from '../../services/storage'
import type { Story } from '../../services/types'

function toImageSrc(img: string) {
  const s = (img || '').trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (/^data:image\//i.test(s)) return s
  return `data:image/png;base64,${s}`
}

function ensureAlbumPermission(): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success: setting => {
        const v = setting.authSetting['scope.writePhotosAlbum']
        if (v === true) {
          resolve()
          return
        }
        wx.authorize({
          scope: 'scope.writePhotosAlbum',
          success: () => resolve(),
          fail: () => reject(new Error('未获得保存到相册权限')),
        })
      },
      fail: err => reject(err as any),
    })
  })
}

function downloadToTemp(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      success: r => {
        if (r.statusCode === 200 && r.tempFilePath) resolve(r.tempFilePath)
        else reject(new Error('下载失败'))
      },
      fail: err => reject(err as any),
    })
  })
}

function writeBase64ToFile(base64: string, filename: string): Promise<string> {
  const fs = wx.getFileSystemManager()
  const filePath = `${wx.env.USER_DATA_PATH}/${filename}`
  return new Promise((resolve, reject) => {
    fs.writeFile({
      filePath,
      data: base64,
      encoding: 'base64',
      success: () => resolve(filePath),
      fail: err => reject(err as any),
    })
  })
}

function saveToAlbum(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => resolve(),
      fail: err => reject(err as any),
    })
  })
}

const NAV_CONTENT = 40

Page({
  data: {
    story: null as Story | null,
    imageSrcs: [] as string[],
    loading: true,
    statusBarHeight: 0,
    navBarHeight: 0,
    contentPaddingTop: 0,
  },
  onLoad(query: Record<string, string>) {
    const sys = wx.getSystemInfoSync()
    const statusBarHeight = (sys as any).statusBarHeight || 0
    const navBarHeight = statusBarHeight + NAV_CONTENT
    const contentPaddingTop = navBarHeight + 12
    this.setData({ statusBarHeight, navBarHeight, contentPaddingTop })
    const id = query.id ? String(query.id) : ''
    if (!id) {
      this.setData({ story: null, imageSrcs: [], loading: false })
      return
    }
    getStory(id)
      .then(story => {
        this.setData({
          story,
          imageSrcs: story?.images ? story.images.map(toImageSrc) : [],
          loading: false,
        })
      })
      .catch(() => {
        this.setData({ story: null, imageSrcs: [], loading: false })
      })
  },
  previewImage(e: WechatMiniprogram.BaseEvent) {
    const idx = Number((e.currentTarget as any).dataset.index)
    const urls = this.data.imageSrcs.filter(Boolean)
    if (!urls.length) return
    const current = this.data.imageSrcs[idx] || urls[0]
    wx.previewImage({
      current,
      urls,
    })
  },
  async saveOne(e: WechatMiniprogram.BaseEvent) {
    const idx = Number((e.currentTarget as any).dataset.index)
    const story = this.data.story
    if (!story) return
    const img = story.images?.[idx]
    if (!img) {
      wx.showToast({ title: '暂无图片', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })
    try {
      await ensureAlbumPermission()
      let filePath: string
      if (/^https?:\/\//i.test(img)) {
        filePath = await downloadToTemp(img)
      } else if (/^data:image\//i.test(img)) {
        const base64 = img.split(',').slice(1).join(',')
        filePath = await writeBase64ToFile(base64, `${story.id}_${idx}.png`)
      } else {
        filePath = await writeBase64ToFile(img, `${story.id}_${idx}.png`)
      }
      await saveToAlbum(filePath)
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (err: any) {
      const msg = err?.message || '保存失败'
      if (/authorize|auth|权限/.test(msg)) {
        wx.showModal({
          title: '需要相册权限',
          content: '请在系统设置中允许“保存到相册”。',
          confirmText: '去设置',
          success: r => {
            if (r.confirm) wx.openSetting({})
          },
        })
      } else {
        wx.showToast({ title: msg, icon: 'none' })
      }
    } finally {
      wx.hideLoading()
    }
  },
  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },
  onShareAppMessage() {
    const story = this.data.story
    return {
      title: story?.topic || '我的连环画作品',
      path: story?.id ? `/pages/story-detail/index?id=${encodeURIComponent(story.id)}` : '/pages/index/index',
    }
  },
})

