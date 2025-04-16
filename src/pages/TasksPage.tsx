import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface TaskInfo {
    name: string;
    path: string;
    state: string;
    last_run_time: string;
    next_run_time: string;
    last_result: string;
}

const TasksPage: React.FC = () => {
    const [tasks, setTasks] = useState<TaskInfo[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<{ path: string, type: 'success' | 'error', message: string } | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null); // Task Path en cours d'action

    const fetchTasks = useCallback(() => {
        setIsLoading(true); setError(null); setActionMessage(null);
        invoke<TaskInfo[]>('list_scheduled_tasks')
            .then(data => {
                data.sort((a,b) => a.path.localeCompare(b.path));
                setTasks(data);
            })
            .catch(err => setError(typeof err === 'string' ? err : 'Erreur inconnue.'))
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    const handleTaskAction = (action: 'enable' | 'disable' | 'run', taskPath: string) => {
        setActionLoading(taskPath); setActionMessage(null);
        const command = `${action}_task`;
        invoke<void>(command, { taskPath })
            .then(() => {
                setActionMessage({ path: taskPath, type: 'success', message: `Action ${action} réussie pour ${taskPath}` });
                fetchTasks(); // Rafraîchir
            })
            .catch(err => setActionMessage({ path: taskPath, type: 'error', message: `Erreur ${action}: ${typeof err === 'string' ? err : 'Erreur inconnue.'}` }))
            .finally(() => setActionLoading(null));
    };

    return (
        <div>
            <h2>Tâches Planifiées</h2>
             {actionMessage && <p style={{ color: actionMessage.type === 'error' ? 'red' : 'green' }}>{actionMessage.message}</p>}
             {isLoading ? <p>Chargement...</p> : error ? <p style={{color: 'red'}}>Erreur: {error}</p> : (
                <table style={{width: '100%'}}><thead><tr><th>Chemin</th><th>État</th><th>Dern. Exé.</th><th>Proch. Exé.</th><th>Résultat Dern.</th><th>Actions</th></tr></thead><tbody>
                    {tasks.map(t => (
                        <tr key={t.path}>
                            <td>{t.path}</td><td>{t.state}</td><td>{t.last_run_time}</td><td>{t.next_run_time}</td><td>{t.last_result}</td>
                            <td>
                                <button onClick={() => handleTaskAction('run', t.path)} disabled={actionLoading === t.path}>Exécuter</button>
                                <button onClick={() => handleTaskAction('enable', t.path)} disabled={t.state === 'Ready' || actionLoading === t.path}>Activer</button>
                                <button onClick={() => handleTaskAction('disable', t.path)} disabled={t.state === 'Disabled' || actionLoading === t.path}>Désactiver</button>
                             </td>
                        </tr>
                    ))}
                </tbody></table>
             )}
        </div>
    );
};

export default TasksPage; 