<template>
  <view class="record-page">
    <view v-if="journal.error" class="error-banner"><text>数据未就绪：{{ journal.error }}。原数据保留，请勿清理缓存。</text><button @tap="journal.refresh()">重试读取</button></view>
    <view class="date-bar"><button aria-label="前一天" @tap="changeDate(shiftDate(journal.selectedDate,-1))">‹</button><picker mode="date" :value="journal.selectedDate" :end="journal.today" start="1900-01-01" @change="onDatePick"><view class="date-value">{{ journal.selectedDate }} {{ isToday ? '· 今天' : '' }} ▾</view></picker><button aria-label="后一天" :disabled="isToday" @tap="changeDate(shiftDate(journal.selectedDate,1))">›</button></view>
    <view class="date-tools"><picker v-if="savedDates.length" :range="savedDates" @change="onSavedPick"><view class="target-link">历史记录 ({{ savedDates.length }}) ▾</view></picker><button v-if="!isToday" class="text-button" @tap="changeDate(journal.today)">回到今天</button></view>
    <view v-if="!isToday" class="history-banner">{{ journal.selectedDate }} 的记录，可在此补记{{ day.target ? '。目标沿用当天值。' : '。未保存当日目标。' }}</view>
    <CalorieCard v-if="day.target" :target="day.target.targetCalories" :consumed="total.kcal" :macros="macroPayload" />
    <view v-else class="simple-summary"><view><text class="summary-label">{{ isToday ? '今日' : '当日' }}已记录</text><text class="summary-value">{{ Math.round(total.kcal) }} <text class="summary-unit">千卡</text></text></view><text v-if="isToday" class="target-link" @tap="openProfile">设置参考目标 ›</text><text v-else class="target-link">无历史目标</text></view>
    <view class="journal-toolbar">
      <view class="journal-tabs"><button :class="{ active: activeList === 'record' }" @tap="switchList('record')">已吃 <text>{{ day.entries.length }}</text></button><button :class="{ active: activeList === 'plan' }" @tap="switchList('plan')">计划 <text>{{ planCount }}</text></button></view>
      <button class="add-button" :disabled="!!journal.error" @tap="adding = !adding; addMode = activeList">{{ adding ? '取消添加' : '＋ 添加' }}</button>
    </view>
    <view v-if="adding && !journal.error" class="add-panel">
      <view class="add-heading"><text>{{ addMode === 'record' ? '记下吃过的食物' : '添加待吃食物' }}</text><text class="add-date">{{ journal.selectedDate }}</text></view>
      <FoodPicker :key="journal.selectedDate + addMode" :action-label="addMode === 'record' ? '保存记录' : '加入计划'" @add="onAddFood" />
    </view>
    <view v-if="activeList === 'record'" class="section-card">
      <view class="section-head"><view><text class="section-caption">{{ day.entries.length ? '合计 ' + Math.round(total.kcal) + ' 千卡' : '饮食明细' }}</text></view><button v-if="day.entries.length" class="text-button" @tap="manageMode = !manageMode; selectedIds = []">{{ manageMode ? '完成' : '管理' }}</button></view>
      <view v-if="!day.entries.length" class="empty-state"><text class="empty-title">{{ isToday ? '今天还没有记录' : '这一天还没有记录' }}</text><text>点「＋ 添加」，选择食物和分量。</text></view>
      <button v-if="manageMode" class="text-button" @tap="selectedIds = selectedIds.length === day.entries.length ? [] : day.entries.map(e => e.id)">{{ selectedIds.length === day.entries.length ? '取消全选' : '全选记录' }}</button>
      <view v-for="entry in day.entries" :key="entry.id" class="entry-row" @tap="manageMode && toggleSelect(entry.id)">
        <view v-if="manageMode" class="check" :class="{ checked: selectedIds.includes(entry.id) }">{{ selectedIds.includes(entry.id) ? '✓' : '' }}</view>
        <view class="entry-info"><text class="entry-name">{{ entry.food.name }}</text><text v-if="incompleteNutrition(entry.food)" class="entry-meta">营养数据未完善 · 热量已计入</text><text class="entry-meta">{{ entry.grams }} g<text v-if="entry.planItemId" class="source-label">来自计划</text></text></view>
        <view class="entry-actions"><text class="entry-kcal">{{ Math.round(entry.subtotalKcal) }} <text>千卡</text></text><button v-if="!manageMode" class="text-button" @tap.stop="editing = { entry, date: journal.selectedDate }">修改</button></view>
      </view>
      <button v-if="manageMode" class="delete-button" :disabled="!selectedIds.length" @tap="deleteSelected">删除选中 ({{ selectedIds.length }})</button>
    </view>
    <PlanManager v-if="activeList === 'plan'" :date="journal.selectedDate" />
    <view v-if="journal.undo && journal.undo.date === journal.selectedDate" class="undo-row"><text>{{ journal.undo.label }}</text><button class="text-button" @tap="safely(() => journal.undoDay(), '已恢复')">撤销刚才操作</button></view>
    <text class="local-note">热量为估算值。数据备份在「我的」。</text>
    <EntryEditor v-if="editing" :key="editing.entry.id" :entry="editing.entry" @close="editing = null" @save="saveEdit" />
  </view>
</template>
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import CalorieCard from '@/components/CalorieCard.vue'
import FoodPicker from '@/components/FoodPicker.vue'
import EntryEditor from '@/components/EntryEditor.vue'
import PlanManager from '@/components/PlanManager.vue'
import { useJournalStore } from '@/store/journal'
import { sumEntries, incompleteNutrition } from '@/utils/nutrition'
import { groupPlans } from '@/utils/planGroups'
import { shiftDate } from '@/utils/input'
import type { FoodItem, MealEntry } from '@/types/journal'
const journal = useJournalStore()
const addMode = ref<'record' | 'plan'>('record')
const activeList = ref<'record' | 'plan'>('record')
const adding = ref(false)
function switchList(list: 'record' | 'plan') { activeList.value = list; adding.value = false; manageMode.value = false; selectedIds.value = [] }
const manageMode = ref(false)
const selectedIds = ref<string[]>([])
const editing = ref<{ entry: MealEntry; date: string } | null>(null)
const day = computed(() => journal.currentDay)
const planCount = computed(() => groupPlans(day.value.plans, day.value.entries).length)
const total = computed(() => sumEntries(day.value.entries))
const isToday = computed(() => journal.selectedDate === journal.today)
const savedDates = computed(() => Object.keys(journal.data.days).filter(date => journal.data.days[date].entries.length || journal.data.days[date].plans.length).sort().reverse())
const macroPayload = computed(() => {
  const t = day.value.target
  if (!t) return undefined
  return { carbs: { target: t.carbs, consumed: total.value.carbs }, protein: { target: t.protein, consumed: total.value.protein }, fat: { target: t.fat, consumed: total.value.fat } }
})
watch(() => journal.selectedDate, () => { editing.value = null; adding.value = false; selectedIds.value = []; manageMode.value = false })
onShow(() => journal.refresh())
onPullDownRefresh(() => { journal.refresh(); uni.stopPullDownRefresh() })
function openProfile() { uni.switchTab({ url: '/pages/my/index' }) }
function changeDate(date: string) { safely(() => journal.selectDate(date)) }
function onDatePick(event: { detail: { value: string } }) { changeDate(event.detail.value) }
function onSavedPick(event: { detail: { value: string | number } }) { changeDate(savedDates.value[Number(event.detail.value)]) }
function safely(action: () => void, title?: string) {
  try { action(); if (title) uni.showToast({ title, icon: 'none' }); return true }
  catch (e) { uni.showModal({ title: '操作未保存', content: e instanceof Error ? e.message : '请检查本机存储后重试', showCancel: false }); return false }
}
function onAddFood(food: FoodItem, grams: number) {
  if (safely(() => addMode.value === 'record' ? journal.addEntry(journal.selectedDate, food, grams) : journal.addPlan(journal.selectedDate, food, grams), addMode.value === 'record' ? '已保存到所选日期' : '已加入所选日期计划')) adding.value = false
}
function toggleSelect(id: string) { selectedIds.value = selectedIds.value.includes(id) ? selectedIds.value.filter(i => i !== id) : [...selectedIds.value, id] }
function saveEdit(grams: number) {
  const saved = editing.value
  if (saved && safely(() => journal.updateEntry(saved.date, saved.entry.id, grams), '分量已更新')) editing.value = null
}
function deleteSelected() {
  const ids = [...selectedIds.value], date = journal.selectedDate, revision = journal.revision
  uni.showModal({ title: '删除饮食记录', content: '删除选中的 '+ids.length+' 条记录？摄入将重新汇总，关联计划变为待吃。本页可撤销。', confirmText: '删除', confirmColor: '#ac513b', success: result => {
    if (!result.confirm) return
    if (date !== journal.selectedDate || revision !== journal.revision) { uni.showToast({ title: '数据已变化，请重新选择', icon: 'none' }); return }
    if (safely(() => journal.deleteEntries(date,ids), '记录已删除')) { selectedIds.value = []; manageMode.value = false }
  } })
}
</script>
<style scoped>
.record-page { max-width:960rpx; margin:0 auto; padding:12rpx 36rpx 32rpx; padding-bottom:calc(32rpx + env(safe-area-inset-bottom)); }
.date-bar { display:flex; align-items:center; justify-content:space-between; gap:8rpx; }
.date-bar button { margin:0; width:88rpx; min-height:44px; line-height:44px; background:transparent; color:var(--ink); font-size:40rpx; padding:0; }
.date-value { padding:20rpx 0; font-size:max(30rpx,15px); font-weight:600; }
.date-tools { display:flex; justify-content:space-between; align-items:center; min-height:44px; border-bottom:1px solid var(--line); }
.target-link { color:var(--muted); font-size:max(24rpx,12px); padding:16rpx 0; }
.history-banner,.error-banner { background:#fff4e5; color:#795725; padding:20rpx; margin:16rpx 0; border-radius:8rpx; font-size:max(24rpx,12px); }
.simple-summary { padding:32rpx 0; display:flex; align-items:center; justify-content:space-between; }
.summary-label { display:block; color:var(--muted); font-size:max(24rpx,12px); }.summary-value { display:block; font-size:64rpx; font-weight:600; }.summary-unit { font-size:24rpx; font-weight:400; }
.journal-toolbar { display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--line); gap:12rpx; }
.journal-tabs { display:flex; gap:28rpx; }.journal-tabs button { border-radius:0; padding:18rpx 0; background:transparent; margin:0; font-size:max(30rpx,15px); color:var(--muted); line-height:1.8; min-height:44px; border-bottom:2px solid transparent; }
.journal-tabs button.active { color:var(--ink); font-weight:600; border-bottom-color:var(--brand); }.journal-tabs text { font-size:max(24rpx,12px); font-weight:400; margin-left:6rpx; }
.add-button { background:var(--brand); color:#fff; border-radius:10rpx; font-size:max(26rpx,13px); padding:0 22rpx; margin:0; line-height:44px; min-height:44px; white-space:nowrap; }
.add-panel { padding-top:24rpx; border-bottom:1px solid var(--line); }.add-heading { display:flex; justify-content:space-between; gap:8rpx; margin-bottom:20rpx; font-size:max(28rpx,14px); }.add-date { color:var(--muted); font-size:max(24rpx,12px); }
.section-head { display:flex; align-items:center; justify-content:space-between; min-height:88rpx; }.section-caption { color:var(--muted); font-size:max(24rpx,12px); }
.text-button { background:transparent; color:var(--brand); font-size:max(26rpx,13px); line-height:44px; min-height:44px; padding:0 8rpx; margin:0; white-space:nowrap; }
.empty-state { padding:60rpx 0; color:var(--muted); font-size:max(26rpx,13px); }.empty-title { display:block; color:var(--ink); font-size:max(30rpx,15px); margin-bottom:12rpx; }
.entry-row { display:flex; align-items:center; gap:16rpx; padding:14rpx 0; border-bottom:1px solid var(--line); min-height:130rpx; }
.entry-info { flex:1; min-width:0; }.entry-name { display:block; font-size:max(30rpx,15px); font-weight:500; overflow-wrap:anywhere; }.entry-meta { display:block; font-size:max(24rpx,12px); color:var(--muted); margin-top:4rpx; }.source-label { margin-left:16rpx; }
.entry-actions { display:flex; align-items:center; gap:16rpx; }.entry-kcal { font-size:max(30rpx,15px); }.entry-kcal text { font-size:max(22rpx,11px); color:var(--muted); }.entry-actions .text-button { font-size:max(24rpx,12px); }
.check { border:1px solid #9aaa9f; border-radius:6rpx; width:40rpx; height:40rpx; flex-shrink:0; text-align:center; }.check.checked { background:var(--brand); color:white; }
.delete-button { margin-top:20rpx; color:#a34831; background:#fbede6; line-height:44px; font-size:28rpx; border-radius:10rpx; }
.undo-row { display:flex; align-items:center; justify-content:space-between; gap:12rpx; background:#edf4ef; padding:12rpx 20rpx; border-radius:8rpx; margin-top:24rpx; font-size:max(24rpx,12px); }
.local-note { font-size:max(22rpx,11px); }
@media(max-width:350px) { .record-page { padding-left:28rpx; padding-right:28rpx; }.entry-actions { gap:8rpx; }.journal-tabs { gap:20rpx; } }
</style>
