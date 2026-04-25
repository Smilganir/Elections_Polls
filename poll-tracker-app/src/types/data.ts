export type UnpivotRow = {
  pollId: number
  date: string
  respondents: number
  mediaOutlet: string
  pollster: string
  mediaIndex: number
  party: string
  votes: number
  votesRank: number
}

export type EventRow = {
  date: string
  eventName: string
  /** Join key; same sheet column as `mediaOutletSheet` when only one outlet column exists */
  mediaOutlet: string
  /** "Media Outlet" cell from Events Dates per Media Outlet (Hebrew display) */
  mediaOutletSheet: string
  party: string
}

export type MajorEventRow = {
  eventName: string
  /** Major Events Dim column "Event He" */
  eventNameHe: string
  date: string
  category: string
}

export type Segment = 'Coalition' | 'Opposition' | 'Arabs'

export type PartyDimRow = {
  party: string
  partyHeb: string
  segment: Segment
  partyId: number
  imageUrl: string
}

export type MediaOutletDimRow = {
  mediaOutlet: string
  enMediaOutlet: string
  shortDescription: string
  biasNote: string
}

/** UnpivotRow enriched with rolling-baseline residuals. */
export type ResidualRow = UnpivotRow & {
  baseline: number
  rawResidual: number
  statResidual: number
}

export type OutletAnomaly = {
  outlet: string
  party: string
  pollId: number
  date: string
  seats: number
  baseline: number
  rawResidual: number
  statResidual: number
  z: number
}

export type HouseEffectCell = {
  outlet: string
  party: string
  n: number
  meanRawResid: number
  meanStatResid: number
  seStat: number
  t: number
  p: number
  /** null when n < MIN_N_FDR — excluded from the BH pool; rendered greyed-out. */
  pAdj: number | null
  segment: Segment
}

export type BlocTilt = {
  outlet: string
  coalitionSum: number
  oppositionSum: number
  tilt: number
}

export type HistoricalAccuracyResult =
  | { outlet: string; hasData: true; mae: number; coalitionBlocError: number; coalitionPred: number }
  | { outlet: string; hasData: false }
