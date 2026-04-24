/**
 * 负责：管理技能管理页面的列表、详情、搜索与选中状态。
 * 不负责：服务端文件解析、Markdown 渲染与路由注册。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchSkillDetail, fetchSkills } from '@/api/hermes'
import type { SkillDetail, SkillSummary } from '@/types/skills'

export const useSkillsStore = defineStore('skills', () => {
  const skills = ref<SkillSummary[]>([])
  const detailsByPath = ref<Record<string, SkillDetail>>({})
  const selectedPath = ref<string | null>(null)
  const search = ref('')
  const isLoadingSkills = ref(false)
  const isLoadingDetail = ref(false)
  const loadError = ref<string | null>(null)

  const filteredSkills = computed(() => {
    const query = search.value.trim().toLowerCase()
    if (!query) return skills.value

    return skills.value.filter((skill) => {
      const haystack = [
        skill.relativePath,
        skill.name,
        skill.title,
        skill.description,
        ...skill.tags,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  })

  const groupedSkills = computed(() => {
    const groups = new Map<string, SkillSummary[]>()
    for (const skill of filteredSkills.value) {
      const groupName = skill.relativePath.includes('/')
        ? skill.relativePath.split('/')[0]
        : 'local'
      groups.set(groupName, [...(groups.get(groupName) || []), skill])
    }

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: key,
      skills: items.sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    }))
  })

  const selectedSkill = computed(() =>
    selectedPath.value ? detailsByPath.value[selectedPath.value] || null : null,
  )

  async function loadSkills() {
    isLoadingSkills.value = true
    loadError.value = null
    try {
      const data = await fetchSkills()
      skills.value = data.skills
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : '加载技能列表失败'
    } finally {
      isLoadingSkills.value = false
    }
  }

  async function loadSkill(relativePath: string) {
    if (detailsByPath.value[relativePath]) return

    isLoadingDetail.value = true
    loadError.value = null
    try {
      const data = await fetchSkillDetail(relativePath)
      detailsByPath.value = { ...detailsByPath.value, [relativePath]: data.skill }
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : '加载技能详情失败'
    } finally {
      isLoadingDetail.value = false
    }
  }

  function setSearch(value: string) {
    search.value = value
  }

  function setSelectedPath(value: string | null) {
    selectedPath.value = value
  }

  return {
    detailsByPath,
    filteredSkills,
    groupedSkills,
    isLoadingDetail,
    isLoadingSkills,
    loadError,
    loadSkill,
    loadSkills,
    search,
    selectedPath,
    selectedSkill,
    setSearch,
    setSelectedPath,
    skills,
  }
})
