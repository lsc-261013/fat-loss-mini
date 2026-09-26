<template>
  <view class="plans">
    <view class="heading"><view><text class="title">{{ date === journal.today ? '今日计划' : '当日计划' }}</text><text class="caption">{{ pending.length }} 项待吃，剩余约 {{ Math.round(pending.reduce((s,p) => s+p.pendingKcal,0)) }} 千卡</text></view><button v-if="items.length" @tap="manage = !manage; selected = []">{{ manage ? '完成' : '管理' }}</button></view>
    <text v-if="!items.length" class="empty">还没有计划。点「＋ 添加」选食材，或从食谱添加。</text>
    <view v-if="manage" class="selection"><button @tap="selected = selected.length === items.length ? [] : items.map(p => p.id)">{{ selected.length === items.length ? '取消全选' : '全选' }}</button><text>已选 {{ selected.length }} 项</text><button :disabled="!pending.length" @tap="run(pending.map(p => p.id), 'eat')">全部待吃记已吃</button></view>
    <view v-for="item in items" :key="item.id" class="plan-item">
    <view class="row" @tap="manage && toggle(item.id)">
      <view v-if="manage" class="check" :class="{ checked: selected.includes(item.id) }">{{ selected.includes(item.id) ? '✓' : '' }}</view>
      <view class="info"><text class="name">{{ item.name }}</text><text class="caption">{{ item.recipe ? '整道' : item.items[0].grams + ' g' }} · {{ Math.round(item.kcal) }} 千卡 · {{ stateLabels[item.state] }}</text><button v-if="item.recipe" class="ingredients-toggle" @tap.stop="expanded = expanded === item.id ? '' : item.id">{{ expanded === item.id ? '收起配料' : '查看配料' }} {{ expanded === item.id ? '−' : '+' }}</button><text v-else-if="item.items[0].groupName" class="caption">{{ item.items[0].groupName }} · 旧计划，份次待核对</text></view>
      <button v-if="!manage" class="eat" :class="{ done: item.state === 'eaten' }" @tap.stop="run([item.id], item.state === 'eaten' ? 'revoke' : 'eat')">{{ item.state === 'eaten' ? '撤回已吃' : item.state === 'partial' ? '记完剩余' : '记已吃' }}</button>
    </view>
    <view v-if="expanded === item.id" class="ingredients"><view v-for="part in item.items" :key="part.id" class="ingredient"><text>{{ part.foodName }} {{ part.grams }} g</text><text>{{ Math.round(planCalories(part)) }} 千卡{{ item.state === 'partial' ? (item.eatenIds.includes(part.id) ? ' · 已吃' : ' · 待吃') : '' }}</text></view></view>
    </view>
    <view v-if="manage" class="batch"><button :disabled="!selectedPending" @tap="run(selected, 'eat')">记已吃 ({{ selectedPending }})</button><button :disabled="!selectedEaten" @tap="run(selected, 'revoke')">撤回已吃 ({{ selectedEaten }})</button><button class="danger" :disabled="!selected.length" @tap="run(selected, 'remove')">移除计划 ({{ selected.length }})</button><text class="caption">撤回会扣回对应摄入；移除计划保留已吃记录。</text></view>
    <button v-if="date === journal.today" class="recipe-link" @tap="openRecipes">从食谱添加计划</button>
  </view>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useJournalStore } from '@/store/journal'
import { planCalories } from '@/utils/nutrition'
import { groupPlans, planGroupAction } from '@/utils/planGroups'
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
.plans { background:#fff; padding:20rpx 0; margin-bottom:24rpx; }
.heading,.selection,.row { display:flex; align-items:center; justify-content:space-between; gap:16rpx; }
.title { display:block; font-size:28rpx; font-weight:500; }
.caption { display:block; font-size:24rpx; color:#68766f; line-height:1.6; }
button { margin:0; padding:0 12rpx; line-height:76rpx; font-size:26rpx; color:#28745b; background:transparent; flex-shrink:0; }
.empty { display:block; padding:36rpx 0; color:#68766f; line-height:1.7; }
.plan-item { border-top:1px solid #edf0e9; margin-top:12rpx; }.row { padding:22rpx 0; }
.ingredients { padding:0 0 24rpx; }.ingredient { display:flex; justify-content:space-between; gap:12rpx; font-size:max(24rpx,12px); color:#68766f; padding:8rpx 0; }.ingredients-toggle { text-align:left; padding:0; font-size:max(24rpx,12px); }
.info { flex:1; min-width:0; }.name { display:block; font-size:28rpx; font-weight:600; overflow-wrap:anywhere; }
.group { font-size:22rpx; }.eat { border-radius:8rpx; background:#edf4ef; font-size:24rpx; }.done { color:#68766f; background:#f0f2ed; }
.check { border:1px solid #aebbb0; border-radius:6rpx; width:44rpx; height:44rpx; flex-shrink:0; text-align:center; }.checked { background:#28745b; color:white; }
.selection { flex-wrap:wrap; margin-top:16rpx; background:#f5f7f1; border-radius:12rpx; font-size:24rpx; }.selection button { font-size:24rpx; }
.batch { display:flex; flex-wrap:wrap; gap:12rpx; margin-top:18rpx; }.batch button { flex:1 1 42%; border-radius:14rpx; background:#eaf2e9; }.batch .danger { color:#a34831; background:#fbede6; }.batch .caption { width:100%; }.recipe-link { width:100%; margin-top:16rpx; }
.title { font-size:max(28rpx,14px); }.name { font-size:max(28rpx,14px); }.caption,.group { font-size:max(24rpx,12px); }
button,.selection button { min-height:44px; line-height:44px; font-size:max(26rpx,13px); }.selection { justify-content:flex-start; column-gap:8rpx; }.selection>text { margin-left:auto; }.selection button:last-child { width:100%; text-align:left; border-top:1px solid #e5ebe4; }
</style>
