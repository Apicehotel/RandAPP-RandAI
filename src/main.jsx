import React from 'react'
import { createRoot } from 'react-dom/client'
import './ui/tokens.css'
import './ui/base.css'
import { applyPrefs } from './lib/ui-prefs.js'
import App from './app/App.jsx'

// Tema e dimensione prima del primo disegno, per evitare lampi di colore.
applyPrefs()

class ErrorBoundary extends React.Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="center">
        <div className="auth-box">
          <h1>Qualcosa non ha funzionato</h1>
          <button className="btn primary" onClick={() => window.location.reload()}>Ricarica</button>
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
