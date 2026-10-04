import type { MealEntry, PlanItem } from '@/types/journal'
import { planCalories } from './nutrition'

export interface PlanGroup {
  id: string
  name: string
  recipe: boolean
  items: PlanItem[]
  pendingIds: string[]
  eatenIds: string[]
  kcal: number
  pendingKcal: number
  state: 'pending' | 'partial' | 'eaten'
}

// Existing recipe IDs encode the individual addition, not just the recipe name.
// Unknown legacy IDs remain separate so repeated portions are never guessed.
export function recipePortionId(id: string): string | undefined { return /^(grp_\d+(?:_[a-z0-9]+)?)_\d+$/.exec(id)?.[1] }
export function groupPlans(plans: PlanItem[], entries: MealEntry[] = []): PlanGroup[] {
  const linked = new Set(entries.map(entry => entry.planItemId).filter(Boolean))
  const groups = new Map<string, PlanGroup>()
  for (const item of plans) {
    const portion = item.groupName && recipePortionId(item.id)
    const id = portion ? JSON.stringify([portion, item.groupName]) : item.id
    let group = groups.get(id)
    if (!group) {
      group = { id, name: portion ? item.groupName! : item.foodName, recipe: !!portion, items: [], pendingIds: [], eatenIds: [], kcal: 0, pendingKcal: 0, state: 'pending' }
      groups.set(id, group)
    }
    const kcal = planCalories(item)
    group.items.push(item)
    group.kcal += kcal
    if (item.eaten || linked.has(item.id)) group.eatenIds.push(item.id)
    else { group.pendingIds.push(item.id); group.pendingKcal += kcal }
    group.state = !group.eatenIds.length ? 'pending' : group.pendingIds.length ? 'partial' : 'eaten'
  }
  return [...groups.values()]
}

export function planGroupAction(groups: PlanGroup[], selected: string[], action: 'eat' | 'revoke' | 'remove') {
  const affected = groups.filter(group => selected.includes(group.id) && (action === 'remove' || (action === 'eat' ? group.pendingIds.length : group.eatenIds.length)))
  return {
    count: affected.length,
    ids: affected.flatMap(group => action === 'remove' ? group.items.map(item => item.id) : action === 'eat' ? group.pendingIds : group.eatenIds),
  }
}

export function planStatusHint(total: number, pending: number, today = true): string {
  if (pending > 0) return `${pending} 项待吃 · 吃过再确认`
  if (total > 0) return `${today ? '今天' : '当日'}的计划已全部确认`
  return '看看日常搭配，也可以直接记录'
}
