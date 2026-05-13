import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { useAuthStore } from './store/authStore';
import { useLanguageStore } from './store/languageStore';
import { setI18nLanguage } from './i18n';
import { useDeviceTracker } from './hooks/useDeviceTracker';

function App() {
  const { isAuthenticated } = useAuthStore();
  const { dir, language } = useLanguageStore();

  useDeviceTracker();

  useEffect(() => {
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', dir === 'rtl' ? 'ar' : 'en');
  }, [dir]);

  useEffect(() => {
    setI18nLanguage(language);
  }, [language]);

  return (
    <>
      <HashRouter>
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />}
          />
          <Route
            path="/dashboard/*"
            element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />}
          />
          <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
        </Routes>
      </HashRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#3A3A3A',
            color: '#F6F5F3',
          },
        }}
      />
    </>
  );
}

export default App;
