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
  Divider,
  Switch
} from '@heroui/react'
import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { IoClose, IoTrash, IoAdd, IoEye, IoPencil } from 'react-icons/io5'
import ChainPreviewModal from './chain-preview-modal'
import { MdLink, MdLinkOff } from 'react-icons/md'
import { getAllChains, addChainItem, updateChainItem, removeChainItem, restartCore } from '@renderer/utils/ipc'
import { useGroups } from '@renderer/hooks/use-groups'


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
      await restartCore()
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
      await restartCore()
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
      await restartCore()
    } catch (e) {
      console.error('Failed to toggle chain:', e)
    } finally {
      setLoading(false)
    }
  }, [loadChains])



  return (
    <Modal
      backdrop="blur"
      classNames={{ backdrop: 'top-[48px]' }}
      size="2xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex justify-between items-center pr-4">
          <span>{isEditing ? (editingChain ? '编辑代理链' : '新建代理链') : '代理链管理'}</span>
          <Button isIconOnly size="sm" variant="light" onPress={isEditing ? closeEditor : onClose}>
            <IoClose className="text-lg" />
          </Button>
        </ModalHeader>
        <ModalBody className="py-2 pb-6">

          {isEditing ? (
            // 编辑表单
            <div className="flex flex-col gap-4">
              <Input
                label="链名称"
                placeholder="如: HK->JP链路"
                value={chainName}
                onValueChange={setChainName}
              />

              <Divider />

              {/* 前置节点 */}
              <Select
                label="前置节点/组"
                placeholder="选择前置代理"
                selectedKeys={dialerProxy ? new Set([dialerProxy]) : new Set()}
                onSelectionChange={(keys) => setDialerProxy(Array.from(keys)[0] as string)}
              >
                {allProxies.map(p => (
                  <SelectItem key={p}>{p}</SelectItem>
                ))}
              </Select>

              <Divider />

              {/* 落地节点 */}
              <Select
                label="落地节点"
                placeholder="选择最终出口节点"
                selectedKeys={targetProxy ? new Set([targetProxy]) : new Set()}
                onSelectionChange={(keys) => setTargetProxy(Array.from(keys)[0] as string)}
              >
                {allProxies.map(p => (
                  <SelectItem key={p}>{p}</SelectItem>
                ))}
              </Select>

              {/* 目标策略组 */}
              <Select
                label="加入策略组 (可选)"
                placeholder="选择要加入的策略组"
                selectionMode="multiple"
                selectedKeys={targetGroups}
                onSelectionChange={(keys) => setTargetGroups(keys as Set<string>)}
                color="primary"
                listboxProps={{
                  itemClasses: {
                    base: [
                      "data-[selected=true]:bg-primary/10",
                      "data-[selected=true]:text-primary",
                      "data-[selected=true]:font-bold",
                      "data-[hover=true]:bg-default-100"
                    ]
                  }
                }}
              >
                {availableGroups.map(g => (
                  <SelectItem key={g}>{g}</SelectItem>
                ))}
              </Select>
            </div>
          ) : (
            // 链列表
            <div className="flex flex-col gap-3">
              {chains.length === 0 ? (
                <div className="text-center py-8 text-default-400">
                  <MdLinkOff className="text-4xl mx-auto mb-2 opacity-50" />
                  <p>暂无代理链配置</p>
                  <p className="text-xs mt-1">点击下方按钮创建您的第一条代理链</p>
                </div>
              ) : (
                chains.map(chain => (
                  <div
                    key={chain.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-content2 hover:bg-content3 transition-colors"
                  >
                    <MdLink className="text-xl text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{chain.name}</div>
                      <div className="text-xs text-default-400 truncate">
                        {chain.dialerProxy} → {chain.targetProxy}
                        {chain.targetGroups && chain.targetGroups.length > 0 && ` (${chain.targetGroups.join(', ')})`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        classNames={{ wrapper: "group-hover:bg-default-200" }}
                        isSelected={chain.enabled !== false}
                        onValueChange={(v) => handleToggle(chain, v)}
                      />
                      <Button 
                        variant="flat" 
                        color="primary"
                        startContent={<IoPencil />}
                        onPress={() => openEditor(chain)}
                      >
                        编辑
                      </Button>
                      <Button
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
        <ModalFooter>
          {isEditing ? (
            <>
              <Button variant="flat" onPress={closeEditor}>取消</Button>
              <Button
                color="primary"
                isLoading={loading}
                isDisabled={!chainName.trim() || !targetProxy || !dialerProxy}
                onPress={handleSave}
              >
                保存
              </Button>
            </>
          ) : (
            <div className="flex gap-2 w-full justify-end">
               <Button
                variant="flat"
                startContent={<IoEye className="text-lg" />}
                isDisabled={chains.length === 0}
                onPress={() => setShowPreview(true)}
              >
                预览链路
              </Button>
              <Button color="primary" startContent={<IoAdd />} onPress={() => openEditor()}>
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
