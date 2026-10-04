import type { EntryDish, JournalDay, MealEntry, PlanItem } from '@/types/journal'
import { groupPlans, recipePortionId, type PlanGroup } from './planGroups'
import { sumEntries } from './nutrition'

export interface EntryGroup {
  id: string; name: string; dish: boolean; entries: MealEntry[]; kcal: number
  recipeId?: string; plan?: PlanGroup
}

function planDishLinks(plans: PlanItem[], entries: MealEntry[] = []) {
  const groups = groupPlans(plans, entries).filter(group => group.recipe)
  const portions = groups.map(group => recipePortionId(group.items[0].id)!)
  const links = new Map<string, { dish: EntryDish; plan: PlanGroup }>()
  for (const group of groups) {
    const id = recipePortionId(group.items[0].id)!
    if (portions.filter(portion => portion === id).length !== 1) continue
    const sourceIds = new Set(group.items.map(item => item.recipeId))
    if (sourceIds.size > 1) continue
    const recipeId = sourceIds.size === 1 ? group.items[0].recipeId : undefined
    const dish: EntryDish = { id, name: group.name, ...(recipeId ? { recipeId } : {}) }
    for (const item of group.items) links.set(item.id, { dish, plan: group })
  }
  return links
}

// Capture only reliable portion links during an explicit action. Historical values are never recalculated.
export function captureEntryDishes(day: JournalDay) {
  const links = planDishLinks(day.plans, day.entries)
  for (const entry of day.entries) {
    const link = entry.planItemId && links.get(entry.planItemId)
    if (!entry.dish && link) entry.dish = { ...link.dish }
  }
}

export function groupEntries(entries: MealEntry[], plans: PlanItem[] = []): EntryGroup[] {
  const links = planDishLinks(plans, entries)
  const candidates = entries.map(entry => {
    const link = entry.planItemId ? links.get(entry.planItemId) : undefined
    return { entry, dish: entry.dish || link?.dish, plan: link?.plan }
  })
  const unsafe = new Set<string>()
  const seen = new Map<string, { name: string; recipeIds: Set<string>; planIds: Set<string> }>()
  for (const { entry, dish } of candidates) {
    if (!dish) continue
    const previous = seen.get(dish.id) || { name: dish.name, recipeIds: new Set<string>(), planIds: new Set<string>() }
    if (previous.name !== dish.name || (entry.planItemId && previous.planIds.has(entry.planItemId))) unsafe.add(dish.id)
    if (dish.recipeId) previous.recipeIds.add(dish.recipeId)
    if (previous.recipeIds.size > 1) unsafe.add(dish.id)
    if (entry.planItemId) previous.planIds.add(entry.planItemId)
    seen.set(dish.id, previous)
  }
  const groups = new Map<string, EntryGroup>()
  for (const { entry, dish, plan } of candidates) {
    const reliable = dish && !unsafe.has(dish.id)
    const id = JSON.stringify(reliable ? ['dish', dish.id] : ['entry', entry.id])
    let group = groups.get(id)
    if (!group) {
      group = { id, name: reliable ? dish.name : entry.food.name, dish: !!reliable, entries: [], kcal: 0,
        ...(reliable && dish.recipeId ? { recipeId: dish.recipeId } : {}), ...(reliable && plan ? { plan } : {}) }
      groups.set(id, group)
    }
    group.entries.push(entry)
  }
  for (const group of groups.values()) group.kcal = sumEntries(group.entries).kcal
  return [...groups.values()]
}

export function selectedEntryGroups(groups: EntryGroup[], selectedIds: string[]) {
  const selected = groups.filter(group => selectedIds.includes(group.id))
  const entries = selected.flatMap(group => group.entries)
  return { count: selected.length, details: entries.length, ids: entries.map(entry => entry.id), kcal: sumEntries(entries).kcal }
}

// Merge conflicts apply to a whole portion, including snapshots whose source plan was removed.
export function dayPortionIds(day: JournalDay): Set<string> {
  return new Set([...day.plans.map(plan => plan.groupName ? recipePortionId(plan.id) : undefined),
    ...day.entries.map(entry => entry.dish?.id || (entry.planItemId ? recipePortionId(entry.planItemId) : undefined))].filter((id): id is string => !!id))
}
