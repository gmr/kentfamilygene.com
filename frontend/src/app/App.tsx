import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AdminLayout } from './components/AdminLayout';
import { LoginPage } from './components/LoginPage';
import { RequireAuth } from './components/RequireAuth';
import { PublicLayout } from './public/PublicLayout';

const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const Lineages = lazy(() => import('./components/Lineages').then(m => ({ default: m.Lineages })));
const People = lazy(() => import('./components/People').then(m => ({ default: m.People })));
const Participants = lazy(() => import('./components/Participants').then(m => ({ default: m.Participants })));
const Haplogroups = lazy(() => import('./components/Haplogroups').then(m => ({ default: m.Haplogroups })));
const Places = lazy(() => import('./components/Places').then(m => ({ default: m.Places })));
const AdminNotes = lazy(() => import('./components/AdminNotes').then(m => ({ default: m.AdminNotes })));
const PersonForm = lazy(() => import('./components/PersonForm').then(m => ({ default: m.PersonForm })));
const ParticipantForm = lazy(() => import('./components/ParticipantForm').then(m => ({ default: m.ParticipantForm })));
const Pages = lazy(() => import('./components/Pages').then(m => ({ default: m.Pages })));
const PageForm = lazy(() => import('./components/PageForm').then(m => ({ default: m.PageForm })));
const Snippets = lazy(() => import('./components/Snippets').then(m => ({ default: m.Snippets })));
const Navigation = lazy(() => import('./components/Navigation').then(m => ({ default: m.Navigation })));

const Home = lazy(() => import('./public/Home').then(m => ({ default: m.Home })));
const LineageBrowser = lazy(() => import('./public/LineageBrowser').then(m => ({ default: m.LineageBrowser })));
const LineageDetail = lazy(() => import('./public/LineageDetail').then(m => ({ default: m.LineageDetail })));
const PublicSearch = lazy(() => import('./public/Search').then(m => ({ default: m.Search })));
const PublicHaplogroups = lazy(() => import('./public/Haplogroups').then(m => ({ default: m.Haplogroups })));
const CmsPage = lazy(() => import('./public/CmsPage').then(m => ({ default: m.CmsPage })));

export default function App() {
  return (
    <>
      <Routes>
        {/* Public site */}
        <Route element={<PublicLayout />}>
          <Route index element={<Suspense><Home /></Suspense>} />
          <Route path="/lineages" element={<Suspense><LineageBrowser /></Suspense>} />
          <Route path="/lineages/:id" element={<Suspense><LineageDetail /></Suspense>} />
          <Route path="/search" element={<Suspense><PublicSearch /></Suspense>} />
          <Route path="/haplogroups" element={<Suspense><PublicHaplogroups /></Suspense>} />
          {/* CMS-managed pages. Last, so it never shadows a built-in route. */}
          <Route path="/:slug" element={<Suspense><CmsPage /></Suspense>} />
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
          <Route path="pages" element={<Suspense><Pages /></Suspense>} />
          <Route path="pages/new" element={<Suspense><PageForm /></Suspense>} />
          <Route path="pages/:id" element={<Suspense><PageForm /></Suspense>} />
          <Route path="snippets" element={<Suspense><Snippets /></Suspense>} />
          <Route path="navigation" element={<Suspense><Navigation /></Suspense>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" />
    </>
  );
}
