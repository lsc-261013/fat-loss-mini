<template>
  <view class="record-page">
    <view class="record-heading"><text class="page-title">饮食记录</text><text class="page-subtitle">计划与实际，分开记清楚</text></view>
    <view v-if="journal.error" class="error-banner"><text>数据未就绪：{{ journal.error }}。原数据保留，请勿清理缓存。</text><button @tap="journal.refresh()">重试读取</button></view>
    <view class="date-bar"><button aria-label="前一天" @tap="changeDate(shiftDate(journal.selectedDate,-1))">‹</button><picker mode="date" :value="journal.selectedDate" :end="journal.today" start="1900-01-01" @change="onDatePick"><view class="date-value"><AppIcon name="calendar" :size="17"/><text class="date-label">{{ journal.selectedDate }}{{ isToday ? ' · 今天' : '' }}</text><text class="date-caret">▾</text></view></picker><button aria-label="后一天" :disabled="isToday" @tap="changeDate(shiftDate(journal.selectedDate,1))">›</button></view>
    <view class="date-tools"><picker v-if="savedDates.length" :range="savedDates" @change="onSavedPick"><view class="target-link">历史记录 ({{ savedDates.length }}) ▾</view></picker><button v-if="!isToday" class="text-button" @tap="changeDate(journal.today)">回到今天</button></view>
    <view v-if="!isToday" class="history-banner">{{ journal.selectedDate }} 的记录，可在此补记{{ day.target ? '。目标沿用当天值。' : '。未保存当日目标。' }}</view>
    <CalorieCard compact :label="isToday ? '今天已记录' : '当日已记录'" :target="day.target?.targetCalories" :consumed="total.kcal" :macros="macroPayload" />
    <view v-if="!day.target" class="target-note"><button v-if="isToday" class="text-button" @tap="openProfile">设置参考目标 ›</button><text v-else>这一天未保存参考目标</text></view>
    <view class="journal-toolbar">
      <view class="journal-tabs"><view class="tab-slider" :class="{ plan: activeList === 'plan' }"/><button :class="{ active: activeList === 'record' }" @tap="switchList('record')">已吃 <text>{{ entryGroups.length }}</text></button><button :class="{ active: activeList === 'plan' }" @tap="switchList('plan')">计划 <text>{{ planCount }}</text></button></view>
      <button class="add-button" :disabled="!!journal.error" @tap="adding = !adding; addMode = activeList">{{ adding ? '取消添加' : '＋ 添加' }}</button>
    </view>
    <view v-if="adding && !journal.error" class="add-panel">
      <view class="add-heading"><text>{{ addMode === 'record' ? '记下吃过的食物' : '添加待吃食物' }}</text><text class="add-date">{{ journal.selectedDate }}</text></view>
      <FoodPicker :key="journal.selectedDate + addMode" :action-label="addMode === 'record' ? '保存记录' : '加入计划'" @add="onAddFood" />
    </view>
    <view v-if="activeList === 'record'" class="section-card content-enter">
      <view class="section-head"><view><text class="section-caption">{{ entryGroups.length ? entryGroups.length + ' 项已吃 · 合计 ' + Math.round(total.kcal) + ' 千卡' : '饮食明细' }}</text></view><button v-if="entryGroups.length" class="text-button" @tap="manageMode = !manageMode; selectedIds = []">{{ manageMode ? '完成' : '管理' }}</button></view>
      <text v-if="entryGroups.some(group => group.dish)" class="section-caption">每份菜独立记录，食材分量可分别修改。</text>
      <view v-if="!day.entries.length" class="empty-state"><view class="empty-picture"><FoodVisual /></view><text class="empty-title">{{ isToday ? '今天还没有记录' : '这一天还没有记录' }}</text><text>点「＋ 添加」，选择食物和分量。</text></view>
      <view v-if="manageMode" class="entry-selection"><button class="text-button" @tap="selectedIds = selectedIds.length === entryGroups.length ? [] : entryGroups.map(group => group.id)">{{ selectedIds.length === entryGroups.length ? '取消全选' : '全选已吃项' }}</button><text class="section-caption">已选 {{ selectedIds.length }} 项 · {{ selectedEntries.details }} 条实际明细</text></view>
      <EntryGroupCard v-for="group in entryGroups" :key="group.id" :group="group" :custom-recipes="journal.data.customRecipes" :manage="manageMode" :selected="selectedIds.includes(group.id)" @select="toggleSelect(group.id)" @edit="editing = { entry: $event, date: journal.selectedDate }" />
      <button v-if="manageMode" class="delete-button" :disabled="!selectedIds.length" @tap="deleteSelected">删除选中 ({{ selectedIds.length }} 项)</button>
    </view>
    <PlanManager class="content-enter" v-if="activeList === 'plan'" :date="journal.selectedDate" />
    <view v-if="journal.undo && journal.undo.date === journal.selectedDate" class="undo-row"><text>{{ journal.undo.label }}</text><button class="text-button" @tap="safely(() => journal.undoDay(), '已恢复')">撤销刚才操作</button></view>
    <text class="local-note">热量为估算值。数据备份在「我的」。</text>
    <EntryEditor v-if="editing" :key="editing.entry.id" :entry="editing.entry" :day-kcal="total.kcal" @close="editing = null" @save="saveEdit" />
  </view>
</template>
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import FoodVisual from '@/components/FoodVisual.vue'
import AppIcon from '@/components/AppIcon.vue'
import CalorieCard from '@/components/CalorieCard.vue'
import FoodPicker from '@/components/FoodPicker.vue'
import EntryEditor from '@/components/EntryEditor.vue'
import EntryGroupCard from '@/components/EntryGroupCard.vue'
import PlanManager from '@/components/PlanManager.vue'
import { useJournalStore } from '@/store/journal'
import { useJournalNavigation } from '@/store/journalNavigation'
import { sumEntries } from '@/utils/nutrition'
import { groupPlans } from '@/utils/planGroups'
import { groupEntries, selectedEntryGroups } from '@/utils/entryGroups'
import { shiftDate } from '@/utils/input'
import type { FoodItem, MealEntry } from '@/types/journal'
const journal = useJournalStore()
const journalNavigation = useJournalNavigation()
const addMode = ref<'record' | 'plan'>('record')
const activeList = ref<'record' | 'plan'>('record')
const adding = ref(false)
function switchList(list: 'record' | 'plan') { activeList.value = list; adding.value = false; manageMode.value = false; selectedIds.value = [] }
const manageMode = ref(false)
const selectedIds = ref<string[]>([])
const editing = ref<{ entry: MealEntry; date: string } | null>(null)
const day = computed(() => journal.currentDay)
const entryGroups = computed(() => groupEntries(day.value.entries, day.value.plans))
const selectedEntries = computed(() => selectedEntryGroups(entryGroups.value, selectedIds.value))
watch(entryGroups, groups => { selectedIds.value = selectedIds.value.filter(id => groups.some(group => group.id === id)); if (!groups.length) manageMode.value = false })
const planCount = computed(() => groupPlans(day.value.plans, day.value.entries).length)
const total = computed(() => sumEntries(day.value.entries))
const isToday = computed(() => journal.selectedDate === journal.today)
const savedDates = computed(() => Object.keys(journal.data.days).filter(date => journal.data.days[date].entries.length || journal.data.days[date].plans.length).sort().reverse())
const macroPayload = computed(() => {
  const t = day.value.target
  return { carbs: { target: t?.carbs, consumed: total.value.carbs }, protein: { target: t?.protein, consumed: total.value.protein }, fat: { target: t?.fat, consumed: total.value.fat } }
})
watch(() => journal.selectedDate, () => { editing.value = null; adding.value = false; selectedIds.value = []; manageMode.value = false })
onShow(() => { journal.refresh(); const list = journalNavigation.consume(); if (list) switchList(list) })
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
  const selection = selectedEntries.value, ids = [...selection.ids], date = journal.selectedDate, revision = journal.revision
  if (!ids.length) return
  uni.showModal({ title: '删除选中的已吃项？', content: '删除 '+selection.count+' 项已吃中的 '+selection.details+' 条实际食材明细？将扣除约 '+Math.round(selection.kcal)+' 千卡摄入，仍存在的关联计划变为待吃。本页可撤销。', confirmText: '删除', confirmColor: '#ac513b', success: result => {
    if (!result.confirm) return
    if (date !== journal.selectedDate || revision !== journal.revision) { uni.showToast({ title: '数据已变化，请重新选择', icon: 'none' }); return }
    if (safely(() => journal.deleteEntries(date,ids), '记录已删除')) { selectedIds.value = []; manageMode.value = false }
  } })
}
</script>
<style scoped>

.record-page { max-width:620px; margin:0 auto; padding:20px 20px 32px; padding-bottom:calc(28px + env(safe-area-inset-bottom)); }.record-heading { margin-bottom:16px; }.page-title { display:block; font-size:25px; font-weight:650; }.page-subtitle { display:block; color:var(--muted); font-size:12px; margin-top:4px; }
.date-bar { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:2px 4px; background:#fff; border:1px solid var(--line); border-radius:16px; }.date-bar button { margin:0; width:44px; min-height:44px; line-height:44px; background:transparent; color:var(--ink); font-size:26px; padding:0; }.date-value { display:flex; align-items:center; justify-content:center; gap:8px; padding:10px 0; font-size:14px; font-weight:550; }.date-tools { display:flex; justify-content:space-between; align-items:center; min-height:44px; margin:3px 2px 10px; }.target-link { color:var(--muted); font-size:12px; padding:12px 0; }.target-note { color:var(--muted); font-size:12px; text-align:right; padding-top:4px; }
.history-banner,.error-banner { background:#f4eadb; color:#795725; padding:12px; margin-bottom:14px; border-radius:12px; font-size:12px; }
.journal-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:22px 0 14px; }.journal-tabs { position:relative; display:flex; background:#e9ede2; border-radius:14px; padding:4px; flex:1; max-width:230px; }.tab-slider { position:absolute; left:4px; top:4px; bottom:4px; width:calc(50% - 4px); background:white; box-shadow:0 2px 6px #26352c0a; border-radius:11px; transition:transform .22s ease; }.tab-slider.plan { transform:translateX(100%); }.journal-tabs button { position:relative; flex:1; min-width:0; margin:0; padding:0 6px; background:transparent; color:var(--muted); font-size:14px; line-height:44px; min-height:44px; }.journal-tabs .active { color:var(--brand); font-weight:600; }.journal-tabs text { font-size:11px; margin-left:4px; }.add-button { color:white; background:var(--brand); border-radius:13px; font-size:13px; padding:0 13px; margin:0; line-height:46px; min-height:46px; white-space:nowrap; }
.add-panel { padding:16px; background:#fff; border:1px solid var(--line); border-radius:18px; margin-bottom:18px; animation:content-in .2s ease; }.add-heading { display:flex; justify-content:space-between; gap:8px; font-size:14px; margin-bottom:16px; }.add-date { color:var(--muted); font-size:11px; }
.section-card { background:#fff; border:1px solid var(--line); border-radius:18px; padding:6px 14px 14px; }.section-head { display:flex; align-items:center; justify-content:space-between; min-height:48px; gap:8px; }.section-caption { display:block; font-size:11px; line-height:1.7; color:var(--muted); }.text-button { margin:0; padding:0 4px; min-height:44px; line-height:44px; color:var(--brand); font-size:12px; background:transparent; white-space:nowrap; }
.empty-state { padding:22px 6px 24px; text-align:center; color:var(--muted); font-size:12px; }.empty-picture { width:130px; height:105px; border-radius:50%; overflow:hidden; margin:0 auto 18px; }.empty-title { display:block; color:var(--ink); font-size:17px; font-weight:500; margin-bottom:6px; }
.entry-row { display:flex; align-items:center; gap:12px; padding:14px 0; border-top:1px solid var(--line); }.entry-icon { width:44px; height:44px; border-radius:13px; overflow:hidden; flex-shrink:0; }.entry-info { flex:1; min-width:0; }.entry-name { display:block; font-size:15px; font-weight:550; overflow-wrap:anywhere; }.entry-meta { display:block; font-size:11px; color:var(--muted); margin-top:3px; line-height:1.6; }.entry-actions { display:flex; flex-direction:column; align-items:flex-end; gap:0; }.entry-kcal { font-size:16px; font-weight:550; white-space:nowrap; }.entry-kcal text { font-size:10px; color:var(--muted); font-weight:400; }.entry-actions .text-button { min-height:44px; line-height:44px; }
.check { width:20px; height:20px; border:1px solid #8d9b85; border-radius:6px; flex-shrink:0; text-align:center; font-size:13px; }.check.checked { color:#fff; background:var(--brand); border-color:var(--brand); }.delete-button { background:#faeee6; color:#9e543f; margin-top:16px; font-size:14px; border-radius:12px; }.undo-row { display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:12px; background:#eaf0e0; border:1px solid #dce4d3; border-radius:12px; padding:8px 14px; margin-top:16px; animation:content-in .2s ease; }.local-note { font-size:11px; }
@media(max-width:350px) { .record-page { padding:18px 16px 28px; }.entry-row { gap:8px; }.entry-icon { width:36px; height:36px; }.entry-name { font-size:14px; }.entry-kcal { font-size:14px; }.section-card { padding-left:12px; padding-right:12px; }.journal-toolbar { gap:8px; }.add-panel { padding:12px; } }

.date-bar>button { flex-shrink:0; }.date-bar picker { flex:1; min-width:0; }.date-value { white-space:nowrap; gap:6px; }.date-label,.date-caret { flex-shrink:0; white-space:nowrap; }.date-label { font-variant-numeric:tabular-nums; }
.section-card { background:transparent; border:0; padding:0; }.entry-selection { display:flex; align-items:center; justify-content:space-between; gap:8px; }.delete-button { width:100%; min-height:48px; line-height:48px; }.empty-state { background:var(--surface); border:1px solid var(--line); border-radius:18px; }
@media(max-width:350px) { .date-bar { gap:4px; }.date-value { gap:4px; font-size:13px; } }
</style>
