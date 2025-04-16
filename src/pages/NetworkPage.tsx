import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import PageLayout from '../components/PageLayout';
import HomeCard from '../components/HomeCard';

// Material UI
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';

// Icons
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import WifiIcon from '@mui/icons-material/Wifi';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import DnsIcon from '@mui/icons-material/Dns';
import RouterIcon from '@mui/icons-material/Router';
import LanguageIcon from '@mui/icons-material/Language';
import RefreshIcon from '@mui/icons-material/Refresh';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';
import IpIcon from '@mui/icons-material/Lan';
import MacIcon from '@mui/icons-material/Memory';
import CableIcon from '@mui/icons-material/Cable';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';

// Interface correspondant à la structure Rust NetworkAdapterInfo
interface NetworkAdapterInfo {
    name: string;
    description: string;
    mac_address: string;
    status: string;
    ip_addresses: string[];
    dns_servers: string[];
    gateway: string;
}

const NetworkPage: React.FC = () => {
    const [adapters, setAdapters] = useState<NetworkAdapterInfo[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchNetworkInfo = () => {
        setIsLoading(true);
        setError(null);
        invoke<NetworkAdapterInfo[]>('list_network_adapters')
            .then(data => {
                // Filtrer les adaptateurs pour ne garder que ceux qui ont des infos pertinentes
                const filteredAdapters = data.filter(adapter => 
                    adapter.ip_addresses.length > 0 || 
                    adapter.status === "Up" || 
                    adapter.status === "Connected"
                );
                
                // Trier par statut (actifs en premier)
                filteredAdapters.sort((a, b) => {
                    if ((a.status === "Up" || a.status === "Connected") && 
                        (b.status !== "Up" && b.status !== "Connected")) {
                        return -1;
                    }
                    if ((b.status === "Up" || b.status === "Connected") && 
                        (a.status !== "Up" && a.status !== "Connected")) {
                        return 1;
                    }
                    return a.name.localeCompare(b.name);
                });
                
                setAdapters(filteredAdapters);
            })
            .catch(err => {
                console.error("Erreur lors de la récupération des adaptateurs réseau:", err);
                setError(typeof err === 'string' ? err : 'Erreur inconnue lors de la récupération des adaptateurs réseau.');
            })
            .finally(() => setIsLoading(false));
    };

    // Chargement initial
    useEffect(() => {
        fetchNetworkInfo();
    }, []);

    // Fonction pour déterminer l'icône appropriée en fonction du nom/description de l'adaptateur
    const getAdapterIcon = (adapter: NetworkAdapterInfo) => {
        const name = adapter.name.toLowerCase();
        const desc = adapter.description.toLowerCase();
        
        if (name.includes('wifi') || desc.includes('wifi') || desc.includes('wireless')) {
            return adapter.status === 'Up' || adapter.status === 'Connected' 
                ? <WifiIcon /> 
                : <SignalWifiOffIcon />;
        } else if (name.includes('ethernet') || desc.includes('ethernet')) {
            return <SettingsEthernetIcon />;
        } else if (name.includes('virtual') || desc.includes('virtual')) {
            return <DeviceHubIcon />;
        } else if (name.includes('loopback') || desc.includes('loopback')) {
            return <LanguageIcon />;
        } else {
            return <CableIcon />;
        }
    };

    // Détermine la couleur du statut
    const getStatusColor = (status: string): "success" | "error" | "warning" | "default" => {
        if (status === 'Up' || status === 'Connected') return "success";
        if (status === 'Down') return "error";
        return "warning";
    };

    return (
        <PageLayout
            title="Configuration Réseau"
            icon={<NetworkCheckIcon />}
            description="Gestion et suivi des interfaces réseau"
        >
            <HomeCard
                title="Interfaces Réseau"
                icon={<RouterIcon />}
                isLoading={isLoading}
                error={error}
                variant="gradient"
                avatarColor="primary.main"
                accentColor="#1976d2"
                headerActions={
                    <Tooltip title="Rafraîchir" arrow>
                        <IconButton 
                            onClick={fetchNetworkInfo} 
                            disabled={isLoading}
                            sx={{
                                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                                '&:hover': {
                                    bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,1)',
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
                <Box sx={{ p: 1 }}>
                    {adapters.length === 0 ? (
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
                                Aucun adaptateur réseau trouvé.
                            </Typography>
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {adapters.map((adapter, index) => (
                                <Paper
                                    key={index}
                                    elevation={2}
                                    sx={{ 
                                        borderRadius: 3,
                                        overflow: 'hidden',
                                        transition: 'transform 0.2s',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            boxShadow: 4
                                        }
                                    }}
                                >
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        p: 2,
                                        bgcolor: theme => theme.palette.mode === 'dark' 
                                            ? 'rgba(25, 118, 210, 0.1)' 
                                            : 'rgba(25, 118, 210, 0.05)',
                                        borderBottom: '1px solid',
                                        borderColor: theme => theme.palette.mode === 'dark' 
                                            ? 'rgba(255,255,255,0.1)' 
                                            : 'rgba(0,0,0,0.1)',
                                    }}>
                                        <Avatar 
                                            sx={{ 
                                                bgcolor: 'primary.main', 
                                                mr: 2,
                                                boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                                            }}
                                        >
                                            {getAdapterIcon(adapter)}
                                        </Avatar>
                                        <Box sx={{ flexGrow: 1 }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                                {adapter.name}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {adapter.description}
                                            </Typography>
                                        </Box>
                                        <Chip 
                                            label={adapter.status} 
                                            color={getStatusColor(adapter.status)} 
                                            size="small"
                                            sx={{ 
                                                fontWeight: 'bold',
                                                borderRadius: '8px',
                                                minWidth: '80px',
                                                textAlign: 'center'
                                            }}
                                        />
                                    </Box>
                                    
                                    <Box sx={{ p: 2 }}>
                                        <Box sx={{ 
                                            display: 'grid', 
                                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                                            gap: 2
                                        }}>
                                            {/* Adresse MAC */}
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Avatar sx={{ bgcolor: 'grey.200', width: 28, height: 28 }}>
                                                    <MacIcon sx={{ color: 'grey.700', fontSize: 16 }} />
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Adresse MAC
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'medium' }}>
                                                        {adapter.mac_address || 'Non disponible'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            
                                            {/* Passerelle */}
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Avatar sx={{ bgcolor: 'info.light', width: 28, height: 28 }}>
                                                    <RouterIcon sx={{ color: 'info.dark', fontSize: 16 }} />
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Passerelle
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'medium' }}>
                                                        {adapter.gateway || 'Non disponible'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                        
                                        <Divider sx={{ my: 2 }} />
                                        
                                        {/* Adresses IP */}
                                        <Box sx={{ mb: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                                                <Avatar sx={{ bgcolor: 'success.light', width: 28, height: 28 }}>
                                                    <IpIcon sx={{ color: 'success.dark', fontSize: 16 }} />
                                                </Avatar>
                                                <Typography variant="subtitle2">
                                                    Adresses IP
                                                </Typography>
                                            </Box>
                                            
                                            {adapter.ip_addresses.length > 0 ? (
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, ml: 4 }}>
                                                    {adapter.ip_addresses.map((ip, idx) => (
                                                        <Chip 
                                                            key={idx}
                                                            label={ip}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ 
                                                                borderRadius: '8px',
                                                                fontFamily: 'monospace'
                                                            }}
                                                        />
                                                    ))}
                                                </Box>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                                                    Aucune adresse IP
                                                </Typography>
                                            )}
                                        </Box>
                                        
                                        {/* Serveurs DNS */}
                                        <Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                                                <Avatar sx={{ bgcolor: 'warning.light', width: 28, height: 28 }}>
                                                    <DnsIcon sx={{ color: 'warning.dark', fontSize: 16 }} />
                                                </Avatar>
                                                <Typography variant="subtitle2">
                                                    Serveurs DNS
                                                </Typography>
                                            </Box>
                                            
                                            {adapter.dns_servers.length > 0 ? (
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, ml: 4 }}>
                                                    {adapter.dns_servers.map((dns, idx) => (
                                                        <Chip 
                                                            key={idx}
                                                            label={dns}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ 
                                                                borderRadius: '8px',
                                                                fontFamily: 'monospace'
                                                            }}
                                                        />
                                                    ))}
                                                </Box>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                                                    Aucun serveur DNS configuré
                                                </Typography>
                                            )}
                                        </Box>
                                    </Box>
                                </Paper>
                            ))}
                        </Box>
                    )}
                </Box>
            </HomeCard>
            
            {/* Légende */}
            <Box sx={{ mt: 4 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Légende</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WifiIcon color="primary" fontSize="small" />
                        <Typography variant="body2">Interface Wi-Fi</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SettingsEthernetIcon color="info" fontSize="small" />
                        <Typography variant="body2">Interface Ethernet</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label="Up" color="success" size="small" />
                        <Typography variant="body2">Interface active</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label="Down" color="error" size="small" />
                        <Typography variant="body2">Interface inactive</Typography>
                    </Box>
                </Box>
            </Box>
        </PageLayout>
    );
};

export default NetworkPage; 