import { JSX, ReactNode } from 'react'
import ErrorBoundary from './error-boundary'

interface Props {
  children?: ReactNode
}

const BaseErrorBoundary = (props: Props): JSX.Element => {
  return <ErrorBoundary>{props.children}</ErrorBoundary>
}

export default BaseErrorBoundary
