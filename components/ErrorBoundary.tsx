import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught Error Boundary:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '60px 20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '12px', color: '#202225' }}>
            Ops, algo deu errado ao carregar esta página.
          </h2>
          <p style={{ color: '#686c70', marginBottom: '20px', fontSize: '14px' }}>
            {this.state.error?.message || 'Ocorreu uma exceção temporária no navegador.'}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            style={{
              background: '#d5322f',
              color: '#fff',
              border: 0,
              padding: '12px 24px',
              fontWeight: 800,
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontSize: '12px',
            }}
          >
            Recarregar página
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
