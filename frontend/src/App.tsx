import React, { Component, ErrorInfo, ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MapPage from './pages/MapPage';
import JunctionPage from './pages/JunctionPage';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          flexDirection: 'column',
          gap: 16,
        }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: '2rem', color: '#ff3366' }}>⚠️ ERROR</div>
          <div style={{ fontFamily: 'Rajdhani', color: '#6b82a8', maxWidth: 400, textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              background: 'rgba(0,245,255,0.1)',
              border: '1px solid #00f5ff',
              color: '#00f5ff',
              padding: '8px 20px',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'Orbitron',
            }}
          >
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/junction/:id" element={<JunctionPage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
