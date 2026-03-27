import { Toaster } from 'sonner'

const AppToaster: React.FC = () => {
  return (
    <Toaster
      richColors
      position="bottom-right"
      toastOptions={{ className: '!z-[99999]', style: { zIndex: 99999 } }}
      style={{ zIndex: 99999 }}
    />
  )
}

export default AppToaster
