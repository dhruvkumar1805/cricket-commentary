import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Ball, Career, Celebration, CelebrationKind, Innings, Language, Moment, MomentKind, Settings } from '../types'
import { BANNER, DURATION_MS, frame, screenRowsFor } from './jumbotron'
import { cannedLine, cleanLine, commentaryRequest, headline } from './lines'
import type { LineContext } from './lines'
import { bowl, newInnings, oversText, playerOfTheMatch, runRate, scoreDelivery, scoreText, shorten } from './scoring'
import type { Delivery, Outcome } from './scoring'

const DEFAULT_SETTINGS: Settings = { isVoiceOn: true, isCrowdOn: true, isHidden: false, isPaused: false, language: 'english' }
const EMPTY_CAREER: Career = { innings: 0, runs: 0, sixes: 0, fours: 0, wickets: 0, fifties: 0, centuries: 0, best: 0 }
const VOICE: Record<Language, string> = { english: 'Aman', hinglish: 'Lekha' }

const inningsAtom = atom({ plugin: 'cricket-commentary', key: 'innings' } as const, null)
const momentAtom = atom({ plugin: 'cricket-commentary', key: 'moment' } as const, null)
const settingsAtom = atom({ plugin: 'cricket-commentary', key: 'settings' } as const, DEFAULT_SETTINGS)
const celebrationAtom = atom({ plugin: 'cricket-commentary', key: 'celebration' } as const, null)

/** Highest first: the one moment a ball is remembered for. */
const PRIORITY: readonly MomentKind[] = ['century', 'fifty', 'hattrick', 'allout', 'six', 'wicket', 'four', 'noball', 'wide', 'maiden']
const CELEBRATES: Partial<Record<MomentKind, CelebrationKind>> = {
  century: 'century',
  fifty: 'fifty',
  hattrick: 'hattrick',
  allout: 'wicket',
  six: 'six',
  wicket: 'wicket',
  four: 'four',
  noball: 'noball',
}
const MUST_SAY = new Set<MomentKind>(['start', 'end', 'century', 'hattrick'])
const BIG = new Set<MomentKind>(['six', 'wicket', 'fifty', 'allout'])

const CHIP: Record<Ball['kind'], { label: (b: Ball) => string; bg: string; fg: string }> = {
  dot: { label: () => '•', bg: '#2b3a55', fg: '#9fb3d1' },
  run: { label: b => String(b.runs), bg: '#1f2d4d', fg: '#ffffff' },
  four: { label: () => '4', bg: '#1565c0', fg: '#ffffff' },
  six: { label: () => '6', bg: '#8e24aa', fg: '#ffffff' },
  wicket: { label: () => 'W', bg: '#c62828', fg: '#ffffff' },
  noball: { label: () => 'nb', bg: '#ef6c00', fg: '#ffffff' },
  wide: { label: () => 'wd', bg: '#455a64', fg: '#ffffff' },
}

const NICKNAMES: Record<string, string> = {
  Read: 'the wall, blocks everything',
  Grep: 'finds the gaps',
  Glob: 'reads the field',
  Bash: 'the finisher',
  Edit: 'rotates the strike',
  Write: 'clears the ropes',
  Agent: 'brings on the specialists',
  WebSearch: 'studies the opposition',
  WebFetch: 'scouting report',
}

const NAVY = '#0a1838'
const GOLD = '#f5c518'

const DEMO: readonly Delivery[] = [
  { tool: 'Read', input: { file_path: 'src/app.ts' }, outcome: 'ok' },
  { tool: 'Grep', input: { pattern: 'useAuth' }, outcome: 'ok' },
  { tool: 'Edit', input: { file_path: 'src/auth.ts', new_string: 'a\nb\nc\nd\ne\nf' }, outcome: 'ok' },
  { tool: 'Bash', input: { command: 'pnpm build' }, outcome: 'ok' },
  { tool: 'Bash', input: { command: 'pnpm test' }, outcome: 'ok', text: '42 passed' },
  { tool: 'Bash', input: { command: 'pnpm lint' }, outcome: 'error' },
  { tool: 'Write', input: { file_path: 'src/session.ts', content: 'x\n'.repeat(120) }, outcome: 'ok' },
  { tool: 'Edit', input: { file_path: 'src/session.ts', new_string: 'x\n'.repeat(25) }, outcome: 'ok' },
  { tool: 'Bash', input: { command: 'pnpm test' }, outcome: 'ok', text: '58 passed' },
  { tool: 'Bash', input: { command: 'git commit -m "fix auth"' }, outcome: 'ok' },
  { tool: 'Bash', input: { command: 'git push' }, outcome: 'ok' },
]

type Job =
  | { type: 'start'; task: string }
  | { type: 'ball'; delivery: Delivery }
  | { type: 'end'; isAborted: boolean }
  | { type: 'demo' }
  | { type: 'stop-demo' }

type BigScreen = { requestId: string; columns: number; rows: number; seq: number }

function scorecard(innings: Innings | null): string {
  if (innings === null) return 'No innings yet. Send Claude a task and the match begins, or try **/cpl demo**.'
  const rows = Object.values(innings.batters).sort((a, b) => b.runs - a.runs || b.balls - a.balls)
  const star = playerOfTheMatch(innings)
  const table = [
    '| Batter | | R | B | 4s | 6s | SR |',
    '|---|---|--:|--:|--:|--:|--:|',
    ...rows.map(
      one =>
        `| **${one.name}**${one.out ? '' : '\\*'} | ${one.out ? `_${one.out}_` : NICKNAMES[one.name] ?? 'not out'} | **${one.runs}** | ${one.balls} | ${one.fours} | ${one.sixes} | ${((one.runs * 100) / Math.max(1, one.balls)).toFixed(1)} |`,
    ),
  ]
  const fow = innings.fallOfWickets.map(w => `${w.score}-${w.wicket} (${w.batter}: ${w.how})`).join(', ')
  return [
    `### 🏏 Claude Premier League · Innings ${innings.number}`,
    `**CLAUDE ${scoreText(innings)}** (${oversText(innings.balls)} ov) · CRR ${runRate(innings.runs, innings.balls)} · extras ${innings.extras}${innings.isLive ? ' · **LIVE**' : ''}`,
    `_Task: ${innings.task}_`,
    '',
    ...table,
    '',
    fow ? `**Fall of wickets:** ${fow}` : '**Fall of wickets:** none, flawless',
    star ? `**Player of the match:** ${star.name}, ${star.runs} off ${star.balls}` : '',
  ]
    .filter(line => line !== '')
    .join('\n')
}

function careerCard(c: Career): string {
  return [
    '### 🏆 Claude career stats',
    '| Innings | Runs | Best | 50s | 100s | 4s | 6s | Wickets lost |',
    '|--:|--:|--:|--:|--:|--:|--:|--:|',
    `| ${c.innings} | ${c.runs} | ${c.best} | ${c.fifties} | ${c.centuries} | ${c.fours} | ${c.sixes} | ${c.wickets} |`,
    '',
    `Average ${(c.runs / Math.max(1, c.wickets)).toFixed(1)} runs per wicket.`,
  ].join('\n')
}

const HELP = [
  '**/cpl** scorecard · **/cpl career** · **/cpl demo** (a scripted innings) · **/cpl stop** / **start** (pause the match)',
  '**/cpl mute** / **unmute** (commentator) · **/cpl crowd** (toggle crowd) · **/cpl hinglish** / **english** · **/cpl hide** / **show**',
].join('\n')

export const register: Register = on => {
  const jobs: Job[] = []
  let screen: BigScreen | null = null
  let celebrationStartedAt = 0

  // Everything that outlives one hook (sounds, the commentator, the big screen,
  // the demo) runs here, from the session's own long-lived timers.
  on('session.start', async ($, e, next) => {
    let seq = 0
    let speaking = 0
    let isDraining = false
    let animation: { cancel: () => void } | null = null
    let demo: { cancel: () => void } | null = null

    const stored = (await $.store.get('settings')) as Partial<Settings> | undefined
    await update($, settingsAtom, () => ({ ...DEFAULT_SETTINGS, ...(stored ?? {}) }))
    await $.command.register({
      name: 'cpl',
      description: 'Claude Premier League: scorecard, career, demo, mute, crowd, hinglish, hide',
      argumentHint: '[scorecard|career|demo|stop|mute|unmute|crowd|hinglish|english|hide|show]',
    })

    const settingsNow = async (): Promise<Settings> => ({ ...DEFAULT_SETTINGS, ...((await read($, settingsAtom)) ?? {}) })
    const careerNow = async (): Promise<Career> => ({
      ...EMPTY_CAREER,
      ...(((await $.store.get('career')) as Partial<Career> | undefined) ?? {}),
    })

    const play = (asset: string, gain = 1) => {
      $.audio.play({ asset }, { gain }).catch(() => undefined)
    }

    const crowd = (kind: MomentKind) => {
      if (kind === 'six') {
        play('sounds/bat.wav')
        play('sounds/six.wav', 0.9)
      } else if (kind === 'four') {
        play('sounds/bat.wav')
        play('sounds/four.wav', 0.8)
      } else if (kind === 'wicket' || kind === 'hattrick' || kind === 'allout') {
        play('sounds/stumps.wav')
        play('sounds/groan.wav', 0.85)
      } else if (kind === 'century' || kind === 'fifty') {
        play('sounds/applause.wav')
        play('sounds/six.wav', 0.6)
      } else if (kind === 'noball') {
        play('sounds/groan.wav', 0.5)
      } else if (kind === 'maiden') {
        play('sounds/applause.wav', 0.35)
      } else if (kind === 'start') {
        play('sounds/four.wav', 0.6)
      } else if (kind === 'end') {
        play('sounds/applause.wav', 0.9)
      }
    }

    const speak = async (text: string, language: Language) => {
      speaking += 1
      try {
        const line = language === 'english' ? `[[rate 205]] ${text}` : text
        await $.audio.speak(line, { voice: VOICE[language] }).catch(() => $.audio.speak(text))
      } catch {
        // no synthesizer here: the band still shows the line
      } finally {
        speaking -= 1
      }
    }

    const commentate = async (kind: MomentKind, ctx: LineContext, mine: number) => {
      const settings = await settingsNow()
      const canned = cannedLine(kind, ctx, settings.language, Math.random())
      const moment: Moment = { kind, headline: headline(kind), line: canned, seq: mine }
      await update($, momentAtom, () => moment)

      if (settings.isCrowdOn) crowd(kind)
      if (!settings.isVoiceOn) return
      if (!MUST_SAY.has(kind) && speaking >= (BIG.has(kind) ? 2 : 1)) return

      let line = canned
      const ask = commentaryRequest(kind, ctx, settings.language)
      const reply = await $.model
        .complete({
          model: 'haiku',
          system: ask.system,
          prompt: ask.prompt,
          maxTokens: 160,
          timeoutMs: MUST_SAY.has(kind) ? 6000 : 3200,
        })
        .catch(() => undefined)
      const written = reply?.isAnswered ? cleanLine(reply.text) : undefined
      if (written !== undefined) {
        line = written
        await update($, momentAtom, current => (current?.seq === mine ? { ...current, line } : current))
      }
      if (!MUST_SAY.has(kind) && seq - mine > 3) return
      await speak(line, settings.language)
    }

    const celebrate = async (kind: CelebrationKind, mine: number) => {
      animation?.cancel()
      celebrationStartedAt = await $.clock.now()
      const celebration: Celebration = { kind, text: BANNER[kind], seq: mine }
      await update($, celebrationAtom, () => celebration)
      const duration = DURATION_MS[kind]
      let isPainting = false
      const timer = $.clock.every(33, () => {
        if (isPainting) return
        isPainting = true
        void (async () => {
          try {
            const elapsed = (await $.clock.now()) - celebrationStartedAt
            if (elapsed >= duration) {
              timer.cancel()
              if (animation === timer) animation = null
              await update($, celebrationAtom, current => (current?.seq === mine ? null : current))
              return
            }
            const target = screen
            if (target === null || target.seq !== mine) return
            await $.ui
              .blit({ requestId: target.requestId, key: 'big-screen', cells: frame(kind, elapsed, target.columns, mine, target.rows) })
              .catch(() => undefined)
          } finally {
            isPainting = false
          }
        })()
      })
      animation = timer
    }

    const startInnings = async (task: string) => {
      const record = await careerNow()
      const innings = newInnings(record.innings + 1, task, await $.clock.now())
      await update($, inningsAtom, () => innings)
      seq += 1
      $.ui.status('🏏 CLAUDE 0/0 (0.0)')
      void commentate('start', { detail: '', batter: 'Claude', score: '0/0', overs: '0.0', task }, seq)
      return innings
    }

    const deliver = async (delivery: Delivery) => {
      let innings = await read($, inningsAtom)
      if (innings === null || !innings.isLive) innings = await startInnings('whatever the captain asked for')

      const b = scoreDelivery(delivery)
      const { innings: after, moments } = bowl(innings, b)
      await update($, inningsAtom, () => after)
      $.ui.status(`🏏 CLAUDE ${scoreText(after)} (${oversText(after.balls)})`)

      const top = PRIORITY.find(kind => moments.includes(kind))
      if (top === undefined) return
      seq += 1
      const ctx: LineContext = {
        detail: b.detail,
        batter: b.batter,
        score: scoreText(after),
        overs: oversText(after.balls),
        how: b.how,
        task: after.task,
      }
      const show = CELEBRATES[top]
      if (show !== undefined) void celebrate(show, seq)
      void commentate(top, ctx, seq)
    }

    const endInnings = async (isAborted: boolean) => {
      const innings = await read($, inningsAtom)
      if (innings === null || !innings.isLive) return
      const ended: Innings = { ...innings, isLive: false, endedAt: await $.clock.now() }
      await update($, inningsAtom, () => ended)
      if (ended.balls === 0 && ended.runs === 0) return

      const star = playerOfTheMatch(ended)
      const record = await careerNow()
      const sixes = Object.values(ended.batters).reduce((n, one) => n + one.sixes, 0)
      const fours = Object.values(ended.batters).reduce((n, one) => n + one.fours, 0)
      const updated: Career = {
        innings: record.innings + 1,
        runs: record.runs + ended.runs,
        sixes: record.sixes + sixes,
        fours: record.fours + fours,
        wickets: record.wickets + ended.fallOfWickets.length,
        fifties: record.fifties + ended.milestones.filter(m => m % 100 !== 0).length,
        centuries: record.centuries + ended.milestones.filter(m => m % 100 === 0).length,
        best: Math.max(record.best, ended.runs),
      }
      await $.store.set('career', updated)

      seq += 1
      const starText = star ? `${star.name}, ${star.runs} off ${star.balls} balls` : 'Claude'
      void commentate('end', { detail: '', batter: 'Claude', score: scoreText(ended), overs: oversText(ended.balls), star: starText }, seq)

      const summary = [
        `🏏 CPL · CLAUDE ${scoreText(ended)} (${oversText(ended.balls)} ov)`,
        isAborted ? 'rain stopped play' : `CRR ${runRate(ended.runs, ended.balls)}`,
        star ? `player of the match: ${star.name} ${star.runs}${star.out ? '' : '*'} (${star.balls})` : '',
        ended.runs > record.best && record.innings > 0 ? 'NEW CAREER BEST' : '',
        '/cpl for the scorecard',
      ]
      await $.session
        .append({ message: { type: 'system', content: [{ type: 'text', text: summary.filter(Boolean).join(' · ') }] } })
        .catch(() => undefined)
    }

    const runDemo = async () => {
      demo?.cancel()
      await startInnings('fix the login bug and ship it')
      let i = 0
      const timer = $.clock.every(3800, () => {
        const one = DEMO[i]
        i += 1
        if (one === undefined) {
          timer.cancel()
          if (demo === timer) demo = null
          jobs.push({ type: 'end', isAborted: false })
          return
        }
        jobs.push({ type: 'ball', delivery: one })
      })
      demo = timer
    }

    const drain = async () => {
      if (isDraining) return
      isDraining = true
      try {
        for (let job = jobs.shift(); job !== undefined; job = jobs.shift()) {
          try {
            if (job.type === 'start') {
              const live = await read($, inningsAtom)
              if (!(live?.isLive ?? false)) await startInnings(job.task)
            } else if (job.type === 'ball') {
              await deliver(job.delivery)
            } else if (job.type === 'end') {
              await endInnings(job.isAborted)
            } else if (job.type === 'demo') {
              await runDemo()
            } else {
              demo?.cancel()
              demo = null
            }
          } catch (error) {
            $.ui.log(`cricket-commentary: ${String(error)}`)
          }
        }
      } finally {
        isDraining = false
      }
    }

    $.clock.every(60, () => {
      if (jobs.length > 0) void drain()
    })

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const settings = await read($, settingsAtom)
    if (!(settings?.isPaused ?? false) && !e.text.trimStart().startsWith('/')) {
      jobs.push({ type: 'start', task: shorten(e.text, 90) })
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    try {
      const settings = await read($, settingsAtom)
      if (settings?.isPaused ?? false) return ran
      // a plugin's view of a Bash result carries the output in stdout and
      // stderr; `text` is only what the model read, and may be absent here
      const result = ran.result as { interrupted?: boolean; stdout?: unknown; stderr?: unknown } | undefined
      const text = [result?.stdout, result?.stderr, ran.text]
        .filter((part): part is string => typeof part === 'string' && part.length > 0)
        .join('\n')
      let outcome: Outcome = 'ok'
      if (ran.deny !== undefined || (ran.isError === true && /doesn't want to proceed|user rejected|denied by the user|rejected this/i.test(text))) {
        outcome = 'denied'
      } else if (result?.interrupted === true) {
        outcome = 'interrupted'
      } else if (ran.isError === true) {
        outcome = 'error'
      }
      const input = { ...(e as unknown as Record<string, unknown>) }
      // test runners print their counts last: keep the tail of long output
      const kept = text.length > 6000 ? `${text.slice(0, 1500)}\n…\n${text.slice(-4500)}` : text
      jobs.push({ type: 'ball', delivery: { tool: String(e.tool), input, outcome, text: kept } })
    } catch {
      // never let the scoreboard break a tool call
    }
    return ran
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) jobs.push({ type: 'end', isAborted: e.isAborted })
    return next(e)
  })

  on('command.run', { command: 'cpl' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const change = async (patch: Partial<Settings>) => {
      const now = { ...DEFAULT_SETTINGS, ...((await read($, settingsAtom)) ?? {}), ...patch }
      await update($, settingsAtom, () => now)
      await $.store.set('settings', now)
      return now
    }
    if (arg === '' || arg === 'scorecard') return { text: scorecard(await read($, inningsAtom)) }
    if (arg === 'career') {
      const c = { ...EMPTY_CAREER, ...(((await $.store.get('career')) as Partial<Career> | undefined) ?? {}) }
      return { text: careerCard(c) }
    }
    if (arg === 'demo') {
      jobs.push({ type: 'demo' })
      return { text: '🏏 Demo innings starting. Turn the volume up.' }
    }
    if (arg === 'stop' || arg === 'pause') {
      jobs.push({ type: 'stop-demo' })
      await change({ isPaused: true })
      return { text: '⏸️ Play suspended. No scoring and no commentary until **/cpl start**.' }
    }
    if (arg === 'start' || arg === 'resume') {
      await change({ isPaused: false })
      return { text: '🏏 Play resumes. The next task starts a fresh innings.' }
    }
    if (arg === 'mute') {
      await change({ isVoiceOn: false })
      return { text: '🔇 Commentator muted, the crowd stays. **/cpl unmute** brings him back.' }
    }
    if (arg === 'unmute') {
      await change({ isVoiceOn: true })
      return { text: '🎙️ Commentator is back in the box.' }
    }
    if (arg === 'crowd') {
      const current = { ...DEFAULT_SETTINGS, ...((await read($, settingsAtom)) ?? {}) }
      const now = await change({ isCrowdOn: !current.isCrowdOn })
      return { text: now.isCrowdOn ? '📣 Crowd is back.' : '🤫 Crowd silenced.' }
    }
    if (arg === 'hinglish' || arg === 'hindi') {
      await change({ language: 'hinglish' })
      return { text: '🇮🇳 Hindi commentary on.' }
    }
    if (arg === 'english') {
      await change({ language: 'english' })
      return { text: '🎙️ English commentary on.' }
    }
    if (arg === 'hide') {
      await change({ isHidden: true })
      return { text: 'Scoreboard hidden. **/cpl show** brings it back.' }
    }
    if (arg === 'show') {
      await change({ isHidden: false })
      return { text: 'Scoreboard is back.' }
    }
    return { text: HELP }
  })

  on('ui.render', { component: 'CommandOutput', props: { command: 'cpl' } }, ($, e, next) => {
    if (e.props.isErrored) return next(e)
    const { Markdown } = $.ui.resolve(e)
    return <Markdown text={e.props.text} />
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const settings = { ...DEFAULT_SETTINGS, ...((await read($, settingsAtom)) ?? {}) }
    if (e.props.hasSurvey || settings.isHidden) return next(e)

    const innings = await read($, inningsAtom)
    const moment = await read($, momentAtom)
    const celebration = await read($, celebrationAtom)
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const width = Math.max(20, e.props.bodyColumns)

    if (settings.isPaused) {
      return (
        <Box>
          <Text backgroundColor={GOLD} color="#000000" bold>
            {' CPL '}
          </Text>
          <Text color="#9fb3d1" wrap="truncate-end">
            {innings === null
              ? '  ⏸ play suspended · /cpl start to resume'
              : `  ⏸ play suspended at ${scoreText(innings)} (${oversText(innings.balls)}) · /cpl start to resume`}
          </Text>
        </Box>
      )
    }

    if (innings === null) {
      return (
        <Box>
          <Text backgroundColor={GOLD} color="#000000" bold>
            {' CPL '}
          </Text>
          <Text color="#9fb3d1" wrap="truncate-end">
            {'  Claude Premier League · send a task to start the innings · /cpl demo for a preview'}
          </Text>
        </Box>
      )
    }

    let bigScreen = null
    const rows = screenRowsFor(e.props.maxRows)
    if (celebration !== null && e.surface === 'terminal' && rows > 0 && width >= 30) {
      const { Raster } = $.ui.resolve(e)
      const columns = Math.min(width, 120)
      const elapsed = Math.max(0, (await $.clock.now()) - celebrationStartedAt)
      screen = { requestId: e.requestId, columns, rows, seq: celebration.seq }
      bigScreen = <Raster key="big-screen" columns={columns} rows={rows} cells={frame(celebration.kind, elapsed, columns, celebration.seq, rows)} />
    } else {
      screen = null
    }
    const call = moment === null ? '' : moment.line.replace(new RegExp(`^${moment.headline.replace(/[^A-Z]/g, '')}!?\\s*`, 'i'), '')

    const batters = Object.values(innings.batters)
      .filter(one => one.runs > 0 || one.balls > 2)
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 3)
    const lastWicket = innings.fallOfWickets[innings.fallOfWickets.length - 1]
    const isWide = width >= 90

    return (
      <Box flexDirection="column">
        {bigScreen}
        <Box>
          <Text backgroundColor={GOLD} color="#000000" bold>
            {' CPL '}
          </Text>
          <Text backgroundColor={NAVY} color="#ffffff" bold>
            {'  CLAUDE '}
          </Text>
          <Text backgroundColor={NAVY} color={GOLD} bold>
            {`${scoreText(innings)} `}
          </Text>
          <Text backgroundColor={NAVY} color="#cfd8e3">
            {` ${oversText(innings.balls)} ov `}
          </Text>
          {isWide && (
            <Text backgroundColor={NAVY} color="#8aa0c2">
              {` CRR ${runRate(innings.runs, innings.balls)} `}
            </Text>
          )}
          <Text backgroundColor={NAVY} color="#8aa0c2">
            {'  THIS OVER '}
          </Text>
          {innings.thisOver.length === 0 && (
            <Text backgroundColor={NAVY} color="#5c6f91">
              {' - '}
            </Text>
          )}
          {innings.thisOver.map(one => (
            <Text backgroundColor={CHIP[one.kind].bg} color={CHIP[one.kind].fg} bold>
              {` ${CHIP[one.kind].label(one)} `}
            </Text>
          ))}
          <Text backgroundColor={NAVY}>{' '}</Text>
          {innings.isLive ? (
            <Text backgroundColor="#b71c1c" color="#ffffff" bold>
              {e.props.isWorking ? ' ● LIVE ' : ' LIVE '}
            </Text>
          ) : (
            <Text backgroundColor="#37474f" color="#ffffff" bold>
              {' STUMPS '}
            </Text>
          )}
        </Box>
        {bigScreen === null && (batters.length > 0 || lastWicket !== undefined) && (
          <Box>
            {batters.map((one, i) => (
              <Text color={i === 0 ? '#ffffff' : '#b0bec5'} bold={i === 0}>
                {`${i === 0 ? ' ' : '  ·  '}${one.name.toUpperCase()} ${one.runs}${one.out ? '' : '*'} (${one.balls})`}
              </Text>
            ))}
            {innings.extras > 0 && <Text color="#78909c">{`  ·  extras ${innings.extras}`}</Text>}
            {lastWicket !== undefined && isWide && (
              <Text color="#ef9a9a" wrap="truncate-end">
                {`  ·  last wkt ${lastWicket.score}-${lastWicket.wicket}: ${lastWicket.how}`}
              </Text>
            )}
          </Box>
        )}
        {moment !== null && (
          <Box>
            <Text color={GOLD} bold>
              {` 🎙  ${moment.headline} `}
            </Text>
            <Text color="#e3f2fd" italic wrap="truncate-end">
              {call}
            </Text>
          </Box>
        )}
      </Box>
    )
  })
}
