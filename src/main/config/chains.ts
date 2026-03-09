import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { dataDir } from '../utils/dirs'
import { parseYaml, stringifyYaml } from '../utils/yaml'
import path from 'path'

// 代理链配置路径
export function chainsConfigPath(): string {
  return path.join(dataDir(), 'chains.yaml')
}

let chainsConfig: ChainsConfig // chains.yaml

/**
 * 获取代理链配置
 */
export async function getChainsConfig(force = false): Promise<ChainsConfig> {
  if (force || !chainsConfig) {
    if (!existsSync(chainsConfigPath())) {
      chainsConfig = { items: [] }
      return chainsConfig
    }
    const data = await readFile(chainsConfigPath(), 'utf-8')
    chainsConfig = parseYaml<ChainsConfig>(data) || { items: [] }
  }
  if (typeof chainsConfig !== 'object') chainsConfig = { items: [] }
  return chainsConfig
}

/**
 * 保存代理链配置
 */
export async function setChainsConfig(config: ChainsConfig): Promise<void> {
  chainsConfig = config
  await writeFile(chainsConfigPath(), stringifyYaml(chainsConfig), 'utf-8')
}

/**
 * 获取单个代理链项
 */
export async function getChainItem(id: string | undefined): Promise<ChainItem | undefined> {
  const { items } = await getChainsConfig()
  return items.find((item) => item.id === id)
}

/**
 * 添加代理链
 */
export async function addChainItem(item: Partial<ChainItem>): Promise<ChainItem> {
  const config = await getChainsConfig()
  const id = item.id || new Date().getTime().toString(16)
  const newItem: ChainItem = {
    id,
    name: item.name || '新建代理链',
    dialerProxy: item.dialerProxy || '',
    targetProxy: item.targetProxy || '',
    targetGroups: item.targetGroups || [],
    enabled: true
  }

  const existingIndex = config.items.findIndex((i) => i.id === id)
  if (existingIndex !== -1) {
    config.items[existingIndex] = newItem
  } else {
    config.items.push(newItem)
  }

  await setChainsConfig(config)
  return newItem
}

/**
 * 更新代理链
 */
export async function updateChainItem(item: ChainItem): Promise<void> {
  const config = await getChainsConfig()
  const index = config.items.findIndex((i) => i.id === item.id)
  if (index === -1) {
    throw new Error('Chain not found')
  }
  config.items[index] = item
  await setChainsConfig(config)
}

/**
 * 删除代理链
 */
export async function removeChainItem(id: string): Promise<void> {
  const config = await getChainsConfig()
  config.items = config.items.filter((item) => item.id !== id)
  await setChainsConfig(config)
}

/**
 * 获取所有代理链
 */
export async function getAllChains(): Promise<ChainItem[]> {
  const config = await getChainsConfig()
  return config.items
}
