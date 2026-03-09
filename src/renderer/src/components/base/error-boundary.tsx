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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="max-w-md w-full bg-content1/80 border border-white/10 shadow-2xl rounded-3xl p-8 flex flex-col items-center text-center space-y-6 animate-in slide-in-from-bottom-5 zoom-in-95 duration-300 backdrop-blur-2xl ring-1 ring-white/5">
            <div className="relative">
              <div className="absolute inset-0 bg-danger/20 blur-xl rounded-full animate-pulse" />
              <div className="relative p-5 rounded-2xl bg-gradient-to-br from-danger/20 to-danger/5 text-danger border border-danger/10 shadow-inner">
                <BiError className="text-5xl drop-shadow-sm" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/60">
                遇到了一点问题
              </h2>
              <p className="text-default-500 text-base leading-relaxed max-w-[90%] mx-auto">
                应用运行过程中遇到了意外错误。这可能只是暂时的，您可以尝试刷新页面。
              </p>
            </div>

            <div className="w-full bg-default-50/50 border border-default-100 p-5 rounded-2xl overflow-hidden text-left relative group hover:bg-default-100/50 transition-colors">
               <div className="flex items-center gap-2 mb-2 opacity-50 text-xs font-semibold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                  Error Details
               </div>
               <code className="block text-xs font-mono text-default-600 break-words line-clamp-4 select-text font-medium leading-relaxed">
                 {this.state.error?.message}
               </code>
            </div>

            <div className="flex gap-4 w-full pt-2">
              <Button 
                variant="bordered" 
                className="flex-1 font-medium border-default-200 hover:bg-default-100 text-default-700"
                size="lg"
                onPress={this.handleCopyError}
              >
                复制错误信息
              </Button>
              <Button 
                color="primary" 
                className="flex-1 font-medium shadow-lg shadow-primary/20"
                size="lg"
                onPress={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.reload()
                }}
              >
                立即重启
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
