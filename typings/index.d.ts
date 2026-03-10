/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    userInfo?: WechatMiniprogram.UserInfo,
    /** 首页最近作品缓存，用于从详情返回时避免重新加载 */
    indexRecentCache?: { recentList: any[]; loadError: string } | null,
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
}