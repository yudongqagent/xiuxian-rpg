// 生成 PWA 图标（192/512）：纯 Node PNG 编码（zlib 内置），墨底描金「仙」印风格
// 用法：node scripts/gen-pwa-icons.mjs  → public/pwa-192.png / public/pwa-512.png
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** 画一个「仙」字印章式图标：墨底 + 描金边框 + 中心金色方印（无字体依赖，几何构图） */
function makeIcon(size) {
  const px = Buffer.alloc(size * size * 3)
  const bg = [13, 9, 6] // #0d0906 墨
  const gold = [255, 217, 122] // #ffd97a
  const seal = [176, 74, 58] // #b04a3a 印泥红
  const set = (x, y, c) => {
    const i = (y * size + x) * 3
    px[i] = c[0]
    px[i + 1] = c[1]
    px[i + 2] = c[2]
  }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) set(x, y, bg)
  // 双描金边框
  const m = Math.round(size * 0.04)
  for (let t = 0; t < 2; t++) {
    const o = m + t * Math.max(2, Math.round(size * 0.012))
    for (let x = o; x < size - o; x++) {
      set(x, o, gold)
      set(x, size - 1 - o, gold)
    }
    for (let y = o; y < size - o; y++) {
      set(o, y, gold)
      set(size - 1 - o, y, gold)
    }
  }
  // 中心红印
  const s0 = Math.round(size * 0.24)
  const s1 = size - s0
  for (let y = s0; y < s1; y++) for (let x = s0; x < s1; x++) set(x, y, seal)
  // 印内「仙」意象：三撇云气 + 人形一竖（几何笔画，非文字）
  const w = Math.max(2, Math.round(size * 0.03))
  const cx = size / 2
  const cy = size / 2
  // 人：一竖
  for (let y = s0 + Math.round(size * 0.08); y < s1 - Math.round(size * 0.08); y++)
    for (let dx = 0; dx < w; dx++) set(Math.round(cx - w / 2) + dx, y, gold)
  // 撇：左下斜线
  for (let t = 0; t < Math.round(size * 0.16); t++) {
    const x = Math.round(cx - t * 0.55)
    const y = Math.round(cy - size * 0.06 + t)
    for (let dx = 0; dx < w; dx++) set(x + dx, y, gold)
  }
  // 捺：右下斜线
  for (let t = 0; t < Math.round(size * 0.16); t++) {
    const x = Math.round(cx + t * 0.55)
    const y = Math.round(cy - size * 0.06 + t)
    for (let dx = 0; dx < w; dx++) set(x + dx, y, gold)
  }
  // 顶部横：云台
  for (let x = s0 + Math.round(size * 0.07); x < s1 - Math.round(size * 0.07); x++)
    for (let dy = 0; dy < w; dy++) set(x, Math.round(cy - size * 0.1) + dy, gold)
  // PNG 组装
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolor
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0 // filter none
    px.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public', { recursive: true })
writeFileSync('public/pwa-192.png', makeIcon(192))
writeFileSync('public/pwa-512.png', makeIcon(512))
console.log('icons written: public/pwa-192.png, public/pwa-512.png')
