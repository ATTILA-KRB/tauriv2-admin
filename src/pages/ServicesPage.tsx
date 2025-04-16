import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import PageLayout from '../components/PageLayout';
import HomeCard from '../components/HomeCard';

// Material UI
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import InputBase from '@mui/material/InputBase';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Switch from '@mui/material/Switch';

// Icons
import MiscellaneousServicesIcon from '@mui/icons-material/MiscellaneousServices';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import SettingsIcon from '@mui/icons-material/Settings';
import CategoryIcon from '@mui/icons-material/Category';
import InfoIcon from '@mui/icons-material/Info';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

// Interface pour les informations de service
interface ServiceInfo {
    name: string;
    display_name: string;
    status: string;
    start_type: string;
}

// Types de statut de service possibles
type ServiceStatus = 'Running' | 'Stopped' | 'Paused' | 'Starting' | 'Stopping' | 'Unknown';

// Types de démarrage de service possibles
type StartType = 'Auto' | 'Manual' | 'Disabled' | 'Boot' | 'System' | 'Unknown';

const ServicesPage: React.FC = () => {
    const [services, setServices] = useState<ServiceInfo[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<{ service: string, type: 'success' | 'error', message: string } | null>(null);
    const [isActionLoading, setIsActionLoading] = useState<string | null>(null); // Nom du service en cours d'action
    
    // États pour le filtrage
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [startTypeFilter, setStartTypeFilter] = useState<string>('all');
    const [showOnlyRunning, setShowOnlyRunning] = useState<boolean>(false);
    
    // États pour le service sélectionné
    const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null);
    
    // Mettre la logique de fetch dans une fonction réutilisable
    const fetchServices = useCallback(() => {
        setIsLoading(true);
        setError(null);
        invoke<ServiceInfo[]>('list_services')
            .then(data => {
                data.sort((a, b) => a.display_name.localeCompare(b.display_name));
                setServices(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Erreur lors de la récupération des services:", err);
                setError(typeof err === 'string' ? err : 'Erreur inconnue lors de la récupération des services.');
                setIsLoading(false);
            });
    }, []); // useCallback pour éviter de recréer la fonction à chaque rendu

    useEffect(() => {
        fetchServices(); // Appel initial
    }, [fetchServices]); // Dépendre de fetchServices

    // Gérer le démarrage d'un service
    const handleStartService = (serviceName: string) => {
        setActionMessage(null);
        setIsActionLoading(serviceName); // Indiquer quel service est en cours d'action
        invoke<void>('start_service', { serviceName })
            .then(() => {
                setActionMessage({ service: serviceName, type: 'success', message: `Service '${serviceName}' démarré avec succès.` });
                fetchServices(); // Rafraîchir la liste
            })
            .catch(err => {
                console.error(`Erreur démarrage service ${serviceName}:`, err);
                setActionMessage({ service: serviceName, type: 'error', message: `Erreur de démarrage '${serviceName}': ${typeof err === 'string' ? err : 'Erreur inconnue.'}` });
            })
            .finally(() => {
                 setIsActionLoading(null); // Fin de l'action
            });
    };

    // Gérer l'arrêt d'un service
    const handleStopService = (serviceName: string) => {
        setActionMessage(null);
        setIsActionLoading(serviceName);
        invoke<void>('stop_service', { serviceName })
            .then(() => {
                setActionMessage({ service: serviceName, type: 'success', message: `Service '${serviceName}' arrêté avec succès.` });
                fetchServices(); // Rafraîchir la liste
            })
            .catch(err => {
                console.error(`Erreur arrêt service ${serviceName}:`, err);
                setActionMessage({ service: serviceName, type: 'error', message: `Erreur d'arrêt '${serviceName}': ${typeof err === 'string' ? err : 'Erreur inconnue.'}` });
            })
            .finally(() => {
                 setIsActionLoading(null);
            });
    };
    
    // Réinitialiser les filtres
    const resetFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setStartTypeFilter('all');
        setShowOnlyRunning(false);
    };
    
    // Fonction pour obtenir la couleur du chip en fonction du statut
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Running': return 'success';
            case 'Stopped': return 'error';
            case 'Paused': return 'warning';
            case 'Starting': 
            case 'Stopping': return 'info';
            default: return 'default';
        }
    };
    
    // Fonction pour obtenir l'icône du statut
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Running': return <CheckCircleIcon />;
            case 'Stopped': return <StopIcon />;
            case 'Paused': return <PauseCircleOutlineIcon />;
            case 'Starting':
            case 'Stopping': return <HourglassEmptyIcon />;
            default: return <ErrorIcon />;
        }
    };
    
    // Fonction pour obtenir la couleur du chip en fonction du type de démarrage
    const getStartTypeColor = (startType: string) => {
        switch (startType) {
            case 'Auto': return 'primary';
            case 'Manual': return 'warning';
            case 'Disabled': return 'error';
            case 'Boot':
            case 'System': return 'info';
            default: return 'default';
        }
    };
    
    // Filtre les services en fonction des critères de recherche
    const filteredServices = useMemo(() => {
        return services.filter(service => {
            // Filtre par texte de recherche
            const matchesQuery = searchQuery === '' || 
                service.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                service.name.toLowerCase().includes(searchQuery.toLowerCase());
            
            // Filtre par statut
            const matchesStatus = statusFilter === 'all' || service.status === statusFilter;
            
            // Filtre par type de démarrage
            const matchesStartType = startTypeFilter === 'all' || service.start_type === startTypeFilter;
            
            // Filtre rapide pour afficher uniquement les services en cours d'exécution
            const matchesRunning = !showOnlyRunning || service.status === 'Running';
            
            return matchesQuery && matchesStatus && matchesStartType && matchesRunning;
        });
    }, [services, searchQuery, statusFilter, startTypeFilter, showOnlyRunning]);
    
    // Calcul des statistiques sur les services
    const stats = useMemo(() => {
        const running = services.filter(s => s.status === 'Running').length;
        const stopped = services.filter(s => s.status === 'Stopped').length;
        const paused = services.filter(s => s.status === 'Paused').length;
        const total = services.length;
        
        return { running, stopped, paused, total };
    }, [services]);

    if (isLoading && services.length === 0) {
        return (
            <PageLayout 
                title="Gestion des Services Windows" 
                icon={<MiscellaneousServicesIcon />}
                description="Gérez et contrôlez les services système de Windows"
            >
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
                    <CircularProgress size={40} />
                    <Typography variant="h6" sx={{ ml: 2 }}>
                        Chargement de la liste des services Windows...
                    </Typography>
                </Box>
            </PageLayout>
        );
    }

    if (error) {
        return (
            <PageLayout 
                title="Gestion des Services Windows" 
                icon={<MiscellaneousServicesIcon />}
                description="Gérez et contrôlez les services système de Windows"
            >
                <Alert severity="error" variant="filled" sx={{ mb: 3, borderRadius: 2 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        Erreur lors de la récupération des services
                    </Typography>
                    <Typography variant="body2">
                        {error}
                    </Typography>
                </Alert>
            </PageLayout>
        );
    }

    return (
        <PageLayout 
            title="Gestion des Services Windows" 
            icon={<MiscellaneousServicesIcon />}
            description="Gérez et contrôlez les services système de Windows"
        >
            <Grid container spacing={3}>
                {/* Section Statistiques */}
                <Grid item xs={12}>
                    <HomeCard 
                        title="Aperçu des services" 
                        icon={<InfoIcon />}
                        variant="gradient"
                        accentColor="#1976d2"
                        isLoading={isLoading}
                        headerActions={
                            <Tooltip title="Rafraîchir les services">
                                <IconButton
                                    onClick={fetchServices}
                                    disabled={isLoading}
                                    size="small"
                                    sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
                                >
                                    <RefreshIcon />
                                </IconButton>
                            </Tooltip>
                        }
                    >
                        <Box sx={{ p: 2 }}>
                            <Box sx={{ 
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 2,
                                justifyContent: 'space-between'
                            }}>
                                {/* Version plus compacte et moderne des cartes de statistiques */}
                                <Box sx={{ 
                                    display: 'flex', 
                                    flexWrap: 'wrap',
                                    gap: 2,
                                    width: '100%'
                                }}>
                                    {/* Services en exécution */}
                                    <Box sx={{
                                        flex: '1 1 200px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        p: 2,
                                        borderRadius: '10px',
                                        background: 'linear-gradient(45deg, rgba(46, 125, 50, 0.08), rgba(46, 125, 50, 0.15))',
                                        border: '1px solid rgba(46, 125, 50, 0.2)',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                        }
                                    }}>
                                        <Box sx={{ 
                                            width: 50, 
                                            height: 50, 
                                            borderRadius: '50%', 
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            bgcolor: 'success.main',
                                            color: 'white'
                                        }}>
                                            <CheckCircleIcon />
                                        </Box>
                                        <Box>
                                            <Typography variant="h4" fontWeight="bold" color="success.main">
                                                {stats.running}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Services actifs
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* Services arrêtés */}
                                    <Box sx={{
                                        flex: '1 1 200px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        p: 2,
                                        borderRadius: '10px',
                                        background: 'linear-gradient(45deg, rgba(211, 47, 47, 0.08), rgba(211, 47, 47, 0.15))',
                                        border: '1px solid rgba(211, 47, 47, 0.2)',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                        }
                                    }}>
                                        <Box sx={{ 
                                            width: 50, 
                                            height: 50, 
                                            borderRadius: '50%', 
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            bgcolor: 'error.main',
                                            color: 'white'
                                        }}>
                                            <StopIcon />
                                        </Box>
                                        <Box>
                                            <Typography variant="h4" fontWeight="bold" color="error.main">
                                                {stats.stopped}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Services inactifs
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* Services en pause */}
                                    <Box sx={{
                                        flex: '1 1 200px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        p: 2,
                                        borderRadius: '10px',
                                        background: 'linear-gradient(45deg, rgba(237, 108, 2, 0.08), rgba(237, 108, 2, 0.15))',
                                        border: '1px solid rgba(237, 108, 2, 0.2)',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                        }
                                    }}>
                                        <Box sx={{ 
                                            width: 50, 
                                            height: 50, 
                                            borderRadius: '50%', 
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            bgcolor: 'warning.main',
                                            color: 'white'
                                        }}>
                                            <PauseCircleOutlineIcon />
                                        </Box>
                                        <Box>
                                            <Typography variant="h4" fontWeight="bold" color="warning.main">
                                                {stats.paused}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Services en pause
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* Total des services */}
                                    <Box sx={{
                                        flex: '1 1 200px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        p: 2,
                                        borderRadius: '10px',
                                        background: 'linear-gradient(45deg, rgba(25, 118, 210, 0.08), rgba(25, 118, 210, 0.15))',
                                        border: '1px solid rgba(25, 118, 210, 0.2)',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                        }
                                    }}>
                                        <Box sx={{ 
                                            width: 50, 
                                            height: 50, 
                                            borderRadius: '50%', 
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            bgcolor: 'primary.main',
                                            color: 'white'
                                        }}>
                                            <DeveloperBoardIcon />
                                        </Box>
                                        <Box>
                                            <Typography variant="h4" fontWeight="bold" color="primary.main">
                                                {stats.total}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Services totaux
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>

                            {/* Barre de progression simplifiée */}
                            {stats.total > 0 && (
                                <Box sx={{ mt: 3, px: { xs: 0, md: 1 } }}>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        mb: 1
                                    }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Distribution ({Math.round((stats.running / stats.total) * 100)}% actifs)
                                        </Typography>
                                        <Box sx={{ 
                                            display: 'flex', 
                                            gap: 2,
                                            fontSize: '0.75rem',
                                        }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                                                <Typography variant="caption" color="text.secondary">En exécution</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
                                                <Typography variant="caption" color="text.secondary">En pause</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main' }} />
                                                <Typography variant="caption" color="text.secondary">Arrêtés</Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                    <Box sx={{ 
                                        width: '100%', 
                                        height: '6px', 
                                        bgcolor: 'background.paper',
                                        borderRadius: '3px',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)'
                                    }}>
                                        <Box sx={{ 
                                            width: `${(stats.running / stats.total) * 100}%`,
                                            bgcolor: 'success.main',
                                            height: '100%'
                                        }} />
                                        <Box sx={{ 
                                            width: `${(stats.paused / stats.total) * 100}%`,
                                            bgcolor: 'warning.main',
                                            height: '100%'
                                        }} />
                                        <Box sx={{ 
                                            width: `${(stats.stopped / stats.total) * 100}%`,
                                            bgcolor: 'error.main',
                                            height: '100%'
                                        }} />
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    </HomeCard>
                </Grid>
                
                {/* Section Filtres */}
                <Grid item xs={12}>
                    <HomeCard 
                        title="Filtres de recherche" 
                        icon={<FilterListIcon />}
                        variant="standard"
                    >
                        <Box sx={{ p: 2 }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        fullWidth
                                        label="Rechercher un service"
                                        size="small"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon color="primary" />
                                                </InputAdornment>
                                            ),
                                            endAdornment: searchQuery && (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        onClick={() => setSearchQuery('')}
                                                        edge="end"
                                                        size="small"
                                                    >
                                                        <ClearIcon fontSize="small" />
                                                    </IconButton>
                                                </InputAdornment>
                                            )
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '12px'
                                            }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={2}>
                                    <FormControl fullWidth size="small">
                                        <Select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            displayEmpty
                                            sx={{ borderRadius: '12px' }}
                                        >
                                            <MenuItem value="all">Tous les statuts</MenuItem>
                                            <MenuItem value="Running">En exécution</MenuItem>
                                            <MenuItem value="Stopped">Arrêté</MenuItem>
                                            <MenuItem value="Paused">En pause</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} sm={6} md={2}>
                                    <FormControl fullWidth size="small">
                                        <Select
                                            value={startTypeFilter}
                                            onChange={(e) => setStartTypeFilter(e.target.value)}
                                            displayEmpty
                                            sx={{ borderRadius: '12px' }}
                                        >
                                            <MenuItem value="all">Tous les types</MenuItem>
                                            <MenuItem value="Auto">Automatique</MenuItem>
                                            <MenuItem value="Manual">Manuel</MenuItem>
                                            <MenuItem value="Disabled">Désactivé</MenuItem>
                                            <MenuItem value="Boot">Boot</MenuItem>
                                            <MenuItem value="System">Système</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} sm={6} md={2}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={showOnlyRunning}
                                                onChange={(e) => setShowOnlyRunning(e.target.checked)}
                                                color="primary"
                                            />
                                        }
                                        label="Services actifs seulement"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={2}>
                                    <Button
                                        variant="outlined"
                                        startIcon={<ClearIcon />}
                                        onClick={resetFilters}
                                        fullWidth
                                        sx={{ borderRadius: '12px' }}
                                    >
                                        Réinitialiser
                                    </Button>
                                </Grid>
                            </Grid>
                        </Box>
                    </HomeCard>
                </Grid>
                
                {/* Afficher le message d'action */}
                {actionMessage && (
                    <Grid item xs={12}>
                        <Alert 
                            severity={actionMessage.type} 
                            variant="filled" 
                            sx={{ borderRadius: 2 }}
                            onClose={() => setActionMessage(null)}
                        >
                            {actionMessage.message}
                        </Alert>
                    </Grid>
                )}
                
                {/* Section Liste des services */}
                <Grid item xs={12}>
                    <HomeCard 
                        title="Liste des services" 
                        icon={<SettingsIcon />}
                        variant="standard"
                        isLoading={isLoading && services.length > 0}
                    >
                        <Box sx={{ p: 2 }}>
                            {services.length === 0 && !isLoading ? (
                                <Box sx={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    alignItems: 'center', 
                                    gap: 2,
                                    p: 6,
                                    bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                    borderRadius: 3,
                                    border: theme => `1px dashed ${
                                        theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                                    }`
                                }}>
                                    <MiscellaneousServicesIcon sx={{ fontSize: 60, color: 'action.disabled' }} />
                                    <Typography variant="body1" color="text.secondary">
                                        Aucun service trouvé.
                                    </Typography>
                                </Box>
                            ) : filteredServices.length === 0 ? (
                                <Box sx={{
                                    textAlign: 'center',
                                    p: 4,
                                    bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                    borderRadius: 3,
                                    border: theme => `1px dashed ${
                                        theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                                    }`
                                }}>
                                    <Typography variant="body1" color="text.secondary">
                                        Aucun service ne correspond aux critères de recherche.
                                    </Typography>
                                    <Button
                                        variant="text"
                                        startIcon={<ClearIcon />}
                                        onClick={resetFilters}
                                        sx={{ mt: 1 }}
                                    >
                                        Réinitialiser les filtres
                                    </Button>
                                </Box>
                            ) : (
                                <TableContainer component={Paper} elevation={0} sx={{ 
                                    borderRadius: '12px',
                                    border: theme => `1px solid ${
                                        theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                                    }`
                                }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ 
                                                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', 
                                                '& th': { fontWeight: 'bold' } 
                                            }}>
                                                <TableCell>Nom affiché</TableCell>
                                                <TableCell>Nom système</TableCell>
                                                <TableCell align="center">Statut</TableCell>
                                                <TableCell align="center">Type de démarrage</TableCell>
                                                <TableCell align="center">Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {filteredServices.map((service) => (
                                                <TableRow
                                                    key={service.name}
                                                    hover
                                                    sx={{ 
                                                        '&:last-child td, &:last-child th': { border: 0 },
                                                        bgcolor: isActionLoading === service.name ? 'rgba(25, 118, 210, 0.08)' : 'inherit'
                                                    }}
                                                >
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight="medium">
                                                            {service.display_name}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                                            {service.name}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Chip
                                                            label={service.status}
                                                            size="small"
                                                            color={getStatusColor(service.status) as any}
                                                            icon={getStatusIcon(service.status)}
                                                            variant="outlined"
                                                            sx={{ borderRadius: '8px', minWidth: '90px' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Chip
                                                            label={service.start_type}
                                                            size="small"
                                                            color={getStartTypeColor(service.start_type) as any}
                                                            icon={<CategoryIcon fontSize="small" />}
                                                            variant="outlined"
                                                            sx={{ borderRadius: '8px', minWidth: '80px' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                                                            <Tooltip title="Démarrer le service">
                                                                <span>
                                                                    <IconButton
                                                                        size="small"
                                                                        color="success"
                                                                        onClick={() => handleStartService(service.name)}
                                                                        disabled={service.status === 'Running' || isActionLoading === service.name}
                                                                        sx={{
                                                                            '&:hover': { bgcolor: 'success.lighter' }
                                                                        }}
                                                                    >
                                                                        {isActionLoading === service.name ? 
                                                                            <CircularProgress size={20} color="inherit" /> : 
                                                                            <PlayArrowIcon fontSize="small" />
                                                                        }
                                                                    </IconButton>
                                                                </span>
                                                            </Tooltip>
                                                            
                                                            <Tooltip title="Arrêter le service">
                                                                <span>
                                                                    <IconButton
                                                                        size="small"
                                                                        color="error"
                                                                        onClick={() => handleStopService(service.name)}
                                                                        disabled={service.status !== 'Running' || isActionLoading === service.name}
                                                                        sx={{
                                                                            '&:hover': { bgcolor: 'error.lighter' }
                                                                        }}
                                                                    >
                                                                        {isActionLoading === service.name ? 
                                                                            <CircularProgress size={20} color="inherit" /> : 
                                                                            <StopIcon fontSize="small" />
                                                                        }
                                                                    </IconButton>
                                                                </span>
                                                            </Tooltip>
                                                            
                                                            <Tooltip title="Redémarrer le service">
                                                                <span>
                                                                    <IconButton
                                                                        size="small"
                                                                        color="primary"
                                                                        onClick={() => {
                                                                            if (service.status === 'Running') {
                                                                                handleStopService(service.name);
                                                                                setTimeout(() => handleStartService(service.name), 1000);
                                                                            }
                                                                        }}
                                                                        disabled={service.status !== 'Running' || isActionLoading === service.name}
                                                                        sx={{
                                                                            '&:hover': { bgcolor: 'primary.lighter' }
                                                                        }}
                                                                    >
                                                                        <RestartAltIcon fontSize="small" />
                                                                    </IconButton>
                                                                </span>
                                                            </Tooltip>
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
                </Grid>

                {/* Légende */}
                <Grid item xs={12}>
                    <Box sx={{ mt: 2 }}>
                        <Divider sx={{ mb: 2 }} />
                        <Typography variant="subtitle2" gutterBottom>Légende</Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6} md={4}>
                                <Typography variant="body2" fontWeight="medium" gutterBottom>Statuts des services</Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip icon={<CheckCircleIcon />} label="Running" color="success" size="small" variant="outlined" sx={{ borderRadius: '8px' }} />
                                        <Typography variant="body2">Service en cours d'exécution</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip icon={<StopIcon />} label="Stopped" color="error" size="small" variant="outlined" sx={{ borderRadius: '8px' }} />
                                        <Typography variant="body2">Service arrêté</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip icon={<PauseCircleOutlineIcon />} label="Paused" color="warning" size="small" variant="outlined" sx={{ borderRadius: '8px' }} />
                                        <Typography variant="body2">Service en pause</Typography>
                                    </Box>
                                </Box>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                                <Typography variant="body2" fontWeight="medium" gutterBottom>Types de démarrage</Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip icon={<CategoryIcon />} label="Auto" color="primary" size="small" variant="outlined" sx={{ borderRadius: '8px' }} />
                                        <Typography variant="body2">Démarrage automatique</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip icon={<CategoryIcon />} label="Manual" color="warning" size="small" variant="outlined" sx={{ borderRadius: '8px' }} />
                                        <Typography variant="body2">Démarrage manuel</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip icon={<CategoryIcon />} label="Disabled" color="error" size="small" variant="outlined" sx={{ borderRadius: '8px' }} />
                                        <Typography variant="body2">Service désactivé</Typography>
                                    </Box>
                                </Box>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                                <Typography variant="body2" fontWeight="medium" gutterBottom>Actions disponibles</Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <IconButton size="small" color="success" disabled><PlayArrowIcon fontSize="small" /></IconButton>
                                        <Typography variant="body2">Démarrer un service arrêté</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <IconButton size="small" color="error" disabled><StopIcon fontSize="small" /></IconButton>
                                        <Typography variant="body2">Arrêter un service en exécution</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <IconButton size="small" color="primary" disabled><RestartAltIcon fontSize="small" /></IconButton>
                                        <Typography variant="body2">Redémarrer un service</Typography>
                                    </Box>
                                </Box>
                            </Grid>
                        </Grid>
                    </Box>
                </Grid>
            </Grid>
        </PageLayout>
    );
};

export default ServicesPage; 