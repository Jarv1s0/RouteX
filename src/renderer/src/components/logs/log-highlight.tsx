import React from 'react'

const KEYWORD_HIGHLIGHT_REGEX =
  /(\b(?:DIRECT|REJECT|MATCH)\b|RuleSet\([^)]+\)|-->|\b(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?::\d+)?\b)/g

function buildHighlightRegex(searchQuery?: string, isRegexSearch?: boolean): RegExp | null {
  const trimmed = searchQuery?.trim()
  if (!trimmed || trimmed.startsWith('-')) return null
  try {
    if (isRegexSearch) {
      return new RegExp(`(${trimmed})`, 'gi')
    }
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(${escaped})`, 'gi')
  } catch {
    return null
  }
}

function renderHighlightedSegment(text: string, keyPrefix: string): React.ReactNode {
  const parts = text.split(KEYWORD_HIGHLIGHT_REGEX)
  if (parts.length === 1) return text

  return parts.map((part, idx) => {
    if (!part) return null
    if (part === 'DIRECT') {
      return (
        <span
          key={`${keyPrefix}-${idx}`}
          className="text-success-600 dark:text-success-400 font-semibold"
        >
          {part}
        </span>
      )
    }
    if (part === 'REJECT') {
      return (
        <span key={`${keyPrefix}-${idx}`} className="text-danger font-semibold">
          {part}
        </span>
      )
    }
    if (part === '-->') {
      return (
        <span key={`${keyPrefix}-${idx}`} className="text-foreground/55 mx-0.5">
          {part}
        </span>
      )
    }
    if (part.startsWith('RuleSet(')) {
      return (
        <span key={`${keyPrefix}-${idx}`} className="text-purple-600 dark:text-purple-300">
          {part}
        </span>
      )
    }
    if (/^(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?::\d+)?$/.test(part)) {
      return (
        <span key={`${keyPrefix}-${idx}`} className="text-primary-600 dark:text-primary-400">
          {part}
        </span>
      )
    }
    return <React.Fragment key={`${keyPrefix}-${idx}`}>{part}</React.Fragment>
  })
}

export function renderLogContent(
  text: string,
  searchQuery?: string,
  isRegexSearch?: boolean
): React.ReactNode {
  const searchRegex = buildHighlightRegex(searchQuery, isRegexSearch)
  if (!searchRegex) {
    return renderHighlightedSegment(text, 'seg')
  }

  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let matchIndex = 0
  for (const match of text.matchAll(searchRegex)) {
    const index = match.index ?? lastIndex
    if (index > lastIndex) {
      nodes.push(
        <React.Fragment key={`plain-${matchIndex}`}>
          {renderHighlightedSegment(text.slice(lastIndex, index), `p${matchIndex}`)}
        </React.Fragment>
      )
    }
    if (match[0]) {
      nodes.push(
        <mark
          key={`match-${matchIndex}`}
          className="bg-warning/35 text-foreground rounded-sm px-0.5 font-semibold"
        >
          {match[0]}
        </mark>
      )
      lastIndex = index + match[0].length
      matchIndex += 1
    } else {
      searchRegex.lastIndex += 1
    }
  }
  if (lastIndex < text.length) {
    nodes.push(
      <React.Fragment key={`plain-${matchIndex}`}>
        {renderHighlightedSegment(text.slice(lastIndex), `p${matchIndex}`)}
      </React.Fragment>
    )
  }
  return nodes
}
