export type Story = {
  id: string
  topic: string
  outline: string
  scenes: string[]
  images: string[]
  createdAt: number
  updatedAt: number
}

export type StoryCard = {
  id: string
  topic: string
  outline: string
  sceneCount: number
  updatedAt: number
}

