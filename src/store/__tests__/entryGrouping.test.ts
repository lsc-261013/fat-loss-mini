import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useJournalStore } from '../journal'
import { usePlanStore } from '../plan'
import { recipes } from '@/data/recipes'
import { clone, exportBackup, mergeBackup, parseBackup } from '@/utils/journalPersistence'
import { groupEntries, selectedEntryGroups } from '@/utils/entryGroups'
import { createEntry, sumEntries } from '@/utils/nutrition'
import { entryGroupImage } from '@/utils/foodVisuals'
import { confirmRecipeHiding, recipeManagementLists } from '@/utils/recipePhotoManagement'
import { emptyDay, emptyJournal } from '@/types/journal'

const date = '2026-10-05', previousDate = '2026-10-04'
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='
const custom = () => ({ ...clone(recipes[0]), id: 'custom_r11', name: '自己的燕麦餐', photo })
let respond: (answer: { confirm: boolean; cancel: boolean }) => void
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 5, 12))
  const storage = new Map<string, string>()
  vi.stubGlobal('uni', { getStorageInfoSync: () => ({ keys: [...storage.keys()] }), getStorageSync: (key: string) => storage.get(key),
    setStorageSync: vi.fn((key: string, value: string) => storage.set(key, value)),
    showModal: vi.fn((options: { success: typeof respond }) => { respond = options.success }) })
  setActivePinia(createPinia())
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
function setup(customSource = false) {
  const journal = useJournalStore(), plan = usePlanStore(); journal.refresh()
  const source = customSource ? custom() : recipes[0]
  if (customSource) journal.saveCustomRecipe(source)
  plan.addRecipeGroup(source.name, source.ingredients, source.id)
  return { journal, plan, source, ids: journal.todayDay.plans.map(item => item.id) }
}
function groups(journal: ReturnType<typeof useJournalStore>) { return groupEntries(journal.todayDay.entries, journal.todayDay.plans) }

describe('intake dish portions preserve ingredient snapshots', () => {
  it('shows one dish with three exact ingredient records, without changing totals or underlying count', () => {
    const { journal, ids } = setup(); journal.planAction(date, ids, 'eat')
    const rows = groups(journal)
    expect(rows).toHaveLength(1); expect(rows[0].dish).toBe(true); expect(rows[0].name).toBe(recipes[0].name)
    expect(rows[0].entries).toHaveLength(3); expect(journal.todayDay.entries).toHaveLength(3)
    expect(rows[0].kcal).toBe(sumEntries(journal.todayDay.entries).kcal)
    expect(rows[0].entries.every(entry => entry.dish?.id && entry.dish.recipeId === recipes[0].id)).toBe(true)
    expect(entryGroupImage(rows[0])).toBe('/static/food/r1.jpg')
  })
  it('keeps two servings of the same recipe and a separately recorded same food as three display items', () => {
    const { journal, plan, source } = setup(); plan.addRecipeGroup(source.name, source.ingredients, source.id)
    journal.planAction(date, journal.todayDay.plans.map(item => item.id), 'eat')
    const single = journal.addEntry(date, journal.allFoods.find(food => food.id === 9)!, 40)
    const rows = groups(journal)
    expect(rows).toHaveLength(3); expect(rows.map(row => row.entries.length)).toEqual([3, 3, 1])
    expect(rows[0].id).not.toBe(rows[1].id); expect(rows[2].entries[0].id).toBe(single.id); expect(single.dish).toBeUndefined()
    expect(rows.reduce((sum, row) => sum + row.kcal, 0)).toBe(sumEntries(journal.todayDay.entries).kcal)
  })
  it('groups only actually eaten members of a partially confirmed plan, then adds the remaining members to that portion', () => {
    const { journal, ids } = setup(); journal.planAction(date, [ids[0]], 'eat')
    expect(groups(journal)[0].entries).toHaveLength(1); expect(groups(journal)[0].kcal).toBe(150.8)
    const portion = groups(journal)[0].id
    journal.planAction(date, ids, 'eat'); journal.planAction(date, ids, 'eat')
    expect(groups(journal)).toHaveLength(1); expect(groups(journal)[0].id).toBe(portion); expect(groups(journal)[0].entries).toHaveLength(3)
  })
  it('updates one actual ingredient and both totals, while original planned grams and other snapshots stay intact; undo restores it', () => {
    const { journal, ids } = setup(); journal.planAction(date, ids, 'eat')
    const before = clone(journal.todayDay), entry = journal.todayDay.entries[0], portion = groups(journal)[0].id
    journal.updateEntry(date, entry.id, 62.5)
    expect(groups(journal)[0].id).toBe(portion); expect(groups(journal)[0].kcal).toBe(sumEntries(journal.todayDay.entries).kcal)
    expect(journal.todayDay.entries.slice(1)).toEqual(before.entries.slice(1)); expect(journal.todayDay.plans).toEqual(before.plans)
    expect(journal.todayDay.entries[0].dish).toEqual(entry.dish)
    journal.undoDay(); expect(journal.todayDay).toEqual(before)
  })
  it('preserves old dish name and values through source editing, hiding, deletion and plan removal; missing image falls back', () => {
    const { journal, ids } = setup(true); journal.planAction(date, ids, 'eat')
    const entries = clone(journal.todayDay.entries), total = sumEntries(entries)
    journal.saveCustomRecipe({ ...custom(), name: '新的菜名', ingredients: [{ foodId: 9, grams: 50 }] }, custom().id)
    journal.hideRecipes([custom().id]); expect(entryGroupImage(groups(journal)[0], journal.data.customRecipes)).toBe(photo)
    journal.deleteCustomRecipes([custom().id]); expect(entryGroupImage(groups(journal)[0], journal.data.customRecipes)).toBe('')
    journal.planAction(date, ids, 'remove')
    expect(groups(journal)).toHaveLength(1); expect(groups(journal)[0].name).toBe(custom().name)
    expect(journal.todayDay.entries).toEqual(entries); expect(sumEntries(journal.todayDay.entries)).toEqual(total)
    setActivePinia(createPinia()); const loaded = useJournalStore(); loaded.refresh(); expect(groups(loaded)[0].name).toBe(custom().name)
  })
  it('reads reliable legacy links without rewriting, and captures their minimal label before explicitly removing plans', () => {
    const { journal, ids } = setup(); journal.planAction(date, ids, 'eat')
    journal.mutate(next => { for (const entry of next.days[date].entries) delete entry.dish; next.days[date].entries[0].subtotalKcal = 147.25 })
    const before = clone(journal.todayDay.entries), stored = uni.getStorageSync('journal-v2')
    expect(groups(journal)).toHaveLength(1); expect(journal.todayDay.entries).toEqual(before); expect(uni.getStorageSync('journal-v2')).toBe(stored)
    journal.planAction(date, ids, 'remove'); expect(groups(journal)).toHaveLength(1)
    expect(journal.todayDay.entries.map(({ dish: _dish, ...entry }) => entry)).toEqual(before)
    expect(journal.todayDay.entries[0].subtotalKcal).toBe(147.25)
  })
  it('keeps orphaned and ambiguous old links independent instead of guessing from names or timing', () => {
    const { journal, ids } = setup(); journal.planAction(date, ids, 'eat')
    const entries = journal.todayDay.entries.map(({ dish: _dish, ...entry }) => entry)
    expect(groupEntries(entries)).toHaveLength(3)
    const mixedSources = journal.todayDay.plans.map((item, i) => ({ ...item, recipeId: i ? 'another_recipe' : item.recipeId }))
    expect(groupEntries(entries, mixedSources)).toHaveLength(3)
    const ambiguous = journal.todayDay.plans.map((item, i) => ({ ...item, groupName: i ? '同编号另一菜名' : item.groupName }))
    expect(groupEntries(entries, ambiguous)).toHaveLength(3)
    const conflicting = clone(journal.todayDay.entries); conflicting[1].dish!.name = '不同的菜名'
    expect(groupEntries(conflicting)).toHaveLength(3)
  })
  it('selects display portions but deletes exactly their actual ingredient IDs, with plan reset and undo', () => {
    const { journal, ids } = setup(); journal.planAction(date, ids, 'eat'); journal.addEntry(date, journal.allFoods[0], 25)
    const before = clone(journal.todayDay), selection = selectedEntryGroups(groups(journal), [groups(journal)[0].id])
    expect(selection.count).toBe(1); expect(selection.details).toBe(3); expect(selection.ids).toEqual(before.entries.slice(0, 3).map(entry => entry.id))
    journal.deleteEntries(date, selection.ids); expect(groups(journal)).toHaveLength(1); expect(groups(journal)[0].dish).toBe(false)
    expect(journal.todayDay.plans.every(plan => !plan.eaten)).toBe(true)
    journal.undoDay(); expect(journal.todayDay).toEqual(before)
  })
  it.each(['eat', 'remove', 'delete', 'update'] as const)('leaves storage and grouping unchanged on failed %s persistence', action => {
    const { journal, ids } = setup(); if (action !== 'eat') journal.planAction(date, ids, 'eat')
    const before = clone(journal.data), stored = uni.getStorageSync('journal-v2')
    vi.mocked(uni.setStorageSync).mockImplementationOnce(() => { throw new Error('quota') })
    expect(() => action === 'eat' || action === 'remove' ? journal.planAction(date, ids, action) : action === 'delete' ? journal.deleteEntries(date, journal.todayDay.entries.map(entry => entry.id)) : journal.updateEntry(date, journal.todayDay.entries[0].id, 50)).toThrow()
    expect(journal.data).toEqual(before); expect(uni.getStorageSync('journal-v2')).toBe(stored)
  })
})

describe('optional dish metadata and backup isolation', () => {
  it('round-trips grouping through backup, replacement import, refresh and a historical date with its stored values', () => {
    const { journal, ids } = setup(); journal.planAction(date, ids, 'eat'); journal.planAction(date, ids, 'remove')
    journal.addEntry(previousDate, journal.allFoods[0], 20)
    const before = clone(journal.data), backup = parseBackup(exportBackup(journal.data))
    journal.importData(backup, 'replace'); expect(journal.data).toEqual(before)
    journal.selectDate(previousDate); expect(groupEntries(journal.currentDay.entries)).toHaveLength(1)
    setActivePinia(createPinia()); const loaded = useJournalStore(); loaded.refresh()
    expect(loaded.data.days).toEqual(before.days); expect(groups(loaded)).toHaveLength(1)
  })
  it('keeps local portions as a unit when merging conflicting subsets, and imports a distinct new serving', () => {
    const { journal, plan, source, ids } = setup(); journal.planAction(date, ids, 'eat')
    const incoming = clone(journal.data); journal.planAction(date, ids, 'remove')
    journal.deleteEntries(date, [journal.todayDay.entries[2].id]); const local = clone(journal.data)
    incoming.days[date].entries[2].id = 'different_entry_same_portion'; incoming.days[date].plans[2].id = ids[2].replace(/_2$/, '_8')
    const merged = mergeBackup(local, incoming)
    expect(merged.days[date]).toEqual(local.days[date]); expect(groupEntries(merged.days[date].entries)).toHaveLength(1)
    plan.addRecipeGroup(source.name, source.ingredients, source.id); journal.planAction(date, journal.todayDay.plans.map(item => item.id), 'eat')
    const fresh = clone(journal.data); const withNew = mergeBackup(local, fresh)
    expect(groupEntries(withNew.days[date].entries, withNew.days[date].plans)).toHaveLength(2)
    expect(local).toEqual(merged)
  })
  it('accepts old backups without dish fields and leaves unlinked rows unchanged', () => {
    const journal = useJournalStore(); journal.refresh(); const old = emptyJournal(date); old.days[date] = emptyDay()
    old.days[date].entries = [createEntry(journal.allFoods[0], 100), createEntry(journal.allFoods[0], 100)]
    const restored = parseBackup(exportBackup(old)); expect(restored).toEqual(old); expect(groupEntries(restored.days[date].entries)).toHaveLength(2)
  })
  it.each(['wrong_id', 'missing_name', 'wrong_source', 'missing_plan'] as const)('rejects malformed optional metadata: %s', scenario => {
    const { journal, ids } = setup(); journal.planAction(date, ids, 'eat'); const data = clone(journal.data), entry = data.days[date].entries[0]
    if (scenario === 'wrong_id') entry.dish!.id = 'another_portion'
    else if (scenario === 'missing_name') entry.dish!.name = ''
    else if (scenario === 'wrong_source') entry.dish!.recipeId = 123 as unknown as string
    else delete entry.planItemId
    expect(() => exportBackup(data)).toThrow()
  })
})

describe('existing recipe management uses protected hiding', () => {
  it('hides and restores a mixed preset/custom selection after confirmation, preserving recipe and day contents', () => {
    const { journal, ids } = setup(true); journal.planAction(date, ids, 'eat')
    const before = clone(journal.data), saved = vi.fn(), error = vi.fn(), targets = ['r1', custom().id]
    confirmRecipeHiding(journal, targets, saved, error); respond({ confirm: false, cancel: true }); expect(journal.data).toEqual(before)
    confirmRecipeHiding(journal, targets, saved, error); respond({ confirm: true, cancel: false })
    expect(saved).toHaveBeenCalledWith(targets); expect(error).not.toHaveBeenCalled()
    expect(journal.data.days).toEqual(before.days); expect(journal.data.customRecipes).toEqual(before.customRecipes)
    const lists = recipeManagementLists(journal.data.customRecipes, journal.data.hiddenRecipeIds)
    expect(lists.hidden.map(item => item.id)).toEqual(targets); expect(lists.existing.some(item => targets.includes(item.id))).toBe(false)
    journal.restoreRecipes(targets); expect(journal.data).toEqual(before)
  })
  it.each(['failure', 'stale', 'missing'] as const)('does not report a successful hide on %s', scenario => {
    const { journal } = setup(true), saved = vi.fn(), error = vi.fn()
    confirmRecipeHiding(journal, [scenario === 'missing' ? 'deleted_source' : custom().id], saved, error)
    if (scenario === 'stale') journal.removeRecipePhoto(custom().id)
    const before = clone(journal.data)
    if (scenario === 'failure') vi.mocked(uni.setStorageSync).mockImplementationOnce(() => { throw new Error('quota') })
    respond({ confirm: true, cancel: false }); expect(saved).not.toHaveBeenCalled(); expect(error).toHaveBeenCalled(); expect(journal.data).toEqual(before)
  })
})
