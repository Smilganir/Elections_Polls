#!/usr/bin/env node
/**
 * Gate scheduled GitHub Actions runs to Asia/Jerusalem wall-clock slots.
 * GitHub cron is UTC-only; we fire IDT/IST UTC pairs and accept only matching IL times (±2 min).
 *
 * Usage: node scripts/israel-poll-schedule-gate.mjs <mode>
 *   wed-thu       — Wed & Thu 09:00, 14:00, 21:00
 *   fri-poll      — Fri 09:30, 10:30, 11:30 (themadad → Sheets)
 *   fri-narrative — Fri 09:45, 10:45, 11:45 (Maariv narrative; 15 min after poll sync)
 */

const MODES = {
  'wed-thu': { days: ['Wed', 'Thu'], times: ['09:00', '14:00', '21:00'] },
  'fri-poll': { days: ['Fri'], times: ['09:30', '10:30', '11:30'] },
  'fri-narrative': { days: ['Fri'], times: ['09:45', '10:45', '11:45'] },
}

const TOLERANCE_MIN = 2

function jerusalemNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(new Date())
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  )
  return { day: parts.weekday, hm: `${parts.hour}:${parts.minute}` }
}

function parseHm(hm) {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

function withinTolerance(nowHm, targetHm) {
  return Math.abs(parseHm(nowHm) - parseHm(targetHm)) <= TOLERANCE_MIN
}

function main() {
  const mode = process.argv[2]
  const spec = MODES[mode]
  if (!spec) {
    console.error(`Unknown mode "${mode}". Expected: ${Object.keys(MODES).join(', ')}`)
    process.exit(2)
  }

  const { day, hm } = jerusalemNow()
  if (!spec.days.includes(day)) {
    console.log(`Skip: ${day} ${hm} IL — not a ${spec.days.join('/')} slot.`)
    process.exit(1)
  }

  const match = spec.times.find((t) => withinTolerance(hm, t))
  if (!match) {
    console.log(`Skip: ${day} ${hm} IL — outside allowed times (${spec.times.join(', ')}).`)
    process.exit(1)
  }

  console.log(`Run: ${day} ${hm} IL matches ${match}.`)
  process.exit(0)
}

main()
