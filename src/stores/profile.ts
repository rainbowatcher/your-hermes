/**
 * 负责：管理当前 Hermes profile 的列表、选中状态与切换动作。
 * 不负责：具体业务页的数据加载与服务端路径推断。
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { fetchHermesProfiles } from '@/api/hermes'
import type { HermesProfileSummary } from '@/types/profiles'

export const DEFAULT_PROFILE_ID = 'default'

export const useProfileStore = defineStore('profile', () => {
  const profiles = ref<HermesProfileSummary[]>([])
  const isLoadingProfiles = ref(false)
  const loadError = ref<string | null>(null)
  const selectedProfileId = useStorage<string>('hermes.selected-profile', DEFAULT_PROFILE_ID)

  const selectedProfile = computed(
    () => profiles.value.find((profile) => profile.id === selectedProfileId.value) || null,
  )

  async function loadProfiles() {
    isLoadingProfiles.value = true
    loadError.value = null

    try {
      const data = await fetchHermesProfiles()
      profiles.value = data.profiles

      const hasSelected = data.profiles.some((profile) => profile.id === selectedProfileId.value)
      selectedProfileId.value = hasSelected ? selectedProfileId.value : DEFAULT_PROFILE_ID
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : '加载 profile 列表失败'
    } finally {
      isLoadingProfiles.value = false
    }
  }

  function setSelectedProfileId(profileId: string) {
    selectedProfileId.value = profileId || DEFAULT_PROFILE_ID
  }

  return {
    profiles,
    isLoadingProfiles,
    loadError,
    selectedProfileId,
    selectedProfile,
    loadProfiles,
    setSelectedProfileId,
  }
})
