import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import { ThemeProvider } from 'next-themes'
import { BrowserRouter } from 'react-router-dom'

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { AuthProvider } from './lib/auth'
import { AuthGate } from './components/AuthGate'

import "./main.css"
import "./styles/theme.css"
import "./index.css"
import "./styles/skins.css"

import { applySavedSkin } from './components/SkinSelect'
// A mentett skin még az első render ELŐTT felkerül a <html>-re (nincs villanás)
applySavedSkin()

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <BrowserRouter>
        <AuthProvider>
          <AuthGate>
            <App />
          </AuthGate>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
   </ErrorBoundary>
)
