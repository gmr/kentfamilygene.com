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
import { Pages } from './components/Pages';
import { PageForm } from './components/PageForm';
import { Snippets } from './components/Snippets';
import { Navigation } from './components/Navigation';
import { LoginPage } from './components/LoginPage';
import { RequireAuth } from './components/RequireAuth';
import { PersonForm } from './components/PersonForm';
import { ParticipantForm } from './components/ParticipantForm';
import { PublicLayout } from './public/PublicLayout';
import { Home } from './public/Home';
import { LineageBrowser } from './public/LineageBrowser';
import { LineageDetail } from './public/LineageDetail';
import { Search as PublicSearch } from './public/Search';
import { Haplogroups as PublicHaplogroups } from './public/Haplogroups';
import { CmsPage } from './public/CmsPage';

export default function App() {
  return (
    <>
      <Routes>
        {/* Public site */}
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="/lineages" element={<LineageBrowser />} />
          <Route path="/lineages/:id" element={<LineageDetail />} />
          <Route path="/search" element={<PublicSearch />} />
          <Route path="/haplogroups" element={<PublicHaplogroups />} />
          {/* CMS-managed pages. Last, so it never shadows a built-in route. */}
          <Route path="/:slug" element={<CmsPage />} />
        </Route>

        {/* Admin */}
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
          <Route path="pages" element={<Pages />} />
          <Route path="pages/new" element={<PageForm />} />
          <Route path="pages/:id" element={<PageForm />} />
          <Route path="snippets" element={<Snippets />} />
          <Route path="navigation" element={<Navigation />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" />
    </>
  );
}
