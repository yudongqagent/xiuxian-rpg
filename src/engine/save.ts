/** 存档系统：IndexedDB。auto 自动档 + s1/s2/s3 手动档（ENG-5）。 */
import type { QuestSaveData } from '../systems/quests'

const DB_NAME = 'xiuxian-save'
const STORE = 'slots'
export const AUTO_SLOT = 'auto'
export const MANUAL_SLOTS = ['s1', 's2', 's3'] as const
export type SlotId = (typeof MANUAL_SLOTS)[number] | typeof AUTO_SLOT

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

export async function loadSave(slot: SlotId = AUTO_SLOT): Promise<SaveData | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(slot)
      tx.onsuccess = () => resolve((tx.result as SaveData) ?? null)
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    return null
  }
}

export async function writeSave(data: SaveData, slot: SlotId = AUTO_SLOT): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite').objectStore(STORE).put(data, slot)
      tx.onsuccess = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* 存档失败不阻塞游戏 */
  }
}

export async function listSaves(): Promise<Record<string, SaveData | null>> {
  const out: Record<string, SaveData | null> = { [AUTO_SLOT]: null, s1: null, s2: null, s3: null }
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const store = db.transaction(STORE, 'readonly').objectStore(STORE)
      const req = store.openCursor()
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) return resolve()
        const key = String(cursor.key)
        if (key in out) out[key] = cursor.value as SaveData
        cursor.continue()
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    /* 列举失败按全空处理 */
  }
  return out
}
