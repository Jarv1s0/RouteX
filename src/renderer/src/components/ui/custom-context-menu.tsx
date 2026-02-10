import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Card } from '@heroui/react'

interface Props {
  isOpen: boolean
  onClose: () => void
  position: { x: number; y: number }
  children: React.ReactNode
}

export const CustomContextMenu: React.FC<Props> = ({ isOpen, onClose, position, children }) => {
  const menuRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // 滚动时也关闭，防止错位
    const handleScroll = () => {
      onClose()
    }

    window.addEventListener('mousedown', handleMouseDown, true)
    window.addEventListener('scroll', handleScroll, true) // Capture phase to detect any scroll
    window.addEventListener('resize', onClose)

    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
       {/* 使用 pointer-events-auto 恢复菜单的点击交互 */}
      <div 
        ref={menuRef}
        className="absolute pointer-events-auto"
        style={{ 
          left: position.x, 
          top: position.y 
        }}
      >
        <Card shadow="md" className="min-w-[140px] p-1">
          {children}
        </Card>
      </div>
    </div>,
    document.body
  )
}
