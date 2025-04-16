import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Box, 
  Typography, 
  Button, 
  CircularProgress, 
  Paper, 
  Divider, 
  Alert, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText,
  Stack,
  Card,
  CardContent,
  IconButton,
  LinearProgress,
  Tooltip,
  Chip,
  useTheme
} from '@mui/material';

// Icônes
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import InstallDesktopIcon from '@mui/icons-material/InstallDesktop';
import RefreshIcon from '@mui/icons-material/Refresh';
import DoneIcon from '@mui/icons-material/Done';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import SyncIcon from '@mui/icons-material/Sync';

// Interfaces
interface UpdateInfo {
  version: string;
  url: string;
  release_date: string;
  description: string;
  is_critical: boolean;
  size_mb: number;
  changes: string[];
}

interface UpdateCheckResult {
  update_available: boolean;
  current_version: string;
  latest_version: string;
  update_info: UpdateInfo | null;
}

interface DownloadResult {
  success: boolean;
  file_path: string;
  message: string;
}

interface InstallResult {
  success: boolean;
  message: string;
  restart_required: boolean;
}

// Page de mise à jour
const AppUpdatePage: React.FC = () => {
  const theme = useTheme();
  
  // États
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  
  const [isInstalling, setIsInstalling] = useState<boolean>(false);
  const [installResult, setInstallResult] = useState<InstallResult | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  
  const [currentStep, setCurrentStep] = useState<'check' | 'download' | 'install' | null>(null);
  
  // Vérifier les mises à jour
  const checkForUpdates = async () => {
    setIsCheckingUpdate(true);
    setCheckError(null);
    setCurrentStep('check');
    
    try {
      const result = await invoke<UpdateCheckResult>('check_for_updates');
      console.log('Résultat de la vérification:', result);
      setUpdateResult(result);
    } catch (error) {
      console.error('Erreur lors de la vérification des mises à jour:', error);
      setCheckError(`${error}`);
    } finally {
      setIsCheckingUpdate(false);
    }
  };
  
  // Télécharger la mise à jour
  const downloadUpdate = async () => {
    if (!updateResult?.update_info?.url) {
      setDownloadError('URL de téléchargement non disponible');
      return;
    }
    
    setIsDownloading(true);
    setDownloadError(null);
    setCurrentStep('download');
    
    try {
      const result = await invoke<DownloadResult>('download_update', {
        updateUrl: updateResult.update_info.url
      });
      console.log('Résultat du téléchargement:', result);
      setDownloadResult(result);
    } catch (error) {
      console.error('Erreur lors du téléchargement de la mise à jour:', error);
      setDownloadError(`${error}`);
    } finally {
      setIsDownloading(false);
    }
  };
  
  // Installer la mise à jour
  const installUpdate = async () => {
    if (!downloadResult?.file_path) {
      setInstallError('Fichier de mise à jour non disponible');
      return;
    }
    
    setIsInstalling(true);
    setInstallError(null);
    setCurrentStep('install');
    
    try {
      const result = await invoke<InstallResult>('install_update', {
        filePath: downloadResult.file_path
      });
      console.log('Résultat de l\'installation:', result);
      setInstallResult(result);
      
      // Si l'installation a réussi et nécessite un redémarrage, redémarrer l'application
      if (result.success && result.restart_required) {
        setTimeout(async () => {
          await invoke('restart_app');
        }, 3000);
      }
    } catch (error) {
      console.error('Erreur lors de l\'installation de la mise à jour:', error);
      setInstallError(`${error}`);
    } finally {
      setIsInstalling(false);
    }
  };
  
  // Redémarrer l'application
  const restartApp = async () => {
    try {
      await invoke('restart_app');
    } catch (error) {
      console.error('Erreur lors du redémarrage de l\'application:', error);
    }
  };
  
  // Vérifier automatiquement les mises à jour au chargement de la page
  useEffect(() => {
    checkForUpdates();
  }, []);
  
  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <SystemUpdateAltIcon sx={{ mr: 1, fontSize: 32 }} />
        Mise à jour de l'application
      </Typography>
      
      <Typography variant="body1" paragraph>
        Vérifier et installer les mises à jour de l'application
      </Typography>
      
      {/* Carte d'état actuel */}
      <Card sx={{ mb: 4, boxShadow: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" component="div">
              Statut des mises à jour
            </Typography>
            <Tooltip title="Vérifier les mises à jour">
              <IconButton 
                onClick={checkForUpdates} 
                disabled={isCheckingUpdate || isDownloading || isInstalling}
                color="primary"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          {isCheckingUpdate ? (
            <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
              <CircularProgress size={20} sx={{ mr: 2 }} />
              <Typography>Vérification des mises à jour en cours...</Typography>
            </Box>
          ) : checkError ? (
            <Alert severity="error" sx={{ my: 2 }}>
              Erreur lors de la récupération de la version actuelle: {checkError}
            </Alert>
          ) : updateResult ? (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="body2">
                  Version actuelle: <strong>{updateResult.current_version}</strong>
                </Typography>
                <Typography variant="body2">
                  Dernière version: <strong>{updateResult.latest_version}</strong>
                </Typography>
              </Box>
              
              {updateResult.update_available ? (
                <Alert 
                  severity="info" 
                  icon={<NewReleasesIcon />}
                  sx={{ 
                    mb: 2,
                    boxShadow: 1,
                    borderLeft: '4px solid',
                    borderColor: 'info.main'
                  }}
                >
                  Une nouvelle version est disponible: <strong>{updateResult.latest_version}</strong>
                  {updateResult.update_info?.is_critical && (
                    <Chip 
                      label="Mise à jour critique" 
                      color="error" 
                      size="small" 
                      sx={{ ml: 2 }} 
                    />
                  )}
                </Alert>
              ) : (
                <Alert 
                  severity="success"
                  icon={<CheckCircleIcon />}
                  sx={{ 
                    mb: 2,
                    boxShadow: 1,
                    borderLeft: '4px solid',
                    borderColor: 'success.main'
                  }}
                >
                  Votre application est à jour.
                </Alert>
              )}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ my: 2 }}>
              Cliquez sur l'icône de rafraîchissement pour vérifier les mises à jour.
            </Typography>
          )}
        </CardContent>
      </Card>
      
      {/* Actions de mise à jour */}
      <Stack spacing={3} direction="row" sx={{ mb: 4 }}>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={checkForUpdates}
          disabled={isCheckingUpdate || isDownloading || isInstalling}
          sx={{ flex: 1 }}
        >
          Vérifier
        </Button>
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<CloudDownloadIcon />}
          onClick={downloadUpdate}
          disabled={!updateResult?.update_available || isCheckingUpdate || isDownloading || isInstalling || !!downloadResult?.success}
          sx={{ flex: 1 }}
        >
          Télécharger
        </Button>
        
        <Button
          variant="contained"
          color="success"
          startIcon={<InstallDesktopIcon />}
          onClick={installUpdate}
          disabled={!downloadResult?.success || isCheckingUpdate || isDownloading || isInstalling || !!installResult?.success}
          sx={{ flex: 1 }}
        >
          Installer
        </Button>
      </Stack>
      
      {/* Informations de la mise à jour */}
      {updateResult?.update_info && (
        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Informations sur la mise à jour
          </Typography>
          
          <Divider sx={{ mb: 2 }} />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2">Version:</Typography>
            <Typography>{updateResult.update_info.version}</Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2">Date de publication:</Typography>
            <Typography>{new Date(updateResult.update_info.release_date).toLocaleDateString()}</Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2">Taille:</Typography>
            <Typography>{updateResult.update_info.size_mb.toFixed(2)} MB</Typography>
          </Box>
          
          <Typography variant="subtitle2" gutterBottom>Description:</Typography>
          <Typography paragraph>{updateResult.update_info.description}</Typography>
          
          <Typography variant="subtitle2" gutterBottom>Changements:</Typography>
          <List dense sx={{ 
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderRadius: 1,
            p: 1
          }}>
            {updateResult.update_info.changes.map((change, index) => (
              <ListItem key={index}>
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <DoneIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText primary={change} />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
      
      {/* Progression des étapes */}
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Gestion des mises à jour
        </Typography>
        
        <Divider sx={{ mb: 3 }} />
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Box 
              component="span" 
              sx={{ 
                width: 24, 
                height: 24, 
                borderRadius: '50%', 
                bgcolor: currentStep === 'check' 
                  ? 'primary.main'
                  : (updateResult && !checkError) 
                    ? 'success.main' 
                    : 'action.disabledBackground',
                color: 'white',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 1,
                fontSize: '14px'
              }}
            >
              1
            </Box>
            Vérifier
          </Typography>
          
          {isCheckingUpdate && <LinearProgress sx={{ mt: 1, mb: 2 }} />}
          
          {checkError && (
            <Alert severity="error" sx={{ mt: 1, mb: 2 }}>
              {checkError}
            </Alert>
          )}
          
          {!isCheckingUpdate && updateResult && !checkError && (
            <Box sx={{ mt: 1, mb: 2, display: 'flex', alignItems: 'center' }}>
              <CheckCircleIcon color="success" sx={{ mr: 1 }} />
              <Typography variant="body2">
                Vérification terminée {updateResult.update_available 
                  ? "- Mise à jour disponible!" 
                  : "- Vous êtes à jour."}
              </Typography>
            </Box>
          )}
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Box 
              component="span" 
              sx={{ 
                width: 24, 
                height: 24, 
                borderRadius: '50%', 
                bgcolor: currentStep === 'download' 
                  ? 'primary.main'
                  : (downloadResult && !downloadError) 
                    ? 'success.main' 
                    : 'action.disabledBackground',
                color: 'white',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 1,
                fontSize: '14px'
              }}
            >
              2
            </Box>
            Télécharger
          </Typography>
          
          {isDownloading && <LinearProgress sx={{ mt: 1, mb: 2 }} />}
          
          {downloadError && (
            <Alert severity="error" sx={{ mt: 1, mb: 2 }}>
              {downloadError}
            </Alert>
          )}
          
          {!isDownloading && downloadResult && !downloadError && (
            <Box sx={{ mt: 1, mb: 2, display: 'flex', alignItems: 'center' }}>
              <CheckCircleIcon color="success" sx={{ mr: 1 }} />
              <Typography variant="body2">
                Téléchargement terminé - {downloadResult.message}
              </Typography>
            </Box>
          )}
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Box 
              component="span" 
              sx={{ 
                width: 24, 
                height: 24, 
                borderRadius: '50%', 
                bgcolor: currentStep === 'install' 
                  ? 'primary.main'
                  : (installResult && !installError) 
                    ? 'success.main' 
                    : 'action.disabledBackground',
                color: 'white',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 1,
                fontSize: '14px'
              }}
            >
              3
            </Box>
            Installer
          </Typography>
          
          {isInstalling && <LinearProgress sx={{ mt: 1, mb: 2 }} />}
          
          {installError && (
            <Alert severity="error" sx={{ mt: 1, mb: 2 }}>
              {installError}
            </Alert>
          )}
          
          {!isInstalling && installResult && !installError && (
            <Box sx={{ mt: 1, mb: 2 }}>
              <Alert 
                severity={installResult.success ? "success" : "error"}
                sx={{ mb: 2 }}
              >
                {installResult.message}
              </Alert>
              
              {installResult.success && installResult.restart_required && (
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<SyncIcon />}
                  onClick={restartApp}
                  fullWidth
                >
                  Redémarrer maintenant
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default AppUpdatePage; 