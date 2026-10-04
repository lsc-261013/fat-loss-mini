<template>
  <view class="backup-card">
    <button class="backup-toggle" @tap="expanded = !expanded"><view class="backup-title"><AppIcon name="backup"/>数据备份</view><text>{{ expanded ? '收起' : '导出 / 导入' }}</text></button><view v-show="expanded"><text class="note">饮食、计划、个人设置、自建食谱和自定义食材都在本机。换设备或清理缓存前，先保存一份备份。</text>
    <view class="actions"><button :disabled="busy || !!journal.error" @tap="exportFile">导出备份文件</button><button :disabled="busy || !!journal.error" @tap="chooseFile">选择备份文件</button></view>
    <text class="note">导入前会显示预览，不会选完就覆盖。备份包含身体数据和自建菜谱照片，请保存在自己信任的位置。</text>
    <button class="text-button" :disabled="!!journal.error" @tap="copyBackup">下载不方便？复制备份文本</button>
    <button class="text-button" @tap="showText = !showText">{{ showText ? '收起文本导入' : '无法选择文件？粘贴备份文本' }}</button>
    <view v-if="showText"><textarea aria-label="备份文本" v-model="rawText" :maxlength="4194304" placeholder="粘贴本应用导出的 JSON 备份内容" /><button :disabled="!rawText.trim() || busy" @tap="preview(rawText)">校验并预览文本</button></view>
    <view v-if="incoming" class="preview">
      <text class="title">导入预览</text><text class="note">{{ counts.days }} 个日期 · {{ counts.entries }} 条记录 · {{ counts.plans }} 项计划 · {{ incoming.customRecipes.length }} 份自建食谱 · {{ incoming.customFoods?.length || 0 }} 种自定义食材</text>
      <text class="note">与本机有 {{ conflicts.days }} 个相同日期、{{ conflicts.items }} 个相同记录或计划编号。</text>
      <view class="modes"><button :class="{ active: mode === 'merge' }" @tap="mode = 'merge'">合并保留本机</button><button :class="{ active: mode === 'replace' }" @tap="mode = 'replace'">完整恢复备份</button></view>
      <text class="note">{{ mode === 'merge' ? '补入缺少的日期、记录、计划、食谱和自定义食材。同一记录、计划或菜份保留本机版本；菜份冲突时整份不补入，以免复活已删明细。不同的自定义食材分别保留。本机个人设置、日期目标和隐藏食谱状态保留。' : '用备份替换当前全部数据和设置。导入前会保存本机副本，之后可导出；没有新操作时可直接撤销。' }}</text>
      <view class="actions"><button @tap="incoming = null">取消</button><button :disabled="busy" @tap="applyImport">确认{{ mode === 'merge' ? '合并' : '恢复' }}</button></view>
    </view>
    <text v-if="message" class="feedback" :class="{ error: failed }">{{ message }}</text>
    <view v-if="hasRecovery" class="recovery"><text class="note">本机保留了最近一次导入前的副本。</text><button class="text-button" @tap="exportRecovery">导出导入前副本</button><button v-if="canUndo" @tap="undoImport">撤销本次导入</button><text v-else class="note">导入后已有新操作，直接撤销已关闭，以免丢失新记录。</text></view>
    </view>
    <text v-if="!expanded" class="note">换设备或清理缓存前，请先导出备份。</text>
  </view>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import { useJournalStore } from '@/store/journal'
import { exportBackup, parseBackup } from '@/utils/journalPersistence'
import { chooseBackupFile, saveBackupFile } from '@/utils/backupFiles'
import { localDate } from '@/utils/input'
import type { JournalData } from '@/types/journal'
const journal = useJournalStore()
const expanded = ref(false)
const busy = ref(false), showText = ref(false), rawText = ref(''), message = ref(''), failed = ref(false)
const incoming = ref<JournalData | null>(null)
const mode = ref<'merge' | 'replace'>('merge')
const recoveryVersion = ref(0)
const hasRecovery = computed(() => { void recoveryVersion.value; void journal.revision; return !!journal.recoveryBackup() })
const canUndo = computed(() => { void recoveryVersion.value; void journal.revision; return journal.canUndoImport() })
const counts = computed(() => { const days = Object.values(incoming.value?.days || {}); return { days: days.length, entries: days.reduce((n,d) => n+d.entries.length,0), plans: days.reduce((n,d) => n+d.plans.length,0) } })
const conflicts = computed(() => {
  let days = 0, items = 0
  for (const [date, day] of Object.entries(incoming.value?.days || {})) {
    const local = journal.data.days[date]; if (!local) continue; days++
    items += day.entries.filter(e => local.entries.some(l => l.id === e.id)).length + day.plans.filter(p => local.plans.some(l => l.id === p.id)).length
  }
  return { days, items }
})
function feedback(text: string, error = false) { message.value = text; failed.value = error }
async function run(action: () => Promise<void>) {
  busy.value = true
  try { await action() } catch (e) { feedback(e instanceof Error ? e.message : '操作未完成，请重试；本机数据保留', true) }
  finally { busy.value = false }
}
function exportFile() { run(async () => { journal.ensureLoaded(); await saveBackupFile(exportBackup(journal.data), 'yikou-'+localDate()+'.json'); feedback('已发起文件保存，请确认文件已存好。') }) }
function copyBackup() {
  try {
    journal.ensureLoaded()
    uni.setClipboardData({ data: exportBackup(journal.data), success: () => feedback('备份已复制，请粘贴到自己的文本文件保存。可通过「粘贴备份文本」恢复。'), fail: () => feedback('复制失败，请尝试导出文件。',true) })
  } catch (e) { feedback(e instanceof Error ? e.message : '备份未能生成',true) }
}
function preview(raw: string) { try { incoming.value = parseBackup(raw); mode.value = 'merge'; feedback('文件校验通过，请核对预览后选择导入方式。') } catch(e) { incoming.value = null; feedback(e instanceof Error ? e.message : '文件无法读取',true) } }
function chooseFile() { run(async () => preview(await chooseBackupFile())) }
function applyImport() {
  if (!incoming.value) return
  const data = incoming.value, selectedMode = mode.value
  uni.showModal({ title: selectedMode === 'merge' ? '合并备份' : '完整恢复备份', content: selectedMode === 'merge' ? '补入缺少的数据，冲突保留本机。导入前会保存恢复副本。' : '当前全部数据和设置将替换为备份内容。已保存的导入前副本可用于恢复。确定继续？', confirmText: selectedMode === 'merge' ? '合并' : '恢复', success: result => {
    if (!result.confirm) return
    run(async () => { journal.importData(data, selectedMode); incoming.value = null; rawText.value = ''; recoveryVersion.value++; feedback('导入成功。没有新的修改前，可在下方撤销本次导入。') })
  } })
}
function undoImport() { run(async () => { journal.undoImport(); recoveryVersion.value++; feedback('已恢复到导入前的数据。') }) }
function exportRecovery() { run(async () => { const saved = JSON.parse(journal.recoveryBackup()); await saveBackupFile(exportBackup(saved.before),'yikou-before-import-'+localDate()+'.json'); feedback('已发起导入前副本保存。') }) }
</script>
<style scoped>
.title { display:block; font-weight:700; margin-bottom:16rpx; }.note { display:block; line-height:1.7; margin:12rpx 0; }
.actions,.modes { display:flex; flex-wrap:wrap; margin:20rpx 0; }button { background:#eaf2e9; color:#28745b; font-size:26rpx; line-height:80rpx; border-radius:14rpx; margin:0; padding:0 18rpx; }.actions button,.modes button { flex:1; }.modes .active { background:#28745b; color:#fff; }.text-button { background:transparent; }.preview { border-top:1px solid #dde6da; margin-top:24rpx; }.feedback { display:block; padding:20rpx; border-radius:12rpx; line-height:1.7; }.error { background:#fbede6; color:#a34831; }textarea { width:100%; box-sizing:border-box; border-radius:12rpx; margin:12rpx 0; }.recovery { margin-top:24rpx; }
.backup-toggle { display:flex; justify-content:space-between; align-items:center; gap:16rpx; width:100%; padding:0; min-height:44px; background:transparent; color:var(--ink); font-weight:600; }.backup-toggle text { color:var(--brand); font-weight:400; }

.backup-card { background:var(--surface); padding:18px 20px; border:1px solid var(--line); border-radius:20px; margin-top:20px; }.backup-title { display:flex; align-items:center; gap:10px; }.backup-toggle { font-size:17px; }.note { color:var(--muted); font-size:12px; }.backup-card button { color:var(--brand); background:#eaf0e2; border-radius:12px; font-size:13px; line-height:44px; min-height:44px; }.backup-card .text-button,.backup-card .backup-toggle { background:transparent; }.backup-card .backup-toggle { color:var(--ink); }.backup-card .modes .active { color:#fff; background:var(--brand); }.actions,.modes { gap:8px; }.preview { padding-top:18px; }.title { font-size:16px; }.feedback { color:var(--brand); background:#edf2e5; font-size:13px; }.feedback.error { color:#a34831; background:#fbede6; }textarea { font-size:13px; border:1px solid var(--line); background:var(--wash); padding:12px; }.text-button { font-size:12px; white-space:normal; text-align:left; line-height:1.6 !important; padding:10px 0; }.backup-toggle text { font-size:12px; }
@media(max-width:350px) { .backup-card { padding:16px; }.backup-card .actions button,.backup-card .modes button { padding:0 10px; font-size:12px; } }
</style>
