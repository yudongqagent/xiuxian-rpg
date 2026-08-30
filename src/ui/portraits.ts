export type HairStyle = 'topknot' | 'long' | 'buns' | 'loosebun' | 'shaved'
export type BrowKind = 'thin' | 'thick' | 'angled'
export type Accessory =
  | 'longBeard'
  | 'shortBeard'
  | 'whiskers'
  | 'flowerPin'
  | 'guanPin'
  | 'douliHat'
  | 'scar'
  | 'cinnabarMark'
  | 'veil'
  | 'seams'
  | 'earrings'
  | 'swordHilt'

interface PortraitSpec {
  skin: string
  hair: string
  robe: string
  robeDark: string
  trim: string
  hairStyle: HairStyle
  brows: BrowKind
  accessories?: Accessory[]
}

const SIZE = 96
const CX = SIZE / 2

const SPECS: Record<string, PortraitSpec> = {
  mo_dafu: {
    skin: '#e6cfa8', hair: '#4a4038', robe: '#3d2f22', robeDark: '#2c2118', trim: '#a08050',
    hairStyle: 'topknot', brows: 'angled', accessories: ['shortBeard'],
  },
  zhang_er: {
    skin: '#e0c9a0', hair: '#3a2c20', robe: '#5c5038', robeDark: '#423a28', trim: '#b8a878',
    hairStyle: 'shaved', brows: 'thick', accessories: ['scar', 'whiskers'],
  },
  li_san: {
    skin: '#e8cda4', hair: '#2c2418', robe: '#47608a', robeDark: '#33466a', trim: '#c4b078',
    hairStyle: 'loosebun', brows: 'angled', accessories: ['shortBeard'],
  },
  wang_zhangmen: {
    skin: '#e8cfa5', hair: '#8a8578', robe: '#2f3a52', robeDark: '#232c40', trim: '#ffd97a',
    hairStyle: 'topknot', brows: 'thick', accessories: ['longBeard', 'guanPin'],
  },
  li_feiyu: {
    skin: '#f0d8b8', hair: '#241c14', robe: '#3f7a4a', robeDark: '#2e5c37', trim: '#a0d8b0',
    hairStyle: 'topknot', brows: 'angled', accessories: ['swordHilt'],
  },
  mo_caihuan: {
    skin: '#f4dcc0', hair: '#1e1610', robe: '#d07aa8', robeDark: '#a85a84', trim: '#f2d16b',
    hairStyle: 'buns', brows: 'thin', accessories: ['flowerPin'],
  },
  chaopeng_laoren: {
    skin: '#dfc49c', hair: '#d8d4c8', robe: '#7a6a58', robeDark: '#5c5044', trim: '#c9b88a',
    hairStyle: 'loosebun', brows: 'thin', accessories: ['whiskers', 'douliHat'],
  },
  chen_qiaoqian: {
    skin: '#f2dcc2', hair: '#181410', robe: '#e8eef0', robeDark: '#c2ced4', trim: '#5aa8c0',
    hairStyle: 'long', brows: 'angled', accessories: ['swordHilt', 'earrings'],
  },
  dong_xuaner: {
    skin: '#f4decb', hair: '#141018', robe: '#7a68b0', robeDark: '#5c4c8a', trim: '#cabff0',
    hairStyle: 'long', brows: 'thin', accessories: ['veil'],
  },
  gu_shishu: {
    skin: '#e0be94', hair: '#2c241c', robe: '#6b4a2f', robeDark: '#503723', trim: '#d9c9a0',
    hairStyle: 'shaved', brows: 'thick', accessories: ['scar', 'shortBeard'],
  },
  jin_guang_shangren: {
    skin: '#e2c39a', hair: '#3a3026', robe: '#8a6a28', robeDark: '#6a5120', trim: '#ffd97a',
    hairStyle: 'topknot', brows: 'thin', accessories: ['cinnabarMark', 'shortBeard'],
  },
  li_huayuan: {
    skin: '#e6cba4', hair: '#26201a', robe: '#24504a', robeDark: '#1a3c38', trim: '#88c8b8',
    hairStyle: 'topknot', brows: 'angled', accessories: ['shortBeard', 'guanPin'],
  },
  ma_guanshi: {
    skin: '#e4c69c', hair: '#33281e', robe: '#6a6a3c', robeDark: '#525230', trim: '#c2bc84',
    hairStyle: 'topknot', brows: 'thin', accessories: ['whiskers'],
  },
  nangong_wan: {
    skin: '#f6e2cc', hair: '#101418', robe: '#e8ecf4', robeDark: '#bcc6da', trim: '#88b8e8',
    hairStyle: 'long', brows: 'thin', accessories: ['earrings', 'flowerPin'],
  },
  qing_wen: {
    skin: '#eed2ae', hair: '#20261c', robe: '#3c7048', robeDark: '#2c5436', trim: '#9cc89c',
    hairStyle: 'loosebun', brows: 'angled', accessories: ['earrings'],
  },
  qu_hun: {
    skin: '#c8c4bc', hair: '#3a3834', robe: '#46424c', robeDark: '#34303a', trim: '#6e6a76',
    hairStyle: 'loosebun', brows: 'thin', accessories: ['seams'],
  },
  wan_xiaoshan: {
    skin: '#ecd0aa', hair: '#2a2018', robe: '#8a7048', robeDark: '#6a5638', trim: '#c8ac78',
    hairStyle: 'topknot', brows: 'thick',
  },
  wanbaolou_zhanggui: {
    skin: '#e8caa0', hair: '#2e241a', robe: '#7a4c28', robeDark: '#5c3a20', trim: '#e8c05a',
    hairStyle: 'topknot', brows: 'thin', accessories: ['whiskers'],
  },
  wu_yan: {
    skin: '#dcbc92', hair: '#201a14', robe: '#46505c', robeDark: '#343c46', trim: '#8898a8',
    hairStyle: 'shaved', brows: 'thick', accessories: ['scar'],
  },
  xinggong_shengzhu: {
    skin: '#e8d0b0', hair: '#98908a', robe: '#2c2044', robeDark: '#201834', trim: '#c0b8e8',
    hairStyle: 'topknot', brows: 'angled', accessories: ['longBeard', 'guanPin'],
  },
  yuan_yao: {
    skin: '#f0ded4', hair: '#12100e', robe: '#5c2030', robeDark: '#441824', trim: '#c07888',
    hairStyle: 'long', brows: 'thin', accessories: ['earrings'],
  },
  yue_tangzhu: {
    skin: '#e0c29a', hair: '#3c342c', robe: '#50565e', robeDark: '#3c4248', trim: '#a8b0ba',
    hairStyle: 'topknot', brows: 'thick', accessories: ['shortBeard'],
  },
}

function hashSeed(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function fallbackSpec(id: string): PortraitSpec {
  const s = hashSeed(id)
  const robes = ['#3f5e8c', '#3f7a4a', '#7a4c28', '#54406e', '#6e3030']
  const trims = ['#c9a44a', '#a0d8b0', '#e8c05a', '#cabff0', '#d99a8a']
  const styles: HairStyle[] = ['topknot', 'long', 'loosebun']
  return {
    skin: '#ecd2ac',
    hair: '#261e16',
    robe: robes[s % robes.length],
    robeDark: '#00000033',
    trim: trims[(s >> 3) % trims.length],
    hairStyle: styles[(s >> 6) % styles.length],
    brows: (s >> 9) % 2 === 0 ? 'thin' : 'angled',
  }
}

const cache = new Map<string, string>()

export function portraitFor(npcId: string): string {
  const hit = cache.get(npcId)
  if (hit) return hit
  const spec = SPECS[npcId] ?? fallbackSpec(npcId)
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const c = canvas.getContext('2d')!
  drawPortrait(c, spec)
  const url = canvas.toDataURL('image/png')
  cache.set(npcId, url)
  return url
}

function drawPortrait(c: CanvasRenderingContext2D, p: PortraitSpec): void {
  const bg = c.createLinearGradient(0, 0, 0, SIZE)
  bg.addColorStop(0, '#342a1c')
  bg.addColorStop(1, '#1d150c')
  c.fillStyle = bg
  c.fillRect(0, 0, SIZE, SIZE)
  const glow = c.createRadialGradient(CX, 40, 8, CX, 44, 52)
  glow.addColorStop(0, 'rgba(255,222,158,0.26)')
  glow.addColorStop(1, 'rgba(255,220,150,0)')
  c.fillStyle = glow
  c.fillRect(0, 0, SIZE, SIZE)
  inkWash(c)

  body(c, p)
  head(c, p)
  hairBack(c, p)
  face(c, p)
  hairFront(c, p)
  for (const a of p.accessories ?? []) accessory(c, a, p)
  frameVignette(c)
}

function inkWash(c: CanvasRenderingContext2D): void {
  c.save()
  c.globalAlpha = 0.12
  c.fillStyle = '#c8b888'
  c.beginPath()
  c.ellipse(18, 74, 26, 10, -0.35, 0, Math.PI * 2)
  c.fill()
  c.beginPath()
  c.ellipse(80, 26, 18, 6, 0.4, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

function body(c: CanvasRenderingContext2D, p: PortraitSpec): void {
  c.fillStyle = p.robe
  c.beginPath()
  c.moveTo(CX - 17, 64)
  c.quadraticCurveTo(CX - 30, 72, CX - 34, 96)
  c.lineTo(CX + 34, 96)
  c.quadraticCurveTo(CX + 30, 72, CX + 17, 64)
  c.closePath()
  c.fill()
  c.fillStyle = 'rgba(0,0,0,0.25)'
  c.fillRect(0, 88, SIZE, 8)
  c.fillStyle = p.robeDark
  c.beginPath()
  c.moveTo(CX, 66)
  c.lineTo(CX - 11, 96)
  c.lineTo(CX - 3, 96)
  c.lineTo(CX + 2, 70)
  c.closePath()
  c.fill()
  c.strokeStyle = p.trim
  c.lineWidth = 1.6
  c.beginPath()
  c.moveTo(CX - 13, 63)
  c.quadraticCurveTo(CX, 74, CX + 13, 63)
  c.stroke()
  c.fillStyle = '#d8bca0'
  c.fillRect(CX - 5, 54, 10, 12)
}

function head(c: CanvasRenderingContext2D, p: PortraitSpec): void {
  c.fillStyle = p.skin
  c.beginPath()
  c.ellipse(CX, 38, 15, 17, 0, 0, Math.PI * 2)
  c.fill()
  c.beginPath()
  c.ellipse(CX - 15, 39, 2.6, 4, 0, 0, Math.PI * 2)
  c.ellipse(CX + 15, 39, 2.6, 4, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = shade(p.skin, -18)
  c.beginPath()
  c.ellipse(CX, 47.5, 2.4, 1.4, 0, 0, Math.PI * 2)
  c.fill()
}

function face(c: CanvasRenderingContext2D, p: PortraitSpec): void {
  const eye = '#241c14'
  c.strokeStyle = '#241c14'
  c.lineWidth = p.brows === 'thick' ? 2.2 : 1.4
  c.lineCap = 'round'
  const browY = 32
  if (p.brows === 'angled') {
    seg(c, CX - 11, browY + 1.6, CX - 4, browY - 0.6)
    seg(c, CX + 4, browY - 0.6, CX + 11, browY + 1.6)
  } else {
    seg(c, CX - 11, browY, CX - 4, browY - 0.8)
    seg(c, CX + 4, browY - 0.8, CX + 11, browY)
  }
  c.fillStyle = eye
  c.beginPath()
  c.ellipse(CX - 7.5, 38, 1.7, p.brows === 'thin' ? 1.1 : 1.5, 0, 0, Math.PI * 2)
  c.ellipse(CX + 7.5, 38, 1.7, p.brows === 'thin' ? 1.1 : 1.5, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = 'rgba(214,110,90,0.55)'
  c.beginPath()
  c.moveTo(CX, 41.5)
  c.quadraticCurveTo(CX + 3, 44, CX, 45)
  c.quadraticCurveTo(CX - 3, 44, CX, 41.5)
  c.fill()
  c.strokeStyle = '#8a5c48'
  c.lineWidth = 1.3
  c.beginPath()
  c.moveTo(CX - 3, 51)
  c.quadraticCurveTo(CX, 53, CX + 3, 51)
  c.stroke()
}

function hairBack(c: CanvasRenderingContext2D, p: PortraitSpec): void {
  if (p.hairStyle === 'shaved') return
  c.fillStyle = p.hair
  c.beginPath()
  c.ellipse(CX, 34, 16.5, 15, 0, Math.PI * 0.95, Math.PI * 2.05)
  c.fill()
  if (p.hairStyle === 'long') {
    c.beginPath()
    c.moveTo(CX - 16, 32)
    c.quadraticCurveTo(CX - 21, 52, CX - 17, 70)
    c.lineTo(CX - 9, 66)
    c.quadraticCurveTo(CX - 13, 48, CX - 11, 30)
    c.closePath()
    c.fill()
    c.beginPath()
    c.moveTo(CX + 16, 32)
    c.quadraticCurveTo(CX + 21, 52, CX + 17, 70)
    c.lineTo(CX + 9, 66)
    c.quadraticCurveTo(CX + 13, 48, CX + 11, 30)
    c.closePath()
    c.fill()
  }
}

function hairFront(c: CanvasRenderingContext2D, p: PortraitSpec): void {
  if (p.hairStyle === 'shaved') return
  c.fillStyle = p.hair
  c.beginPath()
  c.ellipse(CX, 27.5, 15.4, 11, 0, Math.PI, Math.PI * 2)
  c.fill()
  if (p.hairStyle !== 'long') {
    c.beginPath()
    c.moveTo(CX - 15, 28)
    c.quadraticCurveTo(CX - 8, 22, CX - 2, 27)
    c.lineTo(CX - 15.4, 30)
    c.closePath()
    c.fill()
    c.beginPath()
    c.moveTo(CX + 15, 28)
    c.quadraticCurveTo(CX + 8, 22, CX + 2, 27)
    c.lineTo(CX + 15.4, 30)
    c.closePath()
    c.fill()
  }
  if (p.hairStyle === 'topknot') bun(c, CX, 15.5, 5, p.hair)
  if (p.hairStyle === 'loosebun') bun(c, CX + 8, 20, 4.4, p.hair)
  if (p.hairStyle === 'buns') {
    bun(c, CX - 12, 18.5, 5.2, p.hair)
    bun(c, CX + 12, 18.5, 5.2, p.hair)
  }
}

function bun(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string): void {
  c.fillStyle = col
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = 'rgba(255,255,255,0.14)'
  c.beginPath()
  c.arc(x - r / 3, y - r / 3, r / 2.6, 0, Math.PI * 2)
  c.fill()
}

function accessory(c: CanvasRenderingContext2D, kind: Accessory, p: PortraitSpec): void {
  switch (kind) {
    case 'longBeard':
      c.fillStyle = shade(p.hair, 26)
      c.beginPath()
      c.moveTo(CX - 6, 50)
      c.quadraticCurveTo(CX - 9, 66, CX - 4, 82)
      c.quadraticCurveTo(CX, 86, CX + 4, 82)
      c.quadraticCurveTo(CX + 9, 66, CX + 6, 50)
      c.closePath()
      c.fill()
      break
    case 'shortBeard':
      c.fillStyle = shade(p.hair, 18)
      c.beginPath()
      c.moveTo(CX - 8, 46)
      c.quadraticCurveTo(CX, 60, CX + 8, 46)
      c.quadraticCurveTo(CX, 56, CX - 8, 46)
      c.fill()
      break
    case 'whiskers':
      c.strokeStyle = shade(p.hair, 30)
      c.lineWidth = 1.6
      c.lineCap = 'round'
      seg(c, CX - 9, 48.5, CX - 3, 50)
      seg(c, CX + 3, 50, CX + 9, 48.5)
      break
    case 'flowerPin': {
      const fx = p.hairStyle === 'buns' ? CX - 17 : CX + 13
      const fy = p.hairStyle === 'buns' ? 15 : 22
      c.fillStyle = '#e86a8a'
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        c.beginPath()
        c.arc(fx + Math.cos(a) * 2.6, fy + Math.sin(a) * 2.6, 2, 0, Math.PI * 2)
        c.fill()
      }
      c.fillStyle = '#ffd97a'
      c.beginPath()
      c.arc(fx, fy, 1.6, 0, Math.PI * 2)
      c.fill()
      break
    }
    case 'guanPin':
      c.fillStyle = '#c9a44a'
      c.fillRect(CX - 10, 17.5, 20, 3.4)
      c.fillRect(CX - 3, 12.5, 6, 5)
      c.fillStyle = '#8a6a20'
      c.fillRect(CX - 10, 20, 20, 1)
      break
    case 'douliHat':
      c.fillStyle = '#c8a86a'
      c.beginPath()
      c.moveTo(CX - 26, 28)
      c.lineTo(CX, 4)
      c.lineTo(CX + 26, 28)
      c.closePath()
      c.fill()
      c.fillStyle = '#a8874c'
      c.fillRect(CX - 26, 26.4, 52, 2.6)
      c.strokeStyle = '#7c6034'
      c.lineWidth = 1
      seg(c, CX - 20, 24, CX + 20, 24)
      break
    case 'scar':
      c.strokeStyle = '#b06a58'
      c.lineWidth = 1.4
      seg(c, CX + 6, 31, CX + 9.5, 42)
      break
    case 'cinnabarMark':
      c.fillStyle = '#c0392b'
      c.beginPath()
      c.arc(CX, 25.5, 2.2, 0, Math.PI * 2)
      c.fill()
      break
    case 'veil':
      c.fillStyle = 'rgba(210,200,235,0.55)'
      c.beginPath()
      c.moveTo(CX - 16, 34)
      c.quadraticCurveTo(CX, 44, CX + 16, 34)
      c.lineTo(CX + 16, 62)
      c.quadraticCurveTo(CX, 70, CX - 16, 62)
      c.closePath()
      c.fill()
      c.strokeStyle = 'rgba(255,255,255,0.5)'
      c.lineWidth = 1
      seg(c, CX - 15, 40, CX + 15, 40)
      break
    case 'seams':
      c.strokeStyle = 'rgba(60,56,52,0.8)'
      c.lineWidth = 1.2
      seg(c, CX - 14, 38, CX - 4, 40)
      seg(c, CX + 4, 40, CX + 14, 38)
      seg(c, CX, 22, CX, 30)
      break
    case 'earrings':
      c.fillStyle = '#ffd97a'
      c.beginPath()
      c.arc(CX - 15, 46, 1.8, 0, Math.PI * 2)
      c.arc(CX + 15, 46, 1.8, 0, Math.PI * 2)
      c.fill()
      break
    case 'swordHilt':
      c.strokeStyle = '#6a4c2c'
      c.lineWidth = 4
      seg(c, CX + 22, 60, CX + 30, 44)
      c.strokeStyle = '#c9a44a'
      c.lineWidth = 2.4
      seg(c, CX + 19.5, 57, CX + 25, 51.5)
      c.fillStyle = '#b04a3a'
      c.beginPath()
      c.arc(CX + 31, 42, 2, 0, Math.PI * 2)
      c.fill()
      break
  }
}

function seg(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  c.beginPath()
  c.moveTo(x1, y1)
  c.lineTo(x2, y2)
  c.stroke()
}

function shade(hex: string, amt: number): string {
  if (!hex.startsWith('#') || hex.length < 7) return hex
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.max(0, Math.min(255, v + amt))
  const r = ch((n >> 16) & 255)
  const g = ch((n >> 8) & 255)
  const b = ch(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function frameVignette(c: CanvasRenderingContext2D): void {
  const g = c.createRadialGradient(CX, SIZE / 2, 30, CX, SIZE / 2, 66)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.36)')
  c.fillStyle = g
  c.fillRect(0, 0, SIZE, SIZE)
}
