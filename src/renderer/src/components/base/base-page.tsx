import { Button } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { closeMainWindow, windowMax, windowMin } from '@renderer/utils/window-ipc'
import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import { VscChromeClose, VscChromeMaximize, VscChromeMinimize } from 'react-icons/vsc'
import { useI18n } from '@renderer/i18n'
import SysproxySwitcher from '@renderer/components/sider/sysproxy-switcher'
import TunSwitcher from '@renderer/components/sider/tun-switcher'
import { CARD_STYLES } from '@renderer/utils/card-styles'

interface Props {
  title?: React.ReactNode
  header?: React.ReactNode
  footer?: React.ReactNode
  children?: React.ReactNode
  contentClassName?: string
  className?: string
  headerClassName?: string
  showDivider?: boolean
}

export const FLOATING_ACTION_BUTTON_CLASS =
  'app-nodrag h-8 min-w-[72px] rounded-lg px-3 text-sm font-medium shadow-[0_5px_12px_rgba(23,201,100,0.18)]'

const BasePage = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { appConfig } = useAppConfig()
  const { t } = useI18n()
  const { useWindowFrame = false } = appConfig || {}

  const contentRef = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => {
    return contentRef.current as HTMLDivElement
  })

  return (
    <div ref={contentRef} className={`w-full h-full ${props.className || ''}`}>
      <div
        className={`sticky top-0 z-40 h-[49px] w-full border-b border-default-200/50 ${props.headerClassName || 'bg-background/70 backdrop-blur-md'}`}
      >
        <div className="app-drag p-2 flex justify-between h-[48px]">
          <div className="title h-full flex items-center select-none">
            <div className="w-1 h-4 bg-primary rounded-full mr-3 shadow-[0_0_10px_rgba(0,111,238,0.4)]" />
            <span className="text-lg font-bold tracking-tight text-foreground">{props.title}</span>
          </div>
          <div className="header flex gap-0 h-full items-center">
            {props.header}
            <div className="flex items-center gap-1.5 mr-2 ml-1.5 h-full app-nodrag">
              <div
                className={`flex items-center p-1 rounded-2xl mr-1 ${CARD_STYLES.BASE} ${CARD_STYLES.HEADER_SWITCHER}`}
              >
                <SysproxySwitcher headerMode />
                <div className="w-[1px] h-3.5 bg-default-300/50 dark:bg-white/10 mx-0.5" />
                <TunSwitcher headerMode />
              </div>

              {!useWindowFrame && platform !== 'darwin' && (
                <>
                  <div className="w-px h-4 bg-default-200/50 mx-1" />
                  <Button
                    size="sm"
                    className="min-w-8 w-8 h-8 rounded-lg text-foreground hover:bg-default-200 active:scale-90 transition-all basic-hover-transition"
                    isIconOnly
                    title={t('basePage.minimize')}
                    variant="light"
                    onPress={() => windowMin()}
                  >
                    <VscChromeMinimize className="w-4 h-4 text-foreground" />
                  </Button>
                  <Button
                    size="sm"
                    className="min-w-8 w-8 h-8 rounded-lg text-foreground hover:bg-default-200 active:scale-90 transition-all basic-hover-transition"
                    isIconOnly
                    title={t('basePage.maximize')}
                    variant="light"
                    onPress={() => windowMax()}
                  >
                    <VscChromeMaximize className="w-4 h-4 text-foreground" />
                  </Button>
                  <Button
                    size="sm"
                    className="min-w-8 w-8 h-8 rounded-lg text-foreground hover:!bg-red-500 hover:!text-white active:scale-90 transition-all basic-hover-transition"
                    isIconOnly
                    title={t('basePage.close')}
                    variant="light"
                    onPress={() => closeMainWindow()}
                  >
                    <VscChromeClose className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* {(props.showDivider ?? true) && <Divider />} */}
      </div>
      <div className="content h-[calc(100vh-49px)] overflow-y-auto custom-scrollbar relative">
        {props.children}
        {props.footer && (
          <div className="sticky bottom-0 z-30 flex justify-end px-3 pb-3 pointer-events-none animate-appearance-in">
            <div className="pointer-events-auto flex items-center gap-2 app-nodrag">
              {props.footer}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

BasePage.displayName = 'BasePage'
export default BasePage
