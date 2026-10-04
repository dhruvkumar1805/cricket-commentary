import type { CelebrationKind } from '../types'

/**
 * The stadium big screen: a pixel canvas drawn into a terminal Raster with
 * half blocks (each cell is two pixels stacked: ▀ painted fg over bg), so a
 * band of R rows is a 2R pixel tall screen animated by $.ui.blit.
 */

export const SCREEN_ROWS = 10

const FONT: Record<string, readonly string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  '0': ['01110', '10011', '10101', '10101', '10101', '11001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
}

export const DURATION_MS: Record<CelebrationKind, number> = {
  six: 3400,
  four: 2300,
  wicket: 2800,
  fifty: 3200,
  century: 4200,
  hattrick: 3600,
  noball: 2300,
}

export const BANNER: Record<CelebrationKind, string> = {
  six: 'SIX!',
  four: 'FOUR!',
  wicket: 'OUT!',
  fifty: 'FIFTY!',
  century: '100!',
  hattrick: 'HAT-TRICK!',
  noball: 'NO BALL!',
}

type RGB = readonly [number, number, number]

const hex = (n: number): RGB => [(n >> 16) & 255, (n >> 8) & 255, n & 255]
const pack = ([r, g, b]: RGB): number => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

function hsl(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}

const THEME: Record<CelebrationKind, { text: RGB; glow: RGB; top: RGB; bottom: RGB }> = {
  six: { text: hex(0xffd23f), glow: hex(0xffffff), top: hex(0x12002b), bottom: hex(0x3a0a6b) },
  four: { text: hex(0x4fc3f7), glow: hex(0xe1f5fe), top: hex(0x001326), bottom: hex(0x00306b) },
  wicket: { text: hex(0xffffff), glow: hex(0xffcdd2), top: hex(0x2b0000), bottom: hex(0x6b0a0a) },
  fifty: { text: hex(0xffe082), glow: hex(0xffffff), top: hex(0x1a1200), bottom: hex(0x4a3500) },
  century: { text: hex(0xffd700), glow: hex(0xffffff), top: hex(0x1a1000), bottom: hex(0x5c3d00) },
  hattrick: { text: hex(0xff4081), glow: hex(0xffffff), top: hex(0x1f0016), bottom: hex(0x5a0040) },
  noball: { text: hex(0xffa726), glow: hex(0xfff3e0), top: hex(0x1f1000), bottom: hex(0x4d2600) },
}

class Canvas {
  readonly px: Float64Array
  readonly width: number
  readonly height: number
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.px = new Float64Array(width * height * 3)
  }
  set(x: number, y: number, c: RGB, alpha = 1) {
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) return
    const i = (yi * this.width + xi) * 3
    const a = clamp01(alpha)
    this.px[i] = this.px[i]! + (c[0] - this.px[i]!) * a
    this.px[i + 1] = this.px[i + 1]! + (c[1] - this.px[i + 1]!) * a
    this.px[i + 2] = this.px[i + 2]! + (c[2] - this.px[i + 2]!) * a
  }
  get(x: number, y: number): RGB {
    const i = (y * this.width + x) * 3
    return [this.px[i]!, this.px[i + 1]!, this.px[i + 2]!]
  }
}

function textWidth(text: string, sx: number): number {
  return text.length * 6 * sx - sx
}

function drawText(cv: Canvas, text: string, x0: number, y0: number, sx: number, sy: number, color: (x: number, y: number) => RGB) {
  let x = x0
  for (const ch of text) {
    const glyph = FONT[ch] ?? FONT[' ']!
    for (let gy = 0; gy < 7; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        if (glyph[gy]![gx] !== '1') continue
        for (let dy = 0; dy < sy; dy++) {
          for (let dx = 0; dx < sx; dx++) {
            const px = x + gx * sx + dx
            const py = y0 + gy * sy + dy
            cv.set(px, py, color(px, py))
          }
        }
      }
    }
    x += 6 * sx
  }
}

function drawShadowText(cv: Canvas, text: string, x0: number, y0: number, sx: number, sy: number) {
  drawText(cv, text, x0 + 1, y0 + 1, sx, sy, () => [0, 0, 0])
}

type Burst = { t0: number; x: number; y: number; hue: number; count: number; speed: number }

function fireworks(cv: Canvas, bursts: readonly Burst[], t: number, seed: number) {
  for (const [i, b] of bursts.entries()) {
    const age = t - b.t0
    if (age < 0 || age > 1.4) continue
    const r = rng(seed * 31 + i * 7919)
    for (let j = 0; j < b.count; j++) {
      const angle = (j / b.count) * Math.PI * 2 + r() * 0.3
      const v = b.speed * (0.6 + r() * 0.6)
      const x = b.x + Math.cos(angle) * v * age * 2.2
      const y = b.y + Math.sin(angle) * v * age + 9 * age * age
      const fade = 1 - age / 1.4
      const c = hsl((b.hue + r() * 40) % 360, 1, 0.55 + 0.35 * fade)
      cv.set(x, y, c, fade)
      if (age < 0.9) cv.set(x - Math.cos(angle) * 1.5, y - Math.sin(angle) * 0.8, c, fade * 0.35)
    }
    if (age < 0.12) cv.set(b.x, b.y, [255, 255, 255])
  }
}

function confetti(cv: Canvas, t: number, seed: number, amount: number) {
  const r = rng(seed * 13 + 5)
  for (let i = 0; i < amount; i++) {
    const x0 = r() * cv.width
    const speed = 5 + r() * 9
    const start = r() * 1.6
    const y = ((t - start) * speed) % (cv.height + 6)
    if (t < start) continue
    const sway = Math.sin(t * 4 + i) * 1.5
    cv.set(x0 + sway, y - 3, hsl((i * 47) % 360, 0.95, 0.6))
  }
}

function floodlights(cv: Canvas, t: number, seed: number) {
  const r = rng(seed + 99)
  for (let x = 1; x < cv.width; x += 3) {
    const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * (2 + r() * 4) + r() * 6))
    cv.set(x, 0, [255, 250, 220], twinkle * 0.8)
  }
}

function stumpsAndBails(cv: Canvas, t: number, x: number, seed: number) {
  const base = cv.height - 2
  const tall = Math.min(12, cv.height - 4)
  const wood: RGB = [242, 222, 172]
  const shade: RGB = [190, 160, 110]
  // the middle stump is sent cartwheeling back, the outer two stay planted
  for (let s = 0; s < 3; s++) {
    const isHit = s === 1 && t > 0.04
    const lean = isHit ? Math.min(1, (t - 0.04) * 4) * 5 : 0
    for (let h = 0; h < tall; h++) {
      const px = x + s * 3 + (lean * h) / tall
      cv.set(px, base - h, wood)
      cv.set(px + 1, base - h, shade)
    }
  }
  for (let gx = -1; gx < 10; gx++) cv.set(x + gx, base + 1, [60, 120, 60])
  const r = rng(seed + 3)
  const pieces = 16
  for (let i = 0; i < pieces; i++) {
    const age = t - 0.04
    if (age < 0) {
      if (i < 2) cv.set(x + 1 + i * 3, base - tall, [255, 255, 255])
      continue
    }
    const vx = (r() - 0.35) * 34
    const vy = -14 - r() * 14
    const bx = x + 4 + vx * age
    const by = base - tall + vy * age + 30 * age * age
    const isBail = i < 2
    cv.set(bx, by, isBail ? [255, 255, 255] : wood, clamp01(1.8 - age))
    if (isBail) cv.set(bx + 1, by, [255, 255, 255], clamp01(1.8 - age))
  }
}

function ballStreak(cv: Canvas, t: number, duration: number) {
  const p = clamp01(t / (duration * 0.55))
  const ease = 1 - (1 - p) ** 3
  const x = ease * (cv.width + 6) - 3
  const y = cv.height - 3 - Math.sin(p * Math.PI) * 2
  for (let k = 0; k < 14; k++) cv.set(x - k, y + k * 0.05, [255, 255 - k * 12, 255 - k * 18], 1 - k / 14)
  cv.set(x, y, [230, 30, 30])
  cv.set(x + 1, y, [255, 80, 80])
  if (p >= 1) {
    const flash = clamp01(1 - (t - duration * 0.55) * 2)
    for (let xx = 0; xx < cv.width; xx++) cv.set(xx, cv.height - 1, [255, 255, 255], flash)
  }
}

function warningStripes(cv: Canvas, t: number) {
  for (let x = 0; x < cv.width; x++) {
    const on = Math.floor((x + t * 20) / 3) % 2 === 0
    if (on) {
      cv.set(x, 0, [255, 167, 38])
      cv.set(x, cv.height - 1, [255, 167, 38])
    }
  }
}

/** Paints one frame of a celebration at `ms` into a pixel canvas. */
export function paint(kind: CelebrationKind, ms: number, width: number, seed: number, rows = SCREEN_ROWS): Canvas {
  const text = BANNER[kind]
  const height = rows * 2
  const cv = new Canvas(width, height)
  const theme = THEME[kind]
  const t = ms / 1000
  const duration = DURATION_MS[kind] / 1000

  for (let y = 0; y < height; y++) {
    const row = mixRGB(theme.top, theme.bottom, y / (height - 1))
    for (let x = 0; x < width; x++) cv.set(x, y, row)
  }
  if (kind === 'wicket' && t < 0.7 && Math.floor(t * 8) % 2 === 0) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) cv.set(x, y, [200, 20, 20], 0.55)
  }
  floodlights(cv, t, seed)

  const r = rng(seed)
  if (kind === 'six' || kind === 'century' || kind === 'hattrick' || kind === 'fifty') {
    const count = kind === 'century' ? 9 : kind === 'six' ? 7 : 5
    const bursts: Burst[] = Array.from({ length: count }, (_, i) => ({
      t0: 0.05 + (i * (duration * 0.7)) / count + r() * 0.15,
      x: i % 2 === 0 ? r() * width * 0.22 + 6 : width - r() * width * 0.22 - 6,
      y: 4 + r() * (height * 0.35),
      hue: r() * 360,
      count: 30 + Math.floor(r() * 14),
      speed: 5 + r() * 4,
    }))
    fireworks(cv, bursts, t, seed)
  }
  if (kind === 'century' || kind === 'fifty') confetti(cv, t, seed, Math.floor(width * (kind === 'century' ? 0.9 : 0.5)))
  if (kind === 'four') ballStreak(cv, t, duration)
  if (kind === 'noball') warningStripes(cv, t)

  // a short screen (a cramped band) draws the banner at single height
  const sy = height >= 16 ? 2 : 1
  const sx = sy === 2 && textWidth(text, 2) <= width - 4 ? 2 : 1
  const tw = textWidth(text, sx)
  const pop = clamp01(t / 0.32)
  const bounce = Math.round((1 - pop) * -10 + Math.sin(pop * Math.PI) * -1.5)
  const x0 = Math.floor((width - tw) / 2)
  const y0 = Math.floor((height - 7 * sy) / 2) + bounce
  const sweep = ((t * 1.4) % 1.6) * (tw + 20) - 10
  const textColor = (x: number, y: number): RGB => {
    const d = Math.abs(x - x0 - sweep - (y - y0) * 0.6)
    const shine = clamp01(1 - d / 5)
    const base = kind === 'six' || kind === 'century' ? mixRGB(theme.text, hsl((x * 4 + t * 240) % 360, 1, 0.62), kind === 'six' ? 0.25 : 0.1) : theme.text
    return mixRGB(base, theme.glow, shine * 0.85)
  }
  drawShadowText(cv, text, x0, y0, sx, sy)
  drawText(cv, text, x0, y0, sx, sy, textColor)

  if (kind === 'wicket' || kind === 'hattrick') {
    stumpsAndBails(cv, t, 4, seed)
    stumpsAndBails(cv, t, width - 13, seed + 1)
  }

  const fadeOut = clamp01((duration - t) / 0.35)
  if (fadeOut < 1) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = cv.get(x, y)
        const i = (y * width + x) * 3
        cv.px[i] = c[0] * fadeOut
        cv.px[i + 1] = c[1] * fadeOut
        cv.px[i + 2] = c[2] * fadeOut
      }
    }
  }
  return cv
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function toBase64(bytes: Uint8Array): string {
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + B64[n & 63]!
  }
  const rest = bytes.length - i
  if (rest === 1) {
    const n = bytes[i]! << 16
    out += `${B64[(n >> 18) & 63]}${B64[(n >> 12) & 63]}==`
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8)
    out += `${B64[(n >> 18) & 63]}${B64[(n >> 12) & 63]}${B64[(n >> 6) & 63]}=`
  }
  return out
}

const UPPER_HALF = 0x2580

/** Packs a canvas into Raster cells: one ▀ per cell, top pixel fg, bottom bg. */
export function cells(cv: Canvas): string {
  const rows = cv.height / 2
  const words = new Uint32Array(cv.width * rows * 3)
  let k = 0
  for (let row = 0; row < rows; row++) {
    for (let x = 0; x < cv.width; x++) {
      words[k++] = UPPER_HALF
      words[k++] = pack(cv.get(x, row * 2))
      words[k++] = pack(cv.get(x, row * 2 + 1))
    }
  }
  return toBase64(new Uint8Array(words.buffer))
}

export function frame(kind: CelebrationKind, ms: number, width: number, seed: number, rows = SCREEN_ROWS): string {
  return cells(paint(kind, ms, width, seed, rows))
}

/** Screen rows that fit a band of `maxRows`, leaving room for the scorebug and the call; 0 when too cramped. */
export function screenRowsFor(maxRows: number): number {
  // one spare row: the band's height moves as the spinner and tips come and go
  const room = Math.min(SCREEN_ROWS, maxRows - 3)
  return room >= 4 ? room : 0
}
