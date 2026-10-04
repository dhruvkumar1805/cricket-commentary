export type BallKind = 'dot' | 'run' | 'four' | 'six' | 'wicket' | 'noball' | 'wide'

export type Ball = {
  kind: BallKind
  runs: number
  batter: string
  detail: string
  how?: string
}

export type Batter = {
  name: string
  runs: number
  balls: number
  fours: number
  sixes: number
  out?: string
}

export type FallOfWicket = { score: number; wicket: number; batter: string; how: string; detail: string }

export type Innings = {
  number: number
  task: string
  runs: number
  wickets: number
  balls: number
  extras: number
  thisOver: Ball[]
  overs: Ball[][]
  batters: Record<string, Batter>
  fallOfWickets: FallOfWicket[]
  milestones: number[]
  wicketStreak: number
  isLive: boolean
  startedAt: number
  endedAt?: number
}

export type Language = 'english' | 'hinglish'

export type Settings = {
  isVoiceOn: boolean
  isCrowdOn: boolean
  isHidden: boolean
  isPaused: boolean
  language: Language
}

export type MomentKind =
  | 'start'
  | 'six'
  | 'four'
  | 'wicket'
  | 'noball'
  | 'wide'
  | 'fifty'
  | 'century'
  | 'hattrick'
  | 'maiden'
  | 'allout'
  | 'end'

export type Moment = { kind: MomentKind; headline: string; line: string; seq: number }

export type CelebrationKind = 'six' | 'four' | 'wicket' | 'fifty' | 'century' | 'hattrick' | 'noball'

export type Celebration = { kind: CelebrationKind; text: string; seq: number }

export type Career = {
  innings: number
  runs: number
  sixes: number
  fours: number
  wickets: number
  fifties: number
  centuries: number
  best: number
}

declare module 'claude-code' {
  interface PluginState {
    'cricket-commentary': {
      innings: Innings | null
      moment: Moment | null
      settings: Settings
      celebration: Celebration | null
    }
  }
}
