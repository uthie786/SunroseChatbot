// Sunrose trading hours (from sunrose.co.za FAQs) and South African public holidays.
// All branches use the same hours. South Africa is always UTC+2 (no daylight saving).
//
// TODO: confirm with Sunrose whether branches open on public holidays.
// For now public holidays are treated as closed.

const SA_OFFSET_HOURS = 2;

// Minutes after midnight. null = closed all day.
// Index: 0 Sunday, 1 Monday ... 6 Saturday
const WEEKLY_HOURS: ({ open: number; close: number } | null)[] = [
  null, // Sunday
  { open: 8 * 60, close: 17 * 60 }, // Monday 8am-5pm
  { open: 8 * 60, close: 17 * 60 }, // Tuesday
  { open: 8 * 60, close: 17 * 60 }, // Wednesday
  { open: 8 * 60, close: 17 * 60 }, // Thursday
  { open: 8 * 60, close: 17 * 60 }, // Friday
  { open: 8 * 60, close: 14 * 60 + 30 }, // Saturday 8am-2:30pm
];

// Public holidays (YYYY-MM-DD). A holiday on a Sunday moves to the Monday.
// Add next year's dates each December.
const PUBLIC_HOLIDAYS: Record<string, string> = {
  '2026-01-01': "New Year's Day",
  '2026-03-21': 'Human Rights Day',
  '2026-04-03': 'Good Friday',
  '2026-04-06': 'Family Day',
  '2026-04-27': 'Freedom Day',
  '2026-05-01': "Workers' Day",
  '2026-06-16': 'Youth Day',
  '2026-08-10': "National Women's Day (observed)",
  '2026-09-24': 'Heritage Day',
  '2026-12-16': 'Day of Reconciliation',
  '2026-12-25': 'Christmas Day',
  '2026-12-26': 'Day of Goodwill',
  '2027-01-01': "New Year's Day",
  '2027-03-22': 'Human Rights Day (observed)',
  '2027-03-26': 'Good Friday',
  '2027-03-29': 'Family Day',
  '2027-04-27': 'Freedom Day',
  '2027-05-01': "Workers' Day",
  '2027-06-16': 'Youth Day',
  '2027-08-09': "National Women's Day",
  '2027-09-24': 'Heritage Day',
  '2027-12-16': 'Day of Reconciliation',
  '2027-12-25': 'Christmas Day',
  '2027-12-27': 'Day of Goodwill (observed)',
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type BusinessStatus = {
  isOpen: boolean;
  nowText: string; // "Thursday 19 November 2026, 12:11"
  reason?: string; // why closed: "after hours", "Sunday", "public holiday: Heritage Day"
  closesText?: string; // when open: "5pm today"
  nextOpenText?: string; // when closed: "tomorrow (Friday 20 November) at 8am"
};

// A Date whose UTC fields show South African local time.
function toSaClock(now: Date) {
  return new Date(now.getTime() + SA_OFFSET_HOURS * 3600_000);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function clockText(minutes: number) {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

function dayText(d: Date) {
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function hoursFor(d: Date) {
  if (PUBLIC_HOLIDAYS[isoDate(d)]) return null;
  return WEEKLY_HOURS[d.getUTCDay()];
}

export function getBusinessStatus(now: Date = new Date()): BusinessStatus {
  const sa = toSaClock(now);
  const minutes = sa.getUTCHours() * 60 + sa.getUTCMinutes();
  const nowText =
    `${dayText(sa)} ${sa.getUTCFullYear()}, ` +
    `${String(sa.getUTCHours()).padStart(2, '0')}:${String(sa.getUTCMinutes()).padStart(2, '0')}`;

  const today = hoursFor(sa);
  if (today && minutes >= today.open && minutes < today.close) {
    return { isOpen: true, nowText, closesText: `${clockText(today.close)} today` };
  }

  const holiday = PUBLIC_HOLIDAYS[isoDate(sa)];
  const reason = holiday
    ? `public holiday: ${holiday}`
    : !WEEKLY_HOURS[sa.getUTCDay()]
      ? DAYS[sa.getUTCDay()]
      : minutes < (today?.open ?? 0)
        ? 'before opening time'
        : 'after hours';

  // Opens later today?
  if (today && minutes < today.open) {
    return { isOpen: false, nowText, reason, nextOpenText: `today at ${clockText(today.open)}` };
  }

  // Otherwise the next day with opening hours (looks up to 2 weeks ahead).
  for (let i = 1; i <= 14; i++) {
    const day = new Date(sa.getTime() + i * 86_400_000);
    const hours = hoursFor(day);
    if (hours) {
      const when = i === 1 ? `tomorrow (${dayText(day)})` : dayText(day);
      return { isOpen: false, nowText, reason, nextOpenText: `${when} at ${clockText(hours.open)}` };
    }
  }
  return { isOpen: false, nowText, reason, nextOpenText: 'the next working day' };
}

// The short block Claude gets with every message.
export function businessStatusText(status: BusinessStatus): string {
  const lines = ['## Right now', `- Date and time in South Africa: ${status.nowText}`];
  if (status.isOpen) {
    lines.push(`- Sunrose is OPEN now. Closes at ${status.closesText}.`);
  } else {
    lines.push(`- Sunrose is CLOSED now (${status.reason}).`);
    lines.push(`- Next opening: ${status.nextOpenText}.`);
  }
  return lines.join('\n');
}
