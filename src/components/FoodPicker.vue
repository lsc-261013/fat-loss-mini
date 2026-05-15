<template>
  <view class="food-picker">
    <scroll-view scroll-x class="category-tabs" :show-scrollbar="false">
      <view
        v-for="cat in categories"
        :key="cat.key"
        class="tab-item"
        :class="{ active: activeCat === cat.key }"
        @click="activeCat = cat.key"
      >
        <text class="tab-text">{{ cat.label }}</text>
        <view v-if="activeCat === cat.key" class="tab-indicator" />
      </view>
    </scroll-view>

    <view class="food-grid">
      <view
        v-for="food in filteredFoods"
        :key="food.id"
        class="food-card"
        :class="'card-' + food.category"
        @tap="openPicker(food)"
        hover-class="card-touch"
      >
        <text class="food-emoji">{{ getEmoji(food.id) }}</text>
        <text class="food-name">{{ food.name }}</text>
      </view>
    </view>

    <view v-if="showGrams" class="grams-overlay" @click="showGrams = false">
      <view class="grams-panel" @click.stop>
        <text class="grams-title">{{ selectedFood?.name }}</text>
        <text class="grams-subtitle">每100g ≈ {{ selectedFood?.kcal }}千卡</text>

        <view class="grams-presets">
          <view
            v-for="opt in quickOptions"
            :key="opt.g"
            class="preset-btn"
            @click="confirmAdd(opt.g)"
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
                class="stepper-input"
                type="number"
                v-model="customGrams"
                placeholder="100"
              />
            </view>
            <view class="stepper-btn" @click="adjustGrams(10)">+</view>
          </view>
          <text class="custom-unit">克</text>
        </view>

        <text class="custom-preview" v-if="customKcal > 0">
          约 {{ customKcal }} 千卡
        </text>

        <view class="grams-actions">
          <button class="btn-cancel" @click="showGrams = false">取消</button>
          <button class="btn-confirm" @click="confirmAdd(Number(customGrams) || 100)">
            加入 {{ Number(customGrams) || 100 }}g
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { FoodItem } from '@/store/records'
import { usePlanStore } from '@/store/plan'
import foodsData from '@/static/foods.json'

const foods = foodsData as FoodItem[]
const planStore = usePlanStore()

const emojiMap: Record<number, string> = {
  1:'🍚',2:'🍚',3:'🥟',4:'🍜',5:'🍞',6:'🍠',7:'🌽',8:'🥣',9:'🥣',10:'🍜',
  11:'🍗',12:'🥩',13:'🥚',14:'🦐',15:'🥩',16:'🧈',17:'🫘',18:'🐟',19:'🐟',
  21:'🥦',22:'🥬',23:'🥬',24:'🍅',25:'🥒',26:'🥔',27:'🫘',28:'🍆',29:'🫑',30:'🥕',
  31:'🍈',32:'🥬',33:'🍌',34:'🍎',35:'🍉',36:'🍑',37:'🫐',38:'🍐',39:'🍊',
  41:'🫒',42:'🫒',43:'🥑',44:'🥜',45:'🥜',46:'🫒',47:'🎃',
}
function getEmoji(id: number) { return emojiMap[id] || '🍽️' }

const categories = [
  { key: 'staple', label: '主食' },
  { key: 'protein', label: '蛋白质' },
  { key: 'vegetable', label: '蔬菜' },
  { key: 'fruit', label: '水果' },
  { key: 'fat', label: '油脂' },
]

const activeCat = ref('staple')
const showGrams = ref(false)
const selectedFood = ref<FoodItem | null>(null)
const customGrams = ref('')

const filteredFoods = computed(() =>
  foods.filter((f) => f.category === activeCat.value)
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
  customGrams.value = String(remembered || 100)
  showGrams.value = true
}

function adjustGrams(delta: number) {
  const current = Number(customGrams.value) || 100
  const next = Math.max(1, current + delta)
  customGrams.value = String(next)
}

function confirmAdd(g: number) {
  if (selectedFood.value) {
    planStore.rememberGrams(selectedFood.value.id, g)
    emit('add', selectedFood.value, g)
  }
  showGrams.value = false
}
</script>

<style scoped>
.food-picker {
  margin-bottom: 16rpx;
}

.category-tabs {
  white-space: nowrap;
  margin-bottom: 16rpx;
  height: 56rpx;
}

.tab-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 24rpx;
  height: 56rpx;
  position: relative;
}

.tab-text {
  font-size: 26rpx;
  color: #8c8c8c;
}

.tab-item.active .tab-text {
  color: #1a1a1a;
  font-weight: 600;
}

.tab-indicator {
  width: 24rpx;
  height: 4rpx;
  border-radius: 2rpx;
  background: #07c160;
  margin-top: 6rpx;
}

.food-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0;
  row-gap: 12rpx;
}

.food-card {
  width: calc((100% - 24rpx) / 4);
  background: #fff;
  border-radius: 16rpx;
  padding: 14rpx 4rpx 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 200ms ease-out;
}

.card-touch {
  transform: translateY(-4rpx);
  box-shadow: 0 6rpx 18rpx rgba(0, 0, 0, 0.1);
}

.food-emoji {
  font-size: 40rpx;
  line-height: 1.2;
}

.food-name {
  font-size: 22rpx;
  font-weight: 600;
  color: #1a1a1a;
  text-align: center;
  line-height: 1.3;
}

.food-meta {
  font-size: 18rpx;
  color: #999;
}

/* 克数弹窗 */
.grams-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.grams-panel {
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 24rpx 32rpx;
  width: 100%;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}

.grams-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1a1a1a;
  display: block;
  text-align: center;
}

.grams-subtitle {
  font-size: 24rpx;
  color: #8c8c8c;
  display: block;
  text-align: center;
  margin-top: 6rpx;
  margin-bottom: 24rpx;
}

.grams-presets {
  display: flex;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.preset-btn {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  border-radius: 12rpx;
  background: #f8f8f8;
  display: flex;
  flex-direction: column;
  gap: 2rpx;
}

.preset-btn:active {
  background: #e8f5e9;
}

.preset-g {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.preset-label {
  font-size: 20rpx;
  color: #8c8c8c;
}

/* 分割线 */
.grams-divider {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: #e8e8e8;
}

.divider-text {
  font-size: 22rpx;
  color: #b0b0b0;
}

/* 自定义输入 */
.grams-custom {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.custom-stepper {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid #e0e0e0;
  border-radius: 12rpx;
  overflow: hidden;
}

.stepper-btn {
  width: 64rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  color: #4d4d4d;
  background: #f8f8f8;
}

.stepper-btn:active {
  background: #e8e8e8;
}

.stepper-input-wrap {
  width: 120rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}

.stepper-input {
  width: 100%;
  height: 100%;
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.custom-unit {
  font-size: 26rpx;
  color: #4d4d4d;
}

.custom-preview {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #07c160;
  margin-bottom: 20rpx;
}

.grams-actions {
  display: flex;
  gap: 12rpx;
}

.btn-cancel {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  background: #f5f5f5;
  border-radius: 16rpx;
  font-size: 28rpx;
  color: #8c8c8c;
  border: none;
}

.btn-cancel::after { border: none; }
.btn-confirm::after { border: none; }

.btn-confirm {
  flex: 2;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  background: #07c160;
  border-radius: 16rpx;
  font-size: 28rpx;
  color: #fff;
  font-weight: 600;
  border: none;
}
</style>
