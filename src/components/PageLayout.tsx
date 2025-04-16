import React, { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';

interface PageLayoutProps {
    title: string;
    icon: React.ReactElement;
    children: ReactNode;
    description?: string;
}

/**
 * Composant de mise en page commun pour toutes les pages
 */
const PageLayout: React.FC<PageLayoutProps> = ({ 
    title, 
    icon, 
    children, 
    description 
}) => {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1200, mx: 'auto', p: 2 }}>
            {/* En-tête de la page */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Avatar 
                    sx={{ 
                        bgcolor: 'primary.main', 
                        mr: 2,
                        width: 40,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    {icon}
                </Avatar>
                <Box>
                    <Typography variant="h4" component="h1" sx={{ m: 0 }}>
                        {title}
                    </Typography>
                    {description && (
                        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                            {description}
                        </Typography>
                    )}
                </Box>
            </Box>
            
            {/* Contenu de la page */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {children}
            </Box>
        </Box>
    );
};

export default PageLayout; 