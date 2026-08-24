// 打包 itch.io HTML5 上传包：dist/ → release/xiuxian-rpg-itch.zip
// 用法：npm run build && npm run pack:itch
import { zipSync, strToU8 } from 'fflate'
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

function walk(dir: string, base = dir): Array<[string, Uint8Array]> {
  const out: Array<[string, Uint8Array]> = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p, base))
    else out.push([relative(base, p).split('\\').join('/'), new Uint8Array(readFileSync(p))])
  }
  return out
}

const dist = 'dist'
const files = walk(dist)
// itch.io HTML5：入口必须叫 index.html（已是），可选 .itch.toml
const zip = zipSync(Object.fromEntries(files), { level: 9 })
mkdirSync('release', { recursive: true })
const out = 'release/xiuxian-rpg-itch.zip'
writeFileSync(out, zip)
const kb = Math.round(zip.length / 1024)
console.log(`✓ ${out} (${kb} KB, ${files.length} files) — 上传至 itch.io → View page → Edit game → HTML5 upload`)
