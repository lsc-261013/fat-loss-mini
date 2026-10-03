<template>
  <view class="plans">
    <view class="heading"><view><text class="title">{{ date === journal.today ? '今日计划' : '当日计划' }}</text><text class="caption">{{ pending.length }} 项待吃，剩余约 {{ Math.round(pending.reduce((s,p) => s+p.pendingKcal,0)) }} 千卡</text></view><button v-if="items.length" @tap="manage = !manage; selected = []">{{ manage ? '完成' : '管理' }}</button></view>
    <view v-if="!items.length" class="empty"><view class="empty-picture"><FoodVisual /></view><text class="empty-title">给下一餐留个位置</text><text>点「＋ 添加」选食材，或从食谱添加。</text></view>
    <view v-if="manage" class="selection"><button @tap="selected = selected.length === items.length ? [] : items.map(p => p.id)">{{ selected.length === items.length ? '取消全选' : '全选' }}</button><text>已选 {{ selected.length }} 项</text><button :disabled="!pending.length" @tap="run(pending.map(p => p.id), 'eat')">全部待吃记已吃</button></view>
    <view v-for="item in items" :key="item.id" class="plan-item">
    <view class="row" @tap="manage && toggle(item.id)">
      <view v-if="manage" class="check" :class="{ checked: selected.includes(item.id) }">{{ selected.includes(item.id) ? '✓' : '' }}</view>
      <view class="plan-image"><FoodVisual :src="planImage(item)" :category="item.recipe ? 'dish' : item.items[0].category" :label="item.name"/></view><view class="info"><text class="name">{{ displayDishName(item.name) }}</text><text class="state-tag" :class="item.state">{{ stateLabels[item.state] }}</text><text class="caption">{{ item.recipe ? '整道' : item.items[0].grams + ' g' }} · 计划 {{ Math.round(item.kcal) }} 千卡</text><text v-if="item.eatenIds.length" class="actual-intake">{{ actualIntake(item) }}</text><button v-if="item.recipe" class="ingredients-toggle" @tap.stop="expanded = expanded === item.id ? '' : item.id">{{ expanded === item.id ? '收起计划配料' : '查看计划配料' }} {{ expanded === item.id ? '−' : '+' }}</button><text v-else-if="item.items[0].groupName" class="caption">{{ item.items[0].groupName }} · 旧计划，份次待核对</text></view>
      <button v-if="!manage" class="eat" :class="{ done: item.state === 'eaten' }" @tap.stop="run([item.id], item.state === 'eaten' ? 'revoke' : 'eat')">{{ item.state === 'eaten' ? '撤回已吃' : item.state === 'partial' ? '记完剩余' : '记已吃' }}</button>
    </view>
    <view class="ingredients-wrap" :class="{open:expanded === item.id}" :aria-hidden="expanded !== item.id"><view class="ingredients-clip"><view class="ingredients"><view v-for="part in item.items" :key="part.id" class="ingredient"><text>{{ part.foodName }} {{ part.grams }} g</text><text>{{ Math.round(planCalories(part)) }} 千卡{{ item.state === 'partial' ? (item.eatenIds.includes(part.id) ? ' · 已吃' : ' · 待吃') : '' }}</text></view></view></view></view>
    </view>
    <view v-if="manage" class="batch"><button :disabled="!selectedPending" @tap="run(selected, 'eat')">记已吃 ({{ selectedPending }})</button><button :disabled="!selectedEaten" @tap="run(selected, 'revoke')">撤回已吃 ({{ selectedEaten }})</button><button class="danger" :disabled="!selected.length" @tap="run(selected, 'remove')">移除计划 ({{ selected.length }})</button><text class="caption">撤回会扣回对应摄入；移除计划保留已吃记录。</text></view>
    <button v-if="date === journal.today" class="recipe-link" @tap="openRecipes">从食谱添加计划</button>
  </view>
</template>
<script setup lang="ts">
import FoodVisual from '@/components/FoodVisual.vue'
import { planImage, displayDishName } from '@/utils/foodVisuals'
import { computed, ref, watch } from 'vue'
import { useJournalStore } from '@/store/journal'
import { planCalories } from '@/utils/nutrition'
import { groupPlans, planGroupAction, type PlanGroup } from '@/utils/planGroups'
const props = defineProps<{ date: string }>()
const journal = useJournalStore()
const manage = ref(false)
const selected = ref<string[]>([])
const expanded = ref('')
const stateLabels = { pending: '待吃', partial: '部分已吃', eaten: '已吃' }
const items = computed(() => { const day = journal.data.days[props.date]; return groupPlans(day?.plans || [], day?.entries || []) })
const pending = computed(() => items.value.filter(p => p.pendingIds.length))
const selectedPending = computed(() => pending.value.filter(p => selected.value.includes(p.id)).length)
const selectedEaten = computed(() => items.value.filter(p => selected.value.includes(p.id) && p.eatenIds.length).length)
watch(() => props.date, () => { manage.value = false; selected.value = []; expanded.value = '' })
watch(items, () => {
  selected.value = selected.value.filter(id => items.value.some(item => item.id === id))
  if (!items.value.length) manage.value = false
  if (!items.value.some(item => item.id === expanded.value)) expanded.value = ''
})
function toggle(id: string) { selected.value = selected.value.includes(id) ? selected.value.filter(i => i !== id) : [...selected.value, id] }
function openRecipes() { uni.switchTab({ url: '/pages/recipe/index' }) }
function actualIntake(group: PlanGroup) {
  const entries = (journal.data.days[props.date]?.entries || []).filter(entry => entry.planItemId && group.eatenIds.includes(entry.planItemId))
  if (group.eatenIds.some(id => !entries.some(entry => entry.planItemId === id))) return '旧记录关联不完整，请到已吃明细核对'
  return `实际已记 ${Math.round(entries.reduce((sum, entry) => sum + entry.subtotalKcal, 0))} 千卡 · 分量在已吃中修改`
}
function run(ids: string[], action: 'eat' | 'revoke' | 'remove') {
  const date = props.date
  const revision = journal.revision
  const { ids: validIds, count } = planGroupAction(items.value, ids, action)
  if (!validIds.length) return
  const execute = () => {
    if (date !== props.date || revision !== journal.revision) { uni.showToast({ title: '数据已变化，请重新选择', icon: 'none' }); return }
    try { journal.planAction(date, validIds, action); selected.value = []; uni.showToast({ title: action === 'eat' ? '已计入饮食记录' : action === 'revoke' ? '已撤回，计划仍保留' : '已移除，已吃记录保留', icon: 'none' }) }
    catch (e) { uni.showModal({ title: '操作未保存', content: e instanceof Error ? e.message : '请检查本机存储后重试', showCancel: false }) }
  }
  if (action === 'eat') execute()
  else uni.showModal({ title: action === 'remove' ? '移除计划' : '撤回已吃', content: action === 'remove' ? `移除 ${count} 项计划？整道菜会一起移除，已吃记录及摄入保留。本页可撤销。` : `撤回 ${count} 项已吃？整道菜的关联记录会一起扣回，计划变为待吃。本页可撤销。`, confirmText: action === 'remove' ? '移除' : '撤回', success: result => { if (result.confirm) execute() } })
}
</script>
<style scoped>

.plans { padding:16px 14px; margin-bottom:20px; border:1px solid var(--line); border-radius:18px; background:#fff; }.heading,.selection,.row { display:flex; align-items:center; justify-content:space-between; gap:10px; }.title { display:block; font-size:17px; font-weight:600; }.caption { display:block; font-size:11px; color:var(--muted); line-height:1.7; margin-top:4px; }
button { margin:0; padding:0 8px; line-height:44px; min-height:44px; font-size:12px; color:var(--brand); background:transparent; flex-shrink:0; }.plan-item { border-top:1px solid var(--line); margin-top:14px; }.row { padding:14px 0; flex-wrap:wrap; justify-content:flex-start; }.plan-image { width:64px; height:72px; border-radius:12px; overflow:hidden; flex-shrink:0; }.info { flex:1; min-width:0; }.name { display:block; font-size:15px; font-weight:600; overflow-wrap:anywhere; }.state-tag { display:inline-block; background:#f5edde; color:#846135; font-size:10px; padding:2px 6px; border-radius:5px; margin-top:5px; }.state-tag.eaten { background:#eaf1e1; color:var(--brand); }.state-tag.partial { background:#f2e6d8; color:#846135; }.actual-intake { display:block; font-size:11px; color:var(--brand); line-height:1.7; margin-top:4px; }.eat { width:100%; text-align:center; line-height:44px; min-height:44px; border-radius:11px; color:var(--brand); background:#edf2e7; margin-top:2px; }.eat.done { background:var(--wash); color:var(--muted); }
.ingredients-toggle { padding:0; text-align:left; min-height:44px; line-height:44px; font-size:11px; color:var(--brand); }.ingredients-wrap { display:grid; grid-template-rows:0fr; opacity:0; overflow:hidden; transition:grid-template-rows .24s ease,opacity .2s ease; }.ingredients-wrap.open { grid-template-rows:1fr; opacity:1; }.ingredients-clip { min-height:0; overflow:hidden; }.ingredients { padding:10px 12px 16px; background:#f5f6f0; border-radius:10px; margin-bottom:2px; }.ingredient { display:flex; justify-content:space-between; gap:12px; color:var(--muted); font-size:12px; padding:5px 0; }.ingredient>text:first-child { flex:1; min-width:0; overflow-wrap:anywhere; }.ingredient>text:last-child { flex-shrink:0; }
.empty { text-align:center; padding:24px 0; color:var(--muted); font-size:12px; }.empty-picture { width:120px; height:100px; border-radius:50%; overflow:hidden; margin:0 auto 14px; }.empty-title { display:block; color:var(--ink); font-size:17px; margin-bottom:8px; }.check { border:1px solid #8d9b85; border-radius:6px; width:20px; height:20px; flex-shrink:0; text-align:center; font-size:13px; }.check.checked { color:#fff; background:var(--brand); }
.selection { flex-wrap:wrap; gap:6px; margin-top:14px; padding:8px; background:var(--wash); border-radius:12px; font-size:12px; }.selection>text { margin-left:auto; }.selection button:last-child { width:100%; text-align:left; border-top:1px solid var(--line); }.batch { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }.batch button { flex:1 1 42%; background:#eaf1e1; border-radius:10px; padding:0 6px; font-size:11px; }.batch .danger { color:#9e543f; background:#faeee6; }.batch .caption { width:100%; }.recipe-link { width:100%; margin-top:16px; background:var(--wash); border-radius:12px; }
@media(max-width:350px) { .plans { padding:14px 12px; }.plan-image { width:52px; height:60px; }.name { font-size:14px; }.row { gap:8px; } }

</style>
