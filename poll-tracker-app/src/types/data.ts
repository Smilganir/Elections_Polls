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
