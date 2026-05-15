<template>
  <view class="meal-card" :class="recipe.type">
    <view class="meal-header">
      <view class="meal-title-row">
        <text class="meal-time-tag">{{ mealTimeLabel }}</text>
        <text class="meal-name">{{ recipe.name }}</text>
      </view>
      <view class="meal-type-badge" :class="recipe.type">
        {{ typeLabel }}
      </view>
    </view>

    <view class="meal-ingredients">
      <view v-for="(ing, i) in displayIngredients" :key="i" class="ingredient-chip">
        <text class="ing-dot" :class="ing.category" />
        <text class="ing-text">{{ ing.name }} {{ ing.grams }}g</text>
      </view>
    </view>

    <view class="meal-footer">
      <view class="meal-macros">
        <text class="macro-item">🔥 {{ recipe.totalKcal }}</text>
        <text class="macro-item">C {{ recipe.totalCarbs }}g</text>
        <text class="macro-item">P {{ recipe.totalProtein }}g</text>
        <text class="macro-item">F {{ recipe.totalFat }}g</text>
      </view>
      <text class="meal-desc">{{ recipe.description }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Recipe } from '@/data/recipes'
import foods from '@/static/foods.json'

const props = defineProps<{ recipe: Recipe }>()

const mealTimeLabel = computed(() => {
  const map: Record<string, string> = {
    breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐',
  }
  return map[props.recipe.mealTime] || ''
})

const typeLabel = computed(() => {
  const map: Record<string, string> = {
    light: '轻量', standard: '标准', rich: '丰盛',
  }
  return map[props.recipe.type] || ''
})

const displayIngredients = computed(() =>
  props.recipe.ingredients.map((ing) => {
    const food = (foods as any[]).find((f: any) => f.id === ing.foodId)
    return {
      name: food?.name || '未知',
      grams: ing.grams,
      category: food?.category || 'staple',
    }
  })
)
</script>

<style scoped>
.meal-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.meal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16rpx;
}

.meal-title-row {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.meal-time-tag {
  font-size: 22rpx;
  color: #8c8c8c;
}

.meal-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.meal-type-badge {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
  font-weight: 500;
}

.meal-type-badge.light {
  background: #e8f5e9;
  color: #2e7d32;
}

.meal-type-badge.standard {
  background: #fbf3e4;
  color: #8b6914;
}

.meal-type-badge.rich {
  background: #fde8e8;
  color: #c0392b;
}

.meal-ingredients {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-bottom: 16rpx;
}

.ingredient-chip {
  display: flex;
  align-items: center;
  gap: 6rpx;
  background: #f8f8f8;
  padding: 6rpx 12rpx;
  border-radius: 6rpx;
}

.ing-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.ing-dot.staple { background: #8b6914; }
.ing-dot.protein { background: #c0392b; }
.ing-dot.vegetable { background: #2e7d32; }
.ing-dot.fruit { background: #e67e22; }
.ing-dot.fat { background: #f9a825; }

.ing-text {
  font-size: 22rpx;
  color: #4d4d4d;
}

.meal-footer {
  border-top: 1px solid #f0f0f0;
  padding-top: 14rpx;
}

.meal-macros {
  display: flex;
  gap: 16rpx;
  margin-bottom: 6rpx;
}

.macro-item {
  font-size: 22rpx;
  color: #4d4d4d;
}

.meal-desc {
  font-size: 22rpx;
  color: #8c8c8c;
}
</style>
