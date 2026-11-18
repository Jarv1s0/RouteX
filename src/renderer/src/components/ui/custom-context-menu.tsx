import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode
} from 'react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { CARD_STYLES } from '@renderer/utils/card-styles'

interface Props {
  children: ReactElement
  items: ReactNode
  onOpenChange?: (open: boolean) => void
}

export function CustomContextMenu({ children, items, onOpenChange }: Props): ReactNode {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (): void => {
      setOpen(false)
      onOpenChange?.(false)
    }
    const closeOnScroll = (event: Event): void => {
      if (event.target instanceof Node && contentRef.current?.contains(event.target)) return
      close()
    }
    window.addEventListener('scroll', closeOnScroll, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', closeOnScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open, onOpenChange])

  return (
    <ContextMenu.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        onOpenChange?.(next)
      }}
      modal={false}
    >
      <ContextMenu.Trigger asChild ref={triggerRef} tabIndex={0}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal container={triggerRef.current?.closest<HTMLElement>('[role="dialog"]')}>
        <ContextMenu.Content
          ref={contentRef}
          collisionPadding={8}
          loop
          className={`z-[9999] min-w-[140px] max-h-[var(--radix-context-menu-content-available-height)] overflow-y-auto p-1 animate-pop-in outline-none ${CARD_STYLES.GLASS_CARD}`}
        >
          {items}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

export function ContextMenuItem({
  className = '',
  ...props
}: ComponentPropsWithoutRef<typeof ContextMenu.Item>): ReactNode {
  return (
    <ContextMenu.Item
      className={`flex h-9 min-w-[120px] cursor-default select-none items-center gap-2 rounded-lg px-3 text-sm font-medium text-default-700 outline-none data-[highlighted]:bg-default-100 data-[disabled]:opacity-50 ${className}`}
      {...props}
    />
  )
}
