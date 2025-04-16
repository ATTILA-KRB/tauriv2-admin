import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import PageLayout from '../components/PageLayout';
import InfoCard from '../components/InfoCard';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

// Icons
import DevicesIcon from '@mui/icons-material/Devices';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import PowerIcon from '@mui/icons-material/Power';
import ClearIcon from '@mui/icons-material/Clear';

interface DeviceInfo {
    instance_id: string;
    name: string;
    class: string;
    manufacturer: string;
    status: string;
}

const DevicesPage: React.FC = () => {
    const [devices, setDevices] = useState<DeviceInfo[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState("");
    const [actionMessage, setActionMessage] = useState<{ id: string, type: 'success' | 'error', message: string } | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchDevices = useCallback(() => {
        setIsLoading(true); 
        setError(null); 
        setActionMessage(null);
        
        invoke<DeviceInfo[]>('list_devices')
            .then(data => {
                data.sort((a,b) => a.name.localeCompare(b.name));
                setDevices(data);
            })
            .catch(err => setError(typeof err === 'string' ? err : 'Erreur inconnue.'))
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => { fetchDevices(); }, [fetchDevices]);

    const handleDeviceAction = (action: 'enable' | 'disable', instanceId: string) => {
        setActionLoading(instanceId); 
        setActionMessage(null);
        
        const command = `${action}_device`;
        invoke<void>(command, { instanceId })
            .then(() => {
                setActionMessage({ 
                    id: instanceId, 
                    type: 'success', 
                    message: `Action ${action === 'enable' ? 'activation' : 'désactivation'} réussie` 
                });
                fetchDevices();
            })
            .catch(err => setActionMessage({ 
                id: instanceId, 
                type: 'error', 
                message: `Erreur: ${typeof err === 'string' ? err : 'Erreur inconnue.'}` 
            }))
            .finally(() => setActionLoading(null));
    };
    
    const filteredDevices = devices.filter(d => 
        d.name.toLowerCase().includes(filter.toLowerCase()) || 
        d.class.toLowerCase().includes(filter.toLowerCase()) || 
        d.manufacturer.toLowerCase().includes(filter.toLowerCase())
    );
    
    // Fonction pour rendre le statut comme une puce colorée
    const renderStatus = (status: string) => {
        if (status === 'OK') {
            return <Chip label="Actif" color="success" size="small" />;
        } else if (status === 'Disabled') {
            return <Chip label="Désactivé" color="error" size="small" />;
        } else {
            return <Chip label={status} color="warning" size="small" />;
        }
    };

    return (
        <PageLayout 
            title="Gestionnaire de Périphériques" 
            icon={<DevicesIcon />} 
            description="Affiche et gère tous les périphériques connectés à l'ordinateur"
        >
            <InfoCard 
                title="Périphériques" 
                icon={<DevicesIcon />} 
                isLoading={isLoading}
                error={error}
                fullWidth
                actions={
                    <Tooltip title="Rafraîchir la liste">
                        <IconButton onClick={fetchDevices} disabled={isLoading}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                }
            >
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        label="Filtrer les périphériques"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        size="small"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                            endAdornment: filter && (
                                <InputAdornment position="end">
                                    <IconButton onClick={() => setFilter('')} edge="end" size="small">
                                        <ClearIcon />
                                    </IconButton>
                                </InputAdornment>
                            )
                        }}
                    />
                </Box>
                
                {actionMessage && (
                    <Alert 
                        severity={actionMessage.type} 
                        sx={{ mb: 2 }}
                    >
                        {actionMessage.message}
                    </Alert>
                )}
                
                {filteredDevices.length === 0 ? (
                    <Typography variant="body1" sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                        {filter ? "Aucun périphérique ne correspond aux critères de recherche" : "Aucun périphérique trouvé"}
                    </Typography>
                ) : (
                    <TableContainer component={Paper} elevation={0}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell><Typography variant="subtitle2">Nom</Typography></TableCell>
                                    <TableCell><Typography variant="subtitle2">Classe</Typography></TableCell>
                                    <TableCell><Typography variant="subtitle2">Fabricant</Typography></TableCell>
                                    <TableCell><Typography variant="subtitle2">Statut</Typography></TableCell>
                                    <TableCell><Typography variant="subtitle2">Actions</Typography></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredDevices.map((device) => (
                                    <TableRow key={device.instance_id} hover>
                                        <TableCell>
                                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                                {device.name}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{device.class}</TableCell>
                                        <TableCell>{device.manufacturer}</TableCell>
                                        <TableCell>{renderStatus(device.status)}</TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="success"
                                                    startIcon={<PowerIcon />}
                                                    disabled={device.status === 'OK' || actionLoading === device.instance_id}
                                                    onClick={() => handleDeviceAction('enable', device.instance_id)}
                                                >
                                                    Activer
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="error"
                                                    startIcon={<PowerSettingsNewIcon />}
                                                    disabled={device.status === 'Disabled' || actionLoading === device.instance_id}
                                                    onClick={() => handleDeviceAction('disable', device.instance_id)}
                                                >
                                                    Désactiver
                                                </Button>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </InfoCard>
        </PageLayout>
    );
};

export default DevicesPage; 