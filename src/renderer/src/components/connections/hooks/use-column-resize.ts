import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { DEFAULT_COLUMN_WIDTHS } from '../columns'
import { useAppConfig } from '@renderer/hooks/use-app-config'

export function useColumnResize() {
  const { appConfig, patchAppConfig } = useAppConfig()
  const { connectionTableColumnWidths = {} } = appConfig || {}

  // 合并默认宽度和用户自定义宽度
  const columnWidths = useMemo(
    () => ({
      ...DEFAULT_COLUMN_WIDTHS,
      ...connectionTableColumnWidths
    }),
    [connectionTableColumnWidths]
  )

  // 本地状态用于实时更新
  const [localWidths, setLocalWidths] = useState(columnWidths)

  // 使用 ref 保存最新的 localWidths，解决闭包问题
  const localWidthsRef = useRef(localWidths)
  localWidthsRef.current = localWidths

  // 同步配置变化
  useEffect(() => {
    setLocalWidths((prev) => {
      const next = { ...DEFAULT_COLUMN_WIDTHS, ...connectionTableColumnWidths }
      if (JSON.stringify(prev) === JSON.stringify(next)) {
        return prev
      }
      return next
    })
  }, [connectionTableColumnWidths])

  // 处理列宽调整
  const handleResize = useCallback((col: string, delta: number) => {
    setLocalWidths((prev) => {
      const newWidth = Math.max(40, (prev[col] || DEFAULT_COLUMN_WIDTHS[col]) + delta)
      return { ...prev, [col]: newWidth }
    })
  }, [])

  // 保存列宽（鼠标释放时）
  const saveColumnWidths = useCallback(() => {
    const currentWidths = localWidthsRef.current
    // 保存所有与默认值不同的列宽
    const changedWidths: Record<string, number> = {}
    for (const col of Object.keys(currentWidths)) {
      if (currentWidths[col] !== DEFAULT_COLUMN_WIDTHS[col]) {
        changedWidths[col] = Math.round(currentWidths[col])
      }
    }
    // 也保留之前已保存但这次没改的列宽
    for (const col of Object.keys(connectionTableColumnWidths)) {
      if (
        !(col in changedWidths) &&
        connectionTableColumnWidths[col] !== DEFAULT_COLUMN_WIDTHS[col]
      ) {
        changedWidths[col] = connectionTableColumnWidths[col]
      }
    }
    patchAppConfig({ connectionTableColumnWidths: changedWidths })
  }, [connectionTableColumnWidths, patchAppConfig])

  return {
    computedWidths: localWidths,
    handleResize,
    saveColumnWidths
  }
}
