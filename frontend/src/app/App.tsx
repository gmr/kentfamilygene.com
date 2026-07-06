import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AdminLayout } from './components/AdminLayout';
import { LoginPage } from './components/LoginPage';
import { RequireAuth } from './components/RequireAuth';

const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const Lineages = lazy(() => import('./components/Lineages').then(m => ({ default: m.Lineages })));
const People = lazy(() => import('./components/People').then(m => ({ default: m.People })));
const Participants = lazy(() => import('./components/Participants').then(m => ({ default: m.Participants })));
const Haplogroups = lazy(() => import('./components/Haplogroups').then(m => ({ default: m.Haplogroups })));
const Places = lazy(() => import('./components/Places').then(m => ({ default: m.Places })));
const AdminNotes = lazy(() => import('./components/AdminNotes').then(m => ({ default: m.AdminNotes })));
const PersonForm = lazy(() => import('./components/PersonForm').then(m => ({ default: m.PersonForm })));
const ParticipantForm = lazy(() => import('./components/ParticipantForm').then(m => ({ default: m.ParticipantForm })));

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Suspense><Dashboard /></Suspense>} />
          <Route path="lineages" element={<Suspense><Lineages /></Suspense>} />
          <Route path="people" element={<Suspense><People /></Suspense>} />
          <Route path="people/new" element={<Suspense><PersonForm /></Suspense>} />
          <Route path="people/:id" element={<Suspense><PersonForm /></Suspense>} />
          <Route path="participants" element={<Suspense><Participants /></Suspense>} />
          <Route path="participants/new" element={<Suspense><ParticipantForm /></Suspense>} />
          <Route path="participants/:id" element={<Suspense><ParticipantForm /></Suspense>} />
          <Route path="haplogroups" element={<Suspense><Haplogroups /></Suspense>} />
          <Route path="places" element={<Suspense><Places /></Suspense>} />
          <Route path="notes" element={<Suspense><AdminNotes /></Suspense>} />
        </Route>
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
      <Toaster position="top-right" />
    </>
  );
}
