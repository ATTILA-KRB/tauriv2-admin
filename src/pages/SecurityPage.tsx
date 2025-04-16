import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import PageLayout from '../components/PageLayout';
import HomeCard from '../components/HomeCard';

// Material UI
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import { Grid } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Badge from '@mui/material/Badge';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';

// Icons
import SecurityIcon from '@mui/icons-material/Security';
import ShieldIcon from '@mui/icons-material/Shield';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import ClearIcon from '@mui/icons-material/Clear';
import GppGoodIcon from '@mui/icons-material/GppGood';
import BugReportIcon from '@mui/icons-material/BugReport';
import UpdateIcon from '@mui/icons-material/Update';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LockIcon from '@mui/icons-material/Lock';
import FilterListIcon from '@mui/icons-material/FilterList';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NetworkPingIcon from '@mui/icons-material/NetworkPing';
import BlockIcon from '@mui/icons-material/Block';
import LayersIcon from '@mui/icons-material/Layers';
import SettingsIcon from '@mui/icons-material/Settings';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import PublicIcon from '@mui/icons-material/Public';
import FireplaceIcon from '@mui/icons-material/Fireplace';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import TableRowsIcon from '@mui/icons-material/TableRows';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';

// Interface pour les règles de pare-feu
interface FirewallRuleInfo {
    name: string;
    enabled: boolean;
    direction: string;
    action: string;
    profile: string;
}

// Interface pour l'état de l'antivirus
interface AntivirusStatusInfo {
    antispyware_enabled: boolean;
    real_time_protection_enabled: boolean;
    antivirus_signature_version: string;
    nis_signature_version: string;
    last_full_scan_end_time: string;
}

const SecurityPage: React.FC = () => {
    // États pour les règles
    const [rules, setRules] = useState<FirewallRuleInfo[]>([]);
    const [rulesLoading, setRulesLoading] = useState<boolean>(true);
    const [rulesError, setRulesError] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>("");

    // États pour l'antivirus
    const [avStatus, setAvStatus] = useState<AntivirusStatusInfo | null>(null);
    const [avLoading, setAvLoading] = useState<boolean>(true);
    const [avError, setAvError] = useState<string | null>(null);

    // Nouvel état pour le filtrage avancé
    const [activeTab, setActiveTab] = useState<string>("all");
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
    const [directionFilter, setDirectionFilter] = useState<string | null>(null);
    const [actionFilter, setActionFilter] = useState<string | null>(null);
    const [compactView, setCompactView] = useState<boolean>(false);

    // Charger les règles de pare-feu
    const fetchFirewallRules = () => {
        setRulesLoading(true);
        setRulesError(null);
        invoke<FirewallRuleInfo[]>('list_firewall_rules')
            .then(data => {
                data.sort((a, b) => a.name.localeCompare(b.name));
                setRules(data);
            })
            .catch(err => {
                console.error("Erreur règles pare-feu:", err);
                setRulesError(typeof err === 'string' ? err : 'Erreur inconnue (règles).');
            })
            .finally(() => setRulesLoading(false));
    };

    // Charger l'état de l'antivirus
    const fetchAntivirusStatus = () => {
        setAvLoading(true);
        setAvError(null);
        invoke<AntivirusStatusInfo>('get_antivirus_status')
            .then(data => {
                setAvStatus(data);
            })
            .catch(err => {
                console.error("Erreur état antivirus:", err);
                setAvError(typeof err === 'string' ? err : 'Erreur inconnue (antivirus).');
            })
            .finally(() => setAvLoading(false));
    };

    // Chargement initial
    useEffect(() => {
        fetchFirewallRules();
        fetchAntivirusStatus();
    }, []);

    // Filtrer les règles avec filtres multiples
    const filteredRules = rules.filter(rule => {
        // Filtre texte
        const textMatch = filter === "" || 
            rule.name.toLowerCase().includes(filter.toLowerCase()) ||
            rule.action.toLowerCase().includes(filter.toLowerCase()) ||
            rule.direction.toLowerCase().includes(filter.toLowerCase()) ||
            rule.profile.toLowerCase().includes(filter.toLowerCase());
            
        // Filtre onglet
        const tabMatch = 
            activeTab === "all" || 
            (activeTab === "enabled" && rule.enabled) ||
            (activeTab === "disabled" && !rule.enabled) ||
            (activeTab === "inbound" && rule.direction.toLowerCase() === "inbound") ||
            (activeTab === "outbound" && rule.direction.toLowerCase() === "outbound") ||
            (activeTab === "allow" && rule.action.toLowerCase() === "allow") ||
            (activeTab === "block" && rule.action.toLowerCase() === "block");
            
        // Filtres direction et action
        const directionMatch = !directionFilter || rule.direction.toLowerCase() === directionFilter.toLowerCase();
        const actionMatch = !actionFilter || rule.action.toLowerCase() === actionFilter.toLowerCase();
        
        return textMatch && tabMatch && directionMatch && actionMatch;
    });
    
    // Calculer les statistiques
    const stats = {
        total: rules.length,
        enabled: rules.filter(r => r.enabled).length,
        disabled: rules.filter(r => !r.enabled).length,
        inbound: rules.filter(r => r.direction.toLowerCase() === "inbound").length,
        outbound: rules.filter(r => r.direction.toLowerCase() === "outbound").length,
        allow: rules.filter(r => r.action.toLowerCase() === "allow").length,
        block: rules.filter(r => r.action.toLowerCase() === "block").length
    };
    
    // Gérer les changements d'onglet
    const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
        setActiveTab(newValue);
    };
    
    // Gérer les changements de filtre direction
    const handleDirectionFilterChange = (
        _event: React.MouseEvent<HTMLElement>,
        newDirection: string | null,
    ) => {
        setDirectionFilter(newDirection);
    };
    
    // Gérer les changements de filtre action
    const handleActionFilterChange = (
        _event: React.MouseEvent<HTMLElement>,
        newAction: string | null,
    ) => {
        setActionFilter(newAction);
    };
    
    // Helper pour obtenir l'icône de direction
    const getDirectionIcon = (direction: string) => {
        return direction.toLowerCase() === "inbound" 
            ? <ArrowForwardIcon fontSize="small" />
            : <ArrowBackIcon fontSize="small" />;
    };
    
    // Helper pour obtenir l'icône d'action
    const getActionIcon = (action: string) => {
        return action.toLowerCase() === "allow" 
            ? <CheckCircleIcon fontSize="small" />
            : <BlockIcon fontSize="small" />;
    };
    
    // Rendu de la vue carte pour une règle
    const renderRuleCard = (rule: FirewallRuleInfo, index: number) => {
        const isInbound = rule.direction.toLowerCase() === "inbound";
        const isAllowed = rule.action.toLowerCase() === "allow";
        
        return (
            <Card 
                key={index}
                elevation={0}
                sx={{
                    mb: 1.5,
                    borderRadius: 2,
                    border: theme => `1px solid ${
                        theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                    }`,
                    transition: 'all 0.2s',
                    '&:hover': {
                        boxShadow: '0 4px 8px rgba(0,0,0,0.05)',
                        transform: 'translateY(-2px)'
                    },
                    opacity: rule.enabled ? 1 : 0.7,
                    bgcolor: theme => 
                        isAllowed 
                            ? (theme.palette.mode === 'dark' ? 'rgba(46, 125, 50, 0.1)' : 'rgba(46, 125, 50, 0.05)')
                            : (theme.palette.mode === 'dark' ? 'rgba(211, 47, 47, 0.1)' : 'rgba(211, 47, 47, 0.05)')
                }}
            >
                <CardContent sx={{ p: compactView ? 1.5 : 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: compactView ? 0.5 : 1, flex: 1 }}>
                            <Avatar 
                                sx={{ 
                                    width: compactView ? 32 : 40, 
                                    height: compactView ? 32 : 40,
                                    bgcolor: isInbound
                                        ? 'primary.main'
                                        : 'secondary.main',
                                }}
                            >
                                {isInbound ? <ArrowForwardIcon /> : <ArrowBackIcon />}
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                                <Typography 
                                    variant={compactView ? "body2" : "subtitle1"} 
                                    component="div" 
                                    sx={{ 
                                        fontWeight: 'medium',
                                        width: '100%',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    {rule.name}
                                </Typography>
                                
                                {!compactView && (
                                    <Typography variant="caption" color="text.secondary" component="div">
                                        {rule.profile}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                        
                        <Chip 
                            icon={getActionIcon(rule.action)}
                            label={rule.action}
                            color={getActionColor(rule.action) as "success" | "error" | "default"}
                            size="small"
                            variant={rule.enabled ? "filled" : "outlined"}
                            sx={{ borderRadius: '6px', minWidth: 72 }}
                        />
                    </Box>
                    
                    {!compactView && (
                        <Box sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            mt: 1.5 
                        }}>
                            <Stack direction="row" spacing={1}>
                                <Chip 
                                    label={rule.direction} 
                                    size="small" 
                                    color={isInbound ? "primary" : "secondary"}
                                    variant="outlined"
                                    icon={getDirectionIcon(rule.direction)}
                                    sx={{ borderRadius: '6px', height: 24 }}
                                />
                                
                                {rule.profile.split(', ').map((profile, i) => (
                                    <Chip 
                                        key={i}
                                        label={profile}
                                        size="small"
                                        variant="outlined"
                                        sx={{ 
                                            borderRadius: '6px', 
                                            height: 24,
                                            '& .MuiChip-label': { px: 1 }
                                        }}
                                    />
                                ))}
                            </Stack>
                            
                            <Typography 
                                variant="caption" 
                                sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    color: rule.enabled ? 'success.main' : 'text.disabled' 
                                }}
                            >
                                {rule.enabled ? <CheckCircleIcon fontSize="small" sx={{ mr: 0.5 }} /> : <CancelIcon fontSize="small" sx={{ mr: 0.5 }} />}
                                {rule.enabled ? 'Activée' : 'Désactivée'}
                            </Typography>
                        </Box>
                    )}
                </CardContent>
            </Card>
        );
    };

    // Helper pour rendre un statut booléen
    const renderStatusChip = (isEnabled: boolean) => {
        return isEnabled ? 
            <Chip 
                icon={<CheckCircleIcon />} 
                label="Activée" 
                color="success" 
                size="small" 
                variant="filled"
                sx={{ borderRadius: '6px' }}
            /> : 
            <Chip 
                icon={<CancelIcon />} 
                label="Désactivée" 
                color="error" 
                size="small" 
                variant="outlined"
                sx={{ borderRadius: '6px' }}
            />;
    };

    // Helper pour obtenir la couleur appropriée pour l'action
    const getActionColor = (action: string) => {
        switch(action.toLowerCase()) {
            case 'allow': return 'success';
            case 'block': return 'error';
            default: return 'default';
        }
    };

    return (
        <PageLayout 
            title="Sécurité" 
            icon={<SecurityIcon />}
            description="Gestion des paramètres de sécurité Windows"
        >
            <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                    <HomeCard 
                        title="Microsoft Defender" 
                        icon={<ShieldIcon />}
                        isLoading={avLoading}
                        error={avError}
                        avatarColor="success.main"
                        accentColor="#2e7d32"
                        variant="gradient"
                        headerActions={
                            <Tooltip title="Rafraîchir">
                                <IconButton 
                                    onClick={fetchAntivirusStatus} 
                                    disabled={avLoading}
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
                        {avStatus && (
                            <Box sx={{ p: 2 }}>
                                <Box 
                                    sx={{ 
                                        p: 2, 
                                        mb: 2, 
                                        borderRadius: 2, 
                                        bgcolor: theme => theme.palette.mode === 'dark' ? 
                                            'rgba(0, 200, 83, 0.12)' : 'rgba(0, 200, 83, 0.08)'
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                        <GppGoodIcon 
                                            color={avStatus.real_time_protection_enabled ? "success" : "error"} 
                                            sx={{ fontSize: 28 }} 
                                        />
                                        <Box>
                                            <Typography variant="subtitle2">Protection temps réel</Typography>
                                            <Typography 
                                                variant="body2" 
                                                color={avStatus.real_time_protection_enabled ? "success.main" : "error"}
                                                sx={{ fontWeight: 'bold' }}
                                            >
                                                {avStatus.real_time_protection_enabled ? 'ACTIVÉE' : 'DÉSACTIVÉE'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <BugReportIcon 
                                            color={avStatus.antispyware_enabled ? "success" : "error"} 
                                            sx={{ fontSize: 28 }}
                                        />
                                        <Box>
                                            <Typography variant="subtitle2">Protection anti-spyware</Typography>
                                            <Typography 
                                                variant="body2" 
                                                color={avStatus.antispyware_enabled ? "success.main" : "error"}
                                                sx={{ fontWeight: 'bold' }}
                                            >
                                                {avStatus.antispyware_enabled ? 'ACTIVÉE' : 'DÉSACTIVÉE'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                                
                                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                                    Informations de signature
                                </Typography>
                                
                                <Box 
                                    sx={{ 
                                        p: 2, 
                                        borderRadius: 2, 
                                        bgcolor: theme => theme.palette.mode === 'dark' ? 
                                            'rgba(25, 118, 210, 0.12)' : 'rgba(25, 118, 210, 0.08)'
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                        <UpdateIcon color="primary" sx={{ fontSize: 24 }} />
                                        <Box>
                                            <Typography variant="subtitle2">Signatures Antivirus</Typography>
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                {avStatus.antivirus_signature_version}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                        <UpdateIcon color="primary" sx={{ fontSize: 24 }} />
                                        <Box>
                                            <Typography variant="subtitle2">Signatures NIS</Typography>
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                {avStatus.nis_signature_version}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <CalendarTodayIcon color="primary" sx={{ fontSize: 24 }} />
                                        <Box>
                                            <Typography variant="subtitle2">Dernier scan complet</Typography>
                                            <Typography variant="body2">
                                                {avStatus.last_full_scan_end_time}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>
                        )}
                    </HomeCard>
                </Grid>
                
                <Grid item xs={12} md={8}>
                    <HomeCard 
                        title="Règles du Pare-feu Windows" 
                        icon={<FireplaceIcon />}
                        isLoading={rulesLoading}
                        error={rulesError}
                        avatarColor="info.main"
                        accentColor="#0288d1"
                        variant="gradient"
                        headerActions={
                            <Tooltip title="Rafraîchir">
                                <IconButton 
                                    onClick={fetchFirewallRules} 
                                    disabled={rulesLoading}
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
                            {/* Statistiques */}
                            {!rulesLoading && rules.length > 0 && (
                                <Box sx={{ mb: 3 }}>
                                    <Grid container spacing={2}>
                                        <Grid item xs={4}>
                                            <Card elevation={0} sx={{ 
                                                p: 1.5, 
                                                textAlign: 'center',
                                                borderRadius: 2,
                                                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                                            }}>
                                                <Typography variant="h4" color="info.main" fontWeight="bold">
                                                    {stats.total}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Règles totales
                                                </Typography>
                                            </Card>
                                        </Grid>
                                        <Grid item xs={4}>
                                            <Card elevation={0} sx={{ 
                                                p: 1.5, 
                                                textAlign: 'center',
                                                borderRadius: 2, 
                                                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.05)',
                                            }}>
                                                <Typography variant="h4" color="success.main" fontWeight="bold">
                                                    {stats.enabled}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Règles activées
                                                </Typography>
                                            </Card>
                                        </Grid>
                                        <Grid item xs={4}>
                                            <Card elevation={0} sx={{ 
                                                p: 1.5, 
                                                textAlign: 'center',
                                                borderRadius: 2,
                                                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(211, 47, 47, 0.1)' : 'rgba(211, 47, 47, 0.05)',
                                            }}>
                                                <Typography variant="h4" color="error.main" fontWeight="bold">
                                                    {stats.disabled}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Règles désactivées
                                                </Typography>
                                            </Card>
                                        </Grid>
                                    </Grid>
                                </Box>
                            )}
                            
                            {/* Filtres et recherche */}
                            <Box sx={{ mb: 2 }}>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={8}>
                                        <TextField
                                            fullWidth
                                            variant="outlined"
                                            placeholder="Rechercher une règle..."
                                            value={filter}
                                            onChange={(e) => setFilter(e.target.value)}
                                            size="small"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: '12px',
                                                    transition: 'all 0.3s',
                                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'info.main',
                                                    },
                                                }
                                            }}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <SearchIcon color="info" />
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
                                    </Grid>
                                    
                                    <Grid item xs={12} md={4}>
                                        <Box sx={{ display: 'flex', gap: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' }}>
                                            <Tooltip title="Vue compacte">
                                                <FormControlLabel
                                                    control={
                                                        <Switch 
                                                            checked={compactView} 
                                                            onChange={(e) => setCompactView(e.target.checked)}
                                                            size="small"
                                                        />
                                                    }
                                                    label={<Typography variant="body2">Compact</Typography>}
                                                    labelPlacement="start"
                                                    sx={{ mr: 1 }}
                                                />
                                            </Tooltip>
                                            
                                            <Tooltip title="Mode d'affichage">
                                                <ToggleButtonGroup
                                                    value={viewMode}
                                                    exclusive
                                                    onChange={(_e, newMode) => newMode && setViewMode(newMode)}
                                                    size="small"
                                                >
                                                    <ToggleButton value="cards">
                                                        <Tooltip title="Vue cartes">
                                                            <LayersIcon fontSize="small" />
                                                        </Tooltip>
                                                    </ToggleButton>
                                                    <ToggleButton value="table">
                                                        <Tooltip title="Vue tableau">
                                                            <TableRowsIcon fontSize="small" />
                                                        </Tooltip>
                                                    </ToggleButton>
                                                </ToggleButtonGroup>
                                            </Tooltip>
                                        </Box>
                                    </Grid>
                                </Grid>
                                
                                {/* Onglets de catégories */}
                                <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
                                    <Tabs 
                                        value={activeTab} 
                                        onChange={handleTabChange}
                                        variant="scrollable"
                                        scrollButtons="auto"
                                    >
                                        <Tab 
                                            icon={<Badge badgeContent={stats.total} color="info" showZero sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}>
                                                <DoneAllIcon fontSize="small" />
                                            </Badge>} 
                                            label="Toutes" 
                                            value="all" 
                                        />
                                        <Tab 
                                            icon={<Badge badgeContent={stats.enabled} color="success" showZero sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}>
                                                <CheckCircleIcon fontSize="small" />
                                            </Badge>} 
                                            label="Actives" 
                                            value="enabled" 
                                        />
                                        <Tab 
                                            icon={<Badge badgeContent={stats.disabled} color="error" showZero sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}>
                                                <CancelIcon fontSize="small" />
                                            </Badge>} 
                                            label="Inactives" 
                                            value="disabled" 
                                        />
                                        <Tab 
                                            icon={<Badge badgeContent={stats.inbound} color="primary" showZero sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}>
                                                <ArrowForwardIcon fontSize="small" />
                                            </Badge>} 
                                            label="Entrantes" 
                                            value="inbound" 
                                        />
                                        <Tab 
                                            icon={<Badge badgeContent={stats.outbound} color="secondary" showZero sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}>
                                                <ArrowBackIcon fontSize="small" />
                                            </Badge>} 
                                            label="Sortantes" 
                                            value="outbound" 
                                        />
                                        <Tab 
                                            icon={<Badge badgeContent={stats.allow} color="success" showZero sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}>
                                                <CheckCircleIcon fontSize="small" />
                                            </Badge>} 
                                            label="Autorisées" 
                                            value="allow" 
                                        />
                                        <Tab 
                                            icon={<Badge badgeContent={stats.block} color="error" showZero sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}>
                                                <BlockIcon fontSize="small" />
                                            </Badge>} 
                                            label="Bloquées" 
                                            value="block" 
                                        />
                                    </Tabs>
                                </Box>
                                
                                {/* Filtres supplémentaires */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 2 }}>
                                    <ToggleButtonGroup
                                        value={directionFilter}
                                        exclusive
                                        onChange={handleDirectionFilterChange}
                                        size="small"
                                        aria-label="Direction"
                                    >
                                        <ToggleButton value="inbound" color="primary">
                                            <ArrowForwardIcon fontSize="small" sx={{ mr: 0.5 }} />
                                            Entrantes
                                        </ToggleButton>
                                        <ToggleButton value="outbound" color="secondary">
                                            <ArrowBackIcon fontSize="small" sx={{ mr: 0.5 }} />
                                            Sortantes
                                        </ToggleButton>
                                    </ToggleButtonGroup>
                                    
                                    <ToggleButtonGroup
                                        value={actionFilter}
                                        exclusive
                                        onChange={handleActionFilterChange}
                                        size="small"
                                        aria-label="Action"
                                    >
                                        <ToggleButton value="allow" color="success">
                                            <CheckCircleIcon fontSize="small" sx={{ mr: 0.5 }} />
                                            Autorisées
                                        </ToggleButton>
                                        <ToggleButton value="block" color="error">
                                            <BlockIcon fontSize="small" sx={{ mr: 0.5 }} />
                                            Bloquées
                                        </ToggleButton>
                                    </ToggleButtonGroup>
                                </Box>
                            </Box>
                            
                            {/* Contenu principal */}
                            {rulesLoading && rules.length > 0 ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                                    <CircularProgress size={40} color="info" />
                                </Box>
                            ) : filteredRules.length === 0 ? (
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
                                        {filter ? "Aucune règle ne correspond aux critères de recherche" : "Aucune règle trouvée"}
                                    </Typography>
                                </Box>
                            ) : viewMode === 'cards' ? (
                                <Box>
                                    {filteredRules.map((rule, index) => renderRuleCard(rule, index))}
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
                                                <TableCell><Typography variant="subtitle2">Nom</Typography></TableCell>
                                                <TableCell><Typography variant="subtitle2">État</Typography></TableCell>
                                                <TableCell><Typography variant="subtitle2">Direction</Typography></TableCell>
                                                <TableCell><Typography variant="subtitle2">Action</Typography></TableCell>
                                                <TableCell><Typography variant="subtitle2">Profil</Typography></TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {filteredRules.map((rule, index) => (
                                                <TableRow 
                                                    key={index} 
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
                                                            <LockIcon color="info" fontSize="small" />
                                                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                                                {rule.name}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell>{renderStatusChip(rule.enabled)}</TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={rule.direction} 
                                                            size="small" 
                                                            color="primary"
                                                            variant="outlined"
                                                            icon={getDirectionIcon(rule.direction)}
                                                            sx={{ borderRadius: '6px' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={rule.action} 
                                                            size="small" 
                                                            color={getActionColor(rule.action) as "success" | "error" | "default"}
                                                            variant="outlined"
                                                            icon={getActionIcon(rule.action)}
                                                            sx={{ borderRadius: '6px' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>{rule.profile}</TableCell>
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
            
            {/* Légende */}
            <Box sx={{ mt: 4 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Légende</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip icon={<CheckCircleIcon />} label="Activée" color="success" size="small" />
                        <Typography variant="body2">Règle activée</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip icon={<CancelIcon />} label="Désactivée" color="error" size="small" variant="outlined" />
                        <Typography variant="body2">Règle désactivée</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label="Allow" color="success" size="small" variant="outlined" />
                        <Typography variant="body2">Trafic autorisé</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label="Block" color="error" size="small" variant="outlined" />
                        <Typography variant="body2">Trafic bloqué</Typography>
                    </Box>
                </Box>
            </Box>
        </PageLayout>
    );
};

export default SecurityPage; 