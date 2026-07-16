import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { JournalPage } from './pages/JournalPage';
import { ChatPage } from './pages/ChatPage';
import { GrowthPage } from './pages/GrowthPage';
import { CommunityPage } from './pages/CommunityPage';
import { LandingPage } from './pages/LandingPage';

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/journal" element={<Protected><JournalPage /></Protected>} />
            <Route path="/chat" element={<Protected><ChatPage /></Protected>} />
            <Route path="/growth" element={<Protected><GrowthPage /></Protected>} />
            <Route path="/community" element={<Protected><CommunityPage /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

