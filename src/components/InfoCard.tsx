import React, { ReactNode } from 'react';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Avatar from '@mui/material/Avatar';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

interface InfoCardProps {
    title: string;
    icon: React.ReactElement;
    children: ReactNode;
    isLoading?: boolean;
    error?: string | null;
    avatarColor?: string;
    fullWidth?: boolean;
    actions?: React.ReactNode;
    minHeight?: number | string;
    gradient?: boolean;
    borderRadius?: number;
    darkModeCompatible?: boolean;
}

/**
 * Carte d'information réutilisable avec chargement et gestion d'erreur
 */
const InfoCard: React.FC<InfoCardProps> = ({
    title,
    icon,
    children,
    isLoading = false,
    error = null,
    avatarColor = 'primary.main',
    fullWidth = false,
    actions,
    minHeight,
    gradient = false,
    borderRadius = 12,
    darkModeCompatible = false
}) => {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    
    // Déterminer le fond en fonction du mode et de l'option gradient
    const cardBackground = gradient 
        ? isDarkMode && darkModeCompatible
            ? 'linear-gradient(135deg, #1a1f2c 0%, #2c3345 100%)'
            : 'linear-gradient(135deg, #f5f7fa 0%, #e4e8eb 100%)'
        : 'background.paper';

    // Déterminer les couleurs de bordure en fonction du mode
    const borderColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
    
    return (
        <Card 
            elevation={3} 
            sx={{ 
                flex: fullWidth ? 1 : 'auto',
                transition: 'all 0.3s ease', 
                '&:hover': { 
                    transform: 'translateY(-4px)',
                    boxShadow: isDarkMode 
                        ? '0 8px 24px rgba(0,0,0,0.3)' 
                        : '0 8px 24px rgba(0,0,0,0.12)'
                },
                minHeight: minHeight || 'auto',
                background: cardBackground,
                borderRadius: borderRadius,
                overflow: 'hidden',
                position: 'relative',
                border: isDarkMode ? `1px solid ${borderColor}` : 'none'
            }}
        >
            <CardHeader
                avatar={
                    <Avatar sx={{ 
                        bgcolor: avatarColor,
                        boxShadow: isDarkMode 
                            ? '0 4px 8px rgba(0,0,0,0.3)' 
                            : '0 4px 8px rgba(0,0,0,0.1)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            transform: 'scale(1.05)'
                        }
                    }}>
                        {icon}
                    </Avatar>
                }
                title={
                    <Typography variant="h6" sx={{ 
                        fontWeight: 'bold',
                        fontSize: '1.125rem',
                        color: 'text.primary'
                    }}>
                        {title}
                    </Typography>
                }
                action={actions}
            />
            <CardContent>
                {isLoading && (
                    <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        p: 3 
                    }}>
                        <CircularProgress 
                            size={36} 
                            sx={{ 
                                color: typeof avatarColor === 'string' ? avatarColor : 'primary.main' 
                            }} 
                        />
                    </Box>
                )}
                {error && (
                    <Alert 
                        severity="error" 
                        sx={{ 
                            mb: 2, 
                            borderRadius: 2,
                            boxShadow: isDarkMode 
                                ? '0 2px 8px rgba(0,0,0,0.2)' 
                                : '0 2px 8px rgba(0,0,0,0.05)'
                        }}
                    >
                        {error}
                    </Alert>
                )}
                <Box sx={{ 
                    transition: 'opacity 0.3s ease',
                    opacity: isLoading ? 0.6 : 1
                }}>
                    {!isLoading && !error && children}
                    {!isLoading && error && children}
                    {isLoading && children}
                </Box>
            </CardContent>
        </Card>
    );
};

export default InfoCard; 