import type { Ball, Batter, Innings, MomentKind } from '../types'

export type Outcome = 'ok' | 'error' | 'denied' | 'interrupted'

export type Delivery = {
  tool: string
  input: Record<string, unknown>
  outcome: Outcome
  text?: string
}

const TEST = /\b(jest|vitest|pytest|mocha|playwright|cypress|rspec|phpunit|ctest|unittest)\b|\b(npm|pnpm|yarn|bun|deno|cargo|go|mix|dotnet|swift|gradle|mvn|make|rake)\s+(run\s+)?test\b|\bnode\s+--test\b/
const BUILD = /\b(tsc|typecheck|type-check|webpack|esbuild|rollup|compile)\b|\b(npm|pnpm|yarn|bun|cargo|go|next|vite|swift|gradle|mvn|make)\s+(run\s+)?build\b|^\s*make\b/
const LINT = /\b(eslint|prettier|biome|ruff|clippy|flake8|rubocop|stylelint)\b|\b(npm|pnpm|yarn|bun)\s+(run\s+)?lint\b/
const INSTALL = /\b(npm|pnpm|yarn|bun)\s+(i|install|add|ci)\b|\bpip3?\s+install\b|\bbrew\s+install\b|\bcargo\s+add\b|\buv\s+(add|pip\s+install)\b/
const PUSH = /\bgit\s+push\b/
const COMMIT = /\bgit\s+commit\b/
const DANGER = /\brm\s+-[a-zA-Z]*(rf|fr)\b|\brm\s+-[a-zA-Z]*r[a-zA-Z]*\s+-[a-zA-Z]*f|\bgit\s+reset\s+--hard\b|\bgit\s+push\b.*(--force\b|\s-f\b)|\bdrop\s+(table|database)\b|\bsudo\s/i
const LOOK = /^\s*(grep|rg|find|ls|cat|head|tail|wc|which|pwd|echo|tree|file|stat|less|git\s+(status|log|diff|show|branch))\b/
const NOT_FOUND = /command not found|No such file or directory|not recognized as/i
const TIMEOUT = /timed out|timeout/i

const READERS = new Set(['Read', 'Glob', 'Grep', 'LS', 'NotebookRead', 'ToolSearch', 'TaskList', 'TaskGet', 'TaskOutput'])
const SINGLES = new Set(['WebSearch', 'WebFetch'])

export function shorten(text: string, max = 46): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

function basename(path: unknown): string {
  return typeof path === 'string' ? path.split('/').filter(Boolean).pop() ?? path : 'a file'
}

function lines(value: unknown): number {
  return typeof value === 'string' ? value.split('\n').length : 0
}

function countFrom(text: string | undefined, pattern: RegExp): number | undefined {
  const match = text?.match(pattern)
  return match ? Number(match[1]) : undefined
}

export function testCounts(text: string | undefined): { passed?: number; failed?: number } {
  // jest/vitest/pytest say "42 passed", node --test and TAP say "pass 42"
  const passed = countFrom(text, /(\d+)\s+(?:tests?\s+)?pass(?:ed|ing)?/i) ?? countFrom(text, /^\W*pass\s+(\d+)/im)
  const failed = countFrom(text, /(\d+)\s+(?:tests?\s+)?fail(?:ed|ing|ures?)?/i) ?? countFrom(text, /^\W*fail\s+(\d+)/im)
  return { passed, failed }
}

// what failing runs print even when `| tail` has cut the summary off
const FAILURE_MARKS = /AssertionError|✖ failing tests|^not ok \d+|^\s*(FAIL|✕)\s|^\s*● .+ › |\bTests:\s+\d+ failed|=+ FAILURES =+|^FAILED /m

export function hasFailures(text: string | undefined): boolean {
  const { failed } = testCounts(text)
  return failed !== undefined ? failed > 0 : FAILURE_MARKS.test(text ?? '')
}

export function testSummary(text: string | undefined): string {
  const { passed, failed } = testCounts(text)
  if (failed) return `${failed} failing`
  if (failed === undefined && FAILURE_MARKS.test(text ?? '')) return 'failing'
  if (passed) return `${passed} passing`
  return ''
}

const SCORING = [DANGER, PUSH, TEST, BUILD, LINT, COMMIT, INSTALL]

/**
 * The command a commentator would name: the step of a pipeline or chain that
 * matters (`npm test`, not `cd x && npm test 2>&1 | grep pass`), redirects gone.
 */
export function coreCommand(command: string): string {
  const steps = command
    .split(/\s*(?:&&|\|\||;|\|)\s*/)
    .map(step => step.replace(/\s*\d?>>?&?\s*\S+/g, '').replace(/\s+/g, ' ').trim())
    .filter(step => step !== '' && !/^cd\s/.test(step))
  for (const pattern of SCORING) {
    const step = steps.find(one => pattern.test(one))
    if (step !== undefined) return step
  }
  return steps[0] ?? command.trim()
}

function ball(kind: Ball['kind'], runs: number, batter: string, detail: string, how?: string): Ball {
  return how === undefined ? { kind, runs, batter, detail } : { kind, runs, batter, detail, how }
}

function scoreBash(d: Delivery): Ball {
  const full = typeof d.input.command === 'string' ? d.input.command : ''
  const command = coreCommand(full)
  const detail = shorten(command, 40)
  const isOk = d.outcome === 'ok'

  if (d.outcome === 'interrupted') return ball('dot', 0, 'Bash', detail, 'rain stopped play')
  if (DANGER.test(full)) {
    return isOk ? ball('noball', 1, 'Bash', detail) : ball('wicket', 0, 'Bash', detail, 'hit wicket, dangerous shot')
  }
  if (PUSH.test(command)) {
    // a pipe can hide git's exit code, its words cannot
    const isRejected = /\[rejected\]|\[remote rejected\]|failed to push|fatal:/i.test(d.text ?? '')
    return isOk && !isRejected
      ? ball('six', 6, 'Bash', detail)
      : ball('wicket', 0, 'Bash', detail, 'caught on the boundary, push rejected')
  }
  if (TEST.test(command) && !LOOK.test(command)) {
    const summary = testSummary(d.text)
    const named = summary ? `${detail} (${summary})` : detail
    // a pipe into grep or tail exits 0 even when tests fail: trust the counts
    const isGreen = isOk && !hasFailures(d.text)
    return isGreen ? ball('six', 6, 'Bash', named) : ball('wicket', 0, 'Bash', named, 'bowled, tests failing')
  }
  if (BUILD.test(command)) {
    const isBroken = /error TS\d+|npm ERR!|ELIFECYCLE|Build failed|Failed to compile/i.test(d.text ?? '')
    return isOk && !isBroken
      ? ball('four', 4, 'Bash', detail)
      : ball('wicket', 0, 'Bash', detail, 'caught behind, build broken')
  }
  if (LINT.test(command)) {
    return isOk ? ball('four', 4, 'Bash', detail) : ball('wicket', 0, 'Bash', detail, 'lbw, the linter appealed')
  }
  if (COMMIT.test(command)) {
    return isOk ? ball('four', 4, 'Bash', detail) : ball('dot', 0, 'Bash', detail)
  }
  if (INSTALL.test(command)) {
    return isOk ? ball('run', 2, 'Bash', detail) : ball('wicket', 0, 'Bash', detail, 'run out, install failed')
  }
  if (LOOK.test(command)) return ball('dot', 0, 'Bash', detail)
  if (isOk) return ball('run', (d.text?.length ?? 0) > 2000 ? 2 : 1, 'Bash', detail)
  if (NOT_FOUND.test(d.text ?? '')) return ball('wicket', 0, 'Bash', detail, 'stumped, command not found')
  if (TIMEOUT.test(d.text ?? '')) return ball('wicket', 0, 'Bash', detail, 'retired hurt, timed out')

  return ball('wicket', 0, 'Bash', detail, 'run out, command failed')
}

/** One tool call is one delivery: what it scored, who faced it, and how. */
export function scoreDelivery(d: Delivery): Ball {
  const tool = d.tool.startsWith('mcp__') ? d.tool.split('__')[1] ?? d.tool : d.tool

  if (d.outcome === 'denied') return ball('wide', 1, tool, 'permission declined')
  if (d.tool === 'Bash') return scoreBash(d)
  if (d.outcome === 'interrupted') return ball('dot', 0, tool, 'interrupted')

  if (d.tool === 'Write') {
    const file = basename(d.input.file_path)
    if (d.outcome !== 'ok') return ball('dot', 0, 'Write', file)
    return lines(d.input.content) >= 80 ? ball('six', 6, 'Write', file) : ball('four', 4, 'Write', file)
  }
  if (d.tool === 'Edit' || d.tool === 'MultiEdit' || d.tool === 'NotebookEdit') {
    const file = basename(d.input.file_path ?? d.input.notebook_path)
    if (d.outcome !== 'ok') return ball('dot', 0, 'Edit', `${file}, played and missed`)
    const size = lines(d.input.new_string) + lines(d.input.new_source)
    const total = Array.isArray(d.input.edits) ? Math.max(size, d.input.edits.length * 4) : size
    return total > 60 ? ball('four', 4, 'Edit', file) : ball('run', total > 20 ? 3 : total > 3 ? 2 : 1, 'Edit', file)
  }
  if (READERS.has(d.tool)) {
    const target = d.input.file_path ?? d.input.pattern ?? d.input.path ?? ''
    return ball('dot', 0, d.tool, typeof target === 'string' ? shorten(basename(target) || target, 30) : '')
  }
  if (SINGLES.has(d.tool)) {
    const what = d.input.query ?? d.input.url ?? ''
    return d.outcome === 'ok' ? ball('run', 1, d.tool, shorten(String(what), 34)) : ball('dot', 0, d.tool, '')
  }
  if (d.tool === 'Agent' || d.tool === 'Task') {
    const what = d.input.description ?? d.input.subagent_type ?? 'a subagent'
    return d.outcome === 'ok' ? ball('run', 2, 'Agent', shorten(String(what), 34)) : ball('dot', 0, 'Agent', '')
  }

  return d.outcome === 'ok' ? ball('run', 1, tool, '') : ball('dot', 0, tool, '')
}

export function isLegal(b: Ball): boolean {
  return b.kind !== 'wide' && b.kind !== 'noball'
}

export function legalBalls(over: readonly Ball[]): number {
  return over.filter(isLegal).length
}

export function oversText(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`
}

export function runRate(runs: number, balls: number): string {
  return balls === 0 ? '0.00' : ((runs * 6) / balls).toFixed(2)
}

export function newInnings(number: number, task: string, startedAt: number): Innings {
  return {
    number,
    task,
    runs: 0,
    wickets: 0,
    balls: 0,
    extras: 0,
    thisOver: [],
    overs: [],
    batters: {},
    fallOfWickets: [],
    milestones: [],
    wicketStreak: 0,
    isLive: true,
    startedAt,
  }
}

const MILESTONES = [50, 100, 150, 200, 250, 300, 400, 500]

/** Adds one delivery to the innings and names the moments it made. */
export function bowl(innings: Innings, b: Ball): { innings: Innings; moments: MomentKind[] } {
  const moments: MomentKind[] = []
  const overs = [...innings.overs]
  let thisOver = innings.thisOver
  if (legalBalls(thisOver) >= 6) {
    overs.push(thisOver)
    thisOver = []
  }

  const before = innings.runs
  const legal = isLegal(b)
  const old: Batter = innings.batters[b.batter] ?? { name: b.batter, runs: 0, balls: 0, fours: 0, sixes: 0 }
  const batter: Batter = {
    ...old,
    runs: old.runs + (legal ? b.runs : 0),
    balls: old.balls + (b.kind === 'wide' ? 0 : 1),
    fours: old.fours + (b.kind === 'four' ? 1 : 0),
    sixes: old.sixes + (b.kind === 'six' ? 1 : 0),
  }
  if (b.kind === 'wicket' && b.how !== undefined) batter.out = b.how

  let wickets = innings.wickets + (b.kind === 'wicket' ? 1 : 0)
  const runs = innings.runs + b.runs
  const wicketStreak = b.kind === 'wicket' ? innings.wicketStreak + 1 : isLegal(b) ? 0 : innings.wicketStreak
  const fallOfWickets =
    b.kind === 'wicket'
      ? [...innings.fallOfWickets, { score: runs, wicket: wickets, batter: b.batter, how: b.how ?? 'out', detail: b.detail }]
      : innings.fallOfWickets

  if (b.kind === 'six' || b.kind === 'four' || b.kind === 'wicket' || b.kind === 'noball' || b.kind === 'wide') {
    moments.push(b.kind)
  }
  if (wicketStreak === 3) moments.push('hattrick')
  if (wickets >= 10) {
    moments.push('allout')
    wickets = 0
  }

  const milestones = [...innings.milestones]
  for (const mark of MILESTONES) {
    if (before < mark && runs >= mark && !milestones.includes(mark)) {
      milestones.push(mark)
      moments.push(mark % 100 === 0 ? 'century' : 'fifty')
    }
  }

  thisOver = [...thisOver, b]
  const balls = innings.balls + (legal ? 1 : 0)
  if (legal && legalBalls(thisOver) === 6 && thisOver.every(one => one.runs === 0 && one.kind !== 'wicket')) {
    moments.push('maiden')
  }

  return {
    innings: {
      ...innings,
      runs,
      wickets,
      balls,
      extras: innings.extras + (legal ? 0 : b.runs),
      thisOver,
      overs,
      batters: { ...innings.batters, [b.batter]: batter },
      fallOfWickets,
      milestones,
      wicketStreak,
    },
    moments,
  }
}

/** The batter with the most runs, then the best strike rate. */
export function playerOfTheMatch(innings: Innings): Batter | undefined {
  return Object.values(innings.batters)
    .filter(one => one.runs > 0)
    .sort((a, b) => b.runs - a.runs || b.runs / Math.max(1, b.balls) - a.runs / Math.max(1, a.balls))[0]
}

export function scoreText(innings: Innings): string {
  return `${innings.runs}/${innings.wickets}`
}
