// 生成 40x40 Tab 图标 PNG（线性图标风格）
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const SIZE = 40
const OUT = path.join(__dirname, '..', 'src', 'static', 'tab')

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function createChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeB = Buffer.from(type, 'ascii')
  const crcInput = Buffer.concat([typeB, data])
  const crcVal = Buffer.alloc(4)
  crcVal.writeUInt32BE(crc32(crcInput))
  return Buffer.concat([len, typeB, data, crcVal])
}

function makePNG(pixels) {
  // pixels: 40 rows of 40 RGBA quads (R,G,B,A each 0-255)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(SIZE, 0)  // width
  ihdrData.writeUInt32BE(SIZE, 4)  // height
  ihdrData[8] = 8   // bit depth
  ihdrData[9] = 6   // color type (RGBA)
  ihdrData[10] = 0  // compression
  ihdrData[11] = 0  // filter
  ihdrData[12] = 0  // interlace

  // Build raw image data with filter byte per row
  const rawRows = []
  for (let y = 0; y < SIZE; y++) {
    const row = Buffer.alloc(1 + SIZE * 4)
    row[0] = 0 // no filter
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 4
      row[1 + x * 4] = pixels[idx]       // R
      row[1 + x * 4 + 1] = pixels[idx + 1] // G
      row[1 + x * 4 + 2] = pixels[idx + 2] // B
      row[1 + x * 4 + 3] = pixels[idx + 3] // A
    }
    rawRows.push(row)
  }
  const raw = Buffer.concat(rawRows)
  const compressed = zlib.deflateSync(raw)

  const ihdr = createChunk('IHDR', ihdrData)
  const idat = createChunk('IDAT', compressed)
  const iend = createChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdr, idat, iend])
}

function createPixels(size, color) {
  const pixels = Buffer.alloc(size * size * 4)
  // all transparent initially
  for (let i = 0; i < pixels.length; i += 4) pixels[i + 3] = 0
  return pixels
}

function drawLine(pixels, x1, y1, x2, y2, r, g, b, a = 255) {
  const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1)
  const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1
  let err = dx - dy
  let x = x1, y = y1
  while (true) {
    if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
      const idx = (y * SIZE + x) * 4
      pixels[idx] = r; pixels[idx + 1] = g; pixels[idx + 2] = b; pixels[idx + 3] = a
    }
    if (x === x2 && y === y2) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x += sx }
    if (e2 < dx) { err += dx; y += sy }
  }
}

function drawThickLine(pixels, x1, y1, x2, y2, r, g, b, thickness = 2) {
  for (let t = -Math.floor(thickness / 2); t < Math.ceil(thickness / 2); t++) {
    const offX = Math.round(t * (y2 - y1) / Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2))
    const offY = Math.round(-t * (x2 - x1) / Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2))
    drawLine(pixels, x1 + offX, y1 + offY, x2 + offX, y2 + offY, r, g, b)
  }
}

function drawCircle(pixels, cx, cy, radius, r, g, b, thickness = 2) {
  for (let t = 0; t < 360; t += 2) {
    const rad = (t * Math.PI) / 180
    for (let th = 0; th < thickness; th++) {
      const rr = radius - th
      const x = Math.round(cx + rr * Math.cos(rad))
      const y = Math.round(cy + rr * Math.sin(rad))
      if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
        const idx = (y * SIZE + x) * 4
        pixels[idx] = r; pixels[idx + 1] = g; pixels[idx + 2] = b; pixels[idx + 3] = 255
      }
    }
  }
}

function drawFilledCircle(pixels, cx, cy, radius, r, g, b, a = 255) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) {
        if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
          const idx = (y * SIZE + x) * 4
          pixels[idx] = r; pixels[idx + 1] = g; pixels[idx + 2] = b; pixels[idx + 3] = a
        }
      }
    }
  }
}

function parseColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

// ── Icons ──

function iconProfile(colorHex) {
  const [r, g, b] = parseColor(colorHex)
  const p = createPixels(SIZE)
  // head circle
  drawCircle(p, 20, 12, 7, r, g, b, 2)
  // body arc
  drawThickLine(p, 10, 30, 15, 21, r, g, b, 2)
  drawThickLine(p, 30, 30, 25, 21, r, g, b, 2)
  drawThickLine(p, 10, 30, 30, 30, r, g, b, 2)
  return p
}

function iconRecord(colorHex) {
  const [r, g, b] = parseColor(colorHex)
  const p = createPixels(SIZE)
  // notepad outline
  drawThickLine(p, 10, 6, 28, 6, r, g, b, 2)
  drawThickLine(p, 10, 6, 10, 34, r, g, b, 2)
  drawThickLine(p, 28, 6, 28, 22, r, g, b, 2)
  drawThickLine(p, 10, 34, 28, 34, r, g, b, 2)
  // page lines
  drawThickLine(p, 10, 22, 28, 22, r, g, b, 1.5)
  drawThickLine(p, 14, 14, 24, 14, r, g, b, 1.5)
  drawThickLine(p, 14, 18, 24, 18, r, g, b, 1.5)
  drawThickLine(p, 14, 26, 22, 26, r, g, b, 1.5)
  drawThickLine(p, 14, 30, 20, 30, r, g, b, 1.5)
  // folded corner
  drawThickLine(p, 22, 22, 28, 22, r, g, b, 1.5)
  drawThickLine(p, 28, 22, 28, 28, r, g, b, 1.5)
  drawThickLine(p, 22, 22, 28, 28, r, g, b, 1.5)
  return p
}

function iconRecipe(colorHex) {
  const [r, g, b] = parseColor(colorHex)
  const p = createPixels(SIZE)
  // book spine
  drawThickLine(p, 20, 6, 20, 34, r, g, b, 2)
  // left page
  drawThickLine(p, 9, 6, 20, 6, r, g, b, 2)
  drawThickLine(p, 9, 6, 9, 34, r, g, b, 2)
  drawThickLine(p, 9, 34, 20, 34, r, g, b, 2)
  // right page
  drawThickLine(p, 20, 8, 31, 8, r, g, b, 2)
  drawThickLine(p, 31, 8, 31, 32, r, g, b, 2)
  drawThickLine(p, 20, 32, 31, 32, r, g, b, 2)
  // page lines left
  drawThickLine(p, 12, 12, 17, 12, r, g, b, 1.5)
  drawThickLine(p, 12, 16, 17, 16, r, g, b, 1.5)
  drawThickLine(p, 12, 20, 17, 20, r, g, b, 1.5)
  // page lines right
  drawThickLine(p, 23, 14, 28, 14, r, g, b, 1.5)
  drawThickLine(p, 23, 18, 28, 18, r, g, b, 1.5)
  return p
}

// Generate
const icons = [
  { name: 'profile', fn: iconProfile },
  { name: 'record', fn: iconRecord },
  { name: 'recipe', fn: iconRecipe },
]

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

for (const { name, fn } of icons) {
  // inactive: #999999
  const inactive = fn('#999999')
  fs.writeFileSync(path.join(OUT, `${name}.png`), makePNG(inactive))
  console.log(`  ${name}.png`)

  // active: #07C160
  const active = fn('#07C160')
  fs.writeFileSync(path.join(OUT, `${name}-active.png`), makePNG(active))
  console.log(`  ${name}-active.png`)
}

console.log('\nDone — 6 icons generated.')
