// @vitest-environment jsdom
import React from 'react'
import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderLogContent } from './log-highlight'

it('does not duplicate capture groups in regex highlights', () => {
  const { container } = render(<>{renderLogContent('using DIRECT', '(DIRECT)', true)}</>)
  expect(container.textContent).toBe('using DIRECT')
})

it('highlights text matched by regex', () => {
  const { container } = render(<>{renderLogContent('using DIRECT', 'DIRECT', true)}</>)
  expect(container.querySelector('mark')?.textContent).toBe('DIRECT')
})
