import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './api';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { SharedEntry } from './pages/SharedEntry';
import { CliAuth } from './pages/CliAuth';
import { Landing } from './pages/Landing';
import { GetStarted } from './pages/GetStarted';
import { InstallCli } from './pages/InstallCli';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="bottom-right" toastOptions={{
        style: { background: '#0f0f0f', color: '#e5e5e5', border: '1px solid #2a2a2a' }
      }} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/s/:token" element={<SharedEntry />} />
        <Route path="/cli-auth" element={<CliAuth />} />
        <Route path="/dashboard" element={
          <PrivateRoute><Dashboard /></PrivateRoute>
        } />
        <Route path="/install" element={<InstallCli />} />
        <Route path="/get-started" element={<GetStarted />} />
        <Route path="/" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  );
}
