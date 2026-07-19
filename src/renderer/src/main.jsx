import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyAppearanceToRoot } from './theme/appearanceRegistry'
import { applyInterfacePreferencesToRoot } from './theme/interfacePreferences'
import './styles/global.css'

applyAppearanceToRoot(document.documentElement)
applyInterfacePreferencesToRoot(document.documentElement)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
