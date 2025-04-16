import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import PageLayout from '../components/PageLayout';
import InfoCard from '../components/InfoCard';
import HomeCard from '../components/HomeCard';

// Material UI
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';

// Icons
import StorageIcon from '@mui/icons-material/Storage';
import DeleteIcon from '@mui/icons-material/Delete';
import SpeedIcon from '@mui/icons-material/Speed';
import FormatColorResetIcon from '@mui/icons-material/FormatColorReset';
import RefreshIcon from '@mui/icons-material/Refresh';
import MemoryIcon from '@mui/icons-material/Memory';
import DoneIcon from '@mui/icons-material/Done';
import WarningIcon from '@mui/icons-material/Warning';
import SdCardIcon from '@mui/icons-material/SdCard';
import FolderIcon from '@mui/icons-material/Folder';
import SearchIcon from '@mui/icons-material/Search';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';

// Interface pour les infos disque
interface DiskInfo {
    disk_number: number;
    name: string;
    mount_point: string;
    total_space: number; 
    available_space: number;
    file_system: string;
    is_removable: boolean;
}

// Interface pour les infos partition
interface PartitionInfo {
    number: number;
    drive_letter: string | null;
    size: number;
    partition_type: string;
}

// Fonction utilitaire pour formater les octets
function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const index = Math.min(i, sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, index)).toFixed(dm)) + ' ' + sizes[index];
}

const DisksPage: React.FC = () => {
    // États pour les disques
    const [disks, setDisks] = useState<DiskInfo[]>([]);
    const [isLoadingDisks, setIsLoadingDisks] = useState<boolean>(true);
    const [disksError, setDisksError] = useState<string | null>(null);
    const [diskFilter, setDiskFilter] = useState<string>("");

    // États pour les partitions du disque sélectionné
    const [selectedDiskNumber, setSelectedDiskNumber] = useState<number | null>(null);
    const [partitions, setPartitions] = useState<PartitionInfo[]>([]);
    const [isLoadingPartitions, setIsLoadingPartitions] = useState<boolean>(false);
    const [partitionsError, setPartitionsError] = useState<string | null>(null);

    // États pour le nettoyage
    const [recycleBinSize, setRecycleBinSize] = useState<number | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
    const [isClearing, setIsClearing] = useState<boolean>(false);
    const [cleanupMessage, setCleanupMessage] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

    // États pour l'optimisation
    const [isOptimizing, setIsOptimizing] = useState<string | null>(null); // Stocke la lettre de lecteur en cours
    const [optimizeMessage, setOptimizeMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // États pour le formatage
    const [isFormatting, setIsFormatting] = useState<string | null>(null);
    const [formatMessage, setFormatMessage] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
    const [formatFS, setFormatFS] = useState<string>("NTFS"); // Système de fichiers pour le formatage

    // Charger les disques 
    const fetchDisks = () => {
        setIsLoadingDisks(true);
        setDisksError(null);
        invoke<DiskInfo[]>('list_disks') 
            .then(data => {
                // Trier par numéro de disque
                data.sort((a, b) => a.disk_number - b.disk_number);
                setDisks(data); 
                
                // Sélectionner automatiquement le premier disque s'il n'y en a pas déjà un
                if (data.length > 0 && selectedDiskNumber === null) {
                    fetchPartitions(data[0].disk_number);
                }
            })
            .catch(err => {
                console.error("Erreur lors de la récupération des disques:", err);
                setDisksError(typeof err === 'string' ? err : 'Erreur inconnue (disques).');
            })
            .finally(() => setIsLoadingDisks(false));
    };

    // Chargement initial
    useEffect(() => {
        fetchDisks();
    }, []);

    // Fonction pour charger les partitions d'un disque
    const fetchPartitions = (diskNumber: number) => {
        setSelectedDiskNumber(diskNumber);
        setIsLoadingPartitions(true);
        setPartitionsError(null);
        setPartitions([]); // Vider les anciennes partitions
        invoke<PartitionInfo[]>('get_disk_partitions', { diskNumber }) 
            .then(data => {
                setPartitions(data);
            })
            .catch(err => {
                console.error(`Erreur partitions disque ${diskNumber}:`, err);
                setPartitionsError(typeof err === 'string' ? err : `Erreur inconnue (partitions disque ${diskNumber}).`);
            })
            .finally(() => setIsLoadingPartitions(false));
    };

    // Fonction pour analyser la corbeille
    const handleAnalyzeRecycleBin = () => {
        setIsAnalyzing(true);
        setRecycleBinSize(null);
        setCleanupMessage(null);
        invoke<number>('analyze_recycle_bin')
            .then(size => {
                setRecycleBinSize(size);
                setCleanupMessage({ type: 'info', message: `Taille estimée de la corbeille: ${formatBytes(size)}` });
            })
            .catch(err => {
                console.error("Erreur analyse corbeille:", err);
                setCleanupMessage({ type: 'error', message: `Erreur analyse: ${typeof err === 'string' ? err : 'Erreur inconnue.'}` });
            })
            .finally(() => setIsAnalyzing(false));
    };

    // Fonction pour vider la corbeille
    const handleClearRecycleBin = () => {
        // Demande de confirmation
        if (!window.confirm("Êtes-vous sûr de vouloir vider la corbeille ? Cette action est irréversible.")) {
            return;
        }
        setIsClearing(true);
        setCleanupMessage(null);
        invoke<void>('clear_recycle_bin')
            .then(() => {
                setCleanupMessage({ type: 'success', message: "Corbeille vidée avec succès." });
                setRecycleBinSize(0); // Mettre à jour la taille affichée
            })
            .catch(err => {
                console.error("Erreur vidage corbeille:", err);
                setCleanupMessage({ type: 'error', message: `Erreur vidage: ${typeof err === 'string' ? err : 'Erreur inconnue.'}` });
            })
            .finally(() => setIsClearing(false));
    };

    // Fonction pour optimiser un volume
    const handleOptimizeVolume = (driveLetter: string) => {
        if (!driveLetter || driveLetter.length < 2) return; // Sécurité
        setIsOptimizing(driveLetter);
        setOptimizeMessage(null);
        invoke<void>('optimize_volume', { driveLetter })
            .then(() => {
                setOptimizeMessage({ type: 'success', message: `Optimisation du lecteur ${driveLetter} terminée avec succès.` });
            })
            .catch(err => {
                setOptimizeMessage({ type: 'error', message: `Erreur optimisation ${driveLetter}: ${typeof err === 'string' ? err : 'Erreur inconnue.'}` });
            })
            .finally(() => setIsOptimizing(null));
    };

    // Fonction pour formater un volume
    const handleFormatVolume = (driveLetter: string) => {
        if (!driveLetter || driveLetter.length < 2) return;
        
        // Double confirmation TRÈS importante
        const confirm1 = window.prompt(`ACTION IRRÉVERSIBLE ! Ceci effacera TOUTES les données sur le lecteur ${driveLetter}. Tapez 'FORMATER' pour confirmer.`);
        if (confirm1 !== "FORMATER") {
            setFormatMessage({ type: 'info', message: "Formatage annulé."});
            return;
        }
        const confirm2 = window.confirm(`DERNIÈRE CONFIRMATION : Êtes-vous absolument sûr de vouloir formater le lecteur ${driveLetter} en ${formatFS} ?`);
         if (!confirm2) {
            setFormatMessage({ type: 'info', message: "Formatage annulé."});
            return;
        }

        setIsFormatting(driveLetter);
        setFormatMessage({type: 'info', message: `Formatage de ${driveLetter} en ${formatFS} en cours... Ceci peut prendre du temps.`});
        invoke<void>('format_disk', { driveLetter, fileSystem: formatFS })
            .then(() => {
                setFormatMessage({ type: 'success', message: `Lecteur ${driveLetter} formaté avec succès en ${formatFS}.` });
                // Rafraîchir les infos disques après formatage
                fetchDisks();
            })
            .catch(err => {
                setFormatMessage({ type: 'error', message: `Erreur formatage ${driveLetter}: ${typeof err === 'string' ? err : 'Erreur inconnue.'}` });
            })
            .finally(() => setIsFormatting(null));
    };

    // Rendu de la barre de progression d'utilisation du disque
    const renderDiskUsageBar = (disk: DiskInfo) => {
        const usedSpace = disk.total_space - disk.available_space;
        const usedPercentage = (usedSpace / disk.total_space) * 100;
        
        let color = 'success';
        if (usedPercentage > 90) color = 'error';
        else if (usedPercentage > 75) color = 'warning';
        
        return (
            <Box sx={{ width: '100%', mt: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                        {formatBytes(usedSpace)} utilisés
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {usedPercentage.toFixed(1)}%
                    </Typography>
                </Box>
                <LinearProgress 
                    variant="determinate" 
                    value={usedPercentage} 
                    color={color as "success" | "error" | "warning" | "primary" | "secondary" | "info"}
                    sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        '& .MuiLinearProgress-bar': {
                            borderRadius: 4
                        }
                    }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                        {formatBytes(disk.available_space)} libres
                    </Typography>
                </Box>
            </Box>
        );
    };

    // Filtrer les disques affichés
    const filteredDisks = disks.filter(disk => 
        disk.name.toLowerCase().includes(diskFilter.toLowerCase()) ||
        (disk.mount_point && disk.mount_point.toLowerCase().includes(diskFilter.toLowerCase())) ||
        (disk.file_system && disk.file_system.toLowerCase().includes(diskFilter.toLowerCase()))
    );

    // Message pour corbeille basé sur la taille
    const getRecycleBinStatusIcon = () => {
        if (recycleBinSize === null) return null;
        if (recycleBinSize === 0) return <DoneIcon sx={{ color: 'success.main', fontSize: 48 }} />;
        if (recycleBinSize > 1024 * 1024 * 500) return <ErrorIcon sx={{ color: 'error.main', fontSize: 48 }} />; // Plus de 500 MB
        return <WarningIcon sx={{ color: 'warning.main', fontSize: 48 }} />;
    }

    return (
        <PageLayout 
            title="Gestion des Disques" 
            icon={<StorageIcon />}
            description="Affichage et gestion des disques et volumes du système"
        >
            {/* Section des outils de gestion */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 4 }}>
                {/* Section Nettoyage */}
                <HomeCard 
                    title="Nettoyage Disque" 
                    icon={<CleaningServicesIcon />}
                    avatarColor="warning.main"
                    accentColor="#ed6c02"
                    variant="standard"
                    minHeight="220px"
                    error={cleanupMessage?.type === 'error' ? cleanupMessage.message : null}
                    headerActions={
                        recycleBinSize !== null ? (
                            <Chip 
                                label={formatBytes(recycleBinSize)}
                                color={
                                    recycleBinSize === 0 ? "success" : 
                                    recycleBinSize > 1024 * 1024 * 500 ? "error" : "warning"
                                }
                                sx={{ fontWeight: 'bold' }}
                            />
                        ) : null
                    }
                >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        {recycleBinSize !== null ? (
                            <>
                                <Box sx={{ textAlign: 'center', mb: 1 }}>
                                    {getRecycleBinStatusIcon()}
                                    <Typography variant="body1" sx={{ mt: 1, fontWeight: 'medium' }}>
                                        {recycleBinSize === 0 
                                            ? "Corbeille vide" 
                                            : `${formatBytes(recycleBinSize)} à nettoyer`}
                                    </Typography>
                                </Box>
                            </>
                        ) : (
                            <Typography variant="body1" sx={{ textAlign: 'center', mb: 2 }}>
                                Analysez et videz la corbeille pour libérer de l'espace disque.
                            </Typography>
                        )}
                        
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button 
                                variant="outlined" 
                                startIcon={isAnalyzing ? <CircularProgress size={20} /> : <SearchIcon />}
                                onClick={handleAnalyzeRecycleBin} 
                                disabled={isAnalyzing || isClearing}
                                sx={{ 
                                    borderRadius: 2,
                                    transition: 'all 0.2s',
                                    '&:hover': { transform: 'translateY(-2px)' }
                                }}
                            >
                                {isAnalyzing ? "Analyse..." : "Analyser"}
                            </Button>
                            
                            {recycleBinSize !== null && recycleBinSize > 0 && (
                                <Button 
                                    variant="contained" 
                                    color="error"
                                    startIcon={isClearing ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
                                    onClick={handleClearRecycleBin} 
                                    disabled={isClearing || isAnalyzing}
                                    sx={{
                                        borderRadius: 2,
                                        transition: 'all 0.2s',
                                        '&:hover': { transform: 'translateY(-2px)' }
                                    }}
                                >
                                    {isClearing ? "Vidage..." : "Vider"}
                                </Button>
                            )}
                        </Box>
                        
                        {cleanupMessage?.type !== 'error' && cleanupMessage && (
                            <Alert severity={cleanupMessage.type} sx={{ mt: 1, borderRadius: 2 }}>
                                {cleanupMessage.message}
                            </Alert>
                        )}
                    </Box>
                </HomeCard>
                
                {/* Section Optimisation */}
                <HomeCard 
                    title="Optimisation" 
                    icon={<SpeedIcon />}
                    avatarColor="info.main"
                    accentColor="#0288d1"
                    variant="gradient"
                    minHeight="220px"
                    error={optimizeMessage?.type === 'error' ? optimizeMessage.message : null}
                >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <Typography variant="body1" sx={{ textAlign: 'center', mb: 1 }}>
                            Défragmentez et optimisez vos lecteurs pour améliorer les performances.
                        </Typography>
                        
                        <Box sx={{ 
                            p: 2, 
                            borderRadius: 2, 
                            bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', 
                            width: '100%',
                            textAlign: 'center'
                        }}>
                            <Typography variant="body2" color="text.secondary">
                                Sélectionnez un disque ci-dessous puis cliquez sur "Optimiser" dans la section Actions.
                            </Typography>
                        </Box>
                        
                        {optimizeMessage?.type === 'success' && (
                            <Alert 
                                severity="success" 
                                variant="filled"
                                icon={<DoneIcon />} 
                                sx={{ 
                                    width: '100%', 
                                    borderRadius: 2,
                                    '& .MuiAlert-icon': { fontSize: 24 }
                                }}
                            >
                                {optimizeMessage.message}
                            </Alert>
                        )}
                        
                        {isOptimizing && (
                            <Alert 
                                severity="info" 
                                icon={<CircularProgress size={20} />} 
                                sx={{ width: '100%', borderRadius: 2 }}
                            >
                                Optimisation de {isOptimizing} en cours...
                            </Alert>
                        )}
                    </Box>
                </HomeCard>
                
                {/* Section Formatage */}
                <HomeCard 
                    title="Formatage" 
                    icon={<FormatColorResetIcon />}
                    avatarColor="error.main"
                    accentColor="#d32f2f"
                    variant="outlined"
                    minHeight="220px"
                    error={formatMessage?.type === 'error' ? formatMessage.message : null}
                >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 1, height: '100%' }}>
                        <Box sx={{ 
                            p: 2, 
                            bgcolor: 'error.light', 
                            color: 'error.dark', 
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                        }}>
                            <WarningIcon color="error" />
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                Le formatage efface <strong>TOUTES</strong> les données d'un volume.
                            </Typography>
                        </Box>
                        
                        <FormControl size="small" variant="outlined" sx={{ mt: 1 }}>
                            <InputLabel>Système de fichiers</InputLabel>
                            <Select
                                value={formatFS}
                                onChange={(e) => setFormatFS(e.target.value as string)}
                                label="Système de fichiers"
                                sx={{ 
                                    borderRadius: 2,
                                    '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'
                                    }
                                }}
                            >
                                <MenuItem value="NTFS">NTFS</MenuItem>
                                <MenuItem value="FAT32">FAT32</MenuItem>
                                <MenuItem value="EXFAT">exFAT</MenuItem>
                            </Select>
                        </FormControl>
                        
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 1 }}>
                            Sélectionnez un disque ci-dessous puis cliquez sur "Formater" dans la section Actions.
                        </Typography>
                        
                        {formatMessage?.type !== 'error' && formatMessage && (
                            <Alert 
                                severity={formatMessage.type} 
                                sx={{ mt: 'auto', borderRadius: 2 }}
                                icon={formatMessage.type === 'info' && isFormatting ? <CircularProgress size={20} /> : undefined}
                            >
                                {formatMessage.message}
                            </Alert>
                        )}
                    </Box>
                </HomeCard>
            </Box>
            
            {/* Section Disques */}
            <HomeCard 
                title="Disques et Volumes" 
                icon={<StorageIcon />}
                avatarColor="primary.main"
                accentColor="#1976d2"
                isLoading={isLoadingDisks}
                error={disksError}
                variant="standard"
                headerActions={
                    <Tooltip title="Rafraîchir la liste">
                        <IconButton 
                            onClick={fetchDisks} 
                            disabled={isLoadingDisks}
                            sx={{
                                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                                '&:hover': {
                                    bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,1)',
                                }
                            }}
                        >
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                }
            >
                <Box sx={{ p: 1 }}>
                    <Box sx={{ mb: 2 }}>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="Filtrer les disques..."
                            value={diskFilter}
                            onChange={(e) => setDiskFilter(e.target.value)}
                            size="small"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '12px',
                                    transition: 'all 0.3s',
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                        borderColor: 'primary.main',
                                    },
                                }
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <FilterListIcon color="primary" />
                                    </InputAdornment>
                                ),
                                endAdornment: diskFilter && (
                                    <InputAdornment position="end">
                                        <IconButton 
                                            onClick={() => setDiskFilter('')} 
                                            edge="end" 
                                            size="small"
                                            sx={{
                                                transition: 'all 0.2s',
                                                '&:hover': {
                                                    bgcolor: 'rgba(0,0,0,0.05)',
                                                    transform: 'scale(1.1)'
                                                }
                                            }}
                                        >
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Box>
                    
                    {filteredDisks.length === 0 ? (
                        <Box sx={{
                            textAlign: 'center',
                            py: 6,
                            px: 2,
                            bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                            borderRadius: 3,
                            border: theme => `1px dashed ${
                                theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                            }`
                        }}>
                            <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 'medium' }}>
                                {diskFilter ? "Aucun disque ne correspond aux critères de recherche." : "Aucun disque trouvé."}
                            </Typography>
                        </Box>
                    ) : (
                        <TableContainer 
                            component={Paper} 
                            elevation={0} 
                            sx={{ 
                                mb: 3, 
                                borderRadius: '12px',
                                overflow: 'hidden',
                                border: theme => `1px solid ${
                                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                                }`
                            }}
                        >
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ 
                                        bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', 
                                        '& th': { 
                                            fontWeight: 'bold', 
                                            color: 'text.primary',
                                            py: 1.5
                                        } 
                                    }}>
                                        <TableCell><Typography variant="subtitle2">Disque</Typography></TableCell>
                                        <TableCell><Typography variant="subtitle2">Informations</Typography></TableCell>
                                        <TableCell><Typography variant="subtitle2">Utilisation</Typography></TableCell>
                                        <TableCell><Typography variant="subtitle2">Actions</Typography></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredDisks.map((disk) => (
                                        <TableRow 
                                            key={disk.disk_number} 
                                            hover
                                            selected={selectedDiskNumber === disk.disk_number}
                                            onClick={() => fetchPartitions(disk.disk_number)}
                                            sx={{ 
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                '&:hover': {
                                                    bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                                                },
                                                '&.Mui-selected': {
                                                    bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.15)' : 'rgba(25, 118, 210, 0.08)',
                                                    '&:hover': {
                                                        bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.25)' : 'rgba(25, 118, 210, 0.12)'
                                                    }
                                                }
                                            }}
                                        >
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    {disk.is_removable ? <SdCardIcon color="warning" /> : <StorageIcon color="primary" />}
                                                    <Chip 
                                                        label={disk.disk_number} 
                                                        size="small" 
                                                        variant="filled"
                                                        color={disk.is_removable ? "warning" : "primary"}
                                                        sx={{ 
                                                            borderRadius: '6px',
                                                            fontWeight: 'bold'
                                                        }}
                                                    />
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                                    {disk.name}
                                                </Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                                                    {disk.mount_point && (
                                                        <Chip 
                                                            icon={<FolderIcon />} 
                                                            label={disk.mount_point} 
                                                            size="small" 
                                                            color="info"
                                                            variant="outlined"
                                                            sx={{ borderRadius: '6px' }}
                                                        />
                                                    )}
                                                    {disk.file_system && (
                                                        <Chip 
                                                            label={disk.file_system} 
                                                            size="small" 
                                                            color="default"
                                                            variant="outlined"
                                                            sx={{ borderRadius: '6px' }}
                                                        />
                                                    )}
                                                    <Chip 
                                                        label={formatBytes(disk.total_space)} 
                                                        size="small" 
                                                        color="default"
                                                        variant="outlined"
                                                        sx={{ borderRadius: '6px' }}
                                                    />
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{ width: '25%' }}>
                                                {renderDiskUsageBar(disk)}
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        startIcon={<InfoIcon />}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            fetchPartitions(disk.disk_number);
                                                        }}
                                                        sx={{ 
                                                            borderRadius: '8px',
                                                            transition: 'all 0.2s',
                                                            '&:hover': { transform: 'translateY(-2px)' }
                                                        }}
                                                    >
                                                        Détails
                                                    </Button>
                                                    
                                                    {disk.mount_point && (
                                                        <>
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                color="info"
                                                                startIcon={isOptimizing === disk.mount_point ? <CircularProgress size={16} /> : <SpeedIcon />}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOptimizeVolume(disk.mount_point);
                                                                }}
                                                                disabled={isOptimizing !== null}
                                                                sx={{ 
                                                                    borderRadius: '8px',
                                                                    transition: 'all 0.2s',
                                                                    '&:hover': { transform: 'translateY(-2px)' }
                                                                }}
                                                            >
                                                                {isOptimizing === disk.mount_point ? "Optim..." : "Optimiser"}
                                                            </Button>
                                                            
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                color="error"
                                                                startIcon={isFormatting === disk.mount_point ? <CircularProgress size={16} /> : <FormatColorResetIcon />}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleFormatVolume(disk.mount_point);
                                                                }}
                                                                disabled={isFormatting !== null}
                                                                sx={{ 
                                                                    borderRadius: '8px',
                                                                    transition: 'all 0.2s',
                                                                    '&:hover': { transform: 'translateY(-2px)' }
                                                                }}
                                                            >
                                                                {isFormatting === disk.mount_point ? "Format..." : "Formater"}
                                                            </Button>
                                                        </>
                                                    )}
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Box>
            </HomeCard>
            
            {/* Section Partitions */}
            {selectedDiskNumber !== null && (
                <Box sx={{ mt: 3 }}>
                    <HomeCard 
                        title={`Partitions du Disque ${selectedDiskNumber}`}
                        icon={<SdCardIcon />}
                        isLoading={isLoadingPartitions}
                        error={partitionsError}
                        avatarColor="secondary.main"
                        accentColor="#9c27b0"
                        variant="gradient"
                    >
                        <Box sx={{ p: 1 }}>
                            {partitions.length === 0 ? (
                                <Box sx={{
                                    textAlign: 'center',
                                    py: 6,
                                    px: 2,
                                    bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                    borderRadius: 3,
                                    border: theme => `1px dashed ${
                                        theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                                    }`
                                }}>
                                    <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 'medium' }}>
                                        Aucune partition trouvée pour ce disque.
                                    </Typography>
                                </Box>
                            ) : (
                                <TableContainer 
                                    component={Paper} 
                                    elevation={0}
                                    sx={{ 
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        border: theme => `1px solid ${
                                            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                                        }`
                                    }}
                                >
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ 
                                                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', 
                                                '& th': { 
                                                    fontWeight: 'bold', 
                                                    color: 'text.primary',
                                                    py: 1.5
                                                } 
                                            }}>
                                                <TableCell><Typography variant="subtitle2">Numéro</Typography></TableCell>
                                                <TableCell><Typography variant="subtitle2">Lettre</Typography></TableCell>
                                                <TableCell><Typography variant="subtitle2">Type</Typography></TableCell>
                                                <TableCell><Typography variant="subtitle2">Taille</Typography></TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {partitions.map((part) => (
                                                <TableRow 
                                                    key={part.number} 
                                                    hover
                                                    sx={{
                                                        transition: 'all 0.2s',
                                                        '&:hover': {
                                                            bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                                                        }
                                                    }}
                                                >
                                                    <TableCell>
                                                        <Chip 
                                                            label={part.number}
                                                            size="small"
                                                            color="secondary"
                                                            variant="filled"
                                                            sx={{ 
                                                                borderRadius: '6px',
                                                                fontWeight: 'bold'
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {part.drive_letter ? (
                                                            <Chip 
                                                                icon={<FolderIcon />}
                                                                label={part.drive_letter} 
                                                                size="small" 
                                                                color="info"
                                                                sx={{ borderRadius: '6px' }}
                                                            />
                                                        ) : (
                                                            <Typography variant="body2" color="text.secondary">
                                                                Non monté
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={part.partition_type} 
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ borderRadius: '6px' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight="medium">
                                                            {formatBytes(part.size)}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Box>
                    </HomeCard>
                </Box>
            )}
            
            {/* Légende */}
            <Box sx={{ mt: 4 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Légende</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StorageIcon color="primary" fontSize="small" />
                        <Typography variant="body2">Disque fixe</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SdCardIcon color="warning" fontSize="small" />
                        <Typography variant="body2">Disque amovible</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip icon={<DoneIcon />} label="OK" color="success" size="small" />
                        <Typography variant="body2">Espace suffisant</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip icon={<WarningIcon />} label="Attention" color="warning" size="small" />
                        <Typography variant="body2">Espace limité</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip icon={<ErrorIcon />} label="Critique" color="error" size="small" />
                        <Typography variant="body2">Espace critique</Typography>
                    </Box>
                </Box>
            </Box>
        </PageLayout>
    );
};

export default DisksPage; 