import { useAppConfig } from '@renderer/hooks/use-app-config'
import React, { useEffect, useState } from 'react'

interface Props {
  children: React.ReactNode
}

const PageTransition: React.FC<Props> = ({ children }) => {
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const [entered, setEntered] = useState(disableAnimation)

  useEffect(() => {
    if (disableAnimation) {
      setEntered(true)
      return
    }

    setEntered(false)
    const frameId = window.requestAnimationFrame(() => {
      setEntered(true)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [disableAnimation])

  return (
    <div
      className={`h-full w-full transition-all ease-out ${
        disableAnimation
          ? ''
          : entered
            ? 'opacity-100 translate-y-0 scale-100 blur-0 duration-200'
            : 'opacity-0 translate-y-2 scale-[0.99] blur-[2px] duration-0'
      }`}
    >
      {children}
    </div>
  )
}

export default PageTransition
