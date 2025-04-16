import './App.css'
import { Route } from './Router';
import AppUpdatePage from './pages/AppUpdatePage';

function App() {

  // Le contenu a été déplacé vers HomePage.tsx
  // On pourrait utiliser ce composant App comme wrapper global plus tard si besoin.

  const routes: Route[] = [
    { path: '/', element: <HomePage /> },
    { path: '/disks', element: <DisksPage /> },
    { path: '/processes', element: <ProcessesPage /> },
    { path: '/services', element: <ServicesPage /> },
    { path: '/network', element: <NetworkPage /> },
    { path: '/users', element: <UsersPage /> },
    { path: '/security', element: <SecurityPage /> },
    { path: '/updates', element: <UpdatesPage /> },
    { path: '/backup', element: <BackupPage /> },
    { path: '/ad', element: <AdPage /> },
    { path: '/events', element: <EventViewerPage /> },
    { path: '/shares', element: <SharesPage /> },
    { path: '/tasks', element: <TasksPage /> },
    { path: '/devices', element: <DevicesPage /> },
    { path: '/app-update', element: <AppUpdatePage /> },
  ];

  return (
    <>
      {/* Contenu de base ou vide */}
       {/* Les logos et le compteur par défaut ont été enlevés */}
    </>
  )
}

export default App
