<template>
  <view class="food-picker">
    <input class="food-search" aria-label="搜索食材" v-model="search" placeholder="搜索食材，如米饭、鸡蛋" confirm-type="search" />
    <button class="new-food" @tap="creatingFood = true"><AppIcon name="plus" :size="17"/> 添加新食材</button>
    <view v-show="!search.trim()" class="category-tabs">
      <view
        v-for="cat in categories"
        :key="cat.key"
        class="tab-item"
        :class="{ active: activeCat === cat.key }"
        @click="activeCat = cat.key; expanded = false"
      >
        <text class="tab-text">{{ cat.label }}</text>
        <view v-if="activeCat === cat.key" class="tab-indicator" />
      </view>
    </view>

    <text v-if="!filteredFoods.length" class="search-empty">{{ search.trim() ? '没找到这个食材，可以点上方「添加新食材」。' : '这个分类还没有食材，可以自己添加。' }}</text>
    <view class="food-grid">
      <button
        v-for="food in (expanded || search.trim() ? filteredFoods : filteredFoods.slice(0, 6))"
        :key="food.id"
        class="food-card"
        :aria-label="'选择' + food.name"
        @tap="openPicker(food)"
        hover-class="card-touch"
      >
        <view class="food-thumb"><FoodVisual :category="food.category" :label="food.name"/></view><view class="food-info"><text class="food-name">{{ food.name }}<text v-if="food.customKey" class="custom-badge">自定义</text></text><text class="food-meta">{{ Math.round(food.kcal * 100) / 100 }} 千卡 / 100 g</text><text v-if="incompleteNutrition(food)" class="food-meta">营养数据未完善</text></view><AppIcon name="plus" :size="18"/>
      </button>
    </view>

    <button v-if="!search.trim() && filteredFoods.length > 6" class="expand-foods" @tap="expanded = !expanded">{{ expanded ? '收起食材' : '查看全部 ' + filteredFoods.length + ' 种食材' }} {{ expanded ? '⌃' : '⌄' }}</button>
    <view v-if="showGrams" class="grams-overlay" @click="showGrams = false">
      <view class="grams-panel" @click.stop>
        <view class="grams-heading"><view class="grams-thumb"><FoodVisual :category="selectedFood?.category" :label="selectedFood?.name"/></view><text class="grams-title">{{ selectedFood?.name }}</text></view>
        <text class="grams-subtitle">每100g ≈ {{ Math.round((selectedFood?.kcal || 0) * 100) / 100 }}千卡</text>
        <text v-if="selectedFood?.customKey" class="food-meta">下方为分量换算，按实际食用克数记录。</text>
        <text v-if="selectedFood && incompleteNutrition(selectedFood)" class="food-meta">营养数据未完善，热量照常计入。</text>

        <view class="grams-presets">
          <view
            v-for="opt in quickOptions"
            :key="opt.g"
            class="preset-btn"
            @click="customGrams = String(opt.g)" :class="{ selected: Number(customGrams) === opt.g }"
          >
            <text class="preset-g">{{ opt.g }}g</text>
            <text class="preset-label">{{ opt.label }}</text>
          </view>
        </view>

        <view class="grams-divider">
          <view class="divider-line" />
          <text class="divider-text">或者自己输入</text>
          <view class="divider-line" />
        </view>

        <view class="grams-custom">
          <view class="custom-stepper">
            <view class="stepper-btn" @click="adjustGrams(-10)">−</view>
            <view class="stepper-input-wrap">
              <input
                class="stepper-input" aria-label="食物克数"
                type="number"
                v-model="customGrams"
                placeholder="100"
              />
            </view>
            <view class="stepper-btn" @click="adjustGrams(10)">+</view>
          </view>
          <text class="custom-unit">克</text>
        </view>

        <text class="custom-preview" v-if="validGrams(customGrams)">
          约 {{ customKcal }} 千卡
        </text>

        <text v-if="!validGrams(customGrams)" class="field-error">请输入大于 0、且不超过 5000 的克数</text>
        <view class="grams-actions">
          <button class="btn-cancel" @click="showGrams = false">取消</button>
          <button class="btn-confirm" @click="confirmAdd(Number(customGrams))" :disabled="!validGrams(customGrams)">
            {{ actionLabel }} {{ validGrams(customGrams) ? customGrams + 'g' : '' }}
          </button>
        </view>
      </view>
    </view>
    <CustomFoodEditor v-if="creatingFood" :initial-name="search.trim()" @close="creatingFood = false" @saved="onFoodSaved" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import FoodVisual from './FoodVisual.vue'
import AppIcon from './AppIcon.vue'
import { validGrams } from '@/utils/input'
defineProps<{ actionLabel: string }>()
const search = ref('')
const expanded = ref(false)
import type { FoodItem } from '@/store/records'
import { usePlanStore } from '@/store/plan'
import { useJournalStore } from '@/store/journal'
import { foodCategories } from '@/utils/customFoods'
import { incompleteNutrition } from '@/utils/nutrition'
import CustomFoodEditor from './CustomFoodEditor.vue'

const journal = useJournalStore()
const foods = computed(() => journal.allFoods)
const creatingFood = ref(false)
const planStore = usePlanStore()


const categories = foodCategories

const activeCat = ref('staple')
const showGrams = ref(false)
const selectedFood = ref<FoodItem | null>(null)
const customGrams = ref('')

const filteredFoods = computed(() =>
  foods.value.filter((f) => search.value.trim() ? f.name.toLowerCase().includes(search.value.trim().toLowerCase()) : f.category === activeCat.value)
)

// 基于实际食物分量（查询中国食物成分表 + 日常经验）
const portionHints: Record<number, { g: number; label: string }[]> = {
  // 主食
  1: [{g:100,label:'小半碗'},{g:150,label:'一中碗'},{g:250,label:'一大碗'},{g:200,label:'200g'}],// 白米饭
  2: [{g:100,label:'小半碗'},{g:150,label:'一中碗'},{g:250,label:'一大碗'},{g:200,label:'200g'}],// 杂粮饭
  3: [{g:50,label:'小半个'},{g:100,label:'一个'},{g:200,label:'两个'},{g:150,label:'150g'}], // 馒头(标准100g)
  4: [{g:150,label:'小碗'},{g:250,label:'中碗'},{g:350,label:'大碗'},{g:200,label:'200g'}], // 面条(煮后)
  5: [{g:35,label:'1片'},{g:70,label:'2片'},{g:100,label:'3片'},{g:50,label:'50g'}],       // 全麦面包(切片≈35g)
  6: [{g:120,label:'小个'},{g:200,label:'中个'},{g:300,label:'大个'},{g:150,label:'150g'}],// 红薯
  7: [{g:150,label:'中根可食'},{g:250,label:'大半根'},{g:350,label:'整根大'},{g:200,label:'200g'}],// 玉米(可食部分)
  8: [{g:150,label:'小碗'},{g:250,label:'中碗'},{g:350,label:'大碗'},{g:200,label:'200g'}],// 小米粥
  9: [{g:20,label:'2平勺'},{g:35,label:'4勺'},{g:50,label:'小碗'},{g:30,label:'30g'}],    // 燕麦片(1勺≈10g)
  10:[{g:150,label:'小碗'},{g:250,label:'中碗'},{g:350,label:'大碗'},{g:200,label:'200g'}],// 荞麦面
  // 蛋白质
  11:[{g:80,label:'小半块'},{g:150,label:'一块'},{g:250,label:'大块'},{g:100,label:'100g'}],// 鸡胸肉(一块≈150-200g)
  12:[{g:80,label:'小半份'},{g:150,label:'一份'},{g:200,label:'大份'},{g:100,label:'100g'}],// 猪瘦肉
  13:[{g:50,label:'1个'},{g:100,label:'2个'},{g:150,label:'3个'},{g:60,label:'60g'}],      // 鸡蛋(1个去壳≈50g)
  14:[{g:50,label:'5-6只'},{g:100,label:'10-12只'},{g:150,label:'15-18只'},{g:80,label:'80g'}],// 虾仁(1只≈8-10g)
  15:[{g:80,label:'小半份'},{g:150,label:'一份'},{g:200,label:'大份'},{g:100,label:'100g'}],// 瘦牛肉
  16:[{g:150,label:'小半块'},{g:250,label:'半块'},{g:400,label:'一块'},{g:200,label:'200g'}],// 豆腐(一块≈350-400g)
  17:[{g:40,label:'半张'},{g:70,label:'一张'},{g:120,label:'两张'},{g:80,label:'80g'}],    // 豆腐皮
  18:[{g:120,label:'一段'},{g:180,label:'一大段'},{g:250,label:'两大段'},{g:150,label:'150g'}],// 鲤鱼
  19:[{g:80,label:'薄片'},{g:120,label:'厚片'},{g:200,label:'大块'},{g:100,label:'100g'}], // 三文鱼(超市片≈100-150g)
  // 蔬菜
  21:[{g:100,label:'小半颗'},{g:200,label:'半颗'},{g:350,label:'大半颗'},{g:150,label:'150g'}],// 西兰花
  22:[{g:80,label:'几片叶'},{g:150,label:'小半颗'},{g:250,label:'半颗'},{g:100,label:'100g'}],// 大白菜
  23:[{g:80,label:'一小把'},{g:150,label:'一把'},{g:250,label:'一大把'},{g:100,label:'100g'}],// 菠菜
  24:[{g:100,label:'小个'},{g:180,label:'中个'},{g:250,label:'大个'},{g:150,label:'150g'}],// 番茄(中≈180g)
  25:[{g:80,label:'半根'},{g:150,label:'一根'},{g:280,label:'一大根'},{g:100,label:'100g'}],// 黄瓜
  26:[{g:100,label:'小个'},{g:180,label:'中个'},{g:250,label:'大个'},{g:150,label:'150g'}],// 土豆(中≈180g)
  27:[{g:80,label:'一小把'},{g:150,label:'一把'},{g:250,label:'一大把'},{g:100,label:'100g'}],// 豆角
  28:[{g:80,label:'小半根'},{g:150,label:'半根'},{g:250,label:'一根'},{g:100,label:'100g'}],// 茄子
  29:[{g:50,label:'小半个'},{g:100,label:'一个'},{g:200,label:'两个'},{g:150,label:'150g'}],// 青椒
  30:[{g:80,label:'一根'},{g:150,label:'两根'},{g:200,label:'两根大'},{g:100,label:'100g'}],// 胡萝卜(一根≈80-120g)
  31:[{g:150,label:'一块'},{g:300,label:'大块'},{g:450,label:'两大块'},{g:200,label:'200g'}],// 冬瓜
  32:[{g:50,label:'几片'},{g:100,label:'一小把'},{g:150,label:'一把'},{g:80,label:'80g'}],// 生菜
  // 水果
  33:[{g:80,label:'大半根'},{g:120,label:'一根'},{g:180,label:'大根'},{g:100,label:'100g'}],// 香蕉(去皮≈100-120g)
  34:[{g:100,label:'半个'},{g:180,label:'一个'},{g:280,label:'大个'},{g:150,label:'150g'}],// 苹果(中≈180-220g)
  35:[{g:200,label:'一角'},{g:350,label:'两角'},{g:500,label:'三角'},{g:250,label:'250g'}],// 西瓜
  36:[{g:120,label:'小个'},{g:200,label:'中个'},{g:280,label:'大个'},{g:150,label:'150g'}],// 桃子
  37:[{g:50,label:'一小把'},{g:100,label:'一把'},{g:150,label:'一大把'},{g:80,label:'80g'}],// 蓝莓
  38:[{g:120,label:'小个'},{g:200,label:'中个'},{g:300,label:'大个'},{g:150,label:'150g'}],// 梨
  39:[{g:120,label:'小个'},{g:200,label:'中个'},{g:280,label:'大个'},{g:150,label:'150g'}],// 橙子(中≈200g)
  // 油脂
  41:[{g:3,label:'几滴'},{g:8,label:'半勺'},{g:15,label:'一汤匙'},{g:5,label:'5g'}],     // 菜籽油(1汤匙≈15g)
  42:[{g:3,label:'几滴'},{g:8,label:'半勺'},{g:15,label:'一汤匙'},{g:5,label:'5g'}],     // 橄榄油
  43:[{g:60,label:'小半个'},{g:100,label:'半个'},{g:180,label:'一个'},{g:80,label:'80g'}],// 牛油果(去核半个≈80-100g)
  44:[{g:15,label:'2-3个'},{g:30,label:'5-6个'},{g:50,label:'8-10个'},{g:20,label:'20g'}],// 核桃(仁≈6g/个)
  45:[{g:10,label:'一平勺'},{g:20,label:'两勺'},{g:30,label:'一大勺'},{g:15,label:'15g'}],// 花生酱
  46:[{g:3,label:'几滴'},{g:8,label:'半勺'},{g:15,label:'一汤匙'},{g:5,label:'5g'}],     // 芝麻油
  47:[{g:10,label:'一撮'},{g:20,label:'一小把'},{g:30,label:'一大把'},{g:15,label:'15g'}], // 南瓜籽
}

const quickOptions = computed(() => {
  const food = selectedFood.value
  if (!food) return []
  if (food.customKey) {
    const grams = food.portionGrams || 100
    return [{ g: grams / 2, label: '参考分量×½' }, { g: grams, label: '填写的分量' }, { g: grams * 2, label: '参考分量×2' }, { g: 100, label: '100克' }].filter((option, index, options) => validGrams(option.g) && options.findIndex(other => other.g === option.g) === index)
  }
  return portionHints[food.id] || [
    { g: 50, label: '少量' },
    { g: 100, label: '一份' },
    { g: 150, label: '中等' },
    { g: 200, label: '大份' },
  ]
})

const customKcal = computed(() => {
  const g = Number(customGrams.value)
  if (!g || !selectedFood.value) return 0
  return Math.round(selectedFood.value.kcal * g / 100)
})

const emit = defineEmits<{
  add: [food: FoodItem, grams: number]
}>()

function openPicker(food: FoodItem) {
  selectedFood.value = food
  // 使用记忆的常用克数，没有则默认100
  const remembered = planStore.getRememberedGrams(food.id)
  customGrams.value = String(remembered || food.portionGrams || 100)
  showGrams.value = true
}

function onFoodSaved(food: FoodItem) {
  creatingFood.value = false; search.value = ''; activeCat.value = food.category; expanded.value = true
  openPicker(food)
}

function adjustGrams(delta: number) {
  const current = Number(customGrams.value) || 100
  const next = Math.max(1, current + delta)
  customGrams.value = String(next)
}

function confirmAdd(g: number) {
  if (!validGrams(g)) return
  if (selectedFood.value) {
    planStore.rememberGrams(selectedFood.value.id, g)
    emit('add', selectedFood.value, g)
  }
  showGrams.value = false
}
</script>

<style scoped>
.food-search { background:var(--wash); height:max(88rpx,44px); padding:0 24rpx; margin-bottom:12rpx; }
.new-food { color:var(--brand); background:transparent; text-align:left; margin:0 0 8rpx; padding:0 4rpx; line-height:44px; }.custom-badge { margin-left:12rpx; font-size:12px; color:var(--muted); font-weight:400; }
.category-tabs { overflow-x:auto; white-space:nowrap; margin-bottom:8rpx; }
.tab-item { display:inline-flex; flex-direction:column; align-items:center; justify-content:center; position:relative; }.tab-text { color:var(--muted); }.tab-item.active .tab-text { color:var(--brand); font-weight:600; }.tab-indicator { width:24rpx; height:4rpx; background:var(--brand); position:absolute; bottom:6rpx; }
.food-card { display:flex; width:100%; align-items:center; justify-content:space-between; text-align:left; margin:0; line-height:1.6; background:transparent; border-radius:0; border-bottom:1px solid var(--line); }.food-info { flex:1; min-width:0; }.food-name { display:block; font-weight:500; color:var(--ink); }.food-meta { display:block; color:var(--muted); }.food-add { font-size:36rpx; color:var(--brand); padding:0 12rpx; }.card-touch { background:var(--wash); }
.search-empty { display:block; padding:32rpx 0; color:var(--muted); }.expand-foods { color:var(--brand); background:transparent; font-size:max(26rpx,13px); line-height:44px; margin:8rpx 0; }
.grams-overlay { position:fixed; top:0; left:0; right:0; bottom:var(--window-bottom,0px); z-index:1001; display:flex; align-items:flex-end; justify-content:center; }
.grams-panel { background:#fff; width:100%; max-height:85vh; overflow-y:auto; padding-bottom:calc(32rpx + env(safe-area-inset-bottom)); }
.grams-title { display:block; font-weight:600; }.grams-subtitle { display:block; color:var(--muted); }
.grams-presets { display:flex; margin-bottom:28rpx; }.preset-btn { flex:1; text-align:center; border:1px solid var(--line); }.preset-btn.selected { border-color:var(--brand); background:#edf4ef; }.preset-g,.preset-label { display:block; }.preset-label { color:var(--muted); }
.grams-divider { margin-bottom:18rpx; }.divider-text { color:var(--muted); font-size:max(24rpx,12px); }.divider-line { display:none; }
.grams-custom { display:flex; align-items:center; gap:16rpx; }.custom-stepper { display:flex; border:1px solid var(--line); overflow:hidden; }.stepper-btn { width:44px; height:44px; display:flex; align-items:center; justify-content:center; background:var(--wash); font-size:32rpx; }.stepper-input-wrap { width:150rpx; }.stepper-input { height:44px; width:100%; text-align:center; font-size:32rpx; }.custom-unit { color:var(--muted); }.custom-preview { display:block; font-size:max(28rpx,14px); margin:20rpx 0; }
.grams-actions { display:flex; gap:16rpx; margin-top:24rpx; }.btn-cancel,.btn-confirm { line-height:44px; min-height:44px; }.btn-cancel { flex:1; background:var(--wash); color:var(--ink); }.btn-confirm { flex:2; background:var(--brand); color:#fff; }

.food-search { border:1px solid var(--line); border-radius:12px; font-size:14px; }.new-food { display:flex; align-items:center; gap:6px; font-size:13px; }.category-tabs { padding:4px 0 10px; }.tab-item { padding:0 12px; border-radius:18px; height:44px; margin-right:4px; transition:background .18s; }.tab-item.active { background:#eaf0e2; }.tab-text { font-size:13px; }.tab-indicator { display:none; }
.food-card { gap:12px; padding:14px 0; }.food-thumb { flex-shrink:0; width:40px; height:40px; border-radius:12px; overflow:hidden; }.food-name { font-size:14px; overflow-wrap:anywhere; }.food-meta { font-size:12px; }.grams-overlay { background:#1b30254d; }.grams-panel { max-width:600px; padding:24px 20px calc(24px + env(safe-area-inset-bottom)); border-radius:24px 24px 0 0; }.grams-heading { display:flex; align-items:center; gap:12px; }.grams-title { font-size:20px; min-width:0; overflow-wrap:anywhere; }.grams-thumb { width:48px; height:48px; border-radius:14px; overflow:hidden; flex-shrink:0; }.grams-subtitle { font-size:13px; margin:10px 0 22px; }.grams-presets { gap:8px; }.preset-btn { border-radius:12px; min-width:0; padding:12px 4px; transition:background .18s,border-color .18s; }.preset-g { font-size:14px; }.preset-label { font-size:11px; line-height:1.6; margin-top:3px; white-space:normal; }.custom-stepper { border-radius:12px; }.btn-cancel,.btn-confirm { border-radius:12px; font-size:14px; margin:0; }
@media(max-width:350px) { .grams-panel { padding-left:16px; padding-right:16px; }.food-card { gap:8px; }.food-thumb { width:34px; height:34px; } }
</style>
