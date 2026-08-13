import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Toaster } from '@/components/Toaster';
import { useWsRefresh } from '@/hooks/useWs';
import { OverviewPage } from '@/pages/OverviewPage';
import { MarketPage } from '@/pages/MarketPage';
import { PositionsPage } from '@/pages/PositionsPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { TradesPage } from '@/pages/TradesPage';
import { SignalsPage } from '@/pages/SignalsPage';
import { FleetPage } from '@/pages/FleetPage';
import { LlmTracesPage } from '@/pages/LlmTracesPage';
import { RiskPage } from '@/pages/RiskPage';
import { NotificationsPage } from '@/pages/NotificationsPage';

export default function App() {
  // Live WebSocket-driven refresh of all queries.
  useWsRefresh();

  return (
    <>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/positions" element={<PositionsPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/trades" element={<TradesPage />} />
          <Route path="/signals" element={<SignalsPage />} />
          <Route path="/fleet" element={<FleetPage />} />
        <Route path="/llm-traces" element={<LlmTracesPage />} />
          <Route path="/risk" element={<RiskPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  );
}
