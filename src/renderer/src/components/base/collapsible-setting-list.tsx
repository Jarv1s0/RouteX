import React, { useEffect, useState } from 'react'
import { Divider } from '@heroui/react'
import { IoChevronForward } from 'react-icons/io5'

import SettingItem from '@renderer/components/base/base-setting-item'

export const getDisabledSettingTitle = (
  title: React.ReactNode,
  isDisabled: boolean
): React.ReactNode => {
  if (!isDisabled) {
    return title
  }

  return <span className="text-default-300">{title}</span>
}

interface CollapsibleSettingListProps {
  title: React.ReactNode
  countLabel: string
  children: React.ReactNode
  divider?: boolean
  isDisabled?: boolean
  hasError?: boolean
}

const CollapsibleSettingList: React.FC<CollapsibleSettingListProps> = ({
  title,
  countLabel,
  children,
  divider = true,
  isDisabled = false,
  hasError = false
}) => {
  const [expanded, setExpanded] = useState(false)
  const showError = !isDisabled && hasError

  useEffect(() => {
    if (showError) {
      setExpanded(true)
    }
  }, [showError])

  return (
    <>
      <SettingItem
        title={getDisabledSettingTitle(title, isDisabled)}
        onPress={() => setExpanded((value) => !value)}
      >
        <div
          className={`flex items-center gap-2 text-xs ${
            showError ? 'text-danger' : isDisabled ? 'text-default-300' : 'text-default-500'
          }`}
        >
          <span>{countLabel}</span>
          <IoChevronForward
            className={`text-base transition-transform duration-300 ease-out ${
              expanded ? 'rotate-90' : ''
            }`}
          />
        </div>
      </SettingItem>
      {expanded && (
        <div
          className={`mt-1 rounded-lg bg-content2 p-2 text-xs text-foreground-500 ${
            isDisabled ? 'opacity-70' : ''
          }`}
        >
          {children}
        </div>
      )}
      {divider && <Divider className="my-2 bg-default-200/50" />}
    </>
  )
}

export default CollapsibleSettingList
