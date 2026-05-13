import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { ErrorBoundary } from '../components/ErrorBoundary';
import DashboardHome from '../components/Dashboard/DashboardHome';

// Lazy-loaded components for code splitting
const Branches = lazy(() => import('../components/Branches/Branches'));
const BranchProfile = lazy(() => import('../components/Branches/BranchProfile'));
const Employers = lazy(() => import('../components/Employers/Employers'));
const EmployerProfile = lazy(() => import('../components/Employers/EmployerProfile'));
const Employees = lazy(() => import('../components/Employees/Employees'));
const EmployeeProfile = lazy(() => import('../components/Employees/EmployeeProfile'));
const Housing = lazy(() => import('../components/Housing/Housing'));
const HousingProfile = lazy(() => import('../components/Housing/HousingProfile'));
const Phones = lazy(() => import('../components/Phones/Phones'));
const PhoneProfile = lazy(() => import('../components/Phones/PhoneProfile'));
const Vehicles = lazy(() => import('../components/Vehicles/Vehicles'));
const VehicleProfile = lazy(() => import('../components/Vehicles/VehicleProfile'));
const Entities = lazy(() => import('../components/Entities/Entities'));
const EntityProfile = lazy(() => import('../components/Entities/EntityProfile'));
const Settings = lazy(() => import('../components/Settings/Settings'));
const Archive = lazy(() => import('../pages/Archive'));
const Documents = lazy(() => import('../pages/Documents'));
const Logs = lazy(() => import('../pages/Logs'));
const Services = lazy(() => import('../pages/Services'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-gold border-t-transparent" />
    </div>
  );
}

export default function Dashboard() {
  const location = useLocation();
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <ErrorBoundary key={location.pathname}>
          <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/services" element={<Services />} />
          <Route path="/branches" element={<Branches />} />
          <Route path="/branches/:id" element={<BranchProfile />} />
          <Route path="/employers" element={<Employers />} />
          <Route path="/employers/:id" element={<EmployerProfile />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/employees/:id" element={<EmployeeProfile />} />
          <Route path="/housing" element={<Housing />} />
          <Route path="/housing/:id" element={<HousingProfile />} />
          <Route path="/phones" element={<Phones />} />
          <Route path="/phones/:id" element={<PhoneProfile />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/vehicles/:id" element={<VehicleProfile />} />
          <Route path="/entities" element={<Entities />} />
          <Route path="/entities/:id" element={<EntityProfile />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/reports" element={<Navigate to="/dashboard" replace />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/:section" element={<Settings />} />
          </Routes>
        </ErrorBoundary>
      </Suspense>
    </Layout>
  );
}
