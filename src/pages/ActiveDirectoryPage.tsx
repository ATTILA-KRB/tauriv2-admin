import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import PageLayout from '../components/PageLayout';
import HomeCard from '../components/HomeCard';

// Material UI
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';

// Icons
import ComputerIcon from '@mui/icons-material/Computer';
import PersonIcon from '@mui/icons-material/Person';
import SyncIcon from '@mui/icons-material/Sync';
import SearchIcon from '@mui/icons-material/Search';
import GroupIcon from '@mui/icons-material/Group';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PeopleIcon from '@mui/icons-material/People';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import RefreshIcon from '@mui/icons-material/Refresh';
import SecurityIcon from '@mui/icons-material/Security';
import DomainIcon from '@mui/icons-material/Domain';
import DevicesIcon from '@mui/icons-material/Devices';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import StorageIcon from '@mui/icons-material/Storage';
import InfoIcon from '@mui/icons-material/Info';
import GroupsIcon from '@mui/icons-material/Groups';

// Interface pour les informations AD
interface AdComputerInfo {
    is_joined: boolean;
    domain_name: string | null;
    site_name: string | null;
    logon_server: string | null;
}

// Interface pour les informations de l'utilisateur connecté
interface LoggedInUserInfo {
    user_name: string | null;
    user_domain: string | null;
}

// Interface pour les infos utilisateur AD
interface AdUserInfo {
    sam_account_name: string;
    name: string;
    enabled: boolean;
    sid: string;
}

// Interface pour les infos ordinateur AD trouvé
interface FoundAdComputerInfo {
    name: string;
    dns_host_name: string;
    enabled: boolean;
    operating_system: string;
}

// Interface pour les groupes AD
interface AdGroupInfo {
    sam_account_name: string;
    name: string;
    category: string;
    scope: string;
    sid: string;
}

// Interface pour les membres de groupe
interface AdMemberInfo {
    sam_account_name: string;
    name: string;
    object_class: string;
    sid: string;
}

const ActiveDirectoryPage: React.FC = () => {
    const [adInfo, setAdInfo] = useState<AdComputerInfo | null>(null);
    const [userInfo, setUserInfo] = useState<LoggedInUserInfo | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isGpUpdateLoading, setIsGpUpdateLoading] = useState<boolean>(false);
    const [gpUpdateMessage, setGpUpdateMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // États pour la recherche utilisateur AD
    const [searchFilter, setSearchFilter] = useState<string>("");
    const [searchResults, setSearchResults] = useState<AdUserInfo[]>([]);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    // États pour la recherche ordinateur AD
    const [computerSearchFilter, setComputerSearchFilter] = useState<string>("");
    const [computerSearchResults, setComputerSearchResults] = useState<FoundAdComputerInfo[]>([]);
    const [isComputerSearching, setIsComputerSearching] = useState<boolean>(false);
    const [computerSearchError, setComputerSearchError] = useState<string | null>(null);

    // États pour recherche groupes AD
    const [groupSearchFilter, setGroupSearchFilter] = useState<string>("");
    const [groupSearchResults, setGroupSearchResults] = useState<AdGroupInfo[]>([]);
    const [isGroupSearching, setIsGroupSearching] = useState<boolean>(false);
    const [groupSearchError, setGroupSearchError] = useState<string | null>(null);

    // États pour affichage membres/groupes
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [groupMembers, setGroupMembers] = useState<AdMemberInfo[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(false);
    const [membersError, setMembersError] = useState<string | null>(null);
    const [selectedPrincipal, setSelectedPrincipal] = useState<string | null>(null);
    const [principalGroups, setPrincipalGroups] = useState<AdGroupInfo[]>([]);
    const [isLoadingPrincipalGroups, setIsLoadingPrincipalGroups] = useState<boolean>(false);
    const [principalGroupsError, setPrincipalGroupsError] = useState<string | null>(null);
    
    // États pour les actions sur comptes
    const [accountActionTarget, setAccountActionTarget] = useState<string | null>(null);
    const [isAccountActionLoading, setIsAccountActionLoading] = useState<boolean>(false);
    const [accountActionMessage, setAccountActionMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const [activeTab, setActiveTab] = useState<number>(0);
    
    // Gérer le changement d'onglet
    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        // Charger les deux informations en parallèle
        Promise.all([
            invoke<AdComputerInfo>('get_ad_computer_info'),
            invoke<LoggedInUserInfo>('get_logged_in_user_info')
        ])
        .then(([adData, userData]) => {
            setAdInfo(adData);
            setUserInfo(userData);
            setIsLoading(false);
        })
        .catch(err => {
            console.error("Erreur lors de la récupération des informations AD:", err);
            setError(typeof err === 'string' ? err : 'Erreur inconnue (infos AD).');
            setIsLoading(false);
        });
    }, []);

    // Fonction pour forcer GpUpdate
    const handleForceGpUpdate = () => {
        setIsGpUpdateLoading(true);
        setGpUpdateMessage(null);
        invoke<void>('force_gp_update')
            .then(() => {
                setGpUpdateMessage({ type: 'success', message: 'Mise à jour des stratégies de groupe forcée avec succès.' });
            })
            .catch(err => {
                console.error("Erreur gpupdate:", err);
                setGpUpdateMessage({ type: 'error', message: `Erreur gpupdate: ${typeof err === 'string' ? err : 'Erreur inconnue.'}` });
            })
            .finally(() => {
                setIsGpUpdateLoading(false);
            });
    };

    // Fonction pour rechercher des utilisateurs AD
    const handleSearchAdUsers = () => {
        if (searchFilter.trim() === "") return;
        setIsSearching(true);
        setSearchError(null);
        setSearchResults([]);
        invoke<AdUserInfo[]>('search_ad_users', { filter: searchFilter })
            .then(data => {
                setSearchResults(data);
            })
            .catch(err => {
                console.error("Erreur recherche utilisateurs AD:", err);
                setSearchError(typeof err === 'string' ? err : 'Erreur inconnue lors de la recherche.');
            })
            .finally(() => {
                setIsSearching(false);
            });
    };

    // Fonction pour rechercher des ordinateurs AD
    const handleSearchAdComputers = () => {
        if (computerSearchFilter.trim() === "") return;
        setIsComputerSearching(true);
        setComputerSearchError(null);
        setComputerSearchResults([]);
        invoke<FoundAdComputerInfo[]>('search_ad_computers', { filter: computerSearchFilter })
            .then(data => {
                setComputerSearchResults(data);
            })
            .catch(err => {
                console.error("Erreur recherche ordinateurs AD:", err);
                setComputerSearchError(typeof err === 'string' ? err : 'Erreur inconnue lors de la recherche.');
            })
            .finally(() => {
                setIsComputerSearching(false);
            });
    };

    // Fonction pour rechercher des groupes AD
    const handleSearchAdGroups = () => {
        if (groupSearchFilter.trim() === "") return;
        setIsGroupSearching(true);
        setGroupSearchError(null);
        setGroupSearchResults([]);
        invoke<AdGroupInfo[]>('search_ad_groups', { filter: groupSearchFilter })
            .then(data => setGroupSearchResults(data))
            .catch(err => setGroupSearchError(typeof err === 'string' ? err : 'Erreur inconnue.'))
            .finally(() => setIsGroupSearching(false));
    };

    // Fonction pour obtenir les membres d'un groupe
    const handleGetGroupMembers = (groupIdentity: string) => {
        setSelectedGroup(groupIdentity);
        setIsLoadingMembers(true);
        setMembersError(null);
        setGroupMembers([]);
        invoke<AdMemberInfo[]>('get_ad_group_members', { groupIdentity })
            .then(data => setGroupMembers(data))
            .catch(err => setMembersError(typeof err === 'string' ? err : 'Erreur inconnue.'))
            .finally(() => setIsLoadingMembers(false));
    };

    // Fonction pour obtenir l'appartenance aux groupes d'un principal
    const handleGetPrincipalGroups = (principalIdentity: string) => {
        setSelectedPrincipal(principalIdentity);
        setIsLoadingPrincipalGroups(true);
        setPrincipalGroupsError(null);
        setPrincipalGroups([]);
        invoke<AdGroupInfo[]>('get_ad_principal_group_membership', { principalIdentity })
            .then(data => setPrincipalGroups(data))
            .catch(err => setPrincipalGroupsError(typeof err === 'string' ? err : 'Erreur inconnue.'))
            .finally(() => setIsLoadingPrincipalGroups(false));
    };

    // Fonction générique pour les actions sur comptes AD
    const handleAccountAction = (action: 'enable' | 'disable' | 'unlock' | 'reset_password', accountIdentity: string) => {
        const command = `${action}_ad_account`;
        setAccountActionTarget(accountIdentity); // Pour afficher le chargement sur la bonne ligne
        setIsAccountActionLoading(true);
        setAccountActionMessage(null);
        
        let confirmationMessage = `Êtes-vous sûr de vouloir ${action === 'reset_password' ? 'réinitialiser le mot de passe pour' : action} le compte ${accountIdentity} ?`;
        if (action === 'reset_password') confirmationMessage += ` (nécessite nouvelle définition au prochain logon)`;
        
        if (!window.confirm(confirmationMessage)) {
            setIsAccountActionLoading(false);
            setAccountActionTarget(null);
            return;
        }

        invoke<void>(command, { accountIdentity })
            .then(() => {
                setAccountActionMessage({ type: 'success', message: `Action '${action}' réussie pour ${accountIdentity}.` });
                // Optionnel: Rafraîchir la recherche d'utilisateurs ?
                // handleSearchAdUsers(); 
            })
            .catch(err => {
                 setAccountActionMessage({ type: 'error', message: `Erreur action '${action}' pour ${accountIdentity}: ${typeof err === 'string' ? err : 'Erreur inconnue.'}` });
            })
            .finally(() => {
                setIsAccountActionLoading(false);
                setAccountActionTarget(null);
            });
    };

    if (isLoading) {
        return (
            <PageLayout 
                title="Active Directory" 
                icon={<DomainIcon />}
                description="Gérer et consulter les informations du domaine"
            >
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
                    <CircularProgress size={40} />
                    <Typography variant="h6" sx={{ ml: 2 }}>
                        Chargement des informations Active Directory...
                    </Typography>
                </Box>
            </PageLayout>
        );
    }

    if (error) {
        return (
            <PageLayout 
                title="Active Directory" 
                icon={<DomainIcon />}
                description="Gérer et consulter les informations du domaine"
            >
                <Alert severity="error" variant="filled" sx={{ mb: 3, borderRadius: 2 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        Erreur lors de la récupération des informations AD
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
            title="Active Directory" 
            icon={<DomainIcon />}
            description="Gérer et consulter les informations du domaine"
        >
            <Grid container spacing={3}>
                {/* Section d'informations (Ordinateur et Utilisateur) */}
                <Grid item xs={12} md={6}>
                    <HomeCard 
                        title="Informations Ordinateur" 
                        icon={<ComputerIcon />}
                        variant="standard"
                    >
                        <Box sx={{ p: 2 }}>
                            {adInfo ? (
                                <List>
                                    <ListItem>
                                        <ListItemIcon>
                                            <DomainIcon color={adInfo.is_joined ? "primary" : "action"} />
                                        </ListItemIcon>
                                        <ListItemText 
                                            primary="Statut du domaine" 
                                            secondary={adInfo.is_joined ? "Joint au domaine" : "Non joint à un domaine (Workgroup)"}
                                        />
                                        {adInfo.is_joined && (
                                            <Chip 
                                                label="Connecté" 
                                                color="success" 
                                                size="small" 
                                                variant="outlined"
                                                icon={<CheckCircleIcon />}
                                                sx={{ borderRadius: '8px' }}
                                            />
                                        )}
                                    </ListItem>
                                    
                                    {adInfo.domain_name && (
                                        <ListItem>
                                            <ListItemIcon>
                                                <StorageIcon color="primary" />
                                            </ListItemIcon>
                                            <ListItemText 
                                                primary="Nom du domaine" 
                                                secondary={adInfo.domain_name}
                                            />
                                        </ListItem>
                                    )}
                                    
                                    {adInfo.is_joined && adInfo.site_name && (
                                        <ListItem>
                                            <ListItemIcon>
                                                <StorageIcon />
                                            </ListItemIcon>
                                            <ListItemText 
                                                primary="Site AD" 
                                                secondary={adInfo.site_name || 'Inconnu'} 
                                            />
                                        </ListItem>
                                    )}
                                    
                                    {adInfo.is_joined && adInfo.logon_server && (
                                        <ListItem>
                                            <ListItemIcon>
                                                <SecurityIcon />
                                            </ListItemIcon>
                                            <ListItemText 
                                                primary="Serveur d'authentification" 
                                                secondary={adInfo.logon_server || 'Inconnu'} 
                                            />
                                        </ListItem>
                                    )}
                                </List>
                            ) : (
                                <Typography variant="body2" color="text.secondary">
                                    Impossible de déterminer l'état du domaine.
                                </Typography>
                            )}
                        </Box>
                    </HomeCard>
                </Grid>
                
                <Grid item xs={12} md={6}>
                    <HomeCard 
                        title="Utilisateur Connecté" 
                        icon={<PersonIcon />}
                        variant="standard"
                    >
                        <Box sx={{ p: 2 }}>
                            {userInfo ? (
                                <List>
                                    <ListItem>
                                        <ListItemIcon>
                                            <AccountCircleIcon color="primary" />
                                        </ListItemIcon>
                                        <ListItemText 
                                            primary="Utilisateur" 
                                            secondary={userInfo.user_name || 'Inconnu'} 
                                        />
                                    </ListItem>
                                    
                                    <ListItem>
                                        <ListItemIcon>
                                            <DomainIcon />
                                        </ListItemIcon>
                                        <ListItemText 
                                            primary="Domaine Utilisateur" 
                                            secondary={userInfo.user_domain || 'Local (Aucun)'} 
                                        />
                                    </ListItem>
                                </List>
                            ) : (
                                <Typography variant="body2" color="text.secondary">
                                    Impossible de déterminer les informations de l'utilisateur.
                                </Typography>
                            )}
                        </Box>
                    </HomeCard>
                </Grid>
                
                {/* Section Actions */}
                <Grid item xs={12}>
                    <HomeCard 
                        title="Actions" 
                        icon={<SyncIcon />}
                        variant="gradient"
                        accentColor="#1976d2"
                    >
                        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary" paragraph>
                                Synchronisez les stratégies de groupe pour appliquer les dernières politiques du domaine.
                            </Typography>
                            
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleForceGpUpdate}
                                disabled={isGpUpdateLoading}
                                startIcon={isGpUpdateLoading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                                sx={{ 
                                    mt: 1, 
                                    borderRadius: 2,
                                    py: 1,
                                    px: 2,
                                    transition: 'all 0.2s',
                                    '&:hover': { transform: 'translateY(-2px)' }
                                }}
                            >
                                {isGpUpdateLoading ? "Synchronisation en cours..." : "Synchroniser les stratégies de groupe"}
                            </Button>
                            
                            {gpUpdateMessage && (
                                <Alert 
                                    severity={gpUpdateMessage.type} 
                                    sx={{ mt: 2, width: '100%', borderRadius: 2 }}
                                >
                                    {gpUpdateMessage.message}
                                </Alert>
                            )}
                        </Box>
                    </HomeCard>
                </Grid>
                
                {/* Section Recherche */}
                <Grid item xs={12}>
                    <HomeCard 
                        title="Recherche Active Directory" 
                        icon={<SearchIcon />}
                        variant="standard"
                    >
                        <Box sx={{ p: 2 }}>
                            <Tabs
                                value={activeTab}
                                onChange={handleTabChange}
                                sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                            >
                                <Tab icon={<PersonIcon />} label="Utilisateurs" iconPosition="start" />
                                <Tab icon={<ComputerIcon />} label="Ordinateurs" iconPosition="start" />
                                <Tab icon={<GroupIcon />} label="Groupes" iconPosition="start" />
                            </Tabs>
                            
                            {/* Onglet Utilisateurs */}
                            {activeTab === 0 && (
                                <Box>
                                    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                                        <TextField 
                                            fullWidth
                                            variant="outlined"
                                            label="Rechercher un utilisateur"
                                            value={searchFilter}
                                            onChange={(e) => setSearchFilter(e.target.value)}
                                            placeholder="Nom ou SamAccountName..."
                                            size="small"
                                            disabled={isSearching}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: '12px'
                                                }
                                            }}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <PersonIcon color="primary" />
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            onClick={handleSearchAdUsers}
                                            disabled={isSearching || searchFilter.trim() === ''}
                                            startIcon={isSearching ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                                            sx={{ 
                                                borderRadius: 2,
                                                minWidth: '120px'
                                            }}
                                        >
                                            {isSearching ? "Recherche..." : "Rechercher"}
                                        </Button>
                                    </Box>
                                    
                                    {searchError && (
                                        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                                            {searchError}
                                        </Alert>
                                    )}
                                    
                                    {!isSearching && searchResults.length > 0 ? (
                                        <TableContainer component={Paper} elevation={0} sx={{ 
                                            borderRadius: '12px',
                                            border: '1px solid',
                                            borderColor: 'divider'
                                        }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                                                        <TableCell>Login (SAM)</TableCell>
                                                        <TableCell>Nom Complet</TableCell>
                                                        <TableCell>Activé</TableCell>
                                                        <TableCell>SID</TableCell>
                                                        <TableCell>Actions</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {searchResults.map((user) => (
                                                        <TableRow 
                                                            key={user.sam_account_name} 
                                                            hover
                                                            sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                                        >
                                                            <TableCell>
                                                                <Typography variant="body2" fontWeight="medium">
                                                                    {user.sam_account_name}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell>{user.name}</TableCell>
                                                            <TableCell>
                                                                <Chip 
                                                                    label={user.enabled ? 'Activé' : 'Désactivé'}
                                                                    color={user.enabled ? 'success' : 'error'}
                                                                    size="small"
                                                                    icon={user.enabled ? <CheckCircleIcon /> : <CancelIcon />}
                                                                    variant="outlined"
                                                                    sx={{ borderRadius: '8px' }}
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                                                    {user.sid}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                                    <Tooltip title="Voir les groupes">
                                                                        <IconButton 
                                                                            size="small" 
                                                                            onClick={() => handleGetPrincipalGroups(user.sam_account_name)}
                                                                            color="primary"
                                                                        >
                                                                            <GroupsIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                    
                                                                    <Tooltip title={user.enabled ? 'Désactiver' : 'Activer'}>
                                                                        <IconButton 
                                                                            size="small" 
                                                                            onClick={() => handleAccountAction(user.enabled ? 'disable' : 'enable', user.sam_account_name)}
                                                                            disabled={isAccountActionLoading && accountActionTarget === user.sam_account_name}
                                                                            color={user.enabled ? 'error' : 'success'}
                                                                        >
                                                                            {user.enabled ? <CancelIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                    
                                                                    <Tooltip title="Déverrouiller">
                                                                        <IconButton 
                                                                            size="small" 
                                                                            onClick={() => handleAccountAction('unlock', user.sam_account_name)}
                                                                            disabled={isAccountActionLoading && accountActionTarget === user.sam_account_name}
                                                                            color="primary"
                                                                        >
                                                                            <LockOpenIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                    
                                                                    <Tooltip title="Réinitialiser le mot de passe">
                                                                        <IconButton 
                                                                            size="small" 
                                                                            onClick={() => handleAccountAction('reset_password', user.sam_account_name)}
                                                                            disabled={isAccountActionLoading && accountActionTarget === user.sam_account_name}
                                                                            color="warning"
                                                                        >
                                                                            <VpnKeyIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                    
                                                                    {isAccountActionLoading && accountActionTarget === user.sam_account_name && (
                                                                        <CircularProgress size={20} />
                                                                    )}
                                                                </Box>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    ) : !isSearching && searchFilter !== "" && !searchError ? (
                                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                                            Aucun utilisateur trouvé pour "{searchFilter}".
                                        </Alert>
                                    ) : null}
                                    
                                    {/* Afficher les groupes du principal sélectionné */} 
                                    {selectedPrincipal && (
                                        <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                                            <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                                                <GroupsIcon sx={{ mr: 1 }} /> 
                                                Groupes pour {selectedPrincipal}:
                                            </Typography>
                                            
                                            {isLoadingPrincipalGroups && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <CircularProgress size={20} />
                                                    <Typography variant="body2">Chargement des groupes...</Typography>
                                                </Box>
                                            )}
                                            
                                            {principalGroupsError && (
                                                <Alert severity="error" sx={{ mt: 1 }}>
                                                    {principalGroupsError}
                                                </Alert>
                                            )}
                                            
                                            {!isLoadingPrincipalGroups && !principalGroupsError && principalGroups.length > 0 && (
                                                <Box sx={{ 
                                                    maxHeight: '200px', 
                                                    overflowY: 'auto',
                                                    mt: 1,
                                                    p: 1,
                                                    borderRadius: 1,
                                                    bgcolor: 'background.paper'
                                                }}>
                                                    {principalGroups.map(g => (
                                                        <Chip 
                                                            key={g.sid}
                                                            label={`${g.name} (${g.sam_account_name})`}
                                                            icon={<GroupIcon />}
                                                            variant="outlined"
                                                            sx={{ m: 0.5, borderRadius: '8px' }}
                                                            size="small"
                                                        />
                                                    ))}
                                                </Box>
                                            )}
                                            
                                            {!isLoadingPrincipalGroups && !principalGroupsError && principalGroups.length === 0 && (
                                                <Typography variant="body2" color="text.secondary">
                                                    Cet utilisateur n'appartient à aucun groupe.
                                                </Typography>
                                            )}
                                        </Box>
                                    )}
                                </Box>
                            )}
                            
                            {/* Onglet Ordinateurs */}
                            {activeTab === 1 && (
                                <Box>
                                    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                                        <TextField 
                                            fullWidth
                                            variant="outlined"
                                            label="Rechercher un ordinateur"
                                            value={computerSearchFilter}
                                            onChange={(e) => setComputerSearchFilter(e.target.value)}
                                            placeholder="Nom ou DNS Hostname..."
                                            size="small"
                                            disabled={isComputerSearching}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: '12px'
                                                }
                                            }}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <ComputerIcon color="primary" />
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            onClick={handleSearchAdComputers}
                                            disabled={isComputerSearching || computerSearchFilter.trim() === ''}
                                            startIcon={isComputerSearching ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                                            sx={{ 
                                                borderRadius: 2,
                                                minWidth: '120px'
                                            }}
                                        >
                                            {isComputerSearching ? "Recherche..." : "Rechercher"}
                                        </Button>
                                    </Box>
                                    
                                    {computerSearchError && (
                                        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                                            {computerSearchError}
                                        </Alert>
                                    )}
                                    
                                    {!isComputerSearching && computerSearchResults.length > 0 ? (
                                        <TableContainer component={Paper} elevation={0} sx={{ 
                                            borderRadius: '12px',
                                            border: '1px solid',
                                            borderColor: 'divider'
                                        }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                                                        <TableCell>Nom</TableCell>
                                                        <TableCell>DNS Hostname</TableCell>
                                                        <TableCell>Activé</TableCell>
                                                        <TableCell>OS</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {computerSearchResults.map((comp) => (
                                                        <TableRow 
                                                            key={comp.name} 
                                                            hover
                                                            sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                                        >
                                                            <TableCell>
                                                                <Typography variant="body2" fontWeight="medium">
                                                                    {comp.name}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell>{comp.dns_host_name}</TableCell>
                                                            <TableCell>
                                                                <Chip 
                                                                    label={comp.enabled ? 'Activé' : 'Désactivé'}
                                                                    color={comp.enabled ? 'success' : 'error'}
                                                                    size="small"
                                                                    icon={comp.enabled ? <CheckCircleIcon /> : <CancelIcon />}
                                                                    variant="outlined"
                                                                    sx={{ borderRadius: '8px' }}
                                                                />
                                                            </TableCell>
                                                            <TableCell>{comp.operating_system}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    ) : !isComputerSearching && computerSearchFilter !== "" && !computerSearchError ? (
                                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                                            Aucun ordinateur trouvé pour "{computerSearchFilter}".
                                        </Alert>
                                    ) : null}
                                </Box>
                            )}
                            
                            {/* Onglet Groupes */}
                            {activeTab === 2 && (
                                <Box>
                                    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                                        <TextField 
                                            fullWidth
                                            variant="outlined"
                                            label="Rechercher un groupe"
                                            value={groupSearchFilter}
                                            onChange={(e) => setGroupSearchFilter(e.target.value)}
                                            placeholder="Nom ou SamAccountName..."
                                            size="small"
                                            disabled={isGroupSearching}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: '12px'
                                                }
                                            }}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <GroupIcon color="primary" />
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            onClick={handleSearchAdGroups}
                                            disabled={isGroupSearching || groupSearchFilter.trim() === ''}
                                            startIcon={isGroupSearching ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                                            sx={{ 
                                                borderRadius: 2,
                                                minWidth: '120px'
                                            }}
                                        >
                                            {isGroupSearching ? "Recherche..." : "Rechercher"}
                                        </Button>
                                    </Box>
                                    
                                    {groupSearchError && (
                                        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                                            {groupSearchError}
                                        </Alert>
                                    )}
                                    
                                    {!isGroupSearching && groupSearchResults.length > 0 ? (
                                        <TableContainer component={Paper} elevation={0} sx={{ 
                                            borderRadius: '12px',
                                            border: '1px solid',
                                            borderColor: 'divider'
                                        }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                                                        <TableCell>Login (SAM)</TableCell>
                                                        <TableCell>Nom</TableCell>
                                                        <TableCell>Catégorie</TableCell>
                                                        <TableCell>Scope</TableCell>
                                                        <TableCell>Actions</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {groupSearchResults.map((group) => (
                                                        <TableRow 
                                                            key={group.sam_account_name} 
                                                            hover
                                                            sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                                        >
                                                            <TableCell>
                                                                <Typography variant="body2" fontWeight="medium">
                                                                    {group.sam_account_name}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell>{group.name}</TableCell>
                                                            <TableCell>
                                                                <Chip 
                                                                    label={group.category}
                                                                    color="primary"
                                                                    size="small"
                                                                    variant="outlined"
                                                                    sx={{ borderRadius: '8px' }}
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                <Chip 
                                                                    label={group.scope}
                                                                    color="secondary"
                                                                    size="small"
                                                                    variant="outlined"
                                                                    sx={{ borderRadius: '8px' }}
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                <Button
                                                                    size="small"
                                                                    variant="outlined"
                                                                    startIcon={<PeopleIcon />}
                                                                    onClick={() => handleGetGroupMembers(group.sam_account_name)}
                                                                    sx={{ borderRadius: '8px' }}
                                                                >
                                                                    Membres
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    ) : !isGroupSearching && groupSearchFilter !== "" && !groupSearchError ? (
                                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                                            Aucun groupe trouvé pour "{groupSearchFilter}".
                                        </Alert>
                                    ) : null}
                                    
                                    {/* Afficher les membres du groupe sélectionné */} 
                                    {selectedGroup && (
                                        <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                                            <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                                                <PeopleIcon sx={{ mr: 1 }} /> 
                                                Membres de {selectedGroup}:
                                            </Typography>
                                            
                                            {isLoadingMembers && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <CircularProgress size={20} />
                                                    <Typography variant="body2">Chargement des membres...</Typography>
                                                </Box>
                                            )}
                                            
                                            {membersError && (
                                                <Alert severity="error" sx={{ mt: 1 }}>
                                                    {membersError}
                                                </Alert>
                                            )}
                                            
                                            {!isLoadingMembers && !membersError && groupMembers.length > 0 && (
                                                <Box sx={{ 
                                                    maxHeight: '200px', 
                                                    overflowY: 'auto',
                                                    mt: 1,
                                                    p: 1,
                                                    borderRadius: 1,
                                                    bgcolor: 'background.paper'
                                                }}>
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow>
                                                                <TableCell>Nom</TableCell>
                                                                <TableCell>Type</TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {groupMembers.map(m => (
                                                                <TableRow key={m.sid} hover>
                                                                    <TableCell>{m.name}</TableCell>
                                                                    <TableCell>
                                                                        <Chip 
                                                                            label={m.object_class}
                                                                            size="small"
                                                                            color={m.object_class.toLowerCase().includes('user') ? "primary" : 
                                                                                   m.object_class.toLowerCase().includes('group') ? "secondary" : "default"}
                                                                            sx={{ borderRadius: '8px' }}
                                                                        />
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </Box>
                                            )}
                                            
                                            {!isLoadingMembers && !membersError && groupMembers.length === 0 && (
                                                <Typography variant="body2" color="text.secondary">
                                                    Ce groupe ne contient aucun membre.
                                                </Typography>
                                            )}
                                        </Box>
                                    )}
                                </Box>
                            )}
                        </Box>
                    </HomeCard>
                </Grid>
            </Grid>
            
            {/* Affichage global message action compte */}
            {accountActionMessage && (
                <Alert 
                    severity={accountActionMessage.type} 
                    sx={{ mt: 3, borderRadius: 2 }}
                >
                    {accountActionMessage.message}
                </Alert>
            )}
        </PageLayout>
    );
};

export default ActiveDirectoryPage; 