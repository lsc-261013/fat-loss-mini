<template>
  <view class="custom-food-overlay" @tap="close">
    <view class="custom-food-panel" @tap.stop>
      <view class="editor-heading"><text>添加新食材</text><button @tap="close" aria-label="关闭新食材"><AppIcon name="close"/></button></view>
      <scroll-view class="editor-body" scroll-y>
        <view class="editor-fields">
          <text class="label">食材名称</text>
          <input v-model="form.name" class="field" maxlength="50" placeholder="可加品牌或做法，方便区分" aria-label="新食材名称" />
          <text class="label">已知分量与对应热量</text>
          <text class="hint">照包装或可靠资料填写。例如：150克，180千卡。</text>
          <view class="measurement"><view class="measure-field"><input type="digit" v-model="form.grams" aria-label="已知分量克数" placeholder="150" /><text>克</text></view><view class="measure-field"><input type="digit" v-model="form.energy" aria-label="对应热量" placeholder="180" /></view></view>
          <view class="unit-row"><button :class="{active: form.unit === 'kcal'}" @tap="form.unit = 'kcal'">千卡 kcal</button><button :class="{active: form.unit === 'kJ'}" @tap="form.unit = 'kJ'">千焦 kJ</button></view>
          <text v-if="preview" class="conversion">换算：每100克 {{ Math.round(preview.kcal * 100) / 100 }} 千卡</text>
          <text class="label">食材分类</text><text class="hint">{{ categoryChosen ? '已按你的选择分类。' : form.category === 'other' ? '名称暂时无法明确归类，可选择下方分类。' : '根据名称给出的建议，可自行调整。' }}</text>
          <view class="category-options"><button v-for="category in foodCategories" :key="category.key" :class="{active: form.category === category.key}" @tap="form.category = category.key; categoryChosen = true">{{ category.label }}</button></view>
          <view class="nutrition-heading"><text class="label">营养数据</text><text class="hint">选填</text></view>
          <text class="hint">填写上述 {{ form.grams || '已知' }} 克食材对应的营养克数。没填表示未知，填0表示确实为0。</text>
          <view v-for="field in macroFields" :key="field.key" class="macro-field"><text>{{ field.label }}</text><input type="digit" v-model="form[field.key]" :aria-label="field.label + '克数'" placeholder="未填写" /><text>克</text></view>
          <text class="hint end-note">保存到本机食材库，可在记录、计划和自建菜谱中使用。</text>
          <text v-if="error" class="field-error">{{ error }}</text>
        </view>
      </scroll-view>
      <view class="editor-footer"><button class="save" :disabled="saving" @tap="save">保存食材并选分量</button></view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted, onUnmounted } from 'vue'
import AppIcon from './AppIcon.vue'
import { useJournalStore } from '@/store/journal'
import { foodCategories, normalizeCustomFood, suggestCategory, type CustomFoodInput } from '@/utils/customFoods'
import type { CustomFood } from '@/types/journal'
const props = defineProps<{ initialName: string }>()
const emit = defineEmits<{ close: []; saved: [food: CustomFood] }>()
const journal = useJournalStore()
const categoryChosen = ref(false), saving = ref(false), error = ref('')
const form = reactive<CustomFoodInput>({ name: props.initialName, grams: '', energy: '', unit: 'kcal', category: suggestCategory(props.initialName), carbs: '', protein: '', fat: '' })
const macroFields = [{ key: 'protein', label: '蛋白质' }, { key: 'carbs', label: '碳水' }, { key: 'fat', label: '脂肪' }] as const
watch(() => form.name, name => { if (!categoryChosen.value) form.category = suggestCategory(name) })
watch(form, () => { error.value = '' })
const preview = computed(() => { try { return normalizeCustomFood(form) } catch { return null } })
// #ifdef H5
let previousOverflow = ''
onMounted(() => { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden' })
onUnmounted(() => { document.body.style.overflow = previousOverflow })
// #endif
function close() {
  const dirty = form.name !== props.initialName || form.grams !== '' || form.energy !== '' || form.carbs !== '' || form.protein !== '' || form.fat !== '' || categoryChosen.value
  if (!dirty) { emit('close'); return }
  uni.showModal({ title: '放弃填写？', content: '这个食材尚未保存。', confirmText: '放弃', cancelText: '继续填写', success: result => { if (result.confirm) emit('close') } })
}
function save() {
  if (saving.value) return
  saving.value = true
  try { const food = journal.addCustomFood(form); emit('saved', food); uni.showToast({ title: '食材已保存，请选实际食用分量', icon: 'none' }) }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '未能保存，请重试'; uni.showToast({ title: error.value, icon: 'none' }) }
  finally { saving.value = false }
}
</script>
<style scoped>
.custom-food-overlay { position:fixed; inset:0; z-index:1100; display:flex; align-items:flex-end; justify-content:center; }
.custom-food-panel { width:100%; height:92vh; height:92dvh; display:flex; flex-direction:column; overflow:hidden; background:#fff; }
.editor-heading { display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--line); font-weight:600; }
button { margin:0; min-height:44px; line-height:44px; font-size:max(26rpx,13px); padding:0 20rpx; background:transparent; color:var(--brand); border-radius:8rpx; }
.editor-body { flex:1; height:0; min-height:0; }.label { display:block; font-weight:500; }.hint { display:block; color:var(--muted); line-height:1.7; margin:8rpx 0 12rpx; }
.field { height:46px; padding:0 20rpx; border:1px solid var(--line); border-radius:8rpx; font-size:16px; margin:12rpx 0 28rpx; }
.measurement { display:flex; gap:16rpx; }.measure-field { flex:1; min-width:0; display:flex; align-items:center; gap:8rpx; border:1px solid var(--line); border-radius:8rpx; padding:0 16rpx; }.measure-field input { width:0; flex:1; min-width:0; height:46px; font-size:16px; }.measure-field text { color:var(--muted); }
.unit-row { display:flex; gap:16rpx; margin:12rpx 0; }.unit-row button { border:1px solid var(--line); flex:1; color:var(--muted); }.unit-row .active,.category-options .active { color:var(--brand); background:#edf4ef; border-color:var(--brand); }.conversion { display:block; color:var(--brand); margin:12rpx 0 28rpx; }
.category-options { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12rpx; margin-bottom:28rpx; }.category-options button { border:1px solid var(--line); color:var(--muted); }
.nutrition-heading { display:flex; align-items:center; gap:16rpx; }.nutrition-heading .hint { margin:0; }.macro-field { display:flex; align-items:center; gap:20rpx; margin:12rpx 0; font-size:max(26rpx,13px); }.macro-field>text:first-child { width:4em; }.macro-field input { flex:1; width:0; min-width:0; border:1px solid var(--line); border-radius:8rpx; padding:0 16rpx; height:44px; font-size:16px; }.end-note { margin-top:24rpx; }
.editor-footer { border-top:1px solid var(--line); flex-shrink:0; }.save { background:var(--brand); color:#fff; width:100%; }

.custom-food-overlay { background:#1b30254d; }.custom-food-panel { max-width:600px; border-radius:24px 24px 0 0; }.editor-heading { padding:12px 20px; font-size:20px; }.editor-heading button { display:flex; align-items:center; justify-content:center; padding:0; }.editor-fields { padding:20px; }.label { font-size:14px; }.hint { font-size:12px; }.field,.measure-field,.macro-field input { border-radius:12px; }.category-options button,.unit-row button { border-radius:12px; font-size:13px; }.conversion { background:#edf2e5; padding:12px; border-radius:12px; font-size:13px; }.editor-footer { padding:14px 20px calc(18px + env(safe-area-inset-bottom)); }.save { border-radius:12px; font-size:14px; }
@media(max-width:350px) { .editor-fields,.editor-footer { padding-left:16px; padding-right:16px; } }
</style>
