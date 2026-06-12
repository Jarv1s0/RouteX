import type { CSSProperties } from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { getMainPaneModalContentStyle } from '@renderer/utils/modal-styles'

export function useMainPaneModalContentStyle(
  maxWidthPx?: number,
  viewportPaddingPx?: number
): CSSProperties {
  const { appConfig: { collapseSidebar = false, siderWidth = 250 } = {} } = useAppConfig()

  return getMainPaneModalContentStyle({
    collapseSidebar,
    siderWidth,
    maxWidthPx,
    viewportPaddingPx
  })
}
