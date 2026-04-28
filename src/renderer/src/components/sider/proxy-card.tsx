import { Button, Card, CardBody, Tooltip } from '@heroui/react'
import { LuChevronRight, LuRocket } from 'react-icons/lu'
import { useLocation } from 'react-router-dom'
import { useGroups } from '@renderer/hooks/use-groups'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { getFlag, removeFlag, cleanNodeName } from '@renderer/utils/flags'
import React, { useMemo } from 'react'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { navigateSidebarRoute } from '@renderer/routes'

interface Props {
  iconOnly?: boolean
}

type ProxyLookupItem = {
  name: string
  now?: string
  all?: Array<ProxyLookupItem>
}

const ProxyCard: React.FC<Props> = (props) => {
  const { iconOnly } = props
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { mode } = controledMihomoConfig || {}
  const location = useLocation()
  const match = location.pathname.includes('/proxies')
  const { groups = [] } = useGroups()

  const handleCardClick = (): void => {
    navigateSidebarRoute('/proxies')
  }

  const allProxies = useMemo(() => {
    const map: Record<string, ProxyLookupItem> = {}

    const collect = (proxy: ProxyLookupItem): void => {
      map[proxy.name] = proxy
      proxy.all?.forEach(collect)
    }

    groups.forEach((group) => collect(group as ProxyLookupItem))
    return map
  }, [groups])

  const firstGroup = useMemo(() => {
    return mode === 'global'
      ? groups.find((g) => g.name === 'GLOBAL')
      : groups.find((g) => g.name !== 'GLOBAL')
  }, [groups, mode])

  const currentGroupLabel = useMemo(() => {
    const groupName = firstGroup?.now
    return groupName ? cleanNodeName(groupName) : '代理组'
  }, [firstGroup])

  const currentGroupFlag = useMemo(() => {
    const groupName = firstGroup?.now
    return groupName ? getFlag(groupName) : ''
  }, [firstGroup])

  const finalNodeName = useMemo(() => {
    const visited = new Set<string>()

    const findFinalNode = (nodeName: string | undefined): string | undefined => {
      if (!nodeName || visited.has(nodeName)) return nodeName

      visited.add(nodeName)
      const subGroup = allProxies[nodeName]
      if (subGroup && 'now' in subGroup && subGroup.now) {
        return findFinalNode(subGroup.now)
      }

      return nodeName
    }

    const groupName = firstGroup?.now
    const finalNode = findFinalNode(groupName)
    if (groupName && finalNode && groupName !== finalNode) {
      return cleanNodeName(removeFlag(finalNode))
    }
    return ''
  }, [allProxies, firstGroup])

  const hasFinalNode = finalNodeName.length > 0

  if (iconOnly) {
    return (
      <div className={`flex justify-center`}>
        <Tooltip content="代理组" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={handleCardClick}
          >
            <LuRocket className="text-[16px]" />
          </Button>
        </Tooltip>
      </div>
    )
  }
  return (
    <div className={`proxy-card`}>
      <Card
        fullWidth
        isPressable
        onPress={handleCardClick}
        className={`
          ${CARD_STYLES.BASE}
          ${match ? CARD_STYLES.ACTIVE : CARD_STYLES.INACTIVE}
          cursor-pointer
        `}
      >
        <CardBody className="py-3 px-5 h-[90px] flex flex-col justify-between">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
              <LuRocket
                className={`text-[16px] transition-colors text-foreground/80 dark:text-foreground/70`}
              />
            </span>
            <h3 className={`text-sm font-semibold text-foreground dark:text-foreground/90`}>
              代理组
            </h3>
          </div>

          <div className="flex items-center gap-1.5 mt-auto max-w-full overflow-hidden">
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[13px] leading-none flag-emoji">
              {currentGroupFlag}
            </span>
            <div className="flex flex-1 min-w-0 items-center gap-1.5 overflow-hidden">
              <span
                className={`text-sm font-normal truncate min-w-0 text-foreground ${
                  hasFinalNode ? 'max-w-[50%] shrink' : 'flex-1'
                }`}
              >
                {currentGroupLabel}
              </span>
              {hasFinalNode && (
                <>
                  <LuChevronRight
                    className={`text-[12px] shrink-0 text-default-500 dark:text-default-300`}
                  />
                  <span
                    className={`text-sm truncate font-medium min-w-0 flex-1 text-default-700 dark:text-default-300 flag-emoji`}
                  >
                    {finalNodeName}
                  </span>
                </>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default ProxyCard
