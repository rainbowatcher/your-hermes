/**
 * 负责：把 session candidates 组装成可供列表与详情查询的 session graph。
 * 不负责：文件读取、字段归一化、消息渲染。
 */
import { buildFamilies, type SessionBranchKind, type SessionCandidate } from './lineage.ts'

export interface SessionGraph<TSummary, TBranchSummary> {
  sessions: TSummary[]
  summariesById: Map<string, TSummary>
  branchesByRootId: Map<string, TBranchSummary[]>
}

export function buildSessionGraph<
  TSummary extends { id: string; updatedAt: string },
  TBranchSummary,
>(input: {
  familyBuckets: Iterable<SessionCandidate<TSummary>[]>
  prompts: {
    skillReviewPrompt: string
    memoryReviewPrompt: string
    combinedReviewPrompt: string
  }
  createRootSummary: (summary: TSummary, branchCount: number) => TSummary
  createBranchRecords: (
    summary: TSummary,
    rootId: string,
    branchKind: SessionBranchKind,
  ) => {
    summary: TSummary
    branchSummary: TBranchSummary
  }
}) {
  const { familyBuckets, prompts, createRootSummary, createBranchRecords } = input
  const summariesById = new Map<string, TSummary>()
  const branchesByRootId = new Map<string, TBranchSummary[]>()
  const sessions: TSummary[] = []

  for (const bucket of familyBuckets) {
    const families = buildFamilies(bucket, prompts)

    for (const family of families) {
      const rootSummary = createRootSummary(family.root.summary, family.branches.length)
      sessions.push(rootSummary)
      summariesById.set(rootSummary.id, rootSummary)

      const branchSummaries = family.branches.map(({ candidate, branchKind }) => {
        const branchRecord = createBranchRecords(candidate.summary, rootSummary.id, branchKind)
        summariesById.set(branchRecord.summary.id, branchRecord.summary)
        return branchRecord.branchSummary
      })

      branchesByRootId.set(rootSummary.id, branchSummaries)
    }
  }

  sessions.sort((left, right) => +new Date(right.updatedAt) - +new Date(left.updatedAt))

  return {
    sessions,
    summariesById,
    branchesByRootId,
  } satisfies SessionGraph<TSummary, TBranchSummary>
}
