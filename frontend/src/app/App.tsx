import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AdminLayout } from './components/AdminLayout';
import { Dashboard } from './components/Dashboard';
import { Lineages } from './components/Lineages';
import { People } from './components/People';
import { Participants } from './components/Participants';
import { Haplogroups } from './components/Haplogroups';
import { Places } from './components/Places';
import { AdminNotes } from './components/AdminNotes';
import { LoginPage } from './components/LoginPage';
import { RequireAuth } from './components/RequireAuth';
import { PersonForm } from './components/PersonForm';
import { ParticipantForm } from './components/ParticipantForm';

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
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="lineages" element={<Lineages />} />
          <Route path="people" element={<People />} />
          <Route path="people/new" element={<PersonForm />} />
          <Route path="people/:id" element={<PersonForm />} />
          <Route path="participants" element={<Participants />} />
          <Route path="participants/new" element={<ParticipantForm />} />
          <Route path="participants/:id" element={<ParticipantForm />} />
          <Route path="haplogroups" element={<Haplogroups />} />
          <Route path="places" element={<Places />} />
          <Route path="notes" element={<AdminNotes />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
      <Toaster position="top-right" />
    </>
  );
}
