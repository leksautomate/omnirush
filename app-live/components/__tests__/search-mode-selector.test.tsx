import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { deleteCookie, getCookie, setCookie } from '@/lib/utils/cookies'

import { SearchModeSelector } from '../search-mode-selector'

describe('SearchModeSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deleteCookie('searchMode')
  })

  test('selects adaptive mode', () => {
    render(<SearchModeSelector />)

    fireEvent.click(screen.getByRole('button', { name: /adaptive mode/i }))

    expect(getCookie('searchMode')).toBe('adaptive')
  })

  test('keeps adaptive selected when it is already active', () => {
    setCookie('searchMode', 'adaptive')

    render(<SearchModeSelector />)

    fireEvent.click(screen.getByRole('button', { name: /adaptive mode/i }))

    expect(getCookie('searchMode')).toBe('adaptive')
  })
})
