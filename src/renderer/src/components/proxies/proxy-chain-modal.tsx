import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Switch
} from '@heroui/react'
import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { IoTrash, IoAdd, IoEye, IoPencil } from 'react-icons/io5'
import ChainPreviewModal from './chain-preview-modal'
import { MdLink, MdLinkOff } from 'react-icons/md'
import { getAllChains, addChainItem, updateChainItem, removeChainItem } from '@renderer/utils/chains-ipc'
import { useGroups } from '@renderer/hooks/use-groups'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import { createSecondaryModalClassNames } from '@renderer/utils/modal-styles'
import { restartCoreInBackground } from '@renderer/utils/core-restart'

const polishedInputClassNames = {
  input: 'bg-transparent text-default-900 text-xs',
  inputWrapper:
    'border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50 min-h-12'
}

const polishedSelectClassNames = {
  trigger:
    'border border-default-200 bg-default-100/50 shadow-sm rounded-2xl data-[hover=true]:bg-default-200/50 min-h-12 h-12',
  value: 'text-xs',
  popoverContent:
    'backdrop-blur-xl bg-background/90 dark:bg-default-100/80 rounded-2xl border border-default-200/60 dark:border-white/10 shadow-xl'
}

interface Props {
  onClose: () => void
}

const ProxyChainModal: React.FC<Props> = ({ onClose }) => {
  const { groups = [] } = useGroups()
  const [chains, setChains] = useState<ChainItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [editingChain, setEditingChain] = useState<ChainItem | null>(null)
  const [isEditing, setIsEditing] = useState(false)


  // 编辑表单状态
  const [chainName, setChainName] = useState('')
  const [dialerProxy, setDialerProxy] = useState('')
  const [targetProxy, setTargetProxy] = useState('')
  const [targetGroups, setTargetGroups] = useState<Set<string>>(new Set())

  // 加载链列表
  const loadChains = useCallback(async () => {
    try {
      const list = await getAllChains()
      setChains(list)
    } catch (e) {
      console.error('Failed to load chains:', e)
    }
  }, [])

  useEffect(() => {
    loadChains()
  }, [loadChains])

  // 所有可用的节点和组名称
  const allProxies = useMemo(() => {
    const proxies: string[] = ['DIRECT', 'REJECT']
    groups.forEach(g => {
      if (!proxies.includes(g.name)) proxies.push(g.name)
      g.all?.forEach(p => {
        if (!proxies.includes(p.name)) proxies.push(p.name)
      })
    })
    return proxies
  }, [groups])

  // 可用的策略组
  const availableGroups = useMemo(() => {
    return groups.filter(g => g.name !== 'GLOBAL').map(g => g.name)
  }, [groups])

  // 开始编辑/新建
  const openEditor = useCallback((chain?: ChainItem) => {
    if (chain) {
      setEditingChain(chain)
      setChainName(chain.name)
      setDialerProxy(chain.dialerProxy)
      setTargetProxy(chain.targetProxy)
      setTargetGroups(new Set(chain.targetGroups || []))
    } else {
      setEditingChain(null)
      setChainName('')
      setDialerProxy('')
      setTargetProxy('')
      setTargetGroups(new Set())
    }
    setIsEditing(true)
  }, [])

  const closeEditor = useCallback(() => {
    setIsEditing(false)
    setEditingChain(null)
  }, [])

  // 保存链
  const handleSave = useCallback(async () => {
    if (!chainName.trim() || !targetProxy || !dialerProxy) {
      return
    }
    setLoading(true)
    try {
      const item: Partial<ChainItem> = {
        name: chainName.trim(),
        dialerProxy,
        targetProxy,
        targetGroups: Array.from(targetGroups)
      }
      if (editingChain) {
        await updateChainItem({ ...editingChain, ...item } as ChainItem)
      } else {
        await addChainItem(item)
      }
      await loadChains()
      setEditingChain(null)
      setIsEditing(false) // 关闭编辑器
      restartCoreInBackground('应用代理链失败')
    } catch (e) {
      console.error('Failed to save chain:', e)
    } finally {
      setLoading(false)
    }
  }, [chainName, dialerProxy, targetProxy, targetGroups, editingChain, loadChains, setIsEditing])

  // 删除链
  const handleDelete = useCallback(async (id: string) => {
    setLoading(true)
    try {
      await removeChainItem(id)
      await loadChains()
      restartCoreInBackground('应用代理链失败')
    } catch (e) {
      console.error('Failed to delete chain:', e)
    } finally {
      setLoading(false)
    }
  }, [loadChains])

  // 切换启用状态
  const handleToggle = useCallback(async (chain: ChainItem, enabled: boolean) => {
    setLoading(true)
    try {
      await updateChainItem({ ...chain, enabled })
      await loadChains()
      restartCoreInBackground('应用代理链失败')
    } catch (e) {
      console.error('Failed to toggle chain:', e)
    } finally {
      setLoading(false)
    }
  }, [loadChains])



  return (
    <Modal
      backdrop="blur"
      classNames={createSecondaryModalClassNames()}
      size="2xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent className="overflow-hidden">
        <ModalHeader className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold text-foreground leading-6">
              {isEditing ? (editingChain ? '编辑代理链' : '新建代理链') : '代理链管理'}
            </div>
            <p className="mt-1 text-xs text-default-400 font-normal leading-5">
              {isEditing
                ? '配置前置节点、落地节点与策略组'
                : `管理代理链配置${chains.length > 0 ? ` · 共 ${chains.length} 条` : ''}`}
            </p>
          </div>
          <SecondaryModalCloseButton onPress={isEditing ? closeEditor : onClose} />
        </ModalHeader>
        <ModalBody className="px-4 py-2">

          {isEditing ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="text-xs font-medium text-default-600">链名称</div>
                <Input
                  size="sm"
                  placeholder="如: HK -> JP 链路"
                  value={chainName}
                  classNames={polishedInputClassNames}
                  onValueChange={setChainName}
                />
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="text-xs font-medium text-default-600">前置节点 / 组</div>
                  <Select
                    size="sm"
                    placeholder="选择前置代理"
                    selectedKeys={dialerProxy ? new Set([dialerProxy]) : new Set()}
                    classNames={polishedSelectClassNames}
                    onSelectionChange={(keys) => setDialerProxy(Array.from(keys)[0] as string)}
                  >
                    {allProxies.map(p => (
                      <SelectItem key={p}>{p}</SelectItem>
                    ))}
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="text-xs font-medium text-default-600">落地节点</div>
                  <Select
                    size="sm"
                    placeholder="选择最终出口节点"
                    selectedKeys={targetProxy ? new Set([targetProxy]) : new Set()}
                    classNames={polishedSelectClassNames}
                    onSelectionChange={(keys) => setTargetProxy(Array.from(keys)[0] as string)}
                  >
                    {allProxies.map(p => (
                      <SelectItem key={p}>{p}</SelectItem>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="text-xs font-medium text-default-600">加入策略组（可选）</div>
                <Select
                  size="sm"
                  placeholder="选择要加入的策略组"
                  selectionMode="multiple"
                  selectedKeys={targetGroups}
                  classNames={polishedSelectClassNames}
                  onSelectionChange={(keys) => setTargetGroups(keys as Set<string>)}
                  color="primary"
                  listboxProps={{
                    itemClasses: {
                      base: [
                        'data-[selected=true]:bg-primary/10',
                        'data-[selected=true]:text-primary',
                        'data-[selected=true]:font-bold',
                        'data-[hover=true]:bg-default-100'
                      ]
                    }
                  }}
                >
                  {availableGroups.map(g => (
                    <SelectItem key={g}>{g}</SelectItem>
                  ))}
                </Select>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {chains.length === 0 ? (
                <div className="rounded-xl border border-dashed border-default-200 bg-content1/40 px-6 py-10 text-center text-default-400">
                  <MdLinkOff className="mx-auto mb-2 text-3xl opacity-50" />
                  <p className="text-sm font-medium text-default-600">暂无代理链配置</p>
                  <p className="mt-1 text-xs">点击下方按钮创建第一条代理链</p>
                </div>
              ) : (
                chains.map(chain => (
                  <div
                    key={chain.id}
                    className="group flex items-center gap-3 p-3 rounded-xl bg-content1/50 hover:bg-content1 border border-default-100 hover:border-default-200 transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <MdLink className="text-lg" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground-600 group-hover:text-foreground-900 transition-colors break-all">
                        {chain.name}
                      </div>
                      <div className="mt-0.5 text-xs text-default-400 group-hover:text-default-500 transition-colors break-all">
                        {chain.dialerProxy} → {chain.targetProxy}
                        {chain.targetGroups && chain.targetGroups.length > 0 && ` · ${chain.targetGroups.join('、')}`}
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-2 shrink-0">
                      <Switch
                        size="sm"
                        isSelected={chain.enabled !== false}
                        color="primary"
                        onValueChange={(v) => handleToggle(chain, v)}
                      />
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        className="min-w-14 px-3 text-xs font-medium"
                        startContent={<IoPencil />}
                        onPress={() => openEditor(chain)}
                      >
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        isIconOnly
                        isLoading={loading}
                        onPress={() => handleDelete(chain.id)}
                      >
                        <IoTrash className="text-xl" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter className="py-2 px-4">
          {isEditing ? (
            <>
              <Button size="sm" variant="flat" onPress={closeEditor}>取消</Button>
              <Button
                size="sm"
                color="primary"
                className="font-medium px-6"
                isLoading={loading}
                isDisabled={!chainName.trim() || !targetProxy || !dialerProxy}
                onPress={handleSave}
              >
                保存
              </Button>
            </>
          ) : (
            <div className="flex w-full justify-end gap-2">
              <Button
                size="sm"
                variant="flat"
                startContent={<IoEye className="text-lg" />}
                isDisabled={chains.length === 0}
                onPress={() => setShowPreview(true)}
              >
                预览链路
              </Button>
              <Button size="sm" color="primary" className="font-medium px-6" startContent={<IoAdd />} onPress={() => openEditor()}>
                新建代理链
              </Button>
            </div>
          )}
        </ModalFooter>
      </ModalContent>
      {showPreview && (
        <ChainPreviewModal 
          chains={chains} 
          onClose={() => setShowPreview(false)} 
        />
      )}
    </Modal>
  )
}

// 可拖拽的前置节点项


export default ProxyChainModal
