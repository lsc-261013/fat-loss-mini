export function validGrams(value: unknown): boolean {
  const number = Number(value)
  return String(value).trim() !== '' && Number.isFinite(number) && number > 0 && number <= 5000
}

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  return year >= 1900 && year <= 2200 && localDate(date) === value
}

export function shiftDate(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number)
  return localDate(new Date(year, month - 1, day + days, 12))
}

export function recordingDays(start: string, today: string): number {
  const dayNumber = (value: string) => {
    const [year, month, day] = value.split('-').map(Number)
    return Date.UTC(year, month - 1, day) / 86400000
  }
  return Math.max(1, dayNumber(today) - dayNumber(start) + 1)
}

export function validProfileNumber(key: 'height' | 'weight' | 'age', value: number): boolean {
  const ranges = { height: [100, 230], weight: [25, 300], age: [18, 100] }
  const [min, max] = ranges[key]
  return Number.isFinite(value) && value >= min && value <= max && (key !== 'age' || Number.isInteger(value))
}
