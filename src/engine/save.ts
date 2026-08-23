/** 存档系统：IndexedDB 单存档位 + 自动保存。后续可扩展多存档位/云同步。 */
import type { QuestSaveData } from '../systems/quests'

const DB_NAME = 'xiuxian-save'
const STORE = 'slots'
const SLOT = 'auto'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export interface PlayerSave {
  level: number
  exp: number
  hp: number
  qi: number
  /** itemId → 数量 */
  inventory: Record<string, number>
  skills: string[]
}

export interface SaveData {
  version: number
  playerId: string
  x: number
  y: number
  /** 当前地图 id；旧存档缺省时由消费方回退到默认地图 */
  mapId?: string
  inventory: string[]
  savedAt: number
  /** v2 起携带成长/背包/功法；旧档缺省时按全新炼气一层处理（向后兼容） */
  player?: PlayerSave
  /** quest-engine 新增：任务进度（additive 可选，旧存档无此字段） */
  quests?: QuestSaveData
}

export async function loadSave(): Promise<SaveData | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(SLOT)
      tx.onsuccess = () => resolve((tx.result as SaveData) ?? null)
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    return null
  }
}

export async function writeSave(data: SaveData): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite').objectStore(STORE).put(data, SLOT)
      tx.onsuccess = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* 存档失败不阻塞游戏 */
  }
}
