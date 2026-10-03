<template>
  <view class="food-visual" :class="['tone-' + category, { 'is-placeholder': !src || failed }]">
    <image v-if="displaySrc && !failed" class="food-photo" :src="displaySrc" mode="aspectFill" :alt="label + '，食物图片'" @error="failed = true" />
    <view v-else class="food-fallback"><image :src="'/static/icons/' + fallback + extension" mode="aspectFit" aria-hidden="true" /><text v-if="caption" class="fallback-caption">{{ caption }}</text></view>
  </view>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { recipePhotoSource } from '@/utils/recipePhotos'
const props = withDefaults(defineProps<{src?: string; category?: string; label?: string; caption?: string}>(), {src:'', category:'dish', label:'食物', caption:''})
const failed = ref(false)
const displaySrc = ref('')
let extension = '.png'
// #ifdef H5
extension = '.svg'
// #endif
watch(() => props.src, async src => {
  failed.value = false; displaySrc.value = ''
  try { const resolved = await recipePhotoSource(src); if (props.src === src) displaySrc.value = resolved }
  catch { if (props.src === src) failed.value = true }
}, { immediate: true })
const fallback = computed(() => ['staple','protein','vegetable','fruit','fat','other'].includes(props.category) ? props.category : 'dish')
</script>
<style scoped>
.food-visual { position:relative; width:100%; height:100%; overflow:hidden; background:#f2eadf; }
.food-photo { width:100%; height:100%; display:block; }
.food-fallback { width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12rpx; background:#f1eadc; }
.food-fallback image { width:56%; height:56%; max-width:160px; max-height:120px; }
.tone-vegetable .food-fallback { background:#eaf0df; }.tone-protein .food-fallback { background:#f5e9db; }.tone-fruit .food-fallback { background:#f7e7dd; }.tone-fat .food-fallback { background:#f3edce; }.tone-other .food-fallback { background:#e9ece8; }
.fallback-caption { color:#767265; font-size:12px; }
</style>
