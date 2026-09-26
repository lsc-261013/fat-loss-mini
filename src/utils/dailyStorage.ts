// Keep the legacy current-day format and preserve the previous raw snapshot before replacement.
// This is a recovery backup, not a migration or a history UI.
export function writeDailySnapshot(key: string, date: string, value: unknown) {
  const previous = uni.getStorageSync(key)
  if (previous) {
    const parsed = JSON.parse(previous)
    if (!parsed || typeof parsed.date !== 'string') throw new Error('Invalid saved date')
    if (parsed.date !== date) {
      uni.setStorageSync(`${key}-backup-${parsed.date}`, previous)
    }
  }
  uni.setStorageSync(key, JSON.stringify(value))
}
