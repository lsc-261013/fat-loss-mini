<template>
  <view></view>
</template>

<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'
import { useRecordsStore } from '@/store/records'
import { usePlanStore } from '@/store/plan'

onLaunch(() => {
  useUserStore().loadFromStorage()
  useRecordsStore().loadToday()
  usePlanStore().loadPlan()
})
</script>

<style>
page {
  background-color: #F6F6F6;
  font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 26rpx;
  color: #1A1A1A;
}
</style>
