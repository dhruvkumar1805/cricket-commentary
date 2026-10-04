import { describe, expect, test } from 'claude-code/testing'

import { SCREEN_ROWS, frame, paint, screenRowsFor } from '../hooks/jumbotron'
import { cannedLine, cleanLine } from '../hooks/lines'
import { bowl, coreCommand, newInnings, oversText, playerOfTheMatch, scoreDelivery } from '../hooks/scoring'
import type { Delivery } from '../hooks/scoring'

const bash = (command: string, outcome: Delivery['outcome'] = 'ok', text = ''): Delivery => ({
  tool: 'Bash',
  input: { command },
  outcome,
  text,
})

describe('scoring a delivery', () => {
  test('passing tests are a six, failing tests bowl Claude', async () => {
    expect(scoreDelivery(bash('pnpm test', 'ok', 'Tests  42 passed')).kind).toBe('six')
    expect(scoreDelivery(bash('pnpm test', 'ok', 'Tests  42 passed')).detail).toContain('42 passing')
    const out = scoreDelivery(bash('npx vitest run', 'error', '3 failed'))
    expect(out.kind).toBe('wicket')
    expect(out.how).toContain('bowled')
    const node = scoreDelivery(bash('npm test', 'error', 'ℹ tests 6\nℹ pass 2\nℹ fail 4'))
    expect(node.detail).toContain('4 failing')
    expect(scoreDelivery(bash('npm test', 'ok', 'ℹ tests 6\nℹ pass 6\nℹ fail 0')).detail).toContain('6 passing')
  })

  test('a pipe cannot hide failing tests, and the commentator names the real command', async () => {
    const piped = scoreDelivery(bash('cd app && npm test 2>&1 | grep -E "^ℹ (pass|fail)"', 'ok', 'ℹ pass 2\nℹ fail 4'))
    expect(piped.kind).toBe('wicket')
    expect(piped.detail).toBe('npm test (4 failing)')
    expect(coreCommand('cd x && pnpm build > /dev/null 2>&1')).toBe('pnpm build')
    expect(coreCommand('git add -A && git commit -m "x" && git push')).toBe('git push')
    expect(coreCommand('ls -la | head')).toBe('ls -la')
  })

  test('failing tests are out even when tail cut the summary off', async () => {
    const cut = '  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:\n\n  59 !== 124\n'
    const out = scoreDelivery(bash('npm test 2>&1 | tail -60', 'ok', cut))
    expect(out.kind).toBe('wicket')
    expect(out.detail).toBe('npm test (failing)')
  })

  test('a rejected push or a broken build is out even when the pipe exits 0', async () => {
    const push = scoreDelivery(bash('git push -u origin fix 2>&1 | tail -5', 'ok', ' ! [rejected]  fix -> fix (fetch first)\nerror: failed to push some refs'))
    expect(push.kind).toBe('wicket')
    expect(scoreDelivery(bash('npx tsc 2>&1 | tail', 'ok', "src/a.ts(3,1): error TS2304: Cannot find name 'x'.")).kind).toBe('wicket')
  })

  test('builds, lints and commits are fours; a push is a six', async () => {
    expect(scoreDelivery(bash('pnpm build')).kind).toBe('four')
    expect(scoreDelivery(bash('npx tsc --noEmit')).kind).toBe('four')
    expect(scoreDelivery(bash('pnpm lint')).kind).toBe('four')
    expect(scoreDelivery(bash('git commit -m "x"')).kind).toBe('four')
    expect(scoreDelivery(bash('git push origin main')).kind).toBe('six')
  })

  test('dangerous commands are no balls, declined permissions are wides', async () => {
    expect(scoreDelivery(bash('rm -rf dist')).kind).toBe('noball')
    expect(scoreDelivery(bash('git push --force')).kind).toBe('noball')
    expect(scoreDelivery(bash('pnpm build', 'denied')).kind).toBe('wide')
  })

  test('looking around is a dot ball, plain commands are singles', async () => {
    expect(scoreDelivery(bash('ls -la')).kind).toBe('dot')
    expect(scoreDelivery(bash('git status')).kind).toBe('dot')
    expect(scoreDelivery(bash('cat test.txt')).kind).toBe('dot')
    expect(scoreDelivery(bash('mkdir tests')).kind).toBe('run')
    expect(scoreDelivery({ tool: 'Read', input: { file_path: '/a/b/app.ts' }, outcome: 'ok' }).detail).toBe('app.ts')
  })

  test('failures have cricket dismissals', async () => {
    expect(scoreDelivery(bash('foo', 'error', 'zsh: command not found: foo')).how).toContain('stumped')
    expect(scoreDelivery(bash('pnpm build', 'error')).how).toContain('caught behind')
    expect(scoreDelivery(bash('node x.js', 'error', 'boom')).how).toContain('run out')
  })

  test('edits rotate the strike, big new files clear the ropes', async () => {
    expect(scoreDelivery({ tool: 'Edit', input: { file_path: 'a.ts', new_string: 'x' }, outcome: 'ok' }).runs).toBe(1)
    expect(scoreDelivery({ tool: 'Edit', input: { file_path: 'a.ts', new_string: 'x' }, outcome: 'error' }).kind).toBe('dot')
    expect(scoreDelivery({ tool: 'Write', input: { file_path: 'a.ts', content: 'x' }, outcome: 'ok' }).kind).toBe('four')
    expect(scoreDelivery({ tool: 'Write', input: { file_path: 'a.ts', content: 'x\n'.repeat(100) }, outcome: 'ok' }).kind).toBe('six')
  })
})

describe('the innings', () => {
  test('overs roll over after six legal balls and wides do not count', async () => {
    let innings = newInnings(1, 'task', 0)
    for (let i = 0; i < 6; i++) innings = bowl(innings, scoreDelivery(bash('echo hi && node a.js'))).innings
    innings = bowl(innings, scoreDelivery(bash('x', 'denied'))).innings
    expect(oversText(innings.balls)).toBe('1.0')
    expect(innings.extras).toBe(1)
    innings = bowl(innings, scoreDelivery(bash('node a.js'))).innings
    expect(innings.overs.length).toBe(1)
    expect(innings.thisOver.map(one => one.kind)).toEqual(['wide', 'run'])
    expect(oversText(innings.balls)).toBe('1.1')
  })

  test('fifty, hat-trick and maiden moments fire', async () => {
    let innings = newInnings(1, 'task', 0)
    const moments: string[] = []
    for (let i = 0; i < 9; i++) {
      const r = bowl(innings, scoreDelivery(bash('pnpm test', 'ok', '1 passed')))
      innings = r.innings
      moments.push(...r.moments)
    }
    expect(moments).toContain('fifty')
    expect(innings.milestones).toContain(50)
    for (let i = 0; i < 3; i++) {
      const r = bowl(innings, scoreDelivery(bash('node a.js', 'error', 'boom')))
      innings = r.innings
      moments.push(...r.moments)
    }
    expect(moments).toContain('hattrick')

    let quiet = newInnings(2, 'task', 0)
    const quietMoments: string[] = []
    for (let i = 0; i < 6; i++) {
      const r = bowl(quiet, scoreDelivery({ tool: 'Read', input: { file_path: 'a.ts' }, outcome: 'ok' }))
      quiet = r.innings
      quietMoments.push(...r.moments)
    }
    expect(quietMoments).toContain('maiden')
  })

  test('player of the match is the top scorer', async () => {
    let innings = newInnings(1, 'task', 0)
    innings = bowl(innings, scoreDelivery(bash('pnpm test', 'ok'))).innings
    innings = bowl(innings, scoreDelivery({ tool: 'Edit', input: { file_path: 'a.ts', new_string: 'x' }, outcome: 'ok' })).innings
    expect(playerOfTheMatch(innings)?.name).toBe('Bash')
  })
})

describe('commentary and the big screen', () => {
  test('canned lines fill in the details and model replies are cleaned', async () => {
    const line = cannedLine('six', { detail: 'pnpm test', batter: 'Bash', score: '42/1', overs: '3.2' }, 'english', 0)
    expect(line).toContain('pnpm test')
    expect(cleanLine('"**SIX!** What a shot!" 🏏\nextra')).toBe('SIX! What a shot!')
    expect(cleanLine('ok')).toBeUndefined()
  })

  test('every celebration paints full frames that pack into cells', async () => {
    for (const kind of ['six', 'four', 'wicket', 'fifty', 'century', 'hattrick', 'noball'] as const) {
      const cv = paint(kind, 600, 80, 7)
      expect(cv.width).toBe(80)
      expect(cv.height).toBe(SCREEN_ROWS * 2)
      const cells = frame(kind, 1200, 80, 7)
      expect(cells.length).toBe(Math.ceil((80 * SCREEN_ROWS * 12) / 3) * 4)
      expect(frame(kind, 900, 70, 3, 5).length).toBe(Math.ceil((70 * 5 * 12) / 3) * 4)
    }
  })

  test('the big screen shrinks to fit a cramped band and skips a tiny one', async () => {
    expect(screenRowsFor(30)).toBe(SCREEN_ROWS)
    expect(screenRowsFor(8)).toBe(5)
    expect(screenRowsFor(6)).toBe(0)
  })
})
