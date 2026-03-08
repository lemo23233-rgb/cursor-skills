// app.ts
App<IAppOption>({
  globalData: {},
  onLaunch() {
    if (!wx.cloud) {
      console.error('当前基础库不支持 wx.cloud，请升级微信版本或基础库版本')
      return
    }

    wx.cloud.init({
      env: wx.cloud.DYNAMIC_CURRENT_ENV,
      traceUser: true,
    })
  },
})