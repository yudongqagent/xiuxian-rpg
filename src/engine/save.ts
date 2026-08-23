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
  /** INV-3：已装备武器/防具（additive 可选，旧档缺省为空） */
  equipped?: { weapon: string | null; armor: string | null }
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

// ===== ENG-6：存档码导出/导入（纯编解码，便于测试） =====

const CODE_PREFIX = 'XJ1'

function djb2Hex(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0
  return (h >>> 0).toString(16).padStart(8, '0')
}

function toB64(json: string): string {
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function fromB64(b64: string): string {
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** 序列化为可分享的存档码：XJ1.<base64>.<校验> */
export function encodeSave(data: SaveData): string {
  const json = JSON.stringify(data)
  return `${CODE_PREFIX}.${toB64(json)}.${djb2Hex(json)}`
}

/** 解析存档码；格式或校验失败返回 null（不抛错） */
export function decodeSave(code: string): SaveData | null {
  try {
    const parts = code.trim().split('.')
    if (parts.length !== 3 || parts[0] !== CODE_PREFIX) return null
    const json = fromB64(parts[1])
    if (djb2Hex(json) !== parts[2]) return null
    const data = JSON.parse(json) as SaveData
    if (typeof data?.x !== 'number' || typeof data?.y !== 'number') return null
    return data
  } catch {
    return null
  }
}

/** 导出指定档位为存档码 */
export async function exportSaveCode(slot: SlotId): Promise<string | null> {
  const data = await loadSave(slot)
  return data ? encodeSave(data) : null
}

/** 将存档码写入指定档位；成功返回 true */
export async function importSaveCode(code: string, slot: SlotId): Promise<boolean> {
  const data = decodeSave(code)
  if (!data) return false
  await writeSave(data, slot)
  return true
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
