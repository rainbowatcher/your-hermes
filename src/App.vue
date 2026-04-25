<!--
  负责：承载全局应用布局与 RouterView。
  不负责：具体页面逻辑与页面级导航状态。
-->
<template>
  <div class="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
    <div class="min-h-0 flex-1 overflow-hidden">
      <RouterView />
    </div>
  </div>
</template>
