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
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';

// Icons
import PersonIcon from '@mui/icons-material/Person';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import GroupIcon from '@mui/icons-material/Group';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import ClearIcon from '@mui/icons-material/Clear';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DoneIcon from '@mui/icons-material/Done';
import BlockIcon from '@mui/icons-material/Block';
import FilterListIcon from '@mui/icons-material/FilterList';

// Interface pour les informations utilisateur local
interface LocalUserInfo {
    name: string;
    full_name: string;
    description: string;
    enabled: boolean;
    sid: string;
}

// Interface pour les informations groupe local
interface LocalGroupInfo {
    name: string;
    description: string;
    sid: string;
}

const UsersPage: React.FC = () => {
    // États pour les utilisateurs
    const [users, setUsers] = useState<LocalUserInfo[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
    const [usersError, setUsersError] = useState<string | null>(null);
    const [userFilter, setUserFilter] = useState<string>("");

    // États pour les groupes
    const [groups, setGroups] = useState<LocalGroupInfo[]>([]);
    const [isLoadingGroups, setIsLoadingGroups] = useState<boolean>(true);
    const [groupsError, setGroupsError] = useState<string | null>(null);
    const [groupFilter, setGroupFilter] = useState<string>("");

    // États pour la création d'utilisateur
    const [newUserName, setNewUserName] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [newFullName, setNewFullName] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [addUserMessage, setAddUserMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // État pour la suppression
    const [isDeletingUser, setIsDeletingUser] = useState<string | null>(null); // Stocke le nom de l'utilisateur en cours de suppression
    const [deleteUserMessage, setDeleteUserMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Fonction pour recharger les utilisateurs (utile après ajout/suppression)
    const fetchUsers = useCallback(() => {
        setIsLoadingUsers(true);
        setUsersError(null);
        invoke<LocalUserInfo[]>('list_local_users')
            .then(data => {
                data.sort((a, b) => a.name.localeCompare(b.name));
                setUsers(data);
            })
            .catch(err => {
                console.error("Erreur récupération utilisateurs locaux:", err);
                setUsersError(typeof err === 'string' ? err : 'Erreur inconnue (utilisateurs).');
            })
            .finally(() => setIsLoadingUsers(false));
    }, []);

    // Charger les utilisateurs initialement
    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Charger les groupes
    const fetchGroups = useCallback(() => {
        setIsLoadingGroups(true);
        setGroupsError(null);
        invoke<LocalGroupInfo[]>('list_local_groups')
            .then(data => {
                data.sort((a, b) => a.name.localeCompare(b.name));
                setGroups(data);
            })
            .catch(err => {
                console.error("Erreur lors de la récupération des groupes locaux:", err);
                setGroupsError(typeof err === 'string' ? err : 'Erreur inconnue lors de la récupération des groupes locaux.');
            })
            .finally(() => setIsLoadingGroups(false));
    }, []);

    useEffect(() => {
        fetchGroups();
    }, [fetchGroups]);

    // Gérer l'ajout d'utilisateur
    const handleAddUser = (event: React.FormEvent) => {
        event.preventDefault(); // Empêcher le rechargement de la page
        setIsAddingUser(true);
        setAddUserMessage(null);
        invoke<void>('add_local_user', { 
            userName: newUserName, 
            password: newPassword, 
            fullName: newFullName || null, // Envoyer null si vide
            description: newDescription || null // Envoyer null si vide
        })
        .then(() => {
            setAddUserMessage({ type: 'success', message: `Utilisateur '${newUserName}' créé avec succès.` });
            // Réinitialiser le formulaire
            setNewUserName("");
            setNewPassword("");
            setNewFullName("");
            setNewDescription("");
            fetchUsers(); // Rafraîchir la liste
        })
        .catch(err => {
            setAddUserMessage({ type: 'error', message: `Erreur création: ${typeof err === 'string' ? err : 'Erreur inconnue.'}` });
        })
        .finally(() => setIsAddingUser(false));
    };

    // Gérer la suppression d'utilisateur
    const handleDeleteUser = (userName: string) => {
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur '${userName}' ? Cette action est irréversible.`)) {
            return;
        }
        setIsDeletingUser(userName);
        setDeleteUserMessage(null);
        invoke<void>('delete_local_user', { userName })
        .then(() => {
            setDeleteUserMessage({ type: 'success', message: `Utilisateur '${userName}' supprimé avec succès.` });
            fetchUsers(); // Rafraîchir la liste
        })
        .catch(err => {
            setDeleteUserMessage({ type: 'error', message: `Erreur suppression '${userName}': ${typeof err === 'string' ? err : 'Erreur inconnue.'}` });
        })
        .finally(() => setIsDeletingUser(null));
    };

    // Filtrer les utilisateurs
    const filteredUsers = users.filter(user => 
        user.name.toLowerCase().includes(userFilter.toLowerCase()) ||
        user.full_name.toLowerCase().includes(userFilter.toLowerCase()) ||
        user.description.toLowerCase().includes(userFilter.toLowerCase())
    );

    // Filtrer les groupes
    const filteredGroups = groups.filter(group => 
        group.name.toLowerCase().includes(groupFilter.toLowerCase()) ||
        group.description.toLowerCase().includes(groupFilter.toLowerCase())
    );

    const handleTogglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    return (
        <PageLayout 
            title="Gestion des Utilisateurs & Groupes" 
            icon={<AdminPanelSettingsIcon />}
            description="Gérez les utilisateurs et groupes locaux du système"
        >
            {/* Section Création Utilisateur */}
            <HomeCard
                title="Création d'Utilisateur"
                icon={<PersonAddIcon />}
                avatarColor="success.main"
                accentColor="#2e7d32"
                variant="gradient"
                isLoading={isAddingUser}
                error={addUserMessage?.type === 'error' ? addUserMessage.message : null}
            >
                <Box sx={{ p: 2 }}>
                    <form onSubmit={handleAddUser}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Nom d'utilisateur"
                                    fullWidth
                                    required
                                    value={newUserName}
                                    onChange={(e) => setNewUserName(e.target.value)}
                                    disabled={isAddingUser}
                                    variant="outlined"
                                    size="small"
                                    sx={{ mb: 2, borderRadius: 2 }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <PersonIcon />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                                
                                <FormControl fullWidth variant="outlined" size="small" sx={{ mb: 2 }}>
                                    <InputLabel htmlFor="password-input">Mot de passe</InputLabel>
                                    <OutlinedInput
                                        id="password-input"
                                        type={showPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        disabled={isAddingUser}
                                        startAdornment={
                                            <InputAdornment position="start">
                                                <IconButton
                                                    aria-label="toggle password visibility"
                                                    onClick={handleTogglePasswordVisibility}
                                                    edge="start"
                                                >
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        }
                                        label="Mot de passe"
                                    />
                                </FormControl>
                            </Grid>
                            
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Nom complet"
                                    fullWidth
                                    value={newFullName}
                                    onChange={(e) => setNewFullName(e.target.value)}
                                    disabled={isAddingUser}
                                    variant="outlined"
                                    size="small"
                                    sx={{ mb: 2 }}
                                />
                                
                                <TextField
                                    label="Description"
                                    fullWidth
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                    disabled={isAddingUser}
                                    variant="outlined"
                                    size="small"
                                    sx={{ mb: 2 }}
                                />
                            </Grid>
                            
                            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    color="success"
                                    disabled={isAddingUser || !newUserName || !newPassword}
                                    startIcon={isAddingUser ? <CircularProgress size={20} color="inherit" /> : <PersonAddIcon />}
                                    sx={{ 
                                        borderRadius: 2,
                                        transition: 'all 0.2s',
                                        '&:hover': { transform: 'translateY(-2px)' }
                                    }}
                                >
                                    {isAddingUser ? "Création..." : "Créer Utilisateur"}
                                </Button>
                            </Grid>
                        </Grid>
                        
                        {addUserMessage?.type === 'success' && (
                            <Alert 
                                severity="success" 
                                sx={{ mt: 2, borderRadius: 2 }}
                                icon={<DoneIcon />}
                            >
                                {addUserMessage.message}
                            </Alert>
                        )}
                    </form>
                </Box>
            </HomeCard>

            {/* Section Utilisateurs Locaux */}
            <Box sx={{ mt: 3 }}>
                <HomeCard
                    title="Utilisateurs Locaux"
                    icon={<PersonIcon />}
                    avatarColor="primary.main"
                    accentColor="#1976d2"
                    variant="standard"
                    isLoading={isLoadingUsers && users.length === 0}
                    error={usersError}
                    headerActions={
                        <Tooltip title="Rafraîchir la liste">
                            <IconButton 
                                onClick={fetchUsers} 
                                disabled={isLoadingUsers}
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
                        {deleteUserMessage && (
                            <Alert 
                                severity={deleteUserMessage.type} 
                                sx={{ mb: 2, borderRadius: 2 }}
                                onClose={() => setDeleteUserMessage(null)}
                            >
                                {deleteUserMessage.message}
                            </Alert>
                        )}
                        
                        <Box sx={{ mb: 2 }}>
                            <TextField
                                fullWidth
                                variant="outlined"
                                placeholder="Filtrer les utilisateurs..."
                                value={userFilter}
                                onChange={(e) => setUserFilter(e.target.value)}
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
                                    endAdornment: userFilter && (
                                        <InputAdornment position="end">
                                            <IconButton 
                                                onClick={() => setUserFilter('')} 
                                                edge="end" 
                                                size="small"
                                            >
                                                <ClearIcon fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                        </Box>
                        
                        {isLoadingUsers && users.length > 0 ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                                <CircularProgress size={40} />
                            </Box>
                        ) : filteredUsers.length === 0 ? (
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
                                    {userFilter ? "Aucun utilisateur ne correspond aux critères de recherche." : "Aucun utilisateur trouvé."}
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
                                            <TableCell><Typography variant="subtitle2">Utilisateur</Typography></TableCell>
                                            <TableCell><Typography variant="subtitle2">Nom Complet</Typography></TableCell>
                                            <TableCell><Typography variant="subtitle2">Description</Typography></TableCell>
                                            <TableCell><Typography variant="subtitle2">Statut</Typography></TableCell>
                                            <TableCell><Typography variant="subtitle2">Actions</Typography></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredUsers.map((user) => (
                                            <TableRow 
                                                key={user.name} 
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
                                                        <PersonIcon color="primary" fontSize="small" />
                                                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                                            {user.name}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    {user.full_name || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    {user.description || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={user.enabled ? "Activé" : "Désactivé"} 
                                                        color={user.enabled ? "success" : "error"}
                                                        size="small"
                                                        icon={user.enabled ? <DoneIcon /> : <BlockIcon />}
                                                        variant={user.enabled ? "filled" : "outlined"}
                                                        sx={{ borderRadius: '6px' }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Tooltip title="Supprimer l'utilisateur">
                                                        <IconButton
                                                            color="error"
                                                            onClick={() => handleDeleteUser(user.name)}
                                                            disabled={isDeletingUser === user.name}
                                                            size="small"
                                                            sx={{
                                                                transition: 'all 0.2s',
                                                                '&:hover': {
                                                                    transform: 'scale(1.1)'
                                                                }
                                                            }}
                                                        >
                                                            {isDeletingUser === user.name ? 
                                                                <CircularProgress size={20} color="error" /> : 
                                                                <PersonRemoveIcon fontSize="small" />
                                                            }
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Box>
                </HomeCard>
            </Box>

            {/* Section Groupes Locaux */}
            <Box sx={{ mt: 3 }}>
                <HomeCard
                    title="Groupes Locaux"
                    icon={<GroupIcon />}
                    avatarColor="secondary.main"
                    accentColor="#9c27b0"
                    variant="gradient"
                    isLoading={isLoadingGroups && groups.length === 0}
                    error={groupsError}
                    headerActions={
                        <Tooltip title="Rafraîchir la liste">
                            <IconButton 
                                onClick={fetchGroups} 
                                disabled={isLoadingGroups}
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
                        <Box sx={{ mb: 2 }}>
                            <TextField
                                fullWidth
                                variant="outlined"
                                placeholder="Filtrer les groupes..."
                                value={groupFilter}
                                onChange={(e) => setGroupFilter(e.target.value)}
                                size="small"
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: '12px',
                                        transition: 'all 0.3s',
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'secondary.main',
                                        },
                                    }
                                }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <FilterListIcon color="secondary" />
                                        </InputAdornment>
                                    ),
                                    endAdornment: groupFilter && (
                                        <InputAdornment position="end">
                                            <IconButton 
                                                onClick={() => setGroupFilter('')} 
                                                edge="end" 
                                                size="small"
                                            >
                                                <ClearIcon fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                        </Box>
                        
                        {isLoadingGroups && groups.length > 0 ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                                <CircularProgress size={40} color="secondary" />
                            </Box>
                        ) : filteredGroups.length === 0 ? (
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
                                    {groupFilter ? "Aucun groupe ne correspond aux critères de recherche." : "Aucun groupe trouvé."}
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
                                            <TableCell><Typography variant="subtitle2">Nom du Groupe</Typography></TableCell>
                                            <TableCell><Typography variant="subtitle2">Description</Typography></TableCell>
                                            <TableCell><Typography variant="subtitle2">SID</Typography></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredGroups.map((group) => (
                                            <TableRow 
                                                key={group.name} 
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
                                                        <GroupIcon color="secondary" fontSize="small" />
                                                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                                            {group.name}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    {group.description || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                        {group.sid}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Box>
                </HomeCard>
            </Box>

            {/* Légende */}
            <Box sx={{ mt: 4 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Légende</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonIcon color="primary" fontSize="small" />
                        <Typography variant="body2">Utilisateur local</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <GroupIcon color="secondary" fontSize="small" />
                        <Typography variant="body2">Groupe local</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip icon={<DoneIcon />} label="Activé" color="success" size="small" />
                        <Typography variant="body2">Utilisateur activé</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip icon={<BlockIcon />} label="Désactivé" color="error" size="small" variant="outlined" />
                        <Typography variant="body2">Utilisateur désactivé</Typography>
                    </Box>
                </Box>
            </Box>
        </PageLayout>
    );
};

export default UsersPage; 