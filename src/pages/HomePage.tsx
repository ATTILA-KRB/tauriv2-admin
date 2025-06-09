import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

// Importer les composants MUI nécessaires
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Avatar from '@mui/material/Avatar';

// Icônes
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ComputerIcon from '@mui/icons-material/Computer';
import MemoryIcon from '@mui/icons-material/Memory';
import SecurityIcon from '@mui/icons-material/Security';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SpeedIcon from '@mui/icons-material/Speed';
import GppGoodIcon from '@mui/icons-material/GppGood';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import BarChartIcon from '@mui/icons-material/BarChart';

// Interfaces
interface HardwareInfo {
    cpu_name: string | null;
    cpu_cores: number | null;
    cpu_threads: number | null;
    cpu_max_speed_mhz: number | null;
    ram_total_gb: number | null;
    ram_modules_count: number | null;
    motherboard_manufacturer: string | null;
    motherboard_product: string | null;
    gpus: GpuInfo[];
}

interface GpuInfo {
    name: string;
    ram_mb: number;
    driver_version: string;
}

interface AntivirusStatusInfo {
    antispyware_enabled: boolean;
    real_time_protection_enabled: boolean;
}

interface SystemUsageInfo {
    cpu_usage_percent: number;
    ram_used_mb: number;
    ram_total_mb: number;
}

import HomeCard from '../components/HomeCard';

const HomePage: React.FC = () => {
    // États
    const [isElevated, setIsElevated] = useState<boolean | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [elevationError, setElevationError] = useState<string | null>(null);
    const [systemActionError, setSystemActionError] = useState<string | null>(null);
    const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
    const [isLoadingHardware, setIsLoadingHardware] = useState<boolean>(true);
    const [hardwareError, setHardwareError] = useState<string | null>(null);
    const [avStatus, setAvStatus] = useState<AntivirusStatusInfo | null>(null);
    const [isLoadingAv, setIsLoadingAv] = useState<boolean>(true);
    const [avError, setAvError] = useState<string | null>(null);
    const [systemUsage, setSystemUsage] = useState<SystemUsageInfo | null>(null);
    const [isLoadingUsage, setIsLoadingUsage] = useState<boolean>(true);
    const [usageError, setUsageError] = useState<string | null>(null);

    // ------------------------------------------------------------------
    // 1) Vérification élévation + Hardware + AV en parallèle au montage
    // ------------------------------------------------------------------
    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const [elevated, hw, av] = await Promise.all([
                    invoke<boolean>('is_elevated'),
                    invoke<HardwareInfo>('get_hardware_info'),
                    invoke<AntivirusStatusInfo>('get_antivirus_status')
                ]);

                if (!mounted) return;
                setIsElevated(elevated);
                setHardwareInfo(hw);
                setAvStatus(av);
                setErrorMsg(null);
                setHardwareError(null);
                setAvError(null);
            } catch (err) {
                if (!mounted) return;
                console.error('Erreur init :', err);
                setErrorMsg('Erreur initialisation');
            } finally {
                if (mounted) {
                    setIsLoadingHardware(false);
                    setIsLoadingAv(false);
                }
            }
        })();

        return () => { mounted = false; };
    }, []);

    // ------------------------------------------------------------------
    // 2) Usage CPU/RAM : callback + interval
    // ------------------------------------------------------------------
    const fetchUsage = useCallback(async () => {
        try {
            const data = await invoke<SystemUsageInfo>('get_system_usage');
            setSystemUsage(data);
            setUsageError(null);
        } catch (err) {
            console.error('Erreur usage système :', err);
            setUsageError('Lecture usage système impossible');
        } finally {
            setIsLoadingUsage(false);
        }
    }, []);

    useEffect(() => {
        fetchUsage();                     // premier appel
        const id = setInterval(fetchUsage, 1500);
        return () => clearInterval(id);
    }, [fetchUsage]);

    // Handlers
    const handleRequireAdmin = async () => {
        try {
            setElevationError(null);
            await invoke<void>('require_admin');
            console.log("Demande d'élévation envoyée.");
        } catch (err) {
            console.error("Erreur élévation:", err);
            const errorString = typeof err === 'string' ? err : (err instanceof Error ? err.message : 'Erreur inconnue');
            setElevationError(`Échec: ${errorString}`);
        }
    };

    const handleSystemAction = async (action: 'restart' | 'shutdown') => {
        const command = action === 'restart' ? 'restart_computer' : 'shutdown_computer';
        const actionName = action === 'restart' ? 'redémarrer' : 'arrêter';
        
        try {
            setSystemActionError(null);
            if (!window.confirm(`Êtes-vous sûr de vouloir ${actionName} l'ordinateur ?`)) return;
            
            await invoke<void>(command);
            console.log(`Commande ${actionName} envoyée.`);
        } catch (err) {
            console.error(`Erreur ${actionName}:`, err);
            setSystemActionError(`Erreur ${actionName}: ${typeof err === 'string' ? err : 'Erreur inconnue. Vérifiez les privilèges admin.'}`);
        }
    };

    // Calculs
    const ramUsagePercent = systemUsage && systemUsage.ram_total_mb > 0
        ? (systemUsage.ram_used_mb / systemUsage.ram_total_mb) * 100
        : 0;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1200, mx: 'auto', p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ComputerIcon sx={{ fontSize: 32, mr: 1, color: 'primary.main' }} />
                <Typography variant="h4" component="h1" gutterBottom sx={{ m: 0 }}>
                    Accueil - KRB Tool
                </Typography>
            </Box>
            
            <Typography variant="body1" sx={{ mb: 2, color: 'text.secondary' }}>
            </Typography>
            
            {/* Cartes statut - Première ligne */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
                {/* Privilèges */}
                <HomeCard
                    title="Statut des Privilèges"
                    icon={<AdminPanelSettingsIcon />}
                    isLoading={isElevated === null}
                    error={errorMsg || elevationError}
                    avatarColor={isElevated ? 'success.main' : 'warning.main'}
                    accentColor={isElevated ? '#4caf50' : '#ff9800'}
                    variant="standard"
                    footerActions={isElevated === false && (
                        <Button 
                            variant="contained" 
                            color="warning" 
                            onClick={handleRequireAdmin} 
                            startIcon={<AdminPanelSettingsIcon />}
                        >
                            Élever les privilèges
                        </Button>
                    )}
                >
                    <Box sx={{ p: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        {isElevated !== null && (
                            <Box sx={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                gap: 2
                            }}>
                                <Avatar
                                    sx={{
                                        width: 80,
                                        height: 80,
                                        bgcolor: isElevated ? 'success.main' : 'warning.main',
                                        boxShadow: theme => theme.palette.mode === 'dark'
                                            ? '0 4px 20px rgba(0,0,0,0.4)'
                                            : '0 4px 20px rgba(0,0,0,0.1)',
                                        mb: 2
                                    }}
                                >
                                    {isElevated ? 
                                        <CheckCircleIcon sx={{ fontSize: 40 }} /> : 
                                        <ErrorIcon sx={{ fontSize: 40 }} />
                                    }
                                </Avatar>
                                <Typography variant="h5" sx={{ textAlign: 'center', fontWeight: 'bold' }}>
                                    {isElevated ? 'Administrateur' : 'Standard'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                                    {isElevated 
                                        ? 'Vous avez les privilèges administrateur' 
                                        : 'Privilèges limités - certaines actions nécessitent une élévation'}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </HomeCard>

                {/* Utilisation Système */}
                <HomeCard
                    title="Utilisation Système"
                    icon={<SpeedIcon />}
                    isLoading={isLoadingUsage && !systemUsage}
                    error={usageError && !systemUsage ? usageError : null}
                    avatarColor="info.main"
                    accentColor="#0288d1"
                    variant="gradient"
                    headerActions={
                        <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            fontSize: '0.75rem',
                            color: 'text.secondary',
                            bgcolor: 'background.paper',
                            px: 1,
                            py: 0.5,
                            borderRadius: '12px'
                        }}>
                            <Box 
                                component="span" 
                                sx={{ 
                                    width: 6, 
                                    height: 6, 
                                    borderRadius: '50%', 
                                    bgcolor: 'success.main',
                                    mr: 0.5,
                                    animation: 'pulse 1.5s infinite',
                                    '@keyframes pulse': {
                                        '0%': { opacity: 0.4 },
                                        '50%': { opacity: 1 },
                                        '100%': { opacity: 0.4 }
                                    }
                                }} 
                            />
                            Temps réel
                        </Box>
                    }
                >
                    {systemUsage && (
                        <Box sx={{ p: 1, transition: 'all 0.3s ease' }}>
                            {/* CPU Usage */}
                            <Box sx={{ mb: 3 }}>
                                <Box sx={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    mb: 1 
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Avatar sx={{ bgcolor: 'primary.main', mr: 1, width: 28, height: 28 }}>
                                            <MemoryIcon sx={{ fontSize: 16 }} />
                                        </Avatar>
                                        <Typography variant="subtitle2">CPU</Typography>
                                    </Box>
                                    <Box sx={{ 
                                        py: 0.5, 
                                        px: 1.5, 
                                        borderRadius: 10, 
                                        bgcolor: theme => {
                                            const isDark = theme.palette.mode === 'dark';
                                            const usage = systemUsage.cpu_usage_percent;
                                            if (usage > 80) return isDark ? 'rgba(244,67,54,0.2)' : 'rgba(244,67,54,0.1)';
                                            if (usage > 60) return isDark ? 'rgba(255,152,0,0.2)' : 'rgba(255,152,0,0.1)';
                                            return isDark ? 'rgba(76,175,80,0.2)' : 'rgba(76,175,80,0.1)';
                                        },
                                        color: () => {
                                            const usage = systemUsage.cpu_usage_percent;
                                            if (usage > 80) return 'error.main';
                                            if (usage > 60) return 'warning.main';
                                            return 'success.main';
                                        },
                                        transition: 'all 0.5s ease'
                                    }}>
                                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                            {systemUsage.cpu_usage_percent.toFixed(0)}%
                                        </Typography>
                                    </Box>
                                </Box>
                                <LinearProgress 
                                    variant="determinate" 
                                    value={systemUsage.cpu_usage_percent} 
                                    sx={{ 
                                        height: 10, 
                                        borderRadius: 5,
                                        bgcolor: theme => theme.palette.mode === 'dark' 
                                            ? 'rgba(255,255,255,0.1)' 
                                            : 'rgba(0,0,0,0.05)',
                                        '& .MuiLinearProgress-bar': {
                                            borderRadius: 5,
                                            background: theme => {
                                                const isDark = theme.palette.mode === 'dark';
                                                return systemUsage.cpu_usage_percent > 80 
                                                    ? isDark 
                                                        ? 'linear-gradient(90deg, #ff5f6d 0%, #ff2525 100%)' 
                                                        : 'linear-gradient(90deg, #ff9a9e 0%, #ff414d 100%)'
                                                    : systemUsage.cpu_usage_percent > 60 
                                                        ? isDark 
                                                            ? 'linear-gradient(90deg, #ffb74d 0%, #ff9100 100%)' 
                                                            : 'linear-gradient(90deg, #ffd086 0%, #ff9800 100%)'
                                                        : isDark 
                                                            ? 'linear-gradient(90deg, #66cfff 0%, #2979ff 100%)' 
                                                            : 'linear-gradient(90deg, #89f7fe 0%, #4eadff 100%)'
                                            },
                                            transition: 'transform 0.5s ease-in-out'
                                        }
                                    }}
                                />
                            </Box>
                            
                            {/* RAM Usage */}
                            <Box>
                                <Box sx={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    mb: 1 
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Avatar sx={{ bgcolor: 'primary.main', mr: 1, width: 28, height: 28 }}>
                                            <SdStorageIcon sx={{ fontSize: 16 }} />
                                        </Avatar>
                                        <Typography variant="subtitle2">Mémoire RAM</Typography>
                                    </Box>
                                    <Box sx={{ 
                                        py: 0.5, 
                                        px: 1.5, 
                                        borderRadius: 10, 
                                        bgcolor: theme => {
                                            const isDark = theme.palette.mode === 'dark';
                                            if (ramUsagePercent > 80) return isDark ? 'rgba(244,67,54,0.2)' : 'rgba(244,67,54,0.1)';
                                            if (ramUsagePercent > 60) return isDark ? 'rgba(255,152,0,0.2)' : 'rgba(255,152,0,0.1)';
                                            return isDark ? 'rgba(76,175,80,0.2)' : 'rgba(76,175,80,0.1)';
                                        },
                                        color: () => {
                                            if (ramUsagePercent > 80) return 'error.main';
                                            if (ramUsagePercent > 60) return 'warning.main';
                                            return 'success.main';
                                        },
                                        transition: 'all 0.5s ease'
                                    }}>
                                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                            {ramUsagePercent.toFixed(0)}%
                                        </Typography>
                                    </Box>
                                </Box>
                                <LinearProgress 
                                    variant="determinate" 
                                    value={ramUsagePercent} 
                                    sx={{ 
                                        height: 10, 
                                        borderRadius: 5,
                                        bgcolor: theme => theme.palette.mode === 'dark' 
                                            ? 'rgba(255,255,255,0.1)' 
                                            : 'rgba(0,0,0,0.05)',
                                        '& .MuiLinearProgress-bar': {
                                            borderRadius: 5,
                                            background: theme => {
                                                const isDark = theme.palette.mode === 'dark';
                                                return ramUsagePercent > 80 
                                                    ? isDark 
                                                        ? 'linear-gradient(90deg, #ff5f6d 0%, #ff2525 100%)' 
                                                        : 'linear-gradient(90deg, #ff9a9e 0%, #ff414d 100%)'
                                                    : ramUsagePercent > 60 
                                                        ? isDark 
                                                            ? 'linear-gradient(90deg, #ffb74d 0%, #ff9100 100%)' 
                                                            : 'linear-gradient(90deg, #ffd086 0%, #ff9800 100%)'
                                                        : isDark 
                                                            ? 'linear-gradient(90deg, #66cfff 0%, #2979ff 100%)' 
                                                            : 'linear-gradient(90deg, #89f7fe 0%, #4eadff 100%)'
                                            },
                                            transition: 'transform 0.5s ease-in-out'
                                        }
                                    }}
                                />
                                <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.5, color: 'text.secondary' }}>
                                    {(systemUsage.ram_used_mb / 1024).toFixed(1)} / {(systemUsage.ram_total_mb / 1024).toFixed(1)} GB
                                </Typography>
                            </Box>
                        </Box>
                    )}
                </HomeCard>

                {/* Antivirus */}
                <HomeCard
                    title="Antivirus"
                    icon={<SecurityIcon />}
                    isLoading={isLoadingAv}
                    error={avError}
                    avatarColor={avStatus?.real_time_protection_enabled && avStatus?.antispyware_enabled ? 'success.main' : 'error.main'}
                    accentColor={avStatus?.real_time_protection_enabled && avStatus?.antispyware_enabled ? '#4caf50' : '#f44336'}
                    variant="standard"
                >
                    <Box sx={{ p: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        {avStatus ? (
                            <Box sx={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                gap: 2
                            }}>
                                <Avatar
                                    sx={{
                                        width: 80,
                                        height: 80,
                                        bgcolor: avStatus.real_time_protection_enabled && avStatus.antispyware_enabled 
                                            ? 'success.main' 
                                            : 'error.main',
                                        boxShadow: theme => theme.palette.mode === 'dark'
                                            ? '0 4px 20px rgba(0,0,0,0.4)'
                                            : '0 4px 20px rgba(0,0,0,0.1)',
                                        mb: 2
                                    }}
                                >
                                    {avStatus.real_time_protection_enabled && avStatus.antispyware_enabled 
                                        ? <GppGoodIcon sx={{ fontSize: 40 }} /> 
                                        : <ErrorIcon sx={{ fontSize: 40 }} />
                                    }
                                </Avatar>
                                <Typography variant="h5" sx={{ textAlign: 'center', fontWeight: 'bold' }}>
                                    {avStatus.real_time_protection_enabled && avStatus.antispyware_enabled 
                                        ? 'Activé' 
                                        : 'Désactivé / Problème'
                                    }
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                                    {avStatus.real_time_protection_enabled && avStatus.antispyware_enabled 
                                        ? 'Protection antivirus et anti-espion active' 
                                        : 'Certaines protections ne sont pas activées'
                                    }
                                </Typography>
                                
                                <Box sx={{ 
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1,
                                    width: '100%',
                                    mt: 2,
                                    p: 2,
                                    bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                                    borderRadius: 2
                                }}>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center' 
                                    }}>
                                        <Typography variant="body2">Protection en temps réel</Typography>
                                        <Box 
                                            sx={{ 
                                                width: 12, 
                                                height: 12, 
                                                borderRadius: '50%', 
                                                bgcolor: avStatus.real_time_protection_enabled ? 'success.main' : 'error.main',
                                                boxShadow: '0 0 10px rgba(0,0,0,0.1)'
                                            }} 
                                        />
                                    </Box>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center' 
                                    }}>
                                        <Typography variant="body2">Protection anti-espion</Typography>
                                        <Box 
                                            sx={{ 
                                                width: 12, 
                                                height: 12, 
                                                borderRadius: '50%', 
                                                bgcolor: avStatus.antispyware_enabled ? 'success.main' : 'error.main',
                                                boxShadow: '0 0 10px rgba(0,0,0,0.1)'
                                            }} 
                                        />
                                    </Box>
                                </Box>
                            </Box>
                        ) : (
                            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                Aucune donnée reçue.
                            </Typography>
                        )}
                    </Box>
                </HomeCard>
            </Box>

            {/* Actions Système */}
            <HomeCard
                title="Actions Système Rapides"
                icon={<ComputerIcon />}
                avatarColor="primary.main"
                accentColor="#1976d2"
                variant="outlined"
                error={systemActionError}
                headerActions={
                    <Typography 
                        variant="caption" 
                        sx={{ 
                            bgcolor: 'primary.main', 
                            color: 'white', 
                            px: 1.5, 
                            py: 0.5, 
                            borderRadius: 10,
                            fontWeight: 'medium',
                            display: 'inline-flex',
                            alignItems: 'center'
                        }}
                    >
                        {isElevated ? 'Activé' : 'Désactivé'}
                    </Typography>
                }
            >
                <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                        Actions nécessitant des privilèges administrateur pour être exécutées
                    </Typography>
                    
                    <Box sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                        gap: 2, 
                        width: '100%',
                        mb: 2
                    }}>
                        <Button 
                            variant="contained"
                            color="secondary"
                            onClick={() => handleSystemAction('restart')} 
                            disabled={!isElevated}
                            startIcon={<RestartAltIcon />}
                            size="large"
                            fullWidth
                            sx={{ 
                                py: 1.5,
                                borderRadius: 2,
                                boxShadow: theme => theme.palette.mode === 'dark'
                                    ? '0 4px 12px rgba(0,0,0,0.4)'
                                    : '0 4px 12px rgba(0,0,0,0.1)',
                                opacity: !isElevated ? 0.7 : 1
                            }}
                        >
                            Redémarrer
                        </Button>
                        <Button 
                            variant="contained"
                            color="error"
                            onClick={() => handleSystemAction('shutdown')} 
                            disabled={!isElevated}
                            startIcon={<PowerSettingsNewIcon />}
                            size="large"
                            fullWidth
                            sx={{ 
                                py: 1.5,
                                borderRadius: 2,
                                boxShadow: theme => theme.palette.mode === 'dark'
                                    ? '0 4px 12px rgba(0,0,0,0.4)'
                                    : '0 4px 12px rgba(0,0,0,0.1)',
                                opacity: !isElevated ? 0.7 : 1
                            }}
                        >
                            Arrêter
                        </Button>
                    </Box>
                    
                    {!isElevated && (
                        <Box sx={{ 
                            p: 1, 
                            bgcolor: 'warning.light', 
                            borderRadius: 2, 
                            display: 'flex', 
                            alignItems: 'center',
                            width: '100%'
                        }}>
                            <ErrorIcon color="warning" sx={{ mr: 1 }} />
                            <Typography variant="caption" color="warning.dark" sx={{ fontWeight: 'medium' }}>
                                Élévation requise pour ces actions
                            </Typography>
                        </Box>
                    )}
                </Box>
            </HomeCard>

            {/* Infos Hardware */}
            <HomeCard
                title="Informations Matérielles"
                icon={<DeveloperBoardIcon />}
                avatarColor="info.main"
                accentColor="#0288d1"
                variant="gradient"
                isLoading={isLoadingHardware}
                error={hardwareError}
            >
                {hardwareInfo && (
                    <Box sx={{ p: 2 }}>
                        <Box sx={{ 
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                            gap: 3
                        }}>
                            <Box>
                                {/* CPU */}
                                <Box sx={{ 
                                    p: 2, 
                                    bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', 
                                    borderRadius: 2,
                                    mb: 2
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                        <Avatar sx={{ bgcolor: 'primary.main', mr: 1, width: 32, height: 32 }}>
                                            <MemoryIcon sx={{ fontSize: 18 }} />
                                        </Avatar>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>CPU</Typography>
                                    </Box>
                                    <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
                                        {hardwareInfo.cpu_name}
                                    </Typography>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between',
                                        bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)',
                                        p: 1,
                                        borderRadius: 1
                                    }}>
                                        <Typography variant="caption" sx={{ fontWeight: 'medium' }}>
                                            {hardwareInfo.cpu_cores} Cores
                                        </Typography>
                                        <Typography variant="caption" sx={{ fontWeight: 'medium' }}>
                                            {hardwareInfo.cpu_threads} Threads
                                        </Typography>
                                        <Typography variant="caption" sx={{ fontWeight: 'medium' }}>
                                            {hardwareInfo.cpu_max_speed_mhz} MHz
                                        </Typography>
                                    </Box>
                                </Box>
                                
                                {/* Motherboard */}
                                <Box sx={{ 
                                    p: 2, 
                                    bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', 
                                    borderRadius: 2 
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                        <Avatar sx={{ bgcolor: 'primary.main', mr: 1, width: 32, height: 32 }}>
                                            <DeveloperBoardIcon sx={{ fontSize: 18 }} />
                                        </Avatar>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Carte Mère</Typography>
                                    </Box>
                                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                        {hardwareInfo.motherboard_manufacturer} {hardwareInfo.motherboard_product}
                                    </Typography>
                                </Box>
                            </Box>
                            
                            <Box>
                                {/* RAM */}
                                <Box sx={{ 
                                    p: 2, 
                                    bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', 
                                    borderRadius: 2,
                                    mb: 2
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                        <Avatar sx={{ bgcolor: 'primary.main', mr: 1, width: 32, height: 32 }}>
                                            <SdStorageIcon sx={{ fontSize: 18 }} />
                                        </Avatar>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Mémoire RAM</Typography>
                                    </Box>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)',
                                        p: 1,
                                        borderRadius: 1
                                    }}>
                                        <Typography variant="h5" sx={{ fontWeight: 'bold', mr: 1 }}>
                                            {hardwareInfo.ram_total_gb?.toFixed(1)}
                                        </Typography>
                                        <Typography variant="body1">
                                            GB
                                        </Typography>
                                    </Box>
                                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                                        {hardwareInfo.ram_modules_count} module(s) installé(s)
                                    </Typography>
                                </Box>
                                
                                {/* GPU */}
                                <Box sx={{ 
                                    p: 2, 
                                    bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', 
                                    borderRadius: 2 
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                        <Avatar sx={{ bgcolor: 'primary.main', mr: 1, width: 32, height: 32 }}>
                                            <BarChartIcon sx={{ fontSize: 18 }} />
                                        </Avatar>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>GPU</Typography>
                                    </Box>
                                    
                                    {hardwareInfo.gpus && hardwareInfo.gpus.length > 0 ? (
                                        <Box component="ul" sx={{ 
                                            listStyleType: 'none', 
                                            pl: 0,
                                            m: 0
                                        }}>
                                            {hardwareInfo.gpus.map((gpu, idx) => {
                                                const ram =
                                                    gpu.ram_mb > 0
                                                        ? `${(gpu.ram_mb / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} GB`
                                                        : 'Partagée / N.C.';

                                                return (
                                                    <Box 
                                                        component="li" 
                                                        key={idx}
                                                        sx={{
                                                            p: 1,
                                                            mb: 1,
                                                            bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)',
                                                            borderRadius: 1,
                                                            '&:last-child': { mb: 0 }
                                                        }}
                                                    >
                                                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                                            {gpu.name}
                                                            <br />
                                                            {ram} – Driver : {gpu.driver_version}
                                                        </Typography>
                                                    </Box>
                                                );
                                            })}
                                        </Box>
                                    ) : (
                                        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                                            Aucun GPU détecté
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                )}
            </HomeCard>
        </Box>
    );
};

export default HomePage; 