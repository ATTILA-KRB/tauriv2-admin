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
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

// Icons
import RestoreIcon from '@mui/icons-material/Restore';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import HistoryIcon from '@mui/icons-material/History';
import SaveIcon from '@mui/icons-material/Save';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import InfoIcon from '@mui/icons-material/Info';
import BuildIcon from '@mui/icons-material/Build';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';

// Interface pour les points de restauration
interface RestorePointInfo {
    sequence_number: number;
    description: string;
    restore_point_type: string;
    creation_time: string;
}

const BackupPage: React.FC = () => {
    const [restorePoints, setRestorePoints] = useState<RestorePointInfo[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>("");
    
    // États pour l'action de création
    const [description, setDescription] = useState<string>("Point créé par Admin Tool");
    const [isCreating, setIsCreating] = useState<boolean>(false);
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Fonction pour charger les points
    const fetchRestorePoints = useCallback(() => {
        // Ne pas mettre isLoading à true ici si on veut juste rafraîchir
        setError(null);
        invoke<RestorePointInfo[]>('list_restore_points')
            .then(data => {
                data.sort((a, b) => b.sequence_number - a.sequence_number);
                setRestorePoints(data);
            })
            .catch(err => {
                console.error("Erreur récupération points restauration:", err);
                setError(typeof err === 'string' ? err : 'Erreur inconnue (points restauration).');
            })
            .finally(() => {
                 setIsLoading(false); // Mettre à false seulement après le fetch
            });
    }, []);

    useEffect(() => {
        setIsLoading(true); // Mettre isLoading à true pour le chargement initial
        fetchRestorePoints();
    }, [fetchRestorePoints]);

    // Gérer la création d'un point
    const handleCreateRestorePoint = () => {
        setActionMessage(null);
        setIsCreating(true);
        invoke<void>('create_restore_point', { description })
            .then(() => {
                setActionMessage({ type: 'success', message: `Point de restauration '${description}' créé avec succès.` });
                setDescription("Point créé par Admin Tool"); // Réinitialiser
                fetchRestorePoints(); // Rafraîchir la liste
            })
            .catch(err => {
                console.error("Erreur création point restauration:", err);
                setActionMessage({ type: 'error', message: `Erreur création: ${typeof err === 'string' ? err : 'Erreur inconnue.'}` });
            })
            .finally(() => {
                setIsCreating(false);
            });
    };

    // Filtrer les points de restauration
    const filteredPoints = restorePoints.filter(point => 
        point.description.toLowerCase().includes(filter.toLowerCase()) ||
        point.restore_point_type.toLowerCase().includes(filter.toLowerCase()) ||
        point.creation_time.toLowerCase().includes(filter.toLowerCase()) ||
        point.sequence_number.toString().includes(filter)
    );

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
        } catch(e) {
            return dateStr; // En cas d'erreur de parsing, retourner la date originale
        }
    };

    // Obtenir la classe CSS pour le type de point
    const getTypeColor = (type: string): "success" | "info" | "warning" | "default" => {
        if (type.includes("SYSTEM")) return "success";
        if (type.includes("APPLICATION_INSTALL")) return "info";
        if (type.includes("DEVICE_DRIVER_INSTALL")) return "warning";
        return "default";
    };

    return (
        <PageLayout 
            title="Points de Restauration Système" 
            icon={<SettingsBackupRestoreIcon />}
            description="Créez et consultez les points de restauration Windows"
        >
            {/* Alerte d'erreur globale si nécessaire */}
            {error && (
                <Alert 
                    severity="error" 
                    variant="filled"
                    sx={{ mb: 3, borderRadius: 2 }}
                    action={
                        <Button 
                            color="inherit" 
                            size="small" 
                            onClick={fetchRestorePoints}
                        >
                            Réessayer
                        </Button>
                    }
                >
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        Erreur de récupération des points de restauration
                    </Typography>
                    <Typography variant="body2">
                        {error}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                        Vérifiez que la restauration système est activée sur votre machine.
                    </Typography>
                </Alert>
            )}

            {/* Section Création */}
            <HomeCard 
                title="Créer un Point de Restauration" 
                icon={<SaveIcon />}
                avatarColor="success.main"
                accentColor="#2e7d32"
                variant="gradient"
                error={actionMessage?.type === 'error' ? actionMessage.message : null}
            >
                <Box sx={{ p: 3 }}>
                    <Typography variant="body2" color="text.secondary" paragraph>
                        Créez un point de restauration système pour enregistrer l'état actuel de votre ordinateur. 
                        Vous pourrez restaurer votre système à cet état ultérieurement en cas de problème.
                    </Typography>
                    
                    <Box sx={{ 
                        display: 'flex', 
                        gap: 2, 
                        alignItems: 'flex-start',
                        flexDirection: { xs: 'column', sm: 'row' }
                    }}>
                        <TextField
                            label="Description du point de restauration"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={isCreating}
                            variant="outlined"
                            size="small"
                            fullWidth
                            sx={{ 
                                flex: 1,
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '12px'
                                }
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <RestoreIcon color="success" />
                                    </InputAdornment>
                                )
                            }}
                        />
                        
                        <Button
                            variant="contained"
                            color="success"
                            startIcon={isCreating ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
                            onClick={handleCreateRestorePoint}
                            disabled={isCreating || description.trim() === ''}
                            sx={{ 
                                borderRadius: 2,
                                py: 1,
                                transition: 'all 0.2s',
                                '&:hover': { transform: 'translateY(-2px)' },
                                minWidth: 200
                            }}
                        >
                            {isCreating ? "Création..." : "Créer un Point"}
                        </Button>
                    </Box>
                    
                    {actionMessage?.type === 'success' && (
                        <Alert 
                            severity="success" 
                            sx={{ mt: 2, borderRadius: 2 }}
                            icon={<CheckCircleIcon />}
                        >
                            {actionMessage.message}
                        </Alert>
                    )}
                </Box>
            </HomeCard>

            {/* Section Liste des points */}
            <Box sx={{ mt: 3 }}>
                <HomeCard 
                    title="Points de Restauration Disponibles" 
                    icon={<HistoryIcon />}
                    avatarColor="primary.main"
                    accentColor="#1976d2"
                    variant="standard"
                    isLoading={isLoading && restorePoints.length === 0}
                    headerActions={
                        <Tooltip title="Rafraîchir la liste">
                            <IconButton 
                                onClick={fetchRestorePoints} 
                                disabled={isLoading}
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
                    {!error && (
                        <Box sx={{ p: 2 }}>
                            {/* Statistiques */}
                            {restorePoints.length > 0 && (
                                <Alert 
                                    severity="info" 
                                    variant="outlined"
                                    sx={{ mb: 2, borderRadius: 2 }}
                                    icon={<InfoIcon />}
                                >
                                    <Typography variant="body2">
                                        {restorePoints.length} point{restorePoints.length > 1 ? 's' : ''} de restauration disponible{restorePoints.length > 1 ? 's' : ''}.
                                    </Typography>
                                </Alert>
                            )}

                            {/* Filtre */}
                            <Box sx={{ mb: 2 }}>
                                <TextField
                                    fullWidth
                                    variant="outlined"
                                    placeholder="Filtrer les points de restauration..."
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
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
                                        endAdornment: filter && (
                                            <InputAdornment position="end">
                                                <IconButton 
                                                    onClick={() => setFilter('')} 
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

                            {/* Liste des points */}
                            {isLoading && restorePoints.length > 0 ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                                    <CircularProgress size={40} color="primary" />
                                </Box>
                            ) : restorePoints.length === 0 ? (
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
                                    <RestoreIcon sx={{ fontSize: 60, color: 'action.disabled', mb: 2 }} />
                                    <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 'medium' }}>
                                        {filter ? "Aucun point ne correspond aux critères de recherche" : "Aucun point de restauration système trouvé."}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                        Utilisez le formulaire ci-dessus pour créer votre premier point de restauration.
                                    </Typography>
                                </Box>
                            ) : filteredPoints.length === 0 ? (
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
                                        Aucun point ne correspond aux critères de recherche.
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
                                                <TableCell><Typography variant="subtitle2">Séquence</Typography></TableCell>
                                                <TableCell><Typography variant="subtitle2">Description</Typography></TableCell>
                                                <TableCell><Typography variant="subtitle2">Type</Typography></TableCell>
                                                <TableCell><Typography variant="subtitle2">Date de création</Typography></TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {filteredPoints.map((point) => (
                                                <TableRow 
                                                    key={point.sequence_number} 
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
                                                            label={point.sequence_number} 
                                                            size="small" 
                                                            color="primary"
                                                            variant="outlined"
                                                            sx={{ borderRadius: '6px', fontWeight: 'bold' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2">
                                                            {point.description}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={point.restore_point_type} 
                                                            size="small"
                                                            color={getTypeColor(point.restore_point_type)}
                                                            variant="outlined"
                                                            icon={
                                                                point.restore_point_type.includes("SYSTEM") ? <SettingsBackupRestoreIcon fontSize="small" /> :
                                                                point.restore_point_type.includes("DEVICE_DRIVER") ? <BuildIcon fontSize="small" /> :
                                                                <RestoreIcon fontSize="small" />
                                                            }
                                                            sx={{ borderRadius: '6px' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <CalendarTodayIcon fontSize="small" color="action" />
                                                            <Typography variant="body2">
                                                                {formatDate(point.creation_time)}
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
                    )}
                </HomeCard>
            </Box>

            {/* Légende */}
            <Box sx={{ mt: 4 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Légende</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip icon={<SettingsBackupRestoreIcon />} label="SYSTEM" color="success" size="small" variant="outlined" />
                        <Typography variant="body2">Point de restauration système</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip icon={<RestoreIcon />} label="APPLICATION_INSTALL" color="info" size="small" variant="outlined" />
                        <Typography variant="body2">Installation d'application</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip icon={<BuildIcon />} label="DEVICE_DRIVER_INSTALL" color="warning" size="small" variant="outlined" />
                        <Typography variant="body2">Installation de pilote</Typography>
                    </Box>
                </Box>
            </Box>
        </PageLayout>
    );
};

export default BackupPage; 