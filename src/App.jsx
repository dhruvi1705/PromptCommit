import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PromptProvider } from './context/PromptContext';
import { ToastProvider } from './context/ToastContext';
import { NotificationProvider } from './context/NotificationContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { Layout } from './components/Layout';
import { ScrollToTop } from './components/ScrollToTop';
import { PageTitle } from './components/PageTitle';

// Pages
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { PromptLibrary } from './pages/PromptLibrary';
import { CreatePrompt } from './pages/CreatePrompt';
import { Playground } from './pages/Playground';
import { Versions } from './pages/Versions';
import { Compare } from './pages/Compare';
import { AIToolkit } from './pages/AIToolkit';
import { Collections } from './pages/Collections';
import { Favorites } from './pages/Favorites';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { Collaboration } from './pages/Collaboration';
import { AcceptInvite } from './pages/AcceptInvite';
import { NotFound } from './pages/NotFound';

import { ErrorBoundary } from './components/ErrorBoundary';

// Route Guard for Protected Workspace Pages
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <PromptProvider>
        <NotificationProvider>
          <ToastProvider>
            <LanguageProvider>
              <Router basename="/PromptCommit">
                <ScrollToTop />
                <PageTitle />
                <Routes>
                  {/* Public Marketing, Auth & Collaboration Invite Pages */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/invite/:token" element={<ErrorBoundary><AcceptInvite /></ErrorBoundary>} />

                  {/* Protected Private Workspace Dashboard Routes */}
                  <Route
                    path="/app"
                    element={
                      <ProtectedRoute>
                        <ErrorBoundary>
                          <Layout />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Dashboard />} />
                    <Route path="prompts" element={<PromptLibrary />} />
                    <Route path="create" element={<CreatePrompt />} />
                    <Route path="playground" element={<Playground />} />
                    <Route path="versions" element={<Versions />} />
                    <Route path="compare" element={<Compare />} />
                    <Route path="toolkit" element={<AIToolkit />} />
                    <Route path="collections" element={<Collections />} />
                    <Route path="favorites" element={<Favorites />} />
                    <Route path="collaboration" element={<Collaboration />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>

                  {/* 404 Fallback */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Router>
            </LanguageProvider>
          </ToastProvider>
        </NotificationProvider>
      </PromptProvider>
    </AuthProvider>
  );
}

export default App;

