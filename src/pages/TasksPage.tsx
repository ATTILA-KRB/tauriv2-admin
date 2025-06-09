import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import PageLayout from '../components/PageLayout';
import HomeCard from '../components/HomeCard';
import GridItem from '../components/GridItem';

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
import Tooltip from '@mui/material/Tooltip';
import TablePagination from '@mui/material/TablePagination';
import ButtonGroup from '@mui/material/ButtonGroup';

// Icons
import TaskIcon from '@mui/icons-material/Task';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import RefreshIcon from '@mui/icons-material/Refresh';
import ClearIcon from '@mui/icons-material/Clear';
import FolderIcon from '@mui/icons-material/Folder';
import ScheduleIcon from '@mui/icons-material/Schedule';

interface TaskInfo {
    name: string;
    path: string;
    state: string;
    last_run_time: string;
    next_run_time: string;
    last_result: string;
}

const STATE_FILTERS = [
    { value: "Tous", label: "Tous les états" },
    { value: "Ready", label: "Prêt" },
    { value: "Running", label: "En cours" },
    { value: "Disabled", label: "Désactivé" },
    { value: "Queued", label: "En file" },
    { value: "Unknown", label: "Inconnu" }
];

const TasksPage: React.FC = () => {
    const [tasks, setTasks] = useState<TaskInfo[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<{ path: string, type: 'success' | 'error', message: string } | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    
    // Filtres
    const [searchFilter, setSearchFilter] = useState<string>("");
    const [stateFilter, setStateFilter] = useState<string>("Tous");
    const [pathFilter, setPathFilter] = useState<string>("");
    
    // Pagination
    const [page, setPage] = useState<number>(0);
    const [rowsPerPage, setRowsPerPage] = useState<number>(25);

    const fetchTasks = useCallback(() => {
        setIsLoading(true);
        setError(null);
        setActionMessage(null);
        invoke<TaskInfo[]>('list_scheduled_tasks')
            .then(data => {
                data.sort((a, b) => a.name.localeCompare(b.name));
                setTasks(data);
            })
            .catch(err => setError(typeof err === 'string' ? err : 'Erreur inconnue.'))
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    // Filtrage
    const filteredTasks = useMemo(() => {
        let filtered = tasks;
        
        if (searchFilter.trim()) {
            const search = searchFilter.toLowerCase();
            filtered = filtered.filter(task => 
                task.name.toLowerCase().includes(search) ||
                task.path.toLowerCase().includes(search)
            );
        }
        
        if (stateFilter !== "Tous") {
            filtered = filtered.filter(task => task.state === stateFilter);
        }
        
        if (pathFilter.trim()) {
            const pathSearch = pathFilter.toLowerCase();
            filtered = filtered.filter(task => 
                task.path.toLowerCase().includes(pathSearch)
            );
        }
        
        return filtered;
    }, [tasks, searchFilter, stateFilter, pathFilter]);

    // Pagination
    const displayedTasks = useMemo(() => {
        const start = page * rowsPerPage;
        return filteredTasks.slice(start, start + rowsPerPage);
    }, [filteredTasks, page, rowsPerPage]);

    const handleChangePage = (_event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    useEffect(() => {
        setPage(0);
    }, [searchFilter, stateFilter, pathFilter]);

    const handleTaskAction = (action: 'enable' | 'disable' | 'run', taskPath: string, taskName: string) => {
        setActionLoading(taskPath);
        setActionMessage(null);
        const command = `${action}_task`;
        invoke<void>(command, { taskPath })
            .then(() => {
                const actionLabels = { enable: 'Activée', disable: 'Désactivée', run: 'Exécutée' };
                setActionMessage({ 
                    path: taskPath, 
                    type: 'success', 
                    message: `Tâche "${taskName}" ${actionLabels[action]} avec succès` 
                });
                fetchTasks();
            })
            .catch(err => setActionMessage({ 
                path: taskPath, 
                type: 'error', 
                message: `Erreur lors de l'action ${action} sur "${taskName}": ${typeof err === 'string' ? err : 'Erreur inconnue.'}` 
            }))
            .finally(() => setActionLoading(null));
    };

    const handleResetFilters = () => {
        setSearchFilter("");
        setStateFilter("Tous");
        setPathFilter("");
    };

    const getStateColor = (state: string): "success" | "warning" | "error" | "info" | "default" => {
        switch (state) {
            case 'Running': return "success";
            case 'Ready': return "info";
            case 'Disabled': return "warning";
            case 'Queued': return "info";
            default: return "default";
        }
    };

    const getStateIcon = (state: string) => {
        switch (state) {
            case 'Running': return <PlayArrowIcon />;
            case 'Ready': return <CheckCircleIcon />;
            case 'Disabled': return <BlockIcon />;
            default: return <ScheduleIcon />;
        }
    };

    const formatDateTime = (dateStr: string): string => {
        if (!dateStr || dateStr === "N/A") return "N/A";
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('fr-FR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <PageLayout 
            title="Tâches Planifiées" 
            icon={<TaskIcon />}
            description="Gérez les tâches planifiées Windows"
        >
            <Grid container spacing={3}>
                {/* Section Filtres */}
                <GridItem xs={12}>
                    <HomeCard 
                        title="Filtres et Actions" 
                        icon={<FilterListIcon />}
                        variant="gradient"
                        accentColor="#2196f3"
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
                                <Tooltip title="Rafraîchir les tâches">
                                    <IconButton
                                        onClick={fetchTasks}
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
                                <GridItem xs={12} sm={6} md={3}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Recherche nom/chemin"
                                        value={searchFilter}
                                        onChange={(e) => setSearchFilter(e.target.value)}
                                        placeholder="Rechercher..."
                                        disabled={isLoading}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon color="primary" />
                                                </InputAdornment>
                                            )
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '12px'
                                            }
                                        }}
                                    />
                                </GridItem>

                                <GridItem xs={12} sm={6} md={3}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel id="state-label">État</InputLabel>
                                        <Select
                                            labelId="state-label"
                                            value={stateFilter}
                                            label="État"
                                            onChange={(e) => setStateFilter(e.target.value)}
                                            disabled={isLoading}
                                            sx={{ borderRadius: '12px' }}
                                        >
                                            {STATE_FILTERS.map(state => (
                                                <MenuItem key={state.value} value={state.value}>
                                                    {state.label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </GridItem>

                                <GridItem xs={12} sm={6} md={3}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Filtre chemin"
                                        value={pathFilter}
                                        onChange={(e) => setPathFilter(e.target.value)}
                                        placeholder="Ex: Microsoft\\"
                                        disabled={isLoading}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <FolderIcon color="primary" />
                                                </InputAdornment>
                                            )
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '12px'
                                            }
                                        }}
                                    />
                                </GridItem>

                                <GridItem xs={12} sm={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">
                                        {filteredTasks.length} tâche(s) trouvée(s) sur {tasks.length}
                                    </Typography>
                                </GridItem>
                            </Grid>

                            {actionMessage && (
                                <Alert 
                                    severity={actionMessage.type} 
                                    sx={{ mt: 2, borderRadius: '12px' }}
                                    onClose={() => setActionMessage(null)}
                                >
                                    {actionMessage.message}
                                </Alert>
                            )}
                        </Box>
                    </HomeCard>
                </GridItem>

                {/* Section Tâches */}
                <GridItem xs={12}>
                    <HomeCard 
                        title={`Tâches Planifiées (${displayedTasks.length})`}
                        icon={<TaskIcon />}
                        variant="standard"
                        isLoading={isLoading}
                        error={error}
                    >
                        <Box sx={{ p: 2 }}>
                            {error ? (
                                <Alert severity="error" sx={{ borderRadius: '12px' }}>
                                    {error}
                                </Alert>
                            ) : isLoading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                    <CircularProgress size={40} />
                                </Box>
                            ) : filteredTasks.length === 0 ? (
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
                                    <TaskIcon sx={{ fontSize: 60, color: 'text.disabled' }} />
                                    <Typography variant="body1" color="text.secondary">
                                        Aucune tâche trouvée avec les filtres actuels.
                                    </Typography>
                                </Box>
                            ) : (
                                <>
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
                                                    <TableCell width="300px">Nom de la tâche</TableCell>
                                                    <TableCell width="200px">Chemin</TableCell>
                                                    <TableCell width="100px">État</TableCell>
                                                    <TableCell width="140px">Dernière exéc.</TableCell>
                                                    <TableCell width="140px">Prochaine exéc.</TableCell>
                                                    <TableCell width="100px">Résultat</TableCell>
                                                    <TableCell width="200px">Actions</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {displayedTasks.map((task) => (
                                                    <TableRow 
                                                        key={task.path + task.name}
                                                        hover
                                                        sx={{ 
                                                            '&:nth-of-type(odd)': {
                                                                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                                                            },
                                                            '&:last-child td, &:last-child th': { border: 0 },
                                                            verticalAlign: 'top'
                                                        }}
                                                    >
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight="medium">
                                                                {task.name}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                                {task.path}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip 
                                                                icon={getStateIcon(task.state)}
                                                                label={task.state} 
                                                                color={getStateColor(task.state)}
                                                                size="small"
                                                                variant="outlined"
                                                                sx={{ borderRadius: '8px' }}
                                                            />
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '0.8rem' }}>
                                                            {formatDateTime(task.last_run_time)}
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '0.8rem' }}>
                                                            {formatDateTime(task.next_run_time)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip 
                                                                label={task.last_result} 
                                                                size="small"
                                                                color={task.last_result === "0" ? "success" : "default"}
                                                                variant="outlined"
                                                                sx={{ borderRadius: '8px' }}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <ButtonGroup size="small" variant="outlined" sx={{ gap: 0.5 }}>
                                                                <Tooltip title="Exécuter la tâche">
                                                                    <Button
                                                                        onClick={() => handleTaskAction('run', task.path, task.name)}
                                                                        disabled={actionLoading === task.path}
                                                                        color="primary"
                                                                        sx={{ minWidth: '40px', borderRadius: '8px' }}
                                                                    >
                                                                        <PlayArrowIcon fontSize="small" />
                                                                    </Button>
                                                                </Tooltip>
                                                                <Tooltip title={task.state === 'Ready' ? "Déjà activée" : "Activer la tâche"}>
                                                                    <span>
                                                                        <Button
                                                                            onClick={() => handleTaskAction('enable', task.path, task.name)}
                                                                            disabled={task.state === 'Ready' || actionLoading === task.path}
                                                                            color="success"
                                                                            sx={{ minWidth: '40px', borderRadius: '8px' }}
                                                                        >
                                                                            <CheckCircleIcon fontSize="small" />
                                                                        </Button>
                                                                    </span>
                                                                </Tooltip>
                                                                <Tooltip title={task.state === 'Disabled' ? "Déjà désactivée" : "Désactiver la tâche"}>
                                                                    <span>
                                                                        <Button
                                                                            onClick={() => handleTaskAction('disable', task.path, task.name)}
                                                                            disabled={task.state === 'Disabled' || actionLoading === task.path}
                                                                            color="warning"
                                                                            sx={{ minWidth: '40px', borderRadius: '8px' }}
                                                                        >
                                                                            <BlockIcon fontSize="small" />
                                                                        </Button>
                                                                    </span>
                                                                </Tooltip>
                                                            </ButtonGroup>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                    
                                    {filteredTasks.length > 0 && (
                                        <TablePagination
                                            component="div"
                                            count={filteredTasks.length}
                                            page={page}
                                            onPageChange={handleChangePage}
                                            rowsPerPage={rowsPerPage}
                                            onRowsPerPageChange={handleChangeRowsPerPage}
                                            rowsPerPageOptions={[10, 25, 50, 100]}
                                            labelRowsPerPage="Lignes par page:"
                                            labelDisplayedRows={({ from, to, count }) => 
                                                `${from}-${to} sur ${count !== -1 ? count : `plus de ${to}`}`
                                            }
                                        />
                                    )}
                                </>
                            )}
                        </Box>
                    </HomeCard>
                </GridItem>
            </Grid>
        </PageLayout>
    );
};

export default TasksPage; 