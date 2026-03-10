import {
  getLastStoryCardFromDB,
  getLastStoryFromDB,
  getRecentStoriesFromDB,
  getStoryCardsFromDB,
  getStoryFromDB,
  getStoriesFromDB,
  saveStoryToDB,
} from './db'
import type { Story, StoryCard } from './types'

const STORAGE_API_KEY = 'ark_api_key'

// ---------- API Key：仅本地存储，不落库 ----------
export function getApiKey(): string | null {
  const v = wx.getStorageSync(STORAGE_API_KEY)
  if (typeof v !== 'string') return null
  const key = v.trim()
  return key.length ? key : null
}

export function setApiKey(apiKey: string) {
  wx.setStorageSync(STORAGE_API_KEY, apiKey.trim())
}

export function clearApiKey() {
  wx.removeStorageSync(STORAGE_API_KEY)
}

// ---------- 作品：从腾讯云数据库读写 ----------
/** 获取当前用户作品列表（按更新时间倒序） */
export function getStories(): Promise<Story[]> {
  return getStoriesFromDB()
}

/** 获取当前用户作品卡片列表（用于列表页/首页） */
export function getStoryCards(): Promise<StoryCard[]> {
  return getStoryCardsFromDB()
}

/** 按 id 获取单条作品详情 */
export function getStory(id: string): Promise<Story | null> {
  return getStoryFromDB(id)
}

/** 获取最近一条作品卡片（首页「最近作品」用） */
export function getLastStoryCard(): Promise<StoryCard | null> {
  return getLastStoryCardFromDB()
}

/** 获取最近一条完整作品（含 images，首页封面用） */
export function getLastStory(): Promise<Story | null> {
  return getLastStoryFromDB()
}

/** 获取最近 3 天内的作品（首页用） */
export function getRecentStories(): Promise<Story[]> {
  return getRecentStoriesFromDB()
}

/** 保存作品到云数据库 */
export function saveStory(story: Story): Promise<StoryCard> {
  return saveStoryToDB(story)
}
