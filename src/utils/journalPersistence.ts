import { emptyDay, emptyJournal, type JournalData } from '@/types/journal'
import { localDate, validDate } from './input'
import { validateJournal } from './journalValidation'
import { nextCustomFoodId } from './customFoods'
import { dayPortionIds } from './entryGroups'
import { recipePortionId } from './planGroups'

export const JOURNAL_KEY = 'journal-v2'
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
export function parseJson(raw: string): unknown {
  try { return JSON.parse(raw.replace(/^\uFEFF/, ''), (key, value) => {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('文件包含不支持的字段')
    return value
  }) } catch (e) {
    if (e instanceof SyntaxError) throw new Error('数据格式不完整，请选择完整的 JSON 备份；原数据未改动')
    throw e
  }
}
function read(key: string) {
  const raw = uni.getStorageSync(key)
  return raw ? (typeof raw === 'string' ? parseJson(raw) : raw) : undefined
}
export function loadJournal(): JournalData {
  const current = read(JOURNAL_KEY)
  if (current !== undefined) { validateJournal(current); return current }
  const data = emptyJournal(localDate())
  const keys: string[] = uni.getStorageInfoSync().keys
  // Archives first; the latest legacy snapshot wins on its own date.
  for (const key of [...keys.filter(k => /^(daily-record|meal-plan)-backup-\d{4}-\d{2}-\d{2}$/.test(k)), 'daily-record', 'meal-plan']) {
    const saved = read(key) as { date: string; entries?: unknown; items?: unknown } | undefined
    if (!saved) continue
    if (!validDate(saved.date)) throw new Error('旧记录日期损坏，已保留原数据，请先备份并检查')
    const day = data.days[saved.date] ||= emptyDay()
    if (key.startsWith('daily-record')) day.entries = saved.entries as typeof day.entries
    else day.plans = saved.items as typeof day.plans
  }
  const profile = read('user-profile') as Partial<JournalData['profile']> | undefined
  if (profile) data.profile = { ...data.profile, ...profile }
  const start = uni.getStorageSync('start-date')
  if (start) data.startDate = start
  data.gramsMemory = (read('grams-memory') || {}) as JournalData['gramsMemory']
  data.customRecipes = (read('custom-recipes') || []) as JournalData['customRecipes']
  data.hiddenRecipeIds = (read('hidden-recipes') || []) as string[]
  validateJournal(data)
  // Link only unique, exact legacy matches. Ambiguous old rows remain untouched.
  for (const day of Object.values(data.days)) for (const plan of day.plans.filter(p => p.eaten)) {
    if (day.entries.some(e => e.planItemId === plan.id)) continue
    const samePlans = day.plans.filter(p => p.eaten && p.foodId === plan.foodId && p.grams === plan.grams)
    const entries = day.entries.filter(e => !e.planItemId && e.food.id === plan.foodId && e.grams === plan.grams && Math.abs(e.subtotalKcal - plan.kcal) <= .51)
    if (samePlans.length === 1 && entries.length === 1) entries[0].planItemId = plan.id
  }
  return data
}
export function writeJournal(data: JournalData) {
  validateJournal(data)
  try { uni.setStorageSync(JOURNAL_KEY, JSON.stringify(data)) }
  catch { throw new Error('本机存储写入失败，数据未保存。请先导出备份，检查可用空间后重试') }
}
export function exportBackup(data: JournalData) {
  validateJournal(data)
  return JSON.stringify({ format: 'yikou-backup', version: data.customFoods?.length ? 3 : 2, exportedAt: new Date().toISOString(), data }, null, 2)
}
export function parseBackup(raw: string): JournalData {
  if (raw.length > 4 * 1024 * 1024) throw new Error('备份超过 4 MB，请检查是否选错文件')
  const file = parseJson(raw) as { format?: string; version?: number; data?: unknown }
  if (!file || file.format !== 'yikou-backup' || ![2, 3].includes(file.version || 0)) throw new Error('请选择本应用导出的 v2 或 v3 JSON 备份')
  validateJournal(file.data)
  return clone(file.data)
}
export function mergeBackup(local: JournalData, incoming: JournalData): JournalData {
  // Catalog preferences (including preset deletion) remain local during merge.
  // A full replace restores the backup's preferences instead.
  const next = clone(local)
  const sourceData = clone(incoming)
  const remapped = new Map<number, number>()
  if (sourceData.customFoods?.length) {
    const catalog = next.customFoods ||= []
    for (const food of sourceData.customFoods) {
      const same = catalog.find(existing => existing.customKey === food.customKey)
      if (same) {
        for (const key of ['name', 'category', 'kcal', 'carbs', 'protein', 'fat', 'portionGrams'] as const) {
          if (same[key] !== food[key]) throw new Error('同一自定义食材的数据存在差异，请先核对备份；本次未合并')
        }
        remapped.set(food.id, same.id)
      } else {
        const id = catalog.some(existing => existing.id === food.id) ? nextCustomFoodId([...catalog, ...sourceData.customFoods]) : food.id
        remapped.set(food.id, id); catalog.push({ ...food, id })
      }
    }
    for (const day of Object.values(sourceData.days)) {
      day.entries.forEach(entry => { entry.food.id = remapped.get(entry.food.id) ?? entry.food.id })
      day.plans.forEach(plan => {
        plan.foodId = remapped.get(plan.foodId) ?? plan.foodId
        plan.children?.forEach(child => { child.foodId = remapped.get(child.foodId) ?? child.foodId })
      })
    }
    sourceData.customRecipes.forEach(recipe => recipe.ingredients.forEach(ingredient => { ingredient.foodId = remapped.get(ingredient.foodId) ?? ingredient.foodId }))
    for (const [oldId, newId] of remapped) if (sourceData.gramsMemory[oldId] !== undefined && next.gramsMemory[newId] === undefined) next.gramsMemory[newId] = sourceData.gramsMemory[oldId]
  }
  for (const [date, source] of Object.entries(sourceData.days)) {
    const target = next.days[date]
    if (!target) { next.days[date] = clone(source); continue }
    // A linked plan and record are one unit when IDs conflict.
    const localPlanIds = new Set(target.plans.map(p => p.id))
    const localEntryIds = new Set(target.entries.map(e => e.id))
    const localPortions = dayPortionIds(target)
    const blockedPlans = new Set(source.entries.filter(e => localEntryIds.has(e.id) && e.planItemId).map(e => e.planItemId))
    target.plans.push(...clone(source.plans.filter(p => !localPlanIds.has(p.id) && !blockedPlans.has(p.id) && !(p.groupName && localPortions.has(recipePortionId(p.id) || '')))))
    target.entries.push(...clone(source.entries.filter(e => !localEntryIds.has(e.id) && !localPortions.has(e.dish?.id || (e.planItemId ? recipePortionId(e.planItemId) || '' : '')) && (!e.planItemId || (!localPlanIds.has(e.planItemId) && !blockedPlans.has(e.planItemId))))))
  }
  next.customRecipes.push(...clone(sourceData.customRecipes.filter(r => !next.customRecipes.some(existing => existing.id === r.id))))
  validateJournal(next)
  return next
}
