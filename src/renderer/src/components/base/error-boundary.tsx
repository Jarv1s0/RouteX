import { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@heroui/react'
import { BiError } from 'react-icons/bi'

interface Props {
  children?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center gap-4 p-4 text-center">
          <div className="p-4 rounded-full bg-danger/10 text-danger text-4xl">
            <BiError />
          </div>
          <h2 className="text-xl font-bold">出错了 (Something went wrong)</h2>
          <p className="text-default-500 max-w-md text-sm font-mono bg-default-100 p-2 rounded">
            {this.state.error?.message}
          </p>
          <Button 
            color="primary" 
            onPress={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
          >
            刷新页面 (Reload)
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
