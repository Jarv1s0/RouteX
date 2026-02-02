import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface RulesState {
  disabledRules: Record<number, boolean>
  setRuleDisabled: (index: number, disabled: boolean) => void
  toggleRuleDisabled: (index: number) => void
  resetRules: () => void
}

export const useRulesStore = create<RulesState>()(
  persist(
    (set) => ({
      disabledRules: {},
      setRuleDisabled: (index, disabled) =>
        set((state) => ({
          disabledRules: { ...state.disabledRules, [index]: disabled }
        })),
      toggleRuleDisabled: (index) =>
        set((state) => {
          const current = state.disabledRules[index] || false
          return {
            disabledRules: { ...state.disabledRules, [index]: !current }
          }
        }),
      resetRules: () => set({ disabledRules: {} })
    }),
    {
      name: 'rules-storage'
    }
  )
)
