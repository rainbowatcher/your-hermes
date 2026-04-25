<!--
  负责：编排技能管理页面的数据加载、列表、详情与路由同步。
  不负责：服务端文件解析与技能写操作。
-->
<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SkillDetail from '@/components/skills/SkillDetail.vue'
import SkillList from '@/components/skills/SkillList.vue'
import { useSkillsStore } from '@/stores/skills'
import { useThemeStore } from '@/stores/theme'

const store = useSkillsStore()
const theme = useThemeStore()
const route = useRoute()
const router = useRouter()

function currentRoutePath() {
  const rawPath = route.query.path
  return typeof rawPath === 'string' && rawPath ? rawPath : null
}

function syncRouteSelection() {
  if (store.isLoadingSkills) {
    return
  }

  const routePath = currentRoutePath()
  const targetPath = routePath || store.filteredSkills[0]?.relativePath || null
  store.setSelectedPath(targetPath)

  if (targetPath) {
    void store.loadSkill(targetPath)
  }

  if (!routePath && targetPath) {
    router.replace({ name: 'skills', query: { path: targetPath } })
  }
}

onMounted(async () => {
  await store.loadSkills()
  syncRouteSelection()
})

watch(
  [() => route.query.path, () => store.filteredSkills.length, () => store.isLoadingSkills],
  () => {
    syncRouteSelection()
  },
  { immediate: true },
)

watch(
  () => store.selectedPath,
  (relativePath) => {
    if (relativePath) {
      void store.loadSkill(relativePath)
    }
  },
)

function openSkill(relativePath: string) {
  store.setSelectedPath(relativePath)
  void store.loadSkill(relativePath)
  router.push({ name: 'skills', query: { path: relativePath } })
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
    <div
      v-if="store.loadError"
      class="border-b border-amber-500/20 bg-amber-500/8 px-5 py-2 text-xs text-amber-100"
    >
      {{ store.loadError }}
    </div>

    <div class="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[360px_minmax(0,1fr)]">
      <SkillList
        :groups="store.groupedSkills"
        :is-loading="store.isLoadingSkills"
        :selected-path="store.selectedPath"
        @select="openSkill"
      />
      <SkillDetail
        :is-dark="theme.isDark"
        :is-loading="store.isLoadingDetail"
        :search="store.search"
        :skill="store.selectedSkill"
        :total="store.skills.length"
        @toggle-theme="theme.toggleTheme"
        @update:search="store.setSearch"
      />
    </div>
  </div>
</template>
