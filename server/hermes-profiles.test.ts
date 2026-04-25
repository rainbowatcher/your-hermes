/**
 * 负责：验证 Hermes profile context 解析与 profile 列表行为。
 * 不负责：HTTP 路由与前端渲染。
 */
import { mkdtemp, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'vitest'
import {
  InvalidHermesProfileError,
  listHermesProfiles,
  resolveHermesProfileContext,
} from './hermes-profiles'

async function createFixtureRoot() {
  return await mkdtemp(join(tmpdir(), 'your-hermes-profiles-'))
}

describe('Hermes profiles', () => {
  test('默认 profile 永远存在，named profiles 来自 profiles 目录', async () => {
    const hermesRoot = await createFixtureRoot()
    await mkdir(join(hermesRoot, 'profiles', 'hetun'), { recursive: true })
    await mkdir(join(hermesRoot, 'profiles', 'haibao'), { recursive: true })

    const profiles = await listHermesProfiles({ hermesRoot })

    expect(profiles).toEqual([
      { id: 'default', label: 'Default', isDefault: true, available: true },
      { id: 'haibao', label: 'haibao', isDefault: false, available: true },
      { id: 'hetun', label: 'hetun', isDefault: false, available: true },
    ])
  })

  test('default profile context 指向 hermes root', async () => {
    const hermesRoot = await createFixtureRoot()

    const context = await resolveHermesProfileContext('default', { hermesRoot })

    expect(context).toEqual({
      summary: { id: 'default', label: 'Default', isDefault: true, available: true },
      hermesHome: hermesRoot,
      sessionsDir: join(hermesRoot, 'sessions'),
      skillsRoot: join(hermesRoot, 'skills'),
      memoriesDir: join(hermesRoot, 'memories'),
    })
  })

  test('named profile context 指向 ~/.hermes/profiles/<name>', async () => {
    const hermesRoot = await createFixtureRoot()
    await mkdir(join(hermesRoot, 'profiles', 'hetun'), { recursive: true })

    const context = await resolveHermesProfileContext('hetun', { hermesRoot })

    expect(context).toEqual({
      summary: { id: 'hetun', label: 'hetun', isDefault: false, available: true },
      hermesHome: join(hermesRoot, 'profiles', 'hetun'),
      sessionsDir: join(hermesRoot, 'profiles', 'hetun', 'sessions'),
      skillsRoot: join(hermesRoot, 'profiles', 'hetun', 'skills'),
      memoriesDir: join(hermesRoot, 'profiles', 'hetun', 'memories'),
    })
  })

  test('非法或不存在的 profile 返回错误', async () => {
    const hermesRoot = await createFixtureRoot()
    await mkdir(join(hermesRoot, 'profiles', 'hetun'), { recursive: true })

    await expect(resolveHermesProfileContext('bad/name', { hermesRoot })).rejects.toThrow(
      InvalidHermesProfileError,
    )
    await expect(resolveHermesProfileContext('missing', { hermesRoot })).rejects.toThrow(
      InvalidHermesProfileError,
    )
  })

  test('空字符串 profile 返回错误，不回退到 default', async () => {
    const hermesRoot = await createFixtureRoot()

    await expect(resolveHermesProfileContext('', { hermesRoot })).rejects.toThrow(
      InvalidHermesProfileError,
    )
  })
})
