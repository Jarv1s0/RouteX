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

  private handleCopyError = () => {
    const { error } = this.state
    if (error) {
      const text = `Error: ${error.message}\n\nStack:\n${error.stack}`
      navigator.clipboard.writeText(text)
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-background/50 backdrop-blur-sm">
          <div className="max-w-md w-full bg-content1 border border-default-200 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center space-y-4">
            <div className="p-3 rounded-full bg-danger/10 text-danger mb-2">
              <BiError className="text-4xl" />
            </div>
            
            <h2 className="text-2xl font-bold">应用遇到问题 (Oops!)</h2>
            
            <p className="text-default-500 text-sm">
              很抱歉，RouteX 遇到了一些意料之外的错误。我们要不尝试刷新一下？
            </p>

            <div className="w-full bg-default-100 p-3 rounded-xl overflow-hidden text-left relative group">
               <code className="text-xs font-mono text-danger break-words line-clamp-4">
                 {this.state.error?.message}
               </code>
            </div>

            <div className="flex gap-3 w-full pt-2">
              <Button 
                variant="flat" 
                color="default" 
                className="flex-1"
                onPress={this.handleCopyError}
              >
                复制错误信息
              </Button>
              <Button 
                color="primary" 
                className="flex-1 shadow-md shadow-primary/20"
                onPress={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.reload()
                }}
              >
                重启应用
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
