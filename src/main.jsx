import React from 'react'
import { createRoot } from 'react-dom/client'
import './ui/tokens.css'
import './ui/base.css'
import { applyPrefs } from './lib/ui-prefs.js'
import { installGlobalHandlers, logError } from './lib/errorlog.js'
import App from './app/App.jsx'

// Tema e dimensione prima del primo disegno, per evitare lampi di colore.
applyPrefs()
installGlobalHandlers()

class ErrorBoundary extends React.Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error, info) { logError('disegno', error, info?.componentStack) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="center">
        <div className="auth-box">
          <h1>Qualcosa non ha funzionato</h1>
          <button className="btn primary" onClick={() => window.location.reload()}>Ricarica</button>
          <a href="#/errors" onClick={() => setTimeout(() => window.location.reload(), 0)}>Vedi registro errori</a>
        </div>
      </div>
    )
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
