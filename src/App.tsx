import { Navigate, Route, Routes } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import TranslatePage from './pages/TranslatePage';
import ConversationPage from './pages/ConversationPage';
import LearnPage from './pages/LearnPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <div className="flex h-dvh flex-col bg-slate-900 pt-[env(safe-area-inset-top)] text-slate-100">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<TranslatePage />} />
          <Route path="/percakapan" element={<ConversationPage />} />
          <Route path="/belajar" element={<LearnPage />} />
          <Route path="/pengaturan" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
