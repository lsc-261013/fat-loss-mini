<template><image class="app-icon" :src="'/static/icons/' + name + extension" :style="{width: size + 'px', height: size + 'px'}" mode="aspectFit" aria-hidden="true" /></template>
<script setup lang="ts">
withDefaults(defineProps<{name: string; size?: number}>(), {size: 20})
let extension = '.png'
// #ifdef H5
extension = '.svg'
// #endif
</script>
<style scoped>.app-icon { display:inline-block; flex-shrink:0; vertical-align:middle; }</style>
