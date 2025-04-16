import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import PageLayout from '../components/PageLayout';
import InfoCard from '../components/InfoCard';

// Material UI
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
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
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';

// Icons
import TaskIcon from '@mui/icons-material/Task';
import MemoryIcon from '@mui/icons-material/Memory';
import RefreshIcon from '@mui/icons-material/Refresh';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import WarningIcon from '@mui/icons-material/Warning';

// Interface pour les informations de processus (sans statut)
interface ProcessInfo {
    pid: number;
    name: string;
    cpu_usage: number;
    memory: number; // En octets
}

// Fonction utilitaire pour formater les octets (peut être partagée)
function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; // Simplifié pour la mémoire
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    // Gérer le cas où i est hors des limites (très grande mémoire ?)
    const index = Math.min(i, sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, index)).toFixed(dm)) + ' ' + sizes[index];
}

const ProcessesPage: React.FC = () => {
    const [processes, setProcesses] = useState<ProcessInfo[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>("");
    const [terminatingPID, setTerminatingPID] = useState<number | null>(null);
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Récupérer les processus
    const fetchProcesses = () => {
        setIsLoading(true);
        setError(null);
        setActionMessage(null);
        invoke<ProcessInfo[]>('list_processes')
            .then(data => {
                // Trier d'abord par utilisation CPU (décroissant)
                data.sort((a, b) => b.cpu_usage - a.cpu_usage);
                setProcesses(data);
            })
            .catch(err => {
                console.error("Erreur lors de la récupération des processus:", err);
                setError(typeof err === 'string' ? err : 'Erreur inconnue lors de la récupération des processus.');
            })
            .finally(() => setIsLoading(false));
    };

    // Fonction pour terminer un processus
    const terminateProcess = (pid: number) => {
        if (!window.confirm(`Êtes-vous sûr de vouloir terminer le processus ${pid} ?`)) {
            return;
        }
        
        setTerminatingPID(pid);
        setActionMessage(null);
        
        invoke<boolean>('terminate_process', { pid })
            .then(success => {
                if (success) {
                    setActionMessage({ 
                        type: 'success', 
                        message: `Processus ${pid} terminé avec succès.` 
                    });
                    // Rafraîchir la liste après avoir terminé un processus
                    fetchProcesses();
                } else {
                    setActionMessage({ 
                        type: 'error', 
                        message: `Impossible de terminer le processus ${pid}.` 
                    });
                }
            })
            .catch(err => {
                console.error(`Erreur lors de la terminaison du processus ${pid}:`, err);
                setActionMessage({ 
                    type: 'error', 
                    message: `Erreur: ${typeof err === 'string' ? err : `Impossible de terminer le processus ${pid}.`}` 
                });
            })
            .finally(() => setTerminatingPID(null));
    };

    // Chargement initial
    useEffect(() => {
        fetchProcesses();
        
        // Actualiser les processus toutes les 10 secondes
        const intervalId = setInterval(fetchProcesses, 10000);
        
        // Nettoyage à la désinscription
        return () => clearInterval(intervalId);
    }, []);

    // Filtrer les processus
    const filteredProcesses = processes.filter(proc => 
        proc.name.toLowerCase().includes(filter.toLowerCase()) ||
        proc.pid.toString().includes(filter)
    );

    return (
        <PageLayout
            title="Gestion des Processus"
            icon={<TaskIcon />}
            description="Surveillance et contrôle des processus en cours d'exécution"
        >
            <InfoCard
                title="Processus Actifs"
                icon={<MemoryIcon />}
                isLoading={isLoading}
                error={error}
                fullWidth
                gradient={true}
                borderRadius={16}
                darkModeCompatible={true}
                avatarColor="linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)"
                actions={
                    <Tooltip title="Rafraîchir la liste" arrow>
                        <IconButton 
                            onClick={fetchProcesses} 
                            disabled={isLoading}
                            sx={{
                                bgcolor: theme => theme.palette.mode === 'dark' 
                                    ? 'rgba(255,255,255,0.1)' 
                                    : 'rgba(255,255,255,0.8)',
                                '&:hover': {
                                    bgcolor: theme => theme.palette.mode === 'dark'
                                        ? 'rgba(255,255,255,0.2)'
                                        : 'rgba(255,255,255,1)',
                                    transform: 'rotate(180deg)',
                                    transition: 'transform 0.5s'
                                },
                                transition: 'all 0.3s'
                            }}
                        >
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                }
            >
                <Box sx={{ mb: 2 }}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="Filtrer les processus par nom ou PID..."
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
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderWidth: '1px',
                                }
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
                
                {actionMessage && (
                    <Alert 
                        severity={actionMessage.type} 
                        sx={{ 
                            mb: 2, 
                            borderRadius: '8px', 
                            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                            animation: 'fadeIn 0.5s ease-in-out'
                        }}
                        icon={actionMessage.type === 'success' ? 
                            <Chip 
                                size="small" 
                                color="success" 
                                label="✓" 
                                sx={{ 
                                    fontWeight: 'bold', 
                                    minWidth: '24px',
                                    height: '24px' 
                                }} 
                            /> : 
                            <Chip 
                                size="small" 
                                color="error" 
                                label="!" 
                                sx={{ 
                                    fontWeight: 'bold', 
                                    minWidth: '24px',
                                    height: '24px' 
                                }} 
                            />
                        }
                    >
                        {actionMessage.message}
                    </Alert>
                )}

                {filteredProcesses.length === 0 ? (
                    <Box
                        sx={{
                            textAlign: 'center',
                            py: 6,
                            px: 2,
                            bgcolor: theme => theme.palette.mode === 'dark' 
                                ? 'rgba(255,255,255,0.03)' 
                                : 'rgba(0,0,0,0.02)',
                            borderRadius: 3,
                            border: theme => `1px dashed ${
                                theme.palette.mode === 'dark' 
                                    ? 'rgba(255,255,255,0.1)' 
                                    : 'rgba(0,0,0,0.1)'
                            }`
                        }}
                    >
                        <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 'medium' }}>
                            {filter ? "Aucun processus ne correspond aux critères de recherche." : "Aucun processus trouvé."}
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
                                theme.palette.mode === 'dark' 
                                    ? 'rgba(255,255,255,0.1)' 
                                    : 'rgba(0,0,0,0.05)'
                            }`
                        }}
                    >
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ 
                                    bgcolor: theme => theme.palette.mode === 'dark' 
                                        ? 'rgba(255,255,255,0.05)' 
                                        : 'rgba(0,0,0,0.02)', 
                                    '& th': { 
                                        fontWeight: 'bold', 
                                        color: 'text.primary',
                                        py: 1.5
                                    } 
                                }}>
                                    <TableCell className="font-semibold text-gray-700">PID</TableCell>
                                    <TableCell className="font-semibold text-gray-700">Nom</TableCell>
                                    <TableCell className="font-semibold text-gray-700">CPU</TableCell>
                                    <TableCell className="font-semibold text-gray-700">Mémoire</TableCell>
                                    <TableCell className="font-semibold text-gray-700">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredProcesses.map((proc) => (
                                    <TableRow 
                                        key={proc.pid} 
                                        hover
                                        sx={{
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                bgcolor: theme => theme.palette.mode === 'dark' 
                                                    ? 'rgba(255,255,255,0.05)' 
                                                    : 'rgba(0,0,0,0.02)'
                                            }
                                        }}
                                    >
                                        <TableCell>
                                            <Chip
                                                label={proc.pid}
                                                size="small"
                                                variant="filled"
                                                color="primary"
                                                sx={{ 
                                                    borderRadius: '6px',
                                                    background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
                                                    fontWeight: 'bold'
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography sx={{ fontWeight: 'medium', fontSize: '0.875rem' }}>
                                                {proc.name}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography sx={{ fontSize: '0.875rem', minWidth: '36px' }}>
                                                    {proc.cpu_usage.toFixed(1)}%
                                                </Typography>
                                                <Box 
                                                    sx={{ 
                                                        width: '80px', 
                                                        height: '6px', 
                                                        bgcolor: 'rgba(0,0,0,0.05)',
                                                        borderRadius: '3px',
                                                        overflow: 'hidden'
                                                    }}
                                                >
                                                    <Box 
                                                        sx={{ 
                                                            height: '100%', 
                                                            width: `${Math.min(proc.cpu_usage, 100)}%`,
                                                            background: proc.cpu_usage > 50 ? 
                                                                'linear-gradient(90deg, #ff9a9e 0%, #ff414d 100%)' : 
                                                                proc.cpu_usage > 20 ? 
                                                                'linear-gradient(90deg, #ffd086 0%, #ff9800 100%)' : 
                                                                'linear-gradient(90deg, #a1c4fd 0%, #4eadff 100%)',
                                                            transition: 'width 0.5s ease-out'
                                                        }}
                                                    />
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={formatBytes(proc.memory)}
                                                size="small"
                                                variant="outlined"
                                                sx={{ 
                                                    borderRadius: '6px',
                                                    fontSize: '0.75rem',
                                                    bgcolor: 'rgba(0,0,0,0.02)'
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title="Terminer le processus" arrow>
                                                <Button
                                                    variant="outlined"
                                                    color="error"
                                                    size="small"
                                                    onClick={() => terminateProcess(proc.pid)}
                                                    disabled={!!terminatingPID}
                                                    startIcon={terminatingPID === proc.pid ? 
                                                        <CircularProgress size={16} /> : 
                                                        <StopCircleIcon />
                                                    }
                                                    sx={{
                                                        borderRadius: '8px',
                                                        boxShadow: '0 0 0 rgba(244,67,54,0)',
                                                        transition: 'all 0.3s',
                                                        '&:hover': {
                                                            boxShadow: '0 0 8px rgba(244,67,54,0.4)',
                                                            bgcolor: 'error.main',
                                                            color: 'white'
                                                        }
                                                    }}
                                                >
                                                    Terminer
                                                </Button>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
                
                <Box sx={{ 
                    mt: 3, 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    borderTop: theme => `1px solid ${
                        theme.palette.mode === 'dark'
                            ? 'rgba(255,255,255,0.1)'
                            : 'rgba(0,0,0,0.05)'
                    }`,
                    pt: 2 
                }}>
                    <Chip
                        label={`${filteredProcesses.length} processus ${filter ? `(sur ${processes.length})` : ''}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ borderRadius: '6px' }}
                    />
                    
                    <Box sx={{ 
                        display: 'flex', 
                        gap: 1, 
                        alignItems: 'center',
                        bgcolor: theme => theme.palette.mode === 'dark'
                            ? 'rgba(255, 152, 0, 0.15)'
                            : 'rgba(255, 152, 0, 0.1)',
                        borderRadius: '8px',
                        p: 1
                    }}>
                        <WarningIcon color="warning" fontSize="small" />
                        <Typography variant="caption" sx={{ fontWeight: 'medium' }}>
                            La terminaison forcée peut causer une perte de données non sauvegardées
                        </Typography>
                    </Box>
                </Box>
            </InfoCard>
        </PageLayout>
    );
};

export default ProcessesPage; 