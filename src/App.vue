<!--
  负责：承载全局应用布局、主导航与 RouterView。
  不负责：具体页面逻辑。
-->
<script setup lang="ts">
import AppNavigation from '@/components/AppNavigation.vue'
</script>

<template>
  <div class="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
    <AppNavigation class="shrink-0" />
    <div class="min-h-0 flex-1 overflow-hidden">
      <RouterView />
    </div>
  </div>
</template>
