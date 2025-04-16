import React, { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { 
    Box, 
    Drawer, 
    List, 
    ListItem, 
    ListItemButton, 
    ListItemIcon, 
    ListItemText, 
    Toolbar, 
    Tooltip, 
    Divider, 
    Typography, 
    Collapse,
    IconButton,
    useTheme,
    alpha
} from '@mui/material';

// Importer les icônes MUI
import HomeIcon from '@mui/icons-material/Home';
import StorageIcon from '@mui/icons-material/Storage';
import MemoryIcon from '@mui/icons-material/Memory';
import HubIcon from '@mui/icons-material/Hub'; // Pour Réseau
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import UpdateIcon from '@mui/icons-material/Update';
import BackupIcon from '@mui/icons-material/Backup';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial'; // Pour AD
import EventNoteIcon from '@mui/icons-material/EventNote';
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent'; // Pour Périphériques
import TaskIcon from '@mui/icons-material/Task';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import DnsIcon from '@mui/icons-material/Dns'; // Services
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import SystemSecurityUpdateGoodIcon from '@mui/icons-material/SystemSecurityUpdateGood';
import SettingsIcon from '@mui/icons-material/Settings';
import DataUsageIcon from '@mui/icons-material/DataUsage';

const drawerWidth = 260;
const drawerCollapsedWidth = 70;

// Définir les catégories pour les sections
interface SidebarSection {
    text: string;
    icon: React.ReactElement;
    path: string;
    category: 'main' | 'system' | 'storage' | 'security' | 'network';
    badge?: {
        count?: number;
        color: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
    };
}

// Regrouper les sections par catégorie
const sidebarSections: SidebarSection[] = [
    // Principale
    { text: 'Accueil', icon: <HomeIcon />, path: '/', category: 'main' },
    { text: 'Mise à jour', icon: <SystemUpdateIcon />, path: '/app-update', category: 'main', badge: { count: 1, color: 'info' } },
    
    // Système
    { text: 'Processus', icon: <MemoryIcon />, path: '/processes', category: 'system' },
    { text: 'Services', icon: <DnsIcon />, path: '/services', category: 'system' },
    { text: 'Tâches', icon: <TaskIcon />, path: '/tasks', category: 'system' },
    { text: 'Périphériques', icon: <SettingsInputComponentIcon />, path: '/devices', category: 'system' },
    
    // Stockage
    { text: 'Disques', icon: <StorageIcon />, path: '/disks', category: 'storage' },
    { text: 'Partages', icon: <FolderSharedIcon />, path: '/shares', category: 'storage' },
    { text: 'Sauvegarde', icon: <BackupIcon />, path: '/backup', category: 'storage' },
    
    // Sécurité
    { text: 'Utilisateurs', icon: <PeopleIcon />, path: '/users', category: 'security' },
    { text: 'Sécurité', icon: <SecurityIcon />, path: '/security', category: 'security', badge: { count: 2, color: 'warning' } },
    { text: 'Mises à jour', icon: <UpdateIcon />, path: '/updates', category: 'security', badge: { count: 3, color: 'error' } },
    { text: 'Événements', icon: <EventNoteIcon />, path: '/events', category: 'security' },
    
    // Réseau et AD
    { text: 'Réseau', icon: <HubIcon />, path: '/network', category: 'network' },
    { text: 'Active Directory', icon: <FolderSpecialIcon />, path: '/ad', category: 'network' },
];

// Titres des catégories
const categoryTitles: Record<string, {title: string, icon: React.ReactElement}> = {
    main: { title: 'Principal', icon: <HomeIcon fontSize="small" /> },
    system: { title: 'Système', icon: <SystemUpdateIcon fontSize="small" /> },
    storage: { title: 'Stockage', icon: <DataUsageIcon fontSize="small" /> },
    security: { title: 'Sécurité', icon: <SystemSecurityUpdateGoodIcon fontSize="small" /> },
    network: { title: 'Réseau', icon: <HubIcon fontSize="small" /> },
};

const Sidebar: React.FC = () => {
    const location = useLocation();
    const theme = useTheme();
    const [collapsed, setCollapsed] = useState<boolean>(false);
    
    // État pour les catégories dépliées/repliées
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
        main: true,
        system: true,
        storage: true,
        security: true,
        network: true
    });
    
    // Fonction pour basculer l'état d'une catégorie
    const toggleCategory = (category: string) => {
        setExpandedCategories({
            ...expandedCategories,
            [category]: !expandedCategories[category]
        });
    };
    
    // Regrouper les sections par catégorie
    const sectionsByCategory = sidebarSections.reduce<Record<string, SidebarSection[]>>((acc, section) => {
        if (!acc[section.category]) {
            acc[section.category] = [];
        }
        acc[section.category].push(section);
        return acc;
    }, {});
    
    // Style spécial pour les liens actifs
    const getActiveStyle = (path: string) => {
        const isActive = location.pathname === path;
        return {
            backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.15) : 'transparent',
            borderLeft: isActive ? `4px solid ${theme.palette.primary.main}` : '4px solid transparent',
            paddingLeft: isActive ? '12px' : '16px',
            borderRadius: '0 8px 8px 0',
            transition: 'all 0.2s ease',
            '&:hover': {
                backgroundColor: isActive 
                    ? alpha(theme.palette.primary.main, 0.2)
                    : alpha(theme.palette.action.hover, 0.1),
                borderLeft: isActive 
                    ? `4px solid ${theme.palette.primary.main}`
                    : `4px solid ${alpha(theme.palette.primary.main, 0.3)}`
            }
        };
    };

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: collapsed ? drawerCollapsedWidth : drawerWidth,
                flexShrink: 0,
                transition: 'width 0.2s ease',
                [`& .MuiDrawer-paper`]: { 
                    width: collapsed ? drawerCollapsedWidth : drawerWidth, 
                    boxSizing: 'border-box',
                    transition: 'width 0.2s ease',
                    overflowX: 'hidden',
                    borderRight: `1px solid ${theme.palette.divider}`,
                    backgroundColor: 
                        theme.palette.mode === 'dark'
                            ? alpha(theme.palette.background.paper, 0.9)
                            : alpha(theme.palette.background.paper, 0.98),
                    boxShadow: '0 0 10px 0 rgba(0, 0, 0, 0.05)'
                },
            }}
        >
            <Toolbar /> {/* Pour l'espacement sous une éventuelle AppBar */} 
            
            {/* Bouton pour réduire/agrandir la sidebar */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    p: 1
                }}
            >
                <Tooltip title={collapsed ? "Agrandir" : "Réduire"} arrow placement="right">
                    <IconButton
                        onClick={() => setCollapsed(!collapsed)}
                        sx={{ 
                            borderRadius: '50%',
                            bgcolor: alpha(theme.palette.primary.main, 0.12),
                            color: theme.palette.primary.main,
                            '&:hover': {
                                bgcolor: alpha(theme.palette.primary.main, 0.25),
                            },
                            transition: 'all 0.15s ease'
                        }}
                    >
                        {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                    </IconButton>
                </Tooltip>
            </Box>
            
            <Box sx={{ overflow: 'auto' }}>
                {/* Afficher les sections par catégorie */}
                {Object.entries(sectionsByCategory).map(([category, sections]) => (
                    <React.Fragment key={category}>
                        {/* En-tête de catégorie */}
                        <Box 
                            sx={{ 
                                display: 'flex', 
                                alignItems: 'center',
                                p: collapsed ? 1 : 1.5,
                                justifyContent: collapsed ? 'center' : 'space-between',
                                cursor: 'pointer',
                                mt: 0.5
                            }}
                            onClick={() => !collapsed && toggleCategory(category)}
                        >
                            {!collapsed && (
                                <>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {categoryTitles[category].icon}
                                        <Typography 
                                            variant="subtitle2" 
                                            sx={{ 
                                                color: theme.palette.text.secondary,
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                fontSize: '0.75rem',
                                                letterSpacing: '0.8px'
                                            }}
                                        >
                                            {categoryTitles[category].title}
                                        </Typography>
                                    </Box>
                                    <IconButton 
                                        size="small" 
                                        sx={{ p: 0.2, color: theme.palette.text.secondary }}
                                    >
                                        {expandedCategories[category] ? 
                                            <ExpandLessIcon fontSize="small" /> : 
                                            <ExpandMoreIcon fontSize="small" />}
                                    </IconButton>
                                </>
                            )}
                            {collapsed && (
                                <Tooltip title={categoryTitles[category].title} arrow placement="right">
                                    <Box sx={{ 
                                        display: 'flex', 
                                        justifyContent: 'center', 
                                        p: 0.5,
                                        color: theme.palette.text.secondary
                                    }}>
                                        {categoryTitles[category].icon}
                                    </Box>
                                </Tooltip>
                            )}
                        </Box>
                        
                        {/* Liste des sections de cette catégorie */}
                        <Collapse in={expandedCategories[category] || collapsed} timeout="auto">
                            <List disablePadding>
                                {sections.map((item) => (
                                    <ListItem 
                                        key={item.text} 
                                        disablePadding
                                        sx={{ 
                                            display: 'block',
                                            mb: 0.5,
                                            px: 1.5
                                        }}
                                    >
                                        <Tooltip
                                            title={collapsed ? item.text : ""}
                                            placement="right"
                                            arrow
                                            disableHoverListener={!collapsed}
                                        >
                                            <ListItemButton
                                                component={RouterLink}
                                                to={item.path}
                                                sx={{
                                                    minHeight: 42,
                                                    px: collapsed ? 2 : 2,
                                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                                    ...getActiveStyle(item.path)
                                                }}
                                            >
                                                <ListItemIcon
                                                    sx={{
                                                        minWidth: 0,
                                                        mr: collapsed ? 0 : 2,
                                                        justifyContent: 'center',
                                                        color: location.pathname === item.path 
                                                            ? theme.palette.primary.main 
                                                            : theme.palette.text.secondary
                                                    }}
                                                >
                                                    {item.icon}
                                                </ListItemIcon>
                                                {!collapsed && (
                                                    <ListItemText 
                                                        primary={
                                                            <Typography 
                                                                variant="body2" 
                                                                sx={{ 
                                                                    fontWeight: location.pathname === item.path ? 600 : 400,
                                                                    color: location.pathname === item.path 
                                                                        ? theme.palette.primary.main 
                                                                        : theme.palette.text.primary
                                                                }}
                                                            >
                                                                {item.text}
                                                            </Typography>
                                                        } 
                                                    />
                                                )}
                                                {!collapsed && item.badge && (
                                                    <Box 
                                                        sx={{ 
                                                            ml: 1, 
                                                            bgcolor: item.badge.color + '.main', 
                                                            color: 'white',
                                                            borderRadius: '50%',
                                                            width: 20,
                                                            height: 20,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 'bold'
                                                        }}
                                                    >
                                                        {item.badge.count}
                                                    </Box>
                                                )}
                                            </ListItemButton>
                                        </Tooltip>
                                    </ListItem>
                                ))}
                            </List>
                        </Collapse>
                        <Divider sx={{ my: 1, mx: collapsed ? 1 : 2, opacity: 0.6 }} />
                    </React.Fragment>
                ))}
            </Box>
        </Drawer>
    );
};

export default Sidebar; 