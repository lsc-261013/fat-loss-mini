import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { emptyDay, emptyJournal, type JournalData, type JournalDay, type FoodItem, type UserProfile } from '@/types/journal'
import { clone, loadJournal, writeJournal, mergeBackup } from '@/utils/journalPersistence'
import { localDate, validDate } from '@/utils/input'
import { profileTarget } from '@/utils/calculator'
import { createEntry, foodPortion, newId } from '@/utils/nutrition'
import foods from '@/static/foods.json'
import { createCustomFood, type CustomFoodInput } from '@/utils/customFoods'

export const useJournalStore = defineStore('journal', () => {
  const data = ref<JournalData>(emptyJournal(localDate()))
  const today = ref(localDate())
  const selectedDate = ref(localDate())
  const error = ref('')
  const loaded = ref(false)
  const revision = ref(0)
  const undo = ref<{ date: string; before: JournalDay; revision: number; label: string } | null>(null)
  const currentDay = computed(() => data.value.days[selectedDate.value] || emptyDay())
  const todayDay = computed(() => data.value.days[today.value] || emptyDay())
  const allFoods = computed<FoodItem[]>(() => [...foods, ...(data.value.customFoods || [])])
  function addCustomFood(input: CustomFoodInput) {
    ensureLoaded()
    const food = createCustomFood(input, allFoods.value)
    mutate(next => { (next.customFoods ||= []).push(food) })
    return food
  }
  function commit(next: JournalData) { writeJournal(next); data.value = next; revision.value++; undo.value = null }
  function ensureLoaded() {
    if (loaded.value) return
    try { const next = loadJournal(); commit(next); loaded.value = true; error.value = '' }
    catch (e) { error.value = e instanceof Error ? e.message : '本机数据未能读取，原数据已保留'; throw e }
  }
  function refresh() {
    try {
      ensureLoaded()
      const date = localDate()
      if (selectedDate.value === today.value) selectedDate.value = date
      today.value = date
      const target = profileTarget(data.value.profile)
      if (!data.value.days[date] || JSON.stringify(data.value.days[date].target) !== JSON.stringify(target)) {
        const next = clone(data.value); const day = next.days[date] ||= emptyDay()
        day.target = target; day.targetSource = target ? 'saved' : 'unknown'; day.targetUpdatedAt = Date.now(); commit(next)
      }
      error.value = ''
    } catch (e) { error.value = e instanceof Error ? e.message : '存储读取失败' }
  }
  function selectDate(date: string) {
    if (!validDate(date) || date > localDate()) throw new Error('请选择今天或之前的日期')
    selectedDate.value = date; undo.value = null
  }
  function mutate(action: (next: JournalData) => void) { ensureLoaded(); const next = clone(data.value); action(next); commit(next) }
  function changeDay(date: string, action: (day: JournalDay) => void, label?: string) {
    ensureLoaded()
    if (!validDate(date) || date > localDate()) throw new Error('记录日期无效')
    if (today.value !== localDate()) { refresh(); throw new Error('日期已变化，请重新操作') }
    const next = clone(data.value); const before = clone(next.days[date] || emptyDay())
    const day = next.days[date] ||= emptyDay()
    if (date === today.value) { day.target = profileTarget(next.profile); day.targetSource = day.target ? 'saved' : 'unknown'; day.targetUpdatedAt = Date.now() }
    action(day); commit(next)
    if (label) undo.value = { date, before, revision: revision.value, label }
  }
  function undoDay() {
    const saved = undo.value
    if (!saved || saved.date !== selectedDate.value || saved.revision !== revision.value) throw new Error('已有新操作，无法撤销')
    changeDay(saved.date, day => Object.assign(day, clone(saved.before)))
  }
  function addEntry(date: string, food: FoodItem, grams: number, planItemId?: string) {
    const entry = createEntry(food, grams, planItemId)
    changeDay(date, day => {
      if (planItemId && day.entries.some(e => e.planItemId === planItemId)) throw new Error('这项计划已经记过了')
      day.entries.push(entry)
      if (planItemId) day.plans.forEach(p => { if (p.id === planItemId) p.eaten = true })
    }); return entry
  }
  function updateEntry(date: string, id: string, grams: number) {
    changeDay(date, day => {
      const entry = day.entries.find(e => e.id === id)
      if (!entry) throw new Error('记录已变化，请刷新')
      Object.assign(entry, { grams, ...foodPortion(entry.food, grams) })
    })
  }
  function deleteEntries(date: string, ids: string[]) {
    changeDay(date, day => {
      const links = day.entries.filter(e => ids.includes(e.id)).map(e => e.planItemId)
      day.entries = day.entries.filter(e => !ids.includes(e.id))
      day.plans.forEach(p => { if (links.includes(p.id) && !day.entries.some(e => e.planItemId === p.id)) p.eaten = false })
    }, '已删除记录')
  }
  function addPlan(date: string, food: FoodItem, grams: number) {
    const kcal = foodPortion(food, grams).subtotalKcal
    changeDay(date, day => day.plans.push({ id: newId(), foodId: food.id, foodName: food.name, category: food.category, grams, kcal, eaten: false }))
  }
  function planAction(date: string, ids: string[], action: 'eat' | 'revoke' | 'remove') {
    changeDay(date, day => {
      const selected = day.plans.filter(p => ids.includes(p.id))
      if (action === 'remove') { day.plans = day.plans.filter(p => !ids.includes(p.id)); return }
      for (const plan of selected) {
        const linked = day.entries.filter(e => e.planItemId === plan.id)
        if (action === 'eat') {
          if (plan.eaten || linked.length) continue
          const food = allFoods.value.find(f => f.id === plan.foodId)
          if (!food) throw new Error('存在无法识别的食材，本次操作未保存')
          day.entries.push(createEntry(food, plan.grams, plan.id)); plan.eaten = true
        } else {
          if (plan.eaten && !linked.length) throw new Error('含无法精确关联的旧版已吃计划，请先到已吃记录中核对；本次未撤回任何项')
          day.entries = day.entries.filter(e => e.planItemId !== plan.id); plan.eaten = false
        }
      }
    }, { eat: '已记入已吃', revoke: '已撤回已吃', remove: '已移除计划' }[action])
  }
  function updateProfile(patch: Partial<UserProfile>) {
    refresh()
    mutate(next => {
      next.profile = { ...next.profile, ...patch }
      const day = next.days[today.value] ||= emptyDay()
      day.target = profileTarget(next.profile); day.targetSource = day.target ? 'saved' : 'unknown'; day.targetUpdatedAt = Date.now()
    })
  }
  function importData(incoming: JournalData, mode: 'merge' | 'replace') {
    ensureLoaded()
    const next = mode === 'merge' ? mergeBackup(data.value, incoming) : clone(incoming)
    // Persist recovery before a single atomic main-document write.
    try { uni.setStorageSync('journal-before-import-v2', JSON.stringify({ before: data.value, applied: next })) }
    catch { throw new Error('空间不足或存储不可用，无法保存导入前副本，本次没有导入') }
    commit(next)
  }
  function canUndoImport() {
    try { const saved = JSON.parse(uni.getStorageSync('journal-before-import-v2') || 'null'); return !!saved && JSON.stringify(saved.applied) === JSON.stringify(data.value) } catch { return false }
  }
  function undoImport() {
    if (!canUndoImport()) throw new Error('导入后已有新操作，不能直接撤销；导入前副本仍保留')
    const saved = JSON.parse(uni.getStorageSync('journal-before-import-v2')); commit(saved.before)
    uni.removeStorageSync('journal-before-import-v2')
  }
  function recoveryBackup() { return uni.getStorageSync('journal-before-import-v2') as string }
  return { data, allFoods, addCustomFood, today, selectedDate, error, loaded, revision, currentDay, todayDay, undo, refresh, ensureLoaded, selectDate, mutate, changeDay, undoDay, addEntry, updateEntry, deleteEntries, addPlan, planAction, updateProfile, importData, canUndoImport, undoImport, recoveryBackup }
})
