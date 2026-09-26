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
@import "./styles/theme.css";
</style>
