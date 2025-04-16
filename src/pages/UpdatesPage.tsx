import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import PageLayout from '../components/PageLayout';
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
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';

// Icons
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import HistoryIcon from '@mui/icons-material/History';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import UpdateIcon from '@mui/icons-material/Update';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import InfoIcon from '@mui/icons-material/Info';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadDoneIcon from '@mui/icons-material/DownloadDone';
import DownloadIcon from '@mui/icons-material/Download';
import StorageIcon from '@mui/icons-material/Storage';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsIcon from '@mui/icons-material/Settings';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DashboardIcon from '@mui/icons-material/Dashboard';

// Interface pour les mises à jour installées
interface InstalledUpdateInfo {
    kb_id: string;
    description: string;
    installed_by: string;
    installed_on: string;
}

// Interface pour les MAJ disponibles
interface AvailableUpdateInfo {
    title: string;
    kb_id: string;
    size: number;
    is_downloaded: boolean;
    is_installed: boolean;
}

// Fonction formatBytes (réutilisée)
function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const index = Math.min(i, sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, index)).toFixed(dm)) + ' ' + sizes[index];
}

const UpdatesPage: React.FC = () => {
    // États pour l'historique
    const [updates, setUpdates] = useState<InstalledUpdateInfo[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [historyFilter, setHistoryFilter] = useState<string>("");

    // États pour la recherche de MAJ disponibles
    const [availableUpdates, setAvailableUpdates] = useState<AvailableUpdateInfo[]>([]);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [availableFilter, setAvailableFilter] = useState<string>("");
    const [isSearchComplete, setIsSearchComplete] = useState<boolean>(false);

    // Charger l'historique
    const fetchHistory = useCallback(() => {
        setIsLoadingHistory(true);
        setHistoryError(null);
        invoke<InstalledUpdateInfo[]>('list_installed_updates')
            .then(data => {
                data.sort((a, b) => a.kb_id.localeCompare(b.kb_id));
                setUpdates(data);
            })
            .catch(err => {
                console.error("Erreur récupération historique MAJ:", err);
                setHistoryError(typeof err === 'string' ? err : 'Erreur inconnue (historique).');
            })
            .finally(() => setIsLoadingHistory(false));
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    // Fonction pour rechercher les MAJ disponibles
    const handleSearchUpdates = () => {
        setIsSearching(true);
        setSearchError(null);
        setAvailableUpdates([]); // Vider les anciens résultats
        setIsSearchComplete(false); // Réinitialiser l'état de recherche
        invoke<AvailableUpdateInfo[]>('search_available_updates')
            .then(data => {
                setAvailableUpdates(data);
                setIsSearchComplete(true); // La recherche est terminée avec succès
            })
            .catch(err => {
                console.error("Erreur recherche MAJ:", err);
                setSearchError(typeof err === 'string' ? err : 'Erreur inconnue (recherche).');
                setIsSearchComplete(false); // Réinitialiser en cas d'erreur
            })
            .finally(() => setIsSearching(false));
    };

    // Filtrer les mises à jour installées
    const filteredUpdates = updates.filter(update => 
        update.kb_id.toLowerCase().includes(historyFilter.toLowerCase()) ||
        update.description.toLowerCase().includes(historyFilter.toLowerCase()) ||
        update.installed_by.toLowerCase().includes(historyFilter.toLowerCase()) ||
        update.installed_on.toLowerCase().includes(historyFilter.toLowerCase())
    );

    // Filtrer les mises à jour disponibles
    const filteredAvailable = availableUpdates.filter(update => 
        update.kb_id.toLowerCase().includes(availableFilter.toLowerCase()) ||
        update.title.toLowerCase().includes(availableFilter.toLowerCase())
    );

    // Calcul des statistiques
    const stats = {
        installed: updates.length,
        available: availableUpdates.length,
        downloaded: availableUpdates.filter(update => update.is_downloaded).length,
        totalSize: availableUpdates.reduce((acc, update) => acc + update.size, 0)
    };

    // Format de date plus joli
    const formatDate = (dateStr: string): string => {
        if (dateStr === "N/A" || !dateStr) return "Non spécifié";
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr; // En cas d'erreur de parsing, retourner la date originale
        }
    };

    return (
        <PageLayout 
            title="Mises à jour Windows" 
            icon={<SystemUpdateAltIcon />}
            description="Recherche et gestion des mises à jour système"
        >
            {/* Cartes de statistiques */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                {/* Carte Tableau de bord */}
                <Box sx={{ width: { xs: '100%', md: 'calc(50% - 8px)' } }}>
                    <HomeCard
                        title="Tableau de bord"
                        icon={<DashboardIcon />}
                        avatarColor="info.main"
                        accentColor="#0288d1"
                        variant="gradient"
                    >
                        <Box sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Card elevation={0} sx={{ 
                                        p: 1.5, 
                                        textAlign: 'center',
                                        borderRadius: 2,
                                        bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(121, 134, 203, 0.1)' : 'rgba(121, 134, 203, 0.05)',
                                        width: '100%'
                                    }}>
                                        <Typography variant="h4" sx={{ color: "#7986cb", fontWeight: "bold" }}>
                                            {stats.installed}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Mises à jour installées
                                        </Typography>
                                    </Card>
                                </Box>
                                
                                <Box sx={{ flex: 1 }}>
                                    <Card elevation={0} sx={{ 
                                        p: 1.5, 
                                        textAlign: 'center',
                                        borderRadius: 2,
                                        bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(0, 137, 123, 0.1)' : 'rgba(0, 137, 123, 0.05)',
                                        width: '100%'
                                    }}>
                                        <Typography variant="h4" sx={{ color: "#00897b", fontWeight: "bold" }}>
                                            {stats.available}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Mises à jour disponibles
                                        </Typography>
                                    </Card>
                                </Box>
                            </Box>
                            
                            <Box sx={{ mb: 2 }}>
                                <Alert
                                    severity={availableUpdates.length > 0 ? "info" : "success"}
                                    icon={availableUpdates.length > 0 ? <InfoIcon /> : <CheckCircleIcon />}
                                    sx={{ borderRadius: 2, width: '100%' }}
                                >
                                    {availableUpdates.length > 0 
                                        ? `${availableUpdates.length} mise(s) à jour disponible(s) pour votre système.` 
                                        : isSearchComplete 
                                            ? "Votre système est à jour." 
                                            : "Recherchez les mises à jour disponibles."
                                    }
                                </Alert>
                            </Box>
                            
                            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    startIcon={isSearching ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                                    onClick={handleSearchUpdates}
                                    disabled={isSearching}
                                    sx={{ 
                                        borderRadius: 2,
                                        boxShadow: 2,
                                        transition: 'all 0.2s',
                                        '&:hover': { transform: 'translateY(-2px)' }
                                    }}
                                >
                                    {isSearching ? "Recherche..." : "Rechercher les mises à jour"}
                                </Button>
                            </Box>
                        </Box>
                    </HomeCard>
                </Box>
                
                {/* Carte Défense & Sécurité */}
                <Box sx={{ width: { xs: '100%', md: 'calc(50% - 8px)' } }}>
                    <HomeCard
                        title="Défense & Sécurité"
                        icon={<SecurityIcon />}
                        avatarColor="error.main"
                        accentColor="#f44336"
                        variant="gradient"
                    >
                        <Box sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Box>
                                    <Card elevation={0} sx={{ 
                                        p: 1.5, 
                                        borderRadius: 2,
                                        bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.1)' : 'rgba(244, 67, 54, 0.05)',
                                        width: '100%'
                                    }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Box>
                                                <Typography variant="h6" sx={{ color: "error.main", fontWeight: "bold" }}>
                                                    Microsoft Defender
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {availableUpdates.some(update => update.kb_id === "KB2267602")
                                                        ? "Mise à jour de sécurité disponible"
                                                        : "Définitions de sécurité à jour"
                                                    }
                                                </Typography>
                                            </Box>
                                            <Box sx={{ ml: 'auto' }}>
                                                {availableUpdates.some(update => update.kb_id === "KB2267602") ? (
                                                    <Button 
                                                        variant="contained" 
                                                        color="error"
                                                        size="small"
                                                        startIcon={<UpdateIcon />}
                                                        sx={{ borderRadius: 2 }}
                                                    >
                                                        Mettre à jour
                                                    </Button>
                                                ) : (
                                                    <Chip 
                                                        label="Protégé" 
                                                        color="success" 
                                                        size="small"
                                                        icon={<CheckCircleIcon />}
                                                        sx={{ borderRadius: 6 }}
                                                    />
                                                )}
                                            </Box>
                                        </Box>
                                    </Card>
                                </Box>
                                
                                <Box>
                                    <Card elevation={0} sx={{ 
                                        p: 1.5, 
                                        borderRadius: 2,
                                        bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(121, 85, 72, 0.1)' : 'rgba(121, 85, 72, 0.05)',
                                        width: '100%'
                                    }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Box>
                                                <Typography variant="h6" sx={{ color: "#795548", fontWeight: "bold" }}>
                                                    Mises à jour de sécurité
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {availableUpdates.filter(update => update.kb_id !== "KB2267602").length > 0
                                                        ? `${availableUpdates.filter(update => update.kb_id !== "KB2267602").length} mise(s) à jour de sécurité en attente`
                                                        : "Toutes les mises à jour de sécurité sont installées"
                                                    }
                                                </Typography>
                                            </Box>
                                            <Box sx={{ ml: 'auto' }}>
                                                {availableUpdates.filter(update => update.kb_id !== "KB2267602").length > 0 ? (
                                                    <Button 
                                                        variant="outlined" 
                                                        size="small"
                                                        startIcon={<SettingsIcon />}
                                                        sx={{ borderRadius: 2 }}
                                                    >
                                                        Détails
                                                    </Button>
                                                ) : (
                                                    <Chip 
                                                        label="À jour" 
                                                        color="success" 
                                                        variant="outlined"
                                                        size="small"
                                                        sx={{ borderRadius: 6 }}
                                                    />
                                                )}
                                            </Box>
                                        </Box>
                                    </Card>
                                </Box>
                            </Box>
                        </Box>
                    </HomeCard>
                </Box>
            </Box>

            {/* Section Recherche de Mises à jour */}
            <HomeCard
                title="Mises à jour disponibles"
                icon={<CloudDownloadIcon />}
                avatarColor="primary.main"
                accentColor="#1976d2"
                variant="gradient"
                isLoading={isSearching && availableUpdates.length === 0}
                error={searchError}
                headerActions={
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={isSearching ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                        onClick={handleSearchUpdates}
                        disabled={isSearching}
                        size="small"
                        sx={{ 
                            borderRadius: 2,
                            boxShadow: 2,
                            transition: 'all 0.2s',
                            '&:hover': { transform: 'translateY(-2px)' }
                        }}
                    >
                        {isSearching ? "Recherche..." : "Rechercher"}
                    </Button>
                }
            >
                {availableUpdates.length > 0 && (
                    <Box sx={{ p: 2 }}>
                        {/* Statistiques en haut */}
                        <Box sx={{ mb: 3 }}>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                                <Box sx={{ flex: 1, minWidth: { xs: '100%', sm: 'calc(33.33% - 8px)' } }}>
                                    <Card elevation={0} sx={{ 
                                        p: 1.5, 
                                        textAlign: 'center',
                                        borderRadius: 2,
                                        bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.1)' : 'rgba(25, 118, 210, 0.05)',
                                        width: '100%'
                                    }}>
                                        <Typography variant="h4" color="primary.main" fontWeight="bold">
                                            {stats.available}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Mises à jour disponibles
                                        </Typography>
                                    </Card>
                                </Box>
                                <Box sx={{ flex: 1, minWidth: { xs: '100%', sm: 'calc(33.33% - 8px)' } }}>
                                    <Card elevation={0} sx={{ 
                                        p: 1.5, 
                                        textAlign: 'center',
                                        borderRadius: 2,
                                        bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.05)',
                                        width: '100%'
                                    }}>
                                        <Typography variant="h4" color="success.main" fontWeight="bold">
                                            {stats.downloaded}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Déjà téléchargées
                                        </Typography>
                                    </Card>
                                </Box>
                                <Box sx={{ flex: 1, minWidth: { xs: '100%', sm: 'calc(33.33% - 8px)' } }}>
                                    <Card elevation={0} sx={{ 
                                        p: 1.5, 
                                        textAlign: 'center',
                                        borderRadius: 2,
                                        bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                                        width: '100%'
                                    }}>
                                        <Typography variant="h4" color="text.primary" fontWeight="bold">
                                            {formatBytes(stats.totalSize)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Taille totale
                                        </Typography>
                                    </Card>
                                </Box>
                            </Box>
                        </Box>

                        {/* Filtres */}
                        <Box sx={{ mb: 2 }}>
                            <TextField
                                fullWidth
                                variant="outlined"
                                placeholder="Filtrer les mises à jour disponibles..."
                                value={availableFilter}
                                onChange={(e) => setAvailableFilter(e.target.value)}
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
                                    endAdornment: availableFilter && (
                                        <InputAdornment position="end">
                                            <IconButton 
                                                onClick={() => setAvailableFilter('')} 
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

                        {/* Tableau des mises à jour disponibles */}
                        {filteredAvailable.length === 0 ? (
                            <Box sx={{
                                textAlign: 'center',
                                py: 4,
                                px: 2,
                                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                borderRadius: 3,
                                border: theme => `1px dashed ${
                                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                                }`
                            }}>
                                <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 'medium' }}>
                                    {availableFilter ? "Aucune mise à jour ne correspond aux critères de recherche" : "Aucune mise à jour disponible"}
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
                                            <TableCell><Typography variant="subtitle2">Mise à jour</Typography></TableCell>
                                            <TableCell><Typography variant="subtitle2">KB ID</Typography></TableCell>
                                            <TableCell><Typography variant="subtitle2">Taille</Typography></TableCell>
                                            <TableCell><Typography variant="subtitle2">Statut</Typography></TableCell>
                                            <TableCell><Typography variant="subtitle2">Actions</Typography></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredAvailable.map((update, index) => (
                                            <TableRow 
                                                key={update.kb_id || index} 
                                                hover
                                                sx={{ 
                                                    transition: 'all 0.2s',
                                                    '&:hover': {
                                                        bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                                                    }
                                                }}
                                            >
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <UpdateIcon color="primary" fontSize="small" />
                                                        <Typography 
                                                            variant="body2" 
                                                            sx={{ 
                                                                fontWeight: 'medium',
                                                                maxWidth: { xs: '180px', sm: '250px', md: '300px', lg: '400px' },
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                            title={update.title}
                                                        >
                                                            {update.title}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={update.kb_id} 
                                                        size="small" 
                                                        color="primary"
                                                        variant="outlined"
                                                        sx={{ borderRadius: '6px' }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        icon={<StorageIcon fontSize="small" />}
                                                        label={formatBytes(update.size)} 
                                                        size="small" 
                                                        color="default"
                                                        variant="outlined"
                                                        sx={{ borderRadius: '6px' }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {update.is_downloaded ? (
                                                        <Chip 
                                                            icon={<DownloadDoneIcon fontSize="small" />}
                                                            label="Téléchargée" 
                                                            size="small" 
                                                            color="success"
                                                            sx={{ borderRadius: '6px' }}
                                                        />
                                                    ) : (
                                                        <Chip 
                                                            icon={<DownloadIcon fontSize="small" />}
                                                            label="Non téléchargée" 
                                                            size="small"
                                                            variant="outlined" 
                                                            color="default"
                                                            sx={{ borderRadius: '6px' }}
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        startIcon={<CloudDownloadIcon />}
                                                        disabled={update.is_downloaded}
                                                        sx={{ 
                                                            borderRadius: '8px',
                                                            fontSize: '0.75rem',
                                                            py: 0.5
                                                        }}
                                                    >
                                                        Installer
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Box>
                )}

                {availableUpdates.length === 0 && !isSearching && !searchError && !isSearchComplete && (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <SystemUpdateAltIcon sx={{ fontSize: 60, color: 'action.disabled', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            Rechercher des mises à jour Windows
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            Cliquez sur le bouton "Rechercher" pour vérifier les mises à jour disponibles pour votre système.
                        </Typography>
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<SearchIcon />}
                            onClick={handleSearchUpdates}
                            sx={{ 
                                borderRadius: 2,
                                mt: 2,
                                boxShadow: 2,
                                transition: 'all 0.2s',
                                '&:hover': { transform: 'translateY(-2px)' }
                            }}
                        >
                            Rechercher des mises à jour
                        </Button>
                    </Box>
                )}

                {availableUpdates.length === 0 && !isSearching && searchError === null && isSearchComplete && (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <CheckCircleIcon sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            Votre système est à jour
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            Aucune mise à jour n'est disponible pour votre système actuellement.
                        </Typography>
                        <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<RefreshIcon />}
                            onClick={handleSearchUpdates}
                            sx={{ 
                                borderRadius: 2,
                                mt: 2,
                                transition: 'all 0.2s',
                                '&:hover': { transform: 'translateY(-2px)' }
                            }}
                        >
                            Vérifier à nouveau
                        </Button>
                    </Box>
                )}
            </HomeCard>

            {/* Section Planification */}
            <Box sx={{ mt: 3 }}>
                <HomeCard
                    title="Planification des mises à jour"
                    icon={<AccessTimeIcon />}
                    avatarColor="warning.main"
                    accentColor="#ed6c02"
                    variant="standard"
                >
                    <Box sx={{ p: 2 }}>
                        <Card elevation={0} sx={{ 
                            p: 2, 
                            borderRadius: 2,
                            bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(237, 108, 2, 0.1)' : 'rgba(237, 108, 2, 0.05)',
                            width: '100%'
                        }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Typography variant="h6" sx={{ color: "warning.main", fontWeight: "medium" }}>
                                    Configuration automatique
                                </Typography>
                                <Typography variant="body2" color="text.secondary" paragraph>
                                    Les mises à jour Windows peuvent être installées automatiquement selon une planification.
                                    Configurez quand vous souhaitez que Windows télécharge et installe les mises à jour.
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Button
                                        variant="outlined"
                                        color="warning"
                                        size="small"
                                        startIcon={<SettingsIcon />}
                                        sx={{ borderRadius: 2 }}
                                    >
                                        Configurer
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="inherit"
                                        size="small"
                                        sx={{ borderRadius: 2 }}
                                    >
                                        En savoir plus
                                    </Button>
                                </Box>
                            </Box>
                        </Card>
                    </Box>
                </HomeCard>
            </Box>

            {/* Section Historique */}
            <Box sx={{ mt: 3 }}>
                <HomeCard
                    title="Historique des mises à jour"
                    icon={<HistoryIcon />}
                    avatarColor="secondary.main"
                    accentColor="#9c27b0"
                    variant="standard"
                    isLoading={isLoadingHistory}
                    error={historyError}
                    headerActions={
                        <Tooltip title="Rafraîchir l'historique">
                            <IconButton 
                                onClick={fetchHistory} 
                                disabled={isLoadingHistory}
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
                    <Box sx={{ p: 2 }}>
                        {/* Informations historique */}
                        <Box sx={{ mb: 3 }}>
                            <Alert 
                                severity="info" 
                                variant="outlined" 
                                icon={<InfoIcon />}
                                sx={{ borderRadius: 2 }}
                            >
                                <Typography variant="body2">
                                    {updates.length} mises à jour Windows ont été installées sur cet ordinateur.
                                </Typography>
                            </Alert>
                        </Box>

                        {/* Filtre */}
                        <Box sx={{ mb: 2 }}>
                            <TextField
                                fullWidth
                                variant="outlined"
                                placeholder="Filtrer l'historique des mises à jour..."
                                value={historyFilter}
                                onChange={(e) => setHistoryFilter(e.target.value)}
                                size="small"
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: '12px',
                                        transition: 'all 0.3s',
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'secondary.main',
                                        },
                                    }
                                }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <FilterListIcon color="secondary" />
                                        </InputAdornment>
                                    ),
                                    endAdornment: historyFilter && (
                                        <InputAdornment position="end">
                                            <IconButton 
                                                onClick={() => setHistoryFilter('')} 
                                                edge="end" 
                                                size="small"
                                            >
                                                <ClearIcon fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                        </Box>

                        {/* Tableau de l'historique */}
                        {filteredUpdates.length === 0 ? (
                            <Box sx={{
                                textAlign: 'center',
                                py: 4,
                                px: 2,
                                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                borderRadius: 3,
                                border: theme => `1px dashed ${
                                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                                }`
                            }}>
                                <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 'medium' }}>
                                    {historyFilter ? "Aucune mise à jour ne correspond aux critères de recherche" : "Aucune mise à jour installée trouvée"}
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
                                            <TableCell><Typography variant="subtitle2">KB ID</Typography></TableCell>
                                            <TableCell><Typography variant="subtitle2">Description</Typography></TableCell>
                                            <TableCell><Typography variant="subtitle2">Installé par</Typography></TableCell>
                                            <TableCell><Typography variant="subtitle2">Date d'installation</Typography></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredUpdates.map((update) => (
                                            <TableRow 
                                                key={update.kb_id} 
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
                                                        label={update.kb_id} 
                                                        size="small" 
                                                        color="secondary"
                                                        variant="outlined"
                                                        sx={{ borderRadius: '6px' }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">
                                                        {update.description || '-'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <PersonIcon fontSize="small" color="action" />
                                                        <Typography variant="body2">
                                                            {update.installed_by || '-'}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <CalendarTodayIcon fontSize="small" color="action" />
                                                        <Typography variant="body2">
                                                            {formatDate(update.installed_on)}
                                                        </Typography>
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
            </Box>

            {/* Légende */}
            <Box sx={{ mt: 4 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Légende</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip icon={<DownloadDoneIcon />} label="Téléchargée" color="success" size="small" />
                        <Typography variant="body2">Mise à jour téléchargée</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip icon={<DownloadIcon />} label="Non téléchargée" color="default" size="small" variant="outlined" />
                        <Typography variant="body2">Mise à jour non téléchargée</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label="KB123456" color="secondary" size="small" variant="outlined" />
                        <Typography variant="body2">Identifiant de mise à jour (KB)</Typography>
                    </Box>
                </Box>
            </Box>
        </PageLayout>
    );
};

export default UpdatesPage; 