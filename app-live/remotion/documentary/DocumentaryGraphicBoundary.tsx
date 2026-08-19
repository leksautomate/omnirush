import React from 'react'

interface Props {
  beatId: string
  fallback: React.ReactNode
  onError?: (beatId: string, error: Error) => void
  children: React.ReactNode
}

interface State {
  failed: boolean
}

export class DocumentaryGraphicBoundary extends React.Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    console.error(`documentary-overlay-fallback:${this.props.beatId}`, error)
    this.props.onError?.(this.props.beatId, error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
