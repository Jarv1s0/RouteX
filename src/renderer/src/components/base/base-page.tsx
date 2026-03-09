import { Button, Divider } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import {
  closeMainWindow,
  isAlwaysOnTop,
  setAlwaysOnTop,
  windowMax,
  windowMin
} from '@renderer/utils/ipc'
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { LuPin } from 'react-icons/lu'
import { VscChromeClose, VscChromeMaximize, VscChromeMinimize } from 'react-icons/vsc'

interface Props {
  title?: React.ReactNode
  header?: React.ReactNode
  children?: React.ReactNode
  contentClassName?: string
  className?: string
  headerClassName?: string
  showDivider?: boolean
}

let saveOnTop = false

const BasePage = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { appConfig } = useAppConfig()
  const { useWindowFrame = false } = appConfig || {}

  const [onTop, setOnTop] = useState(saveOnTop)

  const updateAlwaysOnTop = async (): Promise<void> => {
    try {
      const state = await isAlwaysOnTop()
      setOnTop(state)
      saveOnTop = state
    } catch (e) {
      console.error(e)
    }
  }

  // Initial check
  useEffect(() => {
    updateAlwaysOnTop()
  }, [])

  const contentRef = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => {
    return contentRef.current as HTMLDivElement
  })

  return (
    <div ref={contentRef} className={`w-full h-full ${props.className || ''}`}>
      <div
        className={`sticky top-0 z-40 h-[49px] w-full ${props.headerClassName || 'bg-background'}`}
      >
        <div className="app-drag p-2 flex justify-between h-[48px]">
          <div className="title h-full flex items-center select-none">
            <div className="w-1 h-4 bg-primary rounded-full mr-3 shadow-[0_0_10px_rgba(0,111,238,0.4)]" />
            <span className="text-lg font-bold tracking-tight text-foreground">{props.title}</span>
          </div>
          <div className="header flex gap-0 h-full items-center">
            {props.header}
            <div className="flex items-center gap-1.5 mr-2 h-full app-nodrag">
              <Button
                size="sm"
                className={`min-w-8 w-8 h-8 rounded-lg active:scale-90 transition-all ${
                  onTop
                    ? 'text-primary bg-primary/15 hover:bg-primary/25'
                    : 'text-foreground-500 hover:text-foreground-700 hover:bg-default-200/60'
                }`}
                isIconOnly
                title="窗口置顶"
                variant="light"
                onPress={() => {
                  const newState = !onTop
                  setOnTop(newState)
                  saveOnTop = newState
                  setAlwaysOnTop(newState)
                }}
              >
                <LuPin className="w-4 h-4" />
              </Button>

              {!useWindowFrame && platform !== 'darwin' && (
                <>
                  <div className="w-px h-4 bg-default-200/50 mx-1" />
                  <Button
                    size="sm"
                    className="min-w-8 w-8 h-8 rounded-lg text-foreground hover:bg-default-200 active:scale-90 transition-all basic-hover-transition"
                    isIconOnly
                    title="最小化"
                    variant="light"
                    onPress={() => windowMin()}
                  >
                    <VscChromeMinimize className="w-4 h-4 text-foreground" />
                  </Button>
                  <Button
                    size="sm"
                    className="min-w-8 w-8 h-8 rounded-lg text-foreground hover:bg-default-200 active:scale-90 transition-all basic-hover-transition"
                    isIconOnly
                    title="最大化"
                    variant="light"
                    onPress={() => windowMax()}
                  >
                    <VscChromeMaximize className="w-4 h-4 text-foreground" />
                  </Button>
                  <Button
                    size="sm"
                    className="min-w-8 w-8 h-8 rounded-lg text-foreground hover:!bg-red-500 hover:!text-white active:scale-90 transition-all basic-hover-transition"
                    isIconOnly
                    title="关闭"
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

        {(props.showDivider ?? true) && <Divider />}
      </div>
      <div className="content h-[calc(100vh-49px)] overflow-y-auto custom-scrollbar">
        {props.children}
      </div>
    </div>
  )
})

BasePage.displayName = 'BasePage'
export default BasePage
