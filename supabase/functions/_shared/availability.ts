export const BOOKING_STEP_MINUTES = 30;
export const MAX_BOOKING_DAYS = 120;

export function businessWindow(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [year, month, date] = day.split("-").map(Number);
  if (new Date(Date.UTC(year, month - 1, date)).toISOString().slice(0, 10) !== day) return null;
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  if (weekday >= 1 && weekday <= 5) return { opens: 15 * 60, closes: 19 * 60 };
  if (weekday === 6) return { opens: 8 * 60, closes: 18 * 60 };
  return null;
}

export function isFutureBookingDay(day: string) {
  const localToday = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  if (day < localToday) return false;
  const max = new Date(`${localToday}T12:00:00Z`);
  max.setUTCDate(max.getUTCDate() + MAX_BOOKING_DAYS);
  return day <= max.toISOString().slice(0, 10);
}

export function isWithinBusinessHours(startAt: string, duration: number) {
  const day = startAt.slice(0, 10);
  const window = businessWindow(day);
  if (!window || !isFutureBookingDay(day) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startAt)) return false;
  const [, time] = startAt.split("T");
  const [hour, minute] = time.split(":").map(Number);
  const start = hour * 60 + minute;
  return Number.isInteger(duration) && duration >= 1 && minute % BOOKING_STEP_MINUTES === 0 && start >= window.opens && start + duration <= window.closes;
}

export type BusyInterval = { start_at: string; duration: number };
export type BlockData = { start?: string; end?: string };

export const brazilNow = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).replace(" ", "T");

/** Pure: callers load the day's bookings and the management blocks. */
export function availableBookingSlots(day: string, duration: number, booked: BusyInterval[], blocks: BlockData[]) {
  const window = businessWindow(day);
  if (!window || !isFutureBookingDay(day) || !Number.isInteger(duration) || duration < 1) return [];
  const occupied = booked.map(item => ({
    start: new Date(item.start_at).getTime(), end: new Date(item.start_at).getTime() + item.duration * 60000,
  }));
  const localNow = brazilNow();
  const blocked = blocks.flatMap(data => {
    const interval = { start: new Date(data.start || "").getTime(), end: new Date(data.end || "").getTime() };
    return Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start ? [interval] : [];
  });
  const available: string[] = [];
  for (let start = window.opens; start + duration <= window.closes; start += BOOKING_STEP_MINUTES) {
    const startAt = `${day}T${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
    if (!isWithinBusinessHours(startAt, duration)) continue;
    const startMs = new Date(startAt).getTime(), endMs = startMs + duration * 60000;
    if (startAt <= localNow) continue;
    if (occupied.some(item => startMs < item.end && endMs > item.start)) continue;
    if (blocked.some(item => startMs < item.end && endMs > item.start)) continue;
    available.push(startAt);
  }
  return available;
}
