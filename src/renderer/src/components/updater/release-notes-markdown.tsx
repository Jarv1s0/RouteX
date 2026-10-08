import { Code } from '@heroui/react'
import ReactMarkdown from 'react-markdown'

interface Props {
  children: string
}

const ReleaseNotesMarkdown: React.FC<Props> = ({ children }) => {
  const content = children.replace(/^\s*#{1,6}[\t ]+更新日志[\t ]*(?:\r?\n|$)\s*/, '')

  return (
    <ReactMarkdown
      components={{
        a: ({ ...props }) => <a target="_blank" className="text-primary" {...props} />,
        code: ({ children }) => <Code size="sm">{children}</Code>,
        h3: ({ ...props }) => <h3 className="text-lg font-bold" {...props} />,
        li: ({ children }) => <li className="list-disc list-inside">{children}</li>
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export default ReleaseNotesMarkdown
