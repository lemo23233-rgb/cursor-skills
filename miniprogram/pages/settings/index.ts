import { clearApiKey, getApiKey, setApiKey } from '../../services/storage'

const DOC_URL = 'https://www.volcengine.com/docs/82379/1263279'

function maskKey(key: string) {
  const k = key.trim()
  if (k.length <= 8) return '已保存'
  return `${k.slice(0, 3)}...${k.slice(-4)}`
}

const NAV_CONTENT = 40

Page({
  data: {
    apiKey: '',
    showKey: false,
    savedHint: '',
    statusBarHeight: 0,
    navBarHeight: 0,
    contentPaddingTop: 0,
  },
  onLoad() {
    const sys = wx.getSystemInfoSync()
    const statusBarHeight = (sys as any).statusBarHeight || 0
    const navBarHeight = statusBarHeight + NAV_CONTENT
    const contentPaddingTop = navBarHeight + 12
    this.setData({ statusBarHeight, navBarHeight, contentPaddingTop })
    const existing = getApiKey()
    this.setData({
      apiKey: existing || '',
      savedHint: existing ? `当前已保存：${maskKey(existing)}` : '',
    })
  },
  onInput(e: WechatMiniprogram.Input) {
    this.setData({ apiKey: e.detail.value })
  },
  toggleShow() {
    this.setData({ showKey: !this.data.showKey })
  },
  save() {
    const key = (this.data.apiKey || '').trim()
    if (!key) {
      wx.showToast({ title: '请输入 API Key', icon: 'none' })
      return
    }
    setApiKey(key)
    this.setData({ savedHint: `当前已保存：${maskKey(key)}` })
    wx.showToast({ title: '保存成功', icon: 'success' })
  },
  clear() {
    clearApiKey()
    this.setData({ apiKey: '', savedHint: '' })
    wx.showToast({ title: '已清除', icon: 'success' })
  },
  goBack() {
    wx.navigateBack()
  },
  copyDoc() {
    wx.setClipboardData({
      data: DOC_URL,
      success: () => {
        wx.showModal({
          title: '已复制链接',
          content: '请在浏览器中打开该链接获取 API Key。',
          showCancel: false,
        })
      },
    })
  },
})

