import type { Story, StoryCard } from './types'

const COLLECTION = 'stories'

function getDB() {
  return wx.cloud.database()
}

/** 数据库文档 -> Story（_id 映射为 id） */
function docToStory(doc: any): Story {
  const d = doc || {}
  const id = d._id || ''
  return {
    id,
    topic: d.topic || '',
    outline: d.outline || '',
    scenes: Array.isArray(d.scenes) ? d.scenes : [],
    images: Array.isArray(d.images) ? d.images : [],
    createdAt: d.createdAt || 0,
    updatedAt: d.updatedAt || 0,
  }
}

/** 数据库文档 -> StoryCard */
function docToCard(doc: any): StoryCard {
  const d = doc
  return {
    id: d._id,
    topic: d.topic || '',
    outline: d.outline || '',
    sceneCount: Array.isArray(d.scenes) ? d.scenes.length : 0,
    updatedAt: d.updatedAt || 0,
  }
}

/**
 * 获取当前用户的作品列表（按更新时间倒序）
 */
export function getStoriesFromDB(limit = 20): Promise<Story[]> {
  return new Promise((resolve, reject) => {
    getDB()
      .collection(COLLECTION)
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get()
      .then(res => resolve((res.data as any[]).map(docToStory)))
      .catch(reject)
  })
}

/**
 * 获取当前用户的作品卡片列表（用于列表/首页）
 */
export function getStoryCardsFromDB(limit = 20): Promise<StoryCard[]> {
  return new Promise((resolve, reject) => {
    getDB()
      .collection(COLLECTION)
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get()
      .then(res => resolve((res.data as any[]).map(docToCard)))
      .catch(reject)
  })
}

/**
 * 获取当前用户最近一条作品卡片（首页「最近作品」用）
 */
export function getLastStoryCardFromDB(): Promise<StoryCard | null> {
  return new Promise((resolve, reject) => {
    getDB()
      .collection(COLLECTION)
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get()
      .then(res => {
        const list = (res.data as any[]) || []
        resolve(list.length ? docToCard(list[0]) : null)
      })
      .catch(reject)
  })
}

/**
 * 获取当前用户最近一条完整作品（含 images，首页封面用）
 */
export function getLastStoryFromDB(): Promise<Story | null> {
  return new Promise((resolve, reject) => {
    getDB()
      .collection(COLLECTION)
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get()
      .then(res => {
        const list = (res.data as any[]) || []
        resolve(list.length ? docToStory(list[0]) : null)
      })
      .catch(reject)
  })
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

/**
 * 获取最近 3 天内的作品（含 images，首页用）
 */
export function getRecentStoriesFromDB(): Promise<Story[]> {
  const since = Date.now() - THREE_DAYS_MS
  const db = getDB()
  const _ = db.command
  return new Promise((resolve, reject) => {
    db.collection(COLLECTION)
      .where({ updatedAt: _.gte(since) })
      .orderBy('updatedAt', 'desc')
      .limit(20)
      .get()
      .then(res => resolve((res.data as any[]).map(docToStory)))
      .catch(reject)
  })
}

/**
 * 按 id 获取单条作品详情
 */
export function getStoryFromDB(id: string): Promise<Story | null> {
  if (!id) return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    getDB()
      .collection(COLLECTION)
      .doc(id)
      .get()
      .then(res => {
        const data = (res as any).data
        if (!data) {
          resolve(null)
          return
        }
        resolve(docToStory({ ...data, _id: data._id || id }))
      })
      .catch(reject)
  })
}

/**
 * 保存作品到云数据库（新增或覆盖，以 story.id 为文档 _id）
 * 云开发会自动写入 _openid，仅当前用户可读写自己的文档
 */
export function saveStoryToDB(story: Story): Promise<StoryCard> {
  const now = Date.now()
  const doc = {
    topic: story.topic,
    outline: story.outline,
    scenes: story.scenes,
    images: story.images,
    createdAt: story.createdAt || now,
    updatedAt: now,
  }
  return new Promise((resolve, reject) => {
    getDB()
      .collection(COLLECTION)
      .doc(story.id)
      .set({ data: doc })
      .then(() => {
        resolve({
          id: story.id,
          topic: story.topic,
          outline: story.outline,
          sceneCount: story.scenes?.length || 0,
          updatedAt: now,
        })
      })
      .catch(reject)
  })
}
