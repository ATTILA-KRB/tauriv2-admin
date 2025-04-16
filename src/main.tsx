import React, { useState, useMemo } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import IconButton from '@mui/material/IconButton';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
// import App from './App.tsx' // Supprimer l'import App non utilisé
import HomePage from './pages/HomePage.tsx';
import DisksPage from './pages/DisksPage.tsx';
import ProcessesPage from './pages/ProcessesPage.tsx';
import ServicesPage from './pages/ServicesPage.tsx';
import NetworkPage from './pages/NetworkPage.tsx';
import UsersPage from './pages/UsersPage.tsx';
import SecurityPage from './pages/SecurityPage.tsx';
import UpdatesPage from './pages/UpdatesPage.tsx';
import BackupPage from './pages/BackupPage.tsx';
import ActiveDirectoryPage from './pages/ActiveDirectoryPage.tsx';
import EventViewerPage from './pages/EventViewerPage.tsx';
import SharesPage from './pages/SharesPage.tsx';
import TasksPage from './pages/TasksPage.tsx';
import DevicesPage from './pages/DevicesPage.tsx';
import AppUpdatePage from './pages/AppUpdatePage.tsx';
import './index.css'
import Sidebar from './components/Sidebar';

const drawerWidth = 240;

// Layout avec AppBar et Sidebar
function Layout() {
  const [mode, setMode] = useState<'light' | 'dark'>('dark');

  const toggleColorMode = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
        },
      }),
    [mode],
  );

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <AppBar 
          position="fixed" 
          sx={{ width: `calc(100% - ${drawerWidth}px)`, ml: `${drawerWidth}px` }}
        >
          <Toolbar>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
              Windows Admin Tool
            </Typography>
            <IconButton sx={{ ml: 1 }} onClick={toggleColorMode} color="inherit">
              {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Toolbar>
        </AppBar>
        <Sidebar />
        <Box 
          component="main"
          sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3 }}
        >
          <Toolbar />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/disks" element={<DisksPage />} />
            <Route path="/processes" element={<ProcessesPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/network" element={<NetworkPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/updates" element={<UpdatesPage />} />
            <Route path="/backup" element={<BackupPage />} />
            <Route path="/ad" element={<ActiveDirectoryPage />} />
            <Route path="/events" element={<EventViewerPage />} />
            <Route path="/shares" element={<SharesPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/app-update" element={<AppUpdatePage />} />
          </Routes>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  </React.StrictMode>,
)
