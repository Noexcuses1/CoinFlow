import { Routes, Route } from 'react-router-dom';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Wallet from './pages/Wallet';
import Trade from './pages/Trade';
import Alerts from './pages/Alerts';

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/wallet/:address" element={<Wallet />} />
        <Route path="/trade" element={<Trade />} />
        <Route path="/alerts" element={<Alerts />} />
      </Route>
    </Routes>
  );
}