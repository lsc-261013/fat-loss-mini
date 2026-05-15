<template>
  <view class="record-page">
    <!-- 拍照识别预留 -->
    <view class="camera-bar" @click="onCamera">
      <text class="camera-icon-text">[ + ]</text>
      <text class="camera-label">拍照识别</text>
      <text class="camera-badge">即将上线</text>
    </view>

    <!-- 热量总览 -->
    <CalorieCard
      v-if="userStore.nutritionTarget"
      :target="userStore.nutritionTarget.targetCalories"
      :consumed="recordsStore.todayTotal.kcal"
      :macros="macroPayload"
    />

    <!-- 食材选择器 -->
    <FoodPicker @add="onAddFood" />

    <!-- 今日计划 -->
    <view class="plan-section">
      <view class="plan-header">
        <text class="plan-title">今日计划</text>
        <text class="plan-add-btn" @tap="showPlanPicker = true">+ 添加</text>
      </view>
      <view v-if="planStore.planItems.length > 0">
        <template v-for="(group, gi) in groupedPlanItems" :key="gi">
          <view v-if="group[0].groupName" class="plan-group-head">
            <text class="plan-group-label">📋 {{ group[0].groupName }}</text>
            <text class="plan-group-eat" @tap="eatRecipeGroup(group)">全吃</text>
          </view>
          <view v-for="item in group" :key="item.id" class="plan-item" :class="{ eaten: item.eaten }">
            <text class="plan-emoji">{{ getPlanEmoji(item.foodId) }}</text>
            <text class="plan-name">{{ item.foodName }}</text>
            <text class="plan-grams">{{ item.grams }}g</text>
            <text class="plan-kcal">≈{{ item.kcal }}千卡</text>
            <text class="plan-eat-btn" :class="{ done: item.eaten }" @tap="eatItem(item)">{{ item.eaten ? '✓' : '吃了' }}</text>
            <text class="plan-del" @tap="planStore.removeFromPlan(item.id)">×</text>
          </view>
        </template>
      </view>
      <view v-else class="plan-empty-hint">点击「+ 添加」规划饮食</view>
    </view>

    <!-- 今日记录列表 -->
    <view class="today-section">
      <view class="section-header-row">
        <text class="section-label">已吃记录</text>
        <view style="display:flex;gap:12rpx;">
          <text v-if="recordsStore.todayEntries.length > 0" class="entry-mgr-btn" @tap="entryManageMode = !entryManageMode">
            {{ entryManageMode ? '完成' : '管理' }}
          </text>
          <text v-if="entryManageMode" class="entry-del-all" @tap="batchDeleteEntries">删除选中</text>
        </view>
      </view>

      <view v-if="recordsStore.todayEntries.length === 0" class="empty-list">
        <text class="empty-text">还没有记录，从上方选择食材添加</text>
      </view>

      <view v-for="entry in recordsStore.todayEntries" :key="entry.id" class="entry-item"
        :class="{ 'entry-mg': entryManageMode }" @tap="entryManageMode ? toggleEntrySelect(entry.id) : null">
        <view v-if="entryManageMode" class="entry-check" :class="{ checked: selectedEntryIds.includes(entry.id) }">
          <text v-if="selectedEntryIds.includes(entry.id)">✓</text>
        </view>
        <text class="entry-emoji">{{ foodEmoji(entry.food.id) }}</text>
        <view class="entry-info">
          <text class="entry-name">{{ entry.food.name }}</text>
          <text class="entry-grams">{{ entry.grams }}g</text>
        </view>
        <text class="entry-kcal">{{ Math.round(entry.subtotalKcal) }} 千卡</text>
        <text v-if="!entryManageMode" class="entry-delete" @click="onDeleteEntry(entry.id, entry.food.id)">×</text>
      </view>
    </view>

    <!-- 底部汇总 -->
    <view v-if="recordsStore.todayEntries.length > 0 && userStore.nutritionTarget" class="bottom-bar">
      <text class="bottom-total" :class="{ over: recordsStore.todayTotal.kcal > userStore.nutritionTarget.targetCalories }">
        {{ Math.round(recordsStore.todayTotal.kcal) }} / {{ userStore.nutritionTarget.targetCalories }} 千卡
      </text>
    </view>

    <!-- 添加计划弹窗 -->
    <view v-if="showPlanPicker" class="plan-overlay" @tap="showPlanPicker = false">
      <view class="plan-panel" @tap.stop>
        <scroll-view scroll-y class="plan-food-list">
          <text class="plan-panel-title">添加到计划</text>
          <view v-for="cat in planCategories" :key="cat.key">
            <text class="plan-cat-label">{{ cat.label }}</text>
            <view class="plan-food-grid">
              <view v-for="f in getFoodsByCat(cat.key)" :key="f.id" class="plan-food-chip"
                :class="{ selected: planFoodId === f.id }"
                @tap="planFoodId = f.id; planGrams = planStore.getRememberedGrams(f.id) || 100; planRecipeId = ''"
              >{{ foodEmoji(f.id) }} {{ f.name }}</view>
            </view>
          </view>
          <text class="plan-cat-label">📋 食谱</text>
          <view v-for="r in planAllRecipes" :key="r.id" class="plan-recipe-chip"
            :class="{ selected: planRecipeId === r.id }" @tap="planRecipeId = r.id; planFoodId = 0">
            <text class="prc-name">{{ r.name }}</text>
            <text class="prc-kcal">{{ r.totalKcal }}千卡</text>
          </view>
        </scroll-view>
        <view v-if="planFoodId" class="plan-grams-row">
          <text class="plan-grams-label">{{ planFoodName }} · 克数</text>
          <view class="plan-stepper">
            <view class="ps-btn" @tap="planGrams = Math.max(1, planGrams - 10)">−</view>
            <input class="ps-input" type="number" v-model="planGrams" />
            <view class="ps-btn" @tap="planGrams = planGrams + 10">+</view>
          </view>
          <text class="plan-preview-kcal">≈ {{ planPreviewKcal }}千卡</text>
        </view>
        <view class="plan-panel-btns">
          <button class="pp-cancel" @tap="showPlanPicker = false">取消</button>
          <button v-if="planFoodId" class="pp-confirm" @tap="confirmAddPlan">加食材</button>
          <button v-else-if="planRecipeId" class="pp-confirm" @tap="confirmAddRecipeToPlan">加食谱</button>
          <button v-else class="pp-confirm" disabled>请选择食材或食谱</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onPullDownRefresh } from '@dcloudio/uni-app'
import CalorieCard from '@/components/CalorieCard.vue'
import FoodPicker from '@/components/FoodPicker.vue'
import { useUserStore } from '@/store/user'
import { useRecordsStore } from '@/store/records'
import { usePlanStore } from '@/store/plan'
import { recipes as builtInRecipes } from '@/data/recipes'
import type { FoodItem } from '@/store/records'
import foodsData from '@/static/foods.json'

const allFoods = foodsData as any[]
const userStore = useUserStore()
const recordsStore = useRecordsStore()
const planStore = usePlanStore()

const emojiMap: Record<number,string> = {
  1:'🍚',2:'🍚',3:'🥟',4:'🍜',5:'🍞',6:'🍠',7:'🌽',8:'🥣',9:'🥣',10:'🍜',
  11:'🍗',12:'🥩',13:'🥚',14:'🦐',15:'🥩',16:'🧈',17:'🫘',18:'🐟',19:'🐟',
  21:'🥦',22:'🥬',23:'🥬',24:'🍅',25:'🥒',26:'🥔',27:'🫘',28:'🍆',29:'🫑',30:'🥕',
  31:'🍈',32:'🥬',33:'🍌',34:'🍎',35:'🍉',36:'🍑',37:'🫐',38:'🍐',39:'🍊',
  41:'🫒',42:'🫒',43:'🥑',44:'🥜',45:'🥜',46:'🫒',47:'🎃',
}
function foodEmoji(id: number) { return emojiMap[id] || '🍽️' }

const macroPayload = computed(() => {
  if (!userStore.nutritionTarget) return undefined
  const nt = userStore.nutritionTarget; const tt = recordsStore.todayTotal
  return { carbs:{target:nt.carbs,consumed:tt.carbs}, protein:{target:nt.protein,consumed:tt.protein}, fat:{target:nt.fat,consumed:tt.fat} }
})

function onAddFood(food: FoodItem, grams: number) {
  planStore.addToPlan({ foodId: food.id, foodName: food.name, grams, category: food.category, kcal: Math.round(food.kcal*grams/100) })
}

function onDeleteEntry(id: string, foodId: number) {
  uni.showModal({
    title: '删除记录', content: '确定删除这条饮食记录吗？',
    success: (res: any) => { if (res.confirm) { recordsStore.removeEntry(id); planStore.removeByFoodId(foodId) } },
  })
}

function onCamera() { uni.showToast({ title: '即将上线', icon: 'none' }) }

// 记录管理
const entryManageMode = ref(false)
const selectedEntryIds = ref<string[]>([])

function toggleEntrySelect(id: string) {
  const idx = selectedEntryIds.value.indexOf(id)
  if (idx >= 0) selectedEntryIds.value.splice(idx, 1)
  else selectedEntryIds.value.push(id)
}

function batchDeleteEntries() {
  selectedEntryIds.value.forEach((id) => {
    const entry = recordsStore.todayEntries.find((e) => e.id === id)
    if (entry) {
      recordsStore.removeEntry(id)
      planStore.removeByFoodId(entry.food.id)
    }
  })
  selectedEntryIds.value = []
  entryManageMode.value = false
  uni.showToast({ title: '已删除', icon: 'success' })
}

// 食谱组全吃
function eatRecipeGroup(group: any[]) {
  const allEaten = group.every((item: any) => item.eaten)
  group.forEach((item: any) => {
    if (allEaten) {
      // 全取消
      if (item.eaten) {
        planStore.unmarkEaten(item.id)
        const entries = recordsStore.todayEntries.filter((e: any) => e.food.id === item.foodId)
        if (entries.length) recordsStore.removeEntry(entries[entries.length - 1].id)
      }
    } else {
      // 全吃
      if (!item.eaten) {
        planStore.markEaten(item.id)
        const food = allFoods.find((f: any) => f.id === item.foodId)
        if (food) recordsStore.addEntry(food, item.grams)
      }
    }
  })
}

// hidden recipes 同步
const hiddenRecipeIds = ref<Set<string>>(new Set())
try {
  const d = uni.getStorageSync('hidden-recipes')
  if (d) hiddenRecipeIds.value = new Set(JSON.parse(d))
} catch (_) {}

// 计划
const showPlanPicker = ref(false)
const planFoodId = ref(0)
const planGrams = ref(100)
const planRecipeId = ref('')
const planCategories = [
  { key:'staple',label:'主食'},{key:'protein',label:'蛋白质'},{key:'vegetable',label:'蔬菜'},{key:'fruit',label:'水果'},{key:'fat',label:'油脂'},
]
const customRecipes = ref<any[]>([])
try { const d=uni.getStorageSync('custom-recipes'); if(d) customRecipes.value=JSON.parse(d) } catch(_){}
const planAllRecipes = computed(() => {
  const all = [...builtInRecipes, ...customRecipes.value]
  return all.filter((r) => !hiddenRecipeIds.value.has(r.id))
})

const groupedPlanItems = computed(() => {
  const items=planStore.planItems; const groups:any[]=[]; let cg:string|undefined; let ci:any[]=[]
  for(const item of items){ if(item.groupName!==cg){ if(ci.length) groups.push([...ci]); cg=item.groupName; ci=[item] } else ci.push(item) }
  if(ci.length) groups.push([...ci]); return groups
})
function getPlanEmoji(id:number){ return emojiMap[id]||'🍽️' }
function getFoodsByCat(cat:string){ return allFoods.filter((f:any)=>f.category===cat) }
const planFoodName = computed(()=>{ const f=allFoods.find((f:any)=>f.id===planFoodId.value); return f?.name||'' })
const planPreviewKcal = computed(()=>{ const f=allFoods.find((f:any)=>f.id===planFoodId.value); return f?Math.round(f.kcal*planGrams.value/100):0 })

function confirmAddPlan(){
  if(!planFoodId.value)return
  const food=allFoods.find((f:any)=>f.id===planFoodId.value)
  if(!food)return
  planStore.addToPlan({foodId:food.id,foodName:food.name,grams:Number(planGrams.value)||100,category:food.category,kcal:Math.round(food.kcal*(Number(planGrams.value)||100)/100)})
  planStore.rememberGrams(food.id,Number(planGrams.value)||100)
  showPlanPicker.value=false;planFoodId.value=0;planGrams.value=100
}
function confirmAddRecipeToPlan(){
  if(!planRecipeId.value)return
  const r=planAllRecipes.value.find((x:any)=>x.id===planRecipeId.value)
  if(!r)return
  const items=r.ingredients.map((ing:any)=>{const food=allFoods.find((f:any)=>f.id===ing.foodId);return {foodId:ing.foodId,name:food?.name||'未知',grams:ing.grams,kcal:food?Math.round(food.kcal*ing.grams/100):0,category:food?.category||'staple',emoji:emojiMap[ing.foodId]||'🍽️'}})
  planStore.addRecipeGroup(r.name,items)
  showPlanPicker.value=false;planRecipeId.value=''
}
onPullDownRefresh(() => {
  recordsStore.loadToday()
  planStore.loadPlan()
  try { const d = uni.getStorageSync('custom-recipes'); if (d) customRecipes.value = JSON.parse(d) } catch (_) {}
  try { const h = uni.getStorageSync('hidden-recipes'); if (h) hiddenRecipeIds.value = new Set(JSON.parse(h)) } catch (_) {}
  uni.stopPullDownRefresh()
})

function eatItem(item:any){
  if(item.eaten){ planStore.unmarkEaten(item.id); const entries=recordsStore.todayEntries.filter((e:any)=>e.food.id===item.foodId); if(entries.length) recordsStore.removeEntry(entries[entries.length-1].id) }
  else { planStore.markEaten(item.id); const food=allFoods.find((f:any)=>f.id===item.foodId); if(food) recordsStore.addEntry(food,item.grams) }
}
</script>

<style scoped>
.record-page { padding: 24rpx; padding-bottom: 120rpx; }
.camera-bar { display: flex; align-items: center; gap: 8rpx; background: #fff; border: 1px dashed #ccc; border-radius: 12rpx; padding: 16rpx 20rpx; margin-bottom: 16rpx; }
.camera-icon-text { font-size: 28rpx; }
.camera-label { font-size: 26rpx; color: #4d4d4d; flex: 1; }
.camera-badge { font-size: 20rpx; color: #8c8c8c; background: #f5f5f5; padding: 4rpx 10rpx; border-radius: 4rpx; }

/* 计划区 */
.plan-section { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,.04); }
.plan-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.plan-title { font-size: 28rpx; font-weight: 600; color: #1a1a1a; }
.plan-add-btn { font-size: 24rpx; color: #07c160; font-weight: 500; padding: 6rpx 16rpx; border: 1px solid #07c160; border-radius: 20rpx; }
.plan-group-head { display: flex; justify-content: space-between; align-items: center; padding: 8rpx 0 4rpx; }
.plan-group-label { font-size: 22rpx; color: #8c8c8c; font-weight: 500; }
.plan-group-eat {
  font-size: 20rpx; color: #07c160; font-weight: 500;
  padding: 3rpx 12rpx; border: 1px solid #07c160; border-radius: 10rpx;
}
.plan-item { display: flex; align-items: center; gap: 10rpx; padding: 12rpx 0; border-bottom: 1px solid #f8f8f8; }
.plan-item.eaten { opacity: .5; }
.plan-emoji { font-size: 28rpx; }
.plan-name { flex: 1; font-size: 24rpx; color: #1a1a1a; font-weight: 500; }
.plan-grams { font-size: 22rpx; color: #8c8c8c; }
.plan-kcal { font-size: 22rpx; color: #4d4d4d; }
.plan-eat-btn { font-size: 22rpx; color: #07c160; font-weight: 500; padding: 4rpx 12rpx; border: 1px solid #07c160; border-radius: 12rpx; }
.plan-eat-btn.done { color: #fff; background: #07c160; border-color: #07c160; }
.plan-del { font-size: 24rpx; color: #ccc; padding: 4rpx 8rpx; }
.plan-empty-hint { font-size: 24rpx; color: #8c8c8c; text-align: center; padding: 20rpx 0; }

/* 记录列表 */
.today-section { background: #fff; border-radius: 16rpx; padding: 24rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,.04); }
.section-label { font-size: 26rpx; font-weight: 600; color: #1a1a1a; display: block; margin-bottom: 12rpx; }
.empty-list { padding: 48rpx 24rpx; text-align: center; }
.empty-text { font-size: 28rpx; color: #4d4d4d; font-weight: 500; display: block; }
.entry-item { display: flex; align-items: center; gap: 14rpx; padding: 14rpx 0; border-bottom: 1px solid #f8f8f8; }
.entry-emoji { font-size: 28rpx; }
.entry-info { flex: 1; display: flex; flex-direction: column; gap: 2rpx; }
.entry-name { font-size: 26rpx; color: #1a1a1a; font-weight: 600; }
.entry-grams { font-size: 22rpx; color: #999; }
.entry-kcal { font-size: 26rpx; color: #4d4d4d; font-weight: 500; }
.entry-delete { font-size: 28rpx; color: #ccc; padding: 8rpx; }
.section-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.entry-mgr-btn { font-size: 22rpx; color: #8c8c8c; padding: 4rpx 12rpx; border: 1px solid #ccc; border-radius: 12rpx; }
.entry-del-all { font-size: 22rpx; color: #e74c3c; padding: 4rpx 12rpx; }
.entry-mg { }
.entry-check {
  width: 32rpx; height: 32rpx; border-radius: 50%; border: 2rpx solid #ccc;
  display: flex; align-items: center; justify-content: center; font-size: 18rpx; color: #07c160; flex-shrink: 0;
}
.entry-check.checked { border-color: #07c160; background: #e8f5e9; }
.bottom-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; padding: 20rpx 24rpx; border-top: 1px solid #f0f0f0; text-align: center; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); }
.bottom-total { font-size: 28rpx; font-weight: 600; color: #1a1a1a; }
.bottom-total.over { color: #e74c3c; }

/* 弹窗 */
.plan-overlay { position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,.4); z-index:200; display:flex; align-items:flex-end; }
.plan-panel { background:#fff; border-radius:24rpx 24rpx 0 0; padding:32rpx 24rpx; width:100%; max-height:80vh; display:flex; flex-direction:column; }
.plan-panel-title { font-size:30rpx; font-weight:600; color:#1a1a1a; text-align:center; margin-bottom:16rpx; display:block; }
.plan-food-list { max-height:50vh; margin-bottom:16rpx; }
.plan-cat-label { font-size:24rpx; color:#8c8c8c; padding:12rpx 0 8rpx; display:block; }
.plan-food-grid { display:flex; flex-wrap:wrap; gap:10rpx; }
.plan-food-chip { padding:10rpx 18rpx; border-radius:20rpx; font-size:24rpx; color:#4d4d4d; background:#f5f5f5; }
.plan-food-chip.selected { background:#e8f5e9; color:#2e7d32; font-weight:600; }
.plan-recipe-chip { display:flex; justify-content:space-between; align-items:center; background:#f8f8f8; padding:14rpx 18rpx; border-radius:12rpx; margin-bottom:10rpx; }
.plan-recipe-chip.selected { background:#e8f5e9; }
.prc-name { font-size:26rpx; color:#1a1a1a; font-weight:500; }
.prc-kcal { font-size:22rpx; color:#8c8c8c; }
.plan-grams-row { display:flex; align-items:center; gap:12rpx; padding:16rpx 0; }
.plan-grams-label { font-size:26rpx; color:#1a1a1a; font-weight:500; }
.plan-stepper { display:flex; align-items:center; border:1px solid #e0e0e0; border-radius:10rpx; overflow:hidden; }
.ps-btn { width:56rpx; height:60rpx; display:flex; align-items:center; justify-content:center; background:#f8f8f8; font-size:32rpx; color:#4d4d4d; }
.ps-input { width:100rpx; height:60rpx; text-align:center; font-size:28rpx; font-weight:600; }
.plan-preview-kcal { font-size:24rpx; color:#07c160; }
.plan-panel-btns { display:flex; gap:12rpx; margin-top:20rpx; }
.pp-cancel { flex:1; height:80rpx; line-height:80rpx; background:#f5f5f5; border-radius:16rpx; font-size:28rpx; color:#8c8c8c; border:none; }
.pp-cancel::after { border:none; }
.pp-confirm { flex:2; height:80rpx; line-height:80rpx; background:#07c160; border-radius:16rpx; font-size:28rpx; color:#fff; font-weight:600; border:none; }
.pp-confirm::after { border:none; }
.pp-confirm[disabled] { background:#c0c0c0; }
</style>
