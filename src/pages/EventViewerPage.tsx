import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import PageLayout from '../components/PageLayout';
import HomeCard from '../components/HomeCard';

// Material UI
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';

// Icons
import EventIcon from '@mui/icons-material/Event';
import SearchIcon from '@mui/icons-material/Search';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import IdIcon from '@mui/icons-material/Numbers';
import SourceIcon from '@mui/icons-material/Source';
import EventNoteIcon from '@mui/icons-material/EventNote';
import CategoryIcon from '@mui/icons-material/Category';
import DataUsageIcon from '@mui/icons-material/DataUsage';

// Interface pour une entrée de log
interface EventLogEntry {
    event_id: number;
    level: string;
    provider_name: string;
    time_created: string;
    message: string;
}

const LOG_NAMES = ["Application", "System", "Security", "Setup"];
const LEVELS = [
    { value: 0, label: "Tous" }, 
    { value: 4, label: "Information" }, 
    { value: 3, label: "Avertissement" },
    { value: 2, label: "Erreur" },
    { value: 1, label: "Critique" }
];
const MAX_EVENTS_OPTIONS = [25, 50, 100, 250, 500, 1000];

const EventViewerPage: React.FC = () => {
    // Filtres
    const [logName, setLogName] = useState<string>(LOG_NAMES[0]);
    const [maxEvents, setMaxEvents] = useState<number>(MAX_EVENTS_OPTIONS[1]);
    const [levelFilter, setLevelFilter] = useState<number>(LEVELS[0].value);
    const [providerFilter, setProviderFilter] = useState<string>("");
    const [idFilter, setIdFilter] = useState<string>(""); // Garder comme string pour l'input
    const [openDeleteDialog, setOpenDeleteDialog] = useState<boolean>(false);

    // États affichage
    const [events, setEvents] = useState<EventLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const fetchEvents = useCallback(() => {
        setIsLoading(true);
        setError(null);
        setActionMessage(null);
        setEvents([]);

        // Préparer les arguments pour l'invoke
        const invokeArgs = {
            logName,
            maxEvents,
            level: levelFilter === 0 ? null : levelFilter, // Envoyer null si "Tous"
            providerNameFilter: providerFilter.trim() === "" ? null : providerFilter.trim(),
            eventIdFilter: idFilter.trim() === "" ? null : parseInt(idFilter, 10) || null, // Tenter de parser l'ID
            // TODO: Ajouter filtres de date si besoin
        };

        invoke<EventLogEntry[]>('get_events', invokeArgs)
            .then(data => setEvents(data))
            .catch(err => setError(typeof err === 'string' ? err : `Erreur inconnue (${logName}).`))
            .finally(() => setIsLoading(false));
    }, [logName, maxEvents, levelFilter, providerFilter, idFilter]);

    useEffect(() => {
        fetchEvents(); // Charger au démarrage et quand les filtres changent
    }, [fetchEvents]);

    const handleClearLog = () => {
        setOpenDeleteDialog(false);
        setIsLoading(true); // Utiliser isLoading pour le bouton Vider aussi
        setError(null);
        setActionMessage(null);
        invoke<void>('clear_event_log', { logName })
            .then(() => {
                 setActionMessage({ type: 'success', message: `Journal '${logName}' vidé avec succès.` });
                 fetchEvents(); // Recharger
            })
            .catch(err => {
                 setActionMessage({ type: 'error', message: `Erreur vidage journal '${logName}': ${typeof err === 'string' ? err : 'Erreur inconnue.'}` });
            })
            .finally(() => setIsLoading(false));
    };

    const handleResetFilters = () => {
        setLevelFilter(LEVELS[0].value);
        setProviderFilter("");
        setIdFilter("");
        // La modification des filtres déclenchera fetchEvents via l'useEffect
    };

    // Fonctions pour obtenir des informations visuelles en fonction du niveau
    const getLevelIcon = (level: string) => {
        switch (level.toLowerCase()) {
            case 'error':
            case 'critique':
                return <ErrorIcon color="error" />;
            case 'warning':
            case 'avertissement':
                return <WarningIcon color="warning" />;
            case 'information':
            case 'info':
                return <InfoIcon color="info" />;
            default:
                return <InfoIcon color="disabled" />;
        }
    };

    const getLevelColor = (level: string): "error" | "warning" | "info" | "default" => {
        switch (level.toLowerCase()) {
            case 'error':
            case 'critique':
                return "error";
            case 'warning':
            case 'avertissement':
                return "warning";
            case 'information':
            case 'info':
                return "info";
            default:
                return "default";
        }
    };

    // Formatage de la date en français
    const formatEventDate = (dateStr: string): string => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('fr-FR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (e) {
            return dateStr;
        }
    };

    return (
        <PageLayout 
            title="Observateur d'événements" 
            icon={<EventNoteIcon />}
            description="Consultez et gérez les journaux d'événements Windows"
        >
            <Grid container spacing={3}>
                {/* Section Filtres et Actions */}
                <Grid item xs={12}>
                    <HomeCard 
                        title="Filtres et actions" 
                        icon={<FilterListIcon />}
                        variant="gradient"
                        accentColor="#1976d2"
                        isLoading={isLoading}
                        headerActions={
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Tooltip title="Réinitialiser les filtres">
                                    <IconButton
                                        onClick={handleResetFilters}
                                        disabled={isLoading}
                                        size="small"
                                        color="primary"
                                        sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
                                    >
                                        <ClearIcon />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Rafraîchir les événements">
                                    <IconButton
                                        onClick={fetchEvents}
                                        disabled={isLoading}
                                        size="small"
                                        color="primary"
                                        sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
                                    >
                                        <RefreshIcon />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        }
                    >
                        <Box sx={{ p: 3 }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} sm={6} md={3}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel id="log-name-label">Journal</InputLabel>
                                        <Select
                                            labelId="log-name-label"
                                            value={logName}
                                            label="Journal"
                                            onChange={(e) => setLogName(e.target.value as string)}
                                            disabled={isLoading}
                                            startAdornment={
                                                <InputAdornment position="start">
                                                    <CategoryIcon color="primary" />
                                                </InputAdornment>
                                            }
                                            sx={{ borderRadius: '12px' }}
                                        >
                                            {LOG_NAMES.map(name => (
                                                <MenuItem key={name} value={name}>{name}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} sm={6} md={3}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel id="level-label">Niveau</InputLabel>
                                        <Select
                                            labelId="level-label"
                                            value={levelFilter}
                                            label="Niveau"
                                            onChange={(e) => setLevelFilter(Number(e.target.value))}
                                            disabled={isLoading}
                                            startAdornment={
                                                <InputAdornment position="start">
                                                    <DataUsageIcon color="primary" />
                                                </InputAdornment>
                                            }
                                            sx={{ borderRadius: '12px' }}
                                        >
                                            {LEVELS.map(lvl => (
                                                <MenuItem key={lvl.value} value={lvl.value}>
                                                    {lvl.label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} sm={6} md={3}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Source"
                                        value={providerFilter}
                                        onChange={(e) => setProviderFilter(e.target.value)}
                                        placeholder="Partie du nom..."
                                        disabled={isLoading}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SourceIcon color="primary" />
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

                                <Grid item xs={12} sm={6} md={3}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="ID Événement"
                                        type="number"
                                        value={idFilter}
                                        onChange={(e) => setIdFilter(e.target.value)}
                                        placeholder="Ex: 1001"
                                        disabled={isLoading}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <IdIcon color="primary" />
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

                                <Grid item xs={12} sm={6} md={3}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel id="max-events-label">Max événements</InputLabel>
                                        <Select
                                            labelId="max-events-label"
                                            value={maxEvents}
                                            label="Max événements"
                                            onChange={(e) => setMaxEvents(Number(e.target.value))}
                                            disabled={isLoading}
                                            sx={{ borderRadius: '12px' }}
                                        >
                                            {MAX_EVENTS_OPTIONS.map(num => (
                                                <MenuItem key={num} value={num}>{num}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} sm={6} md={9}>
                                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                        <Button
                                            variant="contained"
                                            color="error"
                                            startIcon={<DeleteSweepIcon />}
                                            onClick={() => setOpenDeleteDialog(true)}
                                            disabled={isLoading}
                                            sx={{ 
                                                borderRadius: '12px',
                                                boxShadow: 'none',
                                                '&:hover': {
                                                    transform: 'translateY(-2px)',
                                                    boxShadow: 2
                                                }
                                            }}
                                        >
                                            Vider le journal '{logName}'
                                        </Button>

                                        {actionMessage && (
                                            <Alert 
                                                severity={actionMessage.type} 
                                                sx={{ 
                                                    flexGrow: 1, 
                                                    borderRadius: '12px',
                                                    boxShadow: 'none'
                                                }}
                                            >
                                                {actionMessage.message}
                                            </Alert>
                                        )}
                                    </Box>
                                </Grid>
                            </Grid>
                        </Box>
                    </HomeCard>
                </Grid>

                {/* Section Événements */}
                <Grid item xs={12}>
                    <HomeCard 
                        title={`Événements du journal ${logName}`} 
                        icon={<EventIcon />}
                        variant="standard"
                        isLoading={isLoading}
                        error={error}
                    >
                        <Box sx={{ p: 2 }}>
                            {/* Afficher le message d'erreur ou le contenu */}
                            {error ? (
                                <Alert severity="error" sx={{ borderRadius: '12px' }}>
                                    {error}
                                </Alert>
                            ) : isLoading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                    <CircularProgress size={40} />
                                </Box>
                            ) : events.length === 0 ? (
                                <Box sx={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    alignItems: 'center', 
                                    gap: 2,
                                    p: 4,
                                    bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                    borderRadius: 3,
                                    border: theme => `1px dashed ${
                                        theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                                    }`
                                }}>
                                    <EventIcon sx={{ fontSize: 60, color: 'text.disabled' }} />
                                    <Typography variant="body1" color="text.secondary">
                                        Aucun événement trouvé pour '{logName}' (ou le journal est vide).
                                    </Typography>
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
                                                <TableCell width="180px">Date/Heure</TableCell>
                                                <TableCell width="100px">Niveau</TableCell>
                                                <TableCell width="150px">Source</TableCell>
                                                <TableCell width="80px">ID</TableCell>
                                                <TableCell>Message</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {events.map((event, index) => (
                                                <TableRow 
                                                    key={index} 
                                                    hover
                                                    sx={{ 
                                                        '&:nth-of-type(odd)': {
                                                            bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                                                        },
                                                        '&:last-child td, &:last-child th': { border: 0 },
                                                        verticalAlign: 'top'
                                                    }}
                                                >
                                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                        {formatEventDate(event.time_created)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            icon={getLevelIcon(event.level)}
                                                            label={event.level} 
                                                            color={getLevelColor(event.level)}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ borderRadius: '8px' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight="medium">
                                                            {event.provider_name}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={event.event_id} 
                                                            size="small"
                                                            color="primary"
                                                            variant="outlined"
                                                            sx={{ borderRadius: '8px', minWidth: '50px' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ 
                                                        fontSize: '0.85rem',
                                                        padding: '8px 16px',
                                                        maxWidth: '600px',
                                                        whiteSpace: 'pre-wrap',
                                                        wordBreak: 'break-word'
                                                    }}>
                                                        {event.message}
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
            </Grid>

            {/* Boîte de dialogue de confirmation pour vider le journal */}
            <Dialog
                open={openDeleteDialog}
                onClose={() => setOpenDeleteDialog(false)}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
                PaperProps={{
                    sx: { borderRadius: '12px' }
                }}
            >
                <DialogTitle id="alert-dialog-title">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DeleteSweepIcon color="error" />
                        <Typography variant="h6">Confirmation de suppression</Typography>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        Êtes-vous sûr de vouloir VIDER le journal '{logName}' ? 
                        <br/><br/>
                        <Alert severity="warning" variant="outlined" sx={{ mb: 1 }}>
                            Cette action est irréversible et nécessite des privilèges administrateur.
                        </Alert>
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenDeleteDialog(false)} color="primary" variant="outlined" sx={{ borderRadius: '8px' }}>
                        Annuler
                    </Button>
                    <Button onClick={handleClearLog} color="error" variant="contained" autoFocus sx={{ borderRadius: '8px' }}>
                        Vider le journal
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Légende */}
            <Box sx={{ mt: 4 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Légende</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip icon={<ErrorIcon />} label="Critique/Erreur" color="error" size="small" variant="outlined" sx={{ borderRadius: '8px' }} />
                        <Typography variant="body2">Problèmes critiques nécessitant une intervention</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip icon={<WarningIcon />} label="Avertissement" color="warning" size="small" variant="outlined" sx={{ borderRadius: '8px' }} />
                        <Typography variant="body2">Avertissements nécessitant une attention</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip icon={<InfoIcon />} label="Information" color="info" size="small" variant="outlined" sx={{ borderRadius: '8px' }} />
                        <Typography variant="body2">Activités normales du système</Typography>
                    </Box>
                </Box>
            </Box>
        </PageLayout>
    );
};

export default EventViewerPage; 