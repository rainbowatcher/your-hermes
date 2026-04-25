/**
 * 负责：解析 Hermes profile 列表与服务端读取所需的 profile context。
 * 不负责：HTTP 路由、前端展示与 profile 写操作。
 */
import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'

export interface HermesProfileSummary {
  id: string
  label: string
  isDefault: boolean
  available: boolean
}

export interface HermesProfileContext {
  summary: HermesProfileSummary
  hermesHome: string
  sessionsDir: string
  skillsRoot: string
  memoriesDir: string
}

interface HermesProfileResolverOptions {
  hermesRoot?: string
}

const DEFAULT_PROFILE_ID = 'default'
const PROFILE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

export class InvalidHermesProfileError extends Error {
  constructor() {
    super('非法 profile')
    this.name = 'InvalidHermesProfileError'
  }
}

function resolveHermesRoot(options: HermesProfileResolverOptions = {}) {
  if (options.hermesRoot) {
    return resolve(options.hermesRoot)
  }

  const envHermesHome = process.env.HERMES_HOME?.trim()
  if (!envHermesHome) {
    return join(homedir(), '.hermes')
  }

  const normalized = resolve(envHermesHome)
  const parentName = basename(resolve(normalized, '..'))
  if (parentName === 'profiles') {
    return resolve(normalized, '..', '..')
  }

  return normalized
}

function validateNamedProfileId(profileId: string) {
  if (!PROFILE_NAME_PATTERN.test(profileId) || profileId === '.' || profileId === '..') {
    throw new InvalidHermesProfileError()
  }
}

function buildProfileSummary(profileId: string, available: boolean): HermesProfileSummary {
  return {
    id: profileId,
    label: profileId === DEFAULT_PROFILE_ID ? 'Default' : profileId,
    isDefault: profileId === DEFAULT_PROFILE_ID,
    available,
  }
}

async function listNamedProfileIds(hermesRoot: string) {
  const profilesDir = join(hermesRoot, 'profiles')

  try {
    const entries = await readdir(profilesDir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory() && PROFILE_NAME_PATTERN.test(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right))
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return []
    }

    throw error
  }
}

function normalizeProfileId(profileId?: string) {
  if (profileId === undefined || profileId === null) {
    return DEFAULT_PROFILE_ID
  }

  return profileId.trim()
}

export async function listHermesProfiles(
  options: HermesProfileResolverOptions = {},
): Promise<HermesProfileSummary[]> {
  const hermesRoot = resolveHermesRoot(options)
  const namedProfiles = await listNamedProfileIds(hermesRoot)

  return [
    buildProfileSummary(DEFAULT_PROFILE_ID, true),
    ...namedProfiles.map((profileId) => buildProfileSummary(profileId, true)),
  ]
}

export async function resolveHermesProfileContext(
  profileId = DEFAULT_PROFILE_ID,
  options: HermesProfileResolverOptions = {},
): Promise<HermesProfileContext> {
  const normalizedProfileId = normalizeProfileId(profileId)
  const hermesRoot = resolveHermesRoot(options)

  if (!normalizedProfileId) {
    throw new InvalidHermesProfileError()
  }

  if (normalizedProfileId === DEFAULT_PROFILE_ID) {
    const hermesHome = hermesRoot
    return {
      summary: buildProfileSummary(DEFAULT_PROFILE_ID, true),
      hermesHome,
      sessionsDir: join(hermesHome, 'sessions'),
      skillsRoot: join(hermesHome, 'skills'),
      memoriesDir: join(hermesHome, 'memories'),
    }
  }

  validateNamedProfileId(normalizedProfileId)
  const profileIds = await listNamedProfileIds(hermesRoot)
  if (!profileIds.includes(normalizedProfileId)) {
    throw new InvalidHermesProfileError()
  }

  const hermesHome = join(hermesRoot, 'profiles', normalizedProfileId)
  return {
    summary: buildProfileSummary(normalizedProfileId, true),
    hermesHome,
    sessionsDir: join(hermesHome, 'sessions'),
    skillsRoot: join(hermesHome, 'skills'),
    memoriesDir: join(hermesHome, 'memories'),
  }
}
