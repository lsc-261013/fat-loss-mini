<template>
  <view class="calorie-card">
    <view class="stats-row">
      <view class="stat">
        <text class="stat-label">目标</text>
        <text class="stat-value goal">{{ target }}</text>
        <text class="stat-unit">千卡</text>
      </view>
      <view class="stat-divider" />
      <view class="stat">
        <text class="stat-label">已摄入</text>
        <text class="stat-value" :class="{ over: consumed > target }">{{ Math.round(consumed) }}</text>
        <text class="stat-unit">千卡</text>
      </view>
      <view class="stat-divider" />
      <view class="stat">
        <text class="stat-label">剩余</text>
        <text class="stat-value" :class="{ over: remaining < 0 }">{{ Math.round(Math.abs(remaining)) }}</text>
        <text class="stat-unit" v-if="remaining >= 0">千卡</text>
        <text class="stat-unit over-label" v-else>超了</text>
      </view>
    </view>

    <view class="macro-bars" v-if="macros">
      <view class="macro-row" v-for="m in macroList" :key="m.key">
        <view class="macro-head">
          <text class="macro-label">{{ m.label }}</text>
          <text class="macro-num" :class="{ 'num-over': m.over }">
            {{ m.consumed }}<text class="macro-unit">/{{ m.target }}g</text>
          </text>
        </view>
        <view class="bar-track">
          <view
            class="bar-fill"
            :class="[m.key, { over: m.over }]"
            :style="{ width: m.pct + '%' }"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  target: number
  consumed: number
  macros?: {
    carbs: { target: number; consumed: number }
    protein: { target: number; consumed: number }
    fat: { target: number; consumed: number }
  }
}>()

const remaining = computed(() => props.target - props.consumed)

const macroList = computed(() => {
  if (!props.macros) return []
  return [
    {
      key: 'carbs',
      label: '碳水',
      target: props.macros.carbs.target,
      consumed: Math.round(props.macros.carbs.consumed * 10) / 10,
      over: props.macros.carbs.consumed > props.macros.carbs.target,
      pct: Math.min(Math.round((props.macros.carbs.consumed / props.macros.carbs.target) * 100), 100),
    },
    {
      key: 'protein',
      label: '蛋白质',
      target: props.macros.protein.target,
      consumed: Math.round(props.macros.protein.consumed * 10) / 10,
      over: props.macros.protein.consumed > props.macros.protein.target,
      pct: Math.min(Math.round((props.macros.protein.consumed / props.macros.protein.target) * 100), 100),
    },
    {
      key: 'fat',
      label: '脂肪',
      target: props.macros.fat.target,
      consumed: Math.round(props.macros.fat.consumed * 10) / 10,
      over: props.macros.fat.consumed > props.macros.fat.target,
      pct: Math.min(Math.round((props.macros.fat.consumed / props.macros.fat.target) * 100), 100),
    },
  ]
})
</script>

<style scoped>
.calorie-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx 24rpx 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.stats-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin-bottom: 24rpx;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.stat-divider {
  width: 1px;
  height: 48rpx;
  background: #eee;
}

.stat-label {
  font-size: 22rpx;
  color: #8c8c8c;
  margin-bottom: 4rpx;
}

.stat-value {
  font-size: 36rpx;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.2;
}

.stat-value.goal {
  color: #07c160;
}

.stat-value.over {
  color: #e74c3c;
}

.stat-unit {
  font-size: 20rpx;
  color: #8c8c8c;
  margin-top: 2rpx;
}

.over-label {
  color: #e74c3c;
}

.macro-bars {
  padding-top: 16rpx;
  border-top: 1px solid #f0f0f0;
}

.macro-row {
  margin-bottom: 14rpx;
}

.macro-row:last-child {
  margin-bottom: 0;
}

.macro-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6rpx;
}

.macro-label {
  font-size: 24rpx;
  color: #4d4d4d;
  font-weight: 500;
}

.macro-num {
  font-size: 22rpx;
  color: #4d4d4d;
}

.macro-num.num-over {
  color: #e74c3c;
}

.macro-unit {
  color: #8c8c8c;
  font-size: 20rpx;
}

.bar-track {
  height: 8rpx;
  border-radius: 4rpx;
  background: #e8e8e8;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4rpx;
  transition: width 300ms ease-out;
}

.bar-fill.carbs {
  background: #8b6914;
}

.bar-fill.protein {
  background: #c0392b;
}

.bar-fill.fat {
  background: #f9a825;
}

.bar-fill.over {
  background: #e74c3c;
}
</style>
