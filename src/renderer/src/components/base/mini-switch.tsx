import React from 'react'

interface MiniSwitchProps {
  isSelected?: boolean
  isDisabled?: boolean
  onValueChange?: (value: boolean) => void
}

const MiniSwitch: React.FC<MiniSwitchProps> = ({
  isSelected = false,
  isDisabled = false,
  onValueChange
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isSelected}
      disabled={isDisabled}
      className={`
        relative inline-flex items-center shrink-0
        h-[14px] w-[26px] rounded-full
        transition-colors duration-200 ease-in-out
        focus:outline-none
        ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${isSelected ? 'bg-primary/90 dark:bg-sky-500/80 shadow-inner' : 'bg-default-400 dark:bg-default-300 shadow-inner ring-1 ring-black/10 dark:ring-white/10'}
      `}
      onClick={(e) => {
        e.stopPropagation()
        if (!isDisabled && onValueChange) {
          onValueChange(!isSelected)
        }
      }}
    >
      <span
        className={`
          inline-block h-[10px] w-[10px] rounded-full
          bg-white shadow-sm
          transition-transform duration-200 ease-in-out
          ${isSelected ? 'translate-x-[14px]' : 'translate-x-[2px]'}
        `}
      />
    </button>
  )
}

export default MiniSwitch
