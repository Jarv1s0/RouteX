import { Code } from '@heroui/react'
import ReactMarkdown from 'react-markdown'

interface Props {
  children: string
}

const ReleaseNotesMarkdown: React.FC<Props> = ({ children }) => {
  return (
    <ReactMarkdown
      components={{
        a: ({ ...props }) => <a target="_blank" className="text-primary" {...props} />,
        code: ({ children }) => <Code size="sm">{children}</Code>,
        h3: ({ ...props }) => <h3 className="text-lg font-bold" {...props} />,
        li: ({ children }) => <li className="list-disc list-inside">{children}</li>
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

export default ReleaseNotesMarkdown
