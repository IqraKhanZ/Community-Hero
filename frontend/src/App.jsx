import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/layout/Navbar';
import CivicBot from './components/chat/CivicBot';

// Pages
import AuthPage from './pages/AuthPage';
import IssueFeedPage from './pages/IssueFeedPage';
import ReportIssuePage from './pages/ReportIssuePage';
import IssueDetailPage from './pages/IssueDetailPage';
import UserDashboardPage from './pages/UserDashboardPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AccountabilityPage from './pages/AccountabilityPage';

function AppShell() {
  const location = useLocation();
  const isAuth = location.pathname === '/auth';

  return (
    <div className="min-h-screen bg-bg font-sans">
      {!isAuth && <Navbar />}
      <main className={!isAuth ? 'pt-16' : ''}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<PrivateRoute><IssueFeedPage /></PrivateRoute>} />
          <Route path="/report" element={<PrivateRoute><ReportIssuePage /></PrivateRoute>} />
          <Route path="/issues/:id" element={<PrivateRoute><IssueDetailPage /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><UserDashboardPage /></PrivateRoute>} />
          <Route path="/analytics" element={<PrivateRoute><AnalyticsPage /></PrivateRoute>} />
          <Route path="/accountability" element={<AccountabilityPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isAuth && <CivicBot />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
