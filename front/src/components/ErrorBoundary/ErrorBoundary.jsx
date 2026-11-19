import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <main role="alert">Une erreur est survenue. Rechargez la page pour réessayer.</main>
    }
    return this.props.children
  }
}
