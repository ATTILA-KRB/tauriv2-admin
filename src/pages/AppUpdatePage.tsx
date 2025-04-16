import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import PageLayout from '../components/PageLayout';
import HomeCard from '../components/HomeCard';

// Material UI
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';

// Icons
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import InstallDesktopIcon from '@mui/icons-material/InstallDesktop';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

// Types pour les mises à jour
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

const AppUpdatePage: React.FC = () => {
    console.log("Rendu de AppUpdatePage");
    
    // États pour les différentes étapes
    const [activeStep, setActiveStep] = useState<number>(0);
    const steps = ['Vérifier', 'Télécharger', 'Installer'];
    
    // État pour la vérification
    const [isChecking, setIsChecking] = useState(false);
    const [checkResult, setCheckResult] = useState<UpdateCheckResult | null>(null);
    const [checkError, setCheckError] = useState<string | null>(null);
    
    // États pour le téléchargement
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    
    // États pour l'installation
    const [isInstalling, setIsInstalling] = useState(false);
    const [installResult, setInstallResult] = useState<InstallResult | null>(null);
    const [installError, setInstallError] = useState<string | null>(null);
    
    // Fonction pour vérifier les mises à jour
    const checkForUpdates = async () => {
        console.log("Vérification des mises à jour...");
        setIsChecking(true);
        setCheckError(null);
        setCheckResult(null);
        setActiveStep(0);
        
        try {
            const result = await invoke<UpdateCheckResult>('check_for_updates');
            console.log("Résultat:", result);
            setCheckResult(result);
            
            // Si une mise à jour est disponible, passer à l'étape suivante
            if (result.update_available) {
                setActiveStep(1);
            }
        } catch (err) {
            console.error("Erreur:", err);
            setCheckError(typeof err === 'string' ? err : 'Erreur lors de la vérification des mises à jour.');
        } finally {
            setIsChecking(false);
        }
    };
    
    // Fonction pour télécharger la mise à jour
    const downloadUpdate = async () => {
        if (!checkResult?.update_info?.url) {
            setDownloadError('URL de mise à jour non disponible');
            return;
        }
        
        console.log(`Téléchargement depuis ${checkResult.update_info.url}...`);
        setIsDownloading(true);
        setDownloadError(null);
        setDownloadResult(null);
        
        try {
            const result = await invoke<DownloadResult>('download_update', { 
                updateUrl: checkResult.update_info.url 
            });
            console.log("Téléchargement terminé:", result);
            setDownloadResult(result);
            
            // Si le téléchargement a réussi, passer à l'étape suivante
            if (result.success) {
                setActiveStep(2);
            }
        } catch (err) {
            console.error("Erreur de téléchargement:", err);
            setDownloadError(typeof err === 'string' ? err : 'Erreur lors du téléchargement.');
        } finally {
            setIsDownloading(false);
        }
    };
    
    // Fonction pour installer la mise à jour
    const installUpdate = async () => {
        if (!downloadResult?.file_path) {
            setInstallError('Fichier de mise à jour non disponible');
            return;
        }
        
        console.log(`Installation depuis ${downloadResult.file_path}...`);
        setIsInstalling(true);
        setInstallError(null);
        setInstallResult(null);
        
        try {
            const result = await invoke<InstallResult>('install_update', { 
                filePath: downloadResult.file_path 
            });
            console.log("Installation terminée:", result);
            setInstallResult(result);
        } catch (err) {
            console.error("Erreur d'installation:", err);
            setInstallError(typeof err === 'string' ? err : 'Erreur lors de l\'installation.');
        } finally {
            setIsInstalling(false);
        }
    };
    
    // Fonction pour redémarrer l'application
    const restartApp = async () => {
        try {
            await invoke('restart_app');
            // Pas besoin d'alerte ici car l'application va se redémarrer
        } catch (err) {
            console.error("Erreur lors du redémarrage:", err);
            alert('Erreur lors du redémarrage. Veuillez redémarrer l\'application manuellement.');
        }
    };
    
    // Formatage de la date
    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return new Intl.DateTimeFormat('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }).format(date);
        } catch {
            // En cas d'erreur de parsing, retourner la date originale
            return dateStr;
        }
    };
    
    return (
        <PageLayout
            title="Mise à jour de l'application"
            icon={<SystemUpdateIcon />}
            description="Vérifier et installer les mises à jour de l'application"
        >
            <Box sx={{ width: '100%', p: 2 }}>
                {/* Stepper pour montrer les étapes */}
                <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>
                
                {/* Carte principale */}
                <HomeCard
                    title="Gestion des mises à jour"
                    icon={<InfoIcon />}
                    variant="outlined"
                    accentColor="#2196f3"
                    avatarColor="info.main"
                    headerActions={
                        <Button
                            startIcon={<RefreshIcon />}
                            onClick={checkForUpdates}
                            disabled={isChecking}
                            size="small"
                            variant="outlined"
                            color="primary"
                        >
                            Vérifier les mises à jour
                        </Button>
                    }
                >
                    <Box sx={{ p: 3 }}>
                        {/* Vérification des mises à jour */}
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            Statut des mises à jour
                        </Typography>
                        
                        {isChecking ? (
                            <Box display="flex" alignItems="center" p={2}>
                                <CircularProgress size={24} />
                                <Typography sx={{ ml: 2 }}>Vérification en cours...</Typography>
                            </Box>
                        ) : checkError ? (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {checkError}
                            </Alert>
                        ) : !checkResult ? (
                            <Typography color="text.secondary">
                                Cliquez sur "Vérifier les mises à jour" pour rechercher les mises à jour disponibles.
                            </Typography>
                        ) : !checkResult.update_available ? (
                            <Alert severity="success" sx={{ mb: 2 }}>
                                Votre application est à jour (version {checkResult.current_version})
                            </Alert>
                        ) : (
                            <Box>
                                <Alert 
                                    severity={checkResult.update_info?.is_critical ? "warning" : "info"} 
                                    icon={checkResult.update_info?.is_critical ? <NewReleasesIcon /> : <InfoIcon />}
                                    sx={{ mb: 2 }}
                                >
                                    Mise à jour {checkResult.update_info?.is_critical ? "critique " : ""}disponible: version {checkResult.latest_version}
                                </Alert>
                                
                                {checkResult.update_info && (
                                    <Box sx={{ mt: 2, mb: 3 }}>
                                        <Typography variant="subtitle1" fontWeight="bold">
                                            Informations sur la mise à jour:
                                        </Typography>
                                        <Typography variant="body2" sx={{ mt: 1 }}>
                                            {checkResult.update_info.description}
                                        </Typography>
                                        
                                        <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                            <Chip 
                                                icon={<InfoIcon />} 
                                                label={`Version: ${checkResult.latest_version}`} 
                                                color="primary" 
                                                variant="outlined" 
                                            />
                                            <Chip 
                                                icon={<InfoIcon />} 
                                                label={`Date: ${formatDate(checkResult.update_info.release_date)}`} 
                                                color="secondary" 
                                                variant="outlined" 
                                            />
                                            <Chip 
                                                icon={<InfoIcon />} 
                                                label={`Taille: ${checkResult.update_info.size_mb} MB`} 
                                                color="info" 
                                                variant="outlined" 
                                            />
                                        </Box>
                                        
                                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 3 }}>
                                            Nouveautés:
                                        </Typography>
                                        <Box component="ul" sx={{ mt: 1 }}>
                                            {checkResult.update_info.changes.map((change, index) => (
                                                <Typography component="li" variant="body2" key={index}>
                                                    {change}
                                                </Typography>
                                            ))}
                                        </Box>
                                    </Box>
                                )}
                                
                                <Divider sx={{ my: 2 }} />
                                
                                {/* Téléchargement */}
                                <Typography variant="h6" sx={{ mb: 2 }}>
                                    Téléchargement
                                </Typography>
                                
                                {isDownloading ? (
                                    <Box sx={{ mt: 2 }}>
                                        <LinearProgress />
                                        <Typography sx={{ mt: 1 }}>Téléchargement en cours...</Typography>
                                    </Box>
                                ) : downloadError ? (
                                    <Alert severity="error" sx={{ mb: 2 }}>
                                        {downloadError}
                                    </Alert>
                                ) : downloadResult ? (
                                    <Alert severity={downloadResult.success ? "success" : "error"} sx={{ mb: 2 }}>
                                        {downloadResult.message}
                                    </Alert>
                                ) : activeStep >= 1 && checkResult.update_available && (
                                    <Button
                                        startIcon={<CloudDownloadIcon />}
                                        onClick={downloadUpdate}
                                        variant="contained"
                                        color="primary"
                                        sx={{ mt: 1 }}
                                    >
                                        Télécharger la mise à jour
                                    </Button>
                                )}
                                
                                {/* Installation */}
                                {(downloadResult?.success || activeStep >= 2) && (
                                    <>
                                        <Divider sx={{ my: 2 }} />
                                        <Typography variant="h6" sx={{ mb: 2 }}>
                                            Installation
                                        </Typography>
                                        
                                        {isInstalling ? (
                                            <Box sx={{ mt: 2 }}>
                                                <LinearProgress />
                                                <Typography sx={{ mt: 1 }}>Installation en cours...</Typography>
                                            </Box>
                                        ) : installError ? (
                                            <Alert severity="error" sx={{ mb: 2 }}>
                                                {installError}
                                            </Alert>
                                        ) : installResult ? (
                                            <Box>
                                                <Alert 
                                                    severity={installResult.success ? "success" : "error"} 
                                                    sx={{ mb: 2 }}
                                                    icon={installResult.success ? <CheckCircleIcon /> : undefined}
                                                >
                                                    {installResult.message}
                                                </Alert>
                                                
                                                {installResult.success && installResult.restart_required && (
                                                    <Button
                                                        startIcon={<RestartAltIcon />}
                                                        onClick={restartApp}
                                                        variant="contained"
                                                        color="warning"
                                                        sx={{ mt: 1 }}
                                                    >
                                                        Redémarrer l'application
                                                    </Button>
                                                )}
                                            </Box>
                                        ) : (
                                            <Button
                                                startIcon={<InstallDesktopIcon />}
                                                onClick={installUpdate}
                                                variant="contained"
                                                color="secondary"
                                                sx={{ mt: 1 }}
                                            >
                                                Installer la mise à jour
                                            </Button>
                                        )}
                                    </>
                                )}
                            </Box>
                        )}
                    </Box>
                </HomeCard>
            </Box>
        </PageLayout>
    );
};

export default AppUpdatePage; 