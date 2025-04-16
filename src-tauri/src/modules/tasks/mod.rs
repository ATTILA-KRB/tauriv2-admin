use serde::{Deserialize, Serialize};
use std::result::Result;
use tauri::command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use serde_json::Value;

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsTask {
    task_name: String,
    task_path: String,
    state: String, // Ready, Running, Disabled
    last_run_time: Option<Value>,
    next_run_time: Option<Value>,
    last_task_result: Option<u32>,
}

#[derive(Serialize, Debug, Clone)]
pub struct TaskInfo {
    name: String,
    path: String,
    state: String,
    last_run_time: String,
    next_run_time: String,
    last_result: String,
}

// Helper pour parser date WMI/PowerShell
fn parse_ps_date(date_value: Option<&Value>) -> String {
    date_value
        .and_then(|v| v.get("DateTime"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "N/A".to_string())
}

#[command]
pub async fn list_scheduled_tasks(app: AppHandle) -> Result<Vec<TaskInfo>, String> {
    let command = "Get-ScheduledTask | Select-Object TaskName, TaskPath, State, @{N='LastRunTime';E={$_.LastRunTime}}, @{N='NextRunTime';E={$_.NextRunTime}}, LastTaskResult | ConvertTo-Json -Depth 3 -Compress";
    let output = app.shell().command("powershell").args(&["-Command", command]).output().await.map_err(|e|e.to_string())?;
    if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).to_string()); }
    let json_str = String::from_utf8_lossy(&output.stdout);
    if json_str.trim().is_empty() { return Ok(vec![]); }
    let parsed: Vec<PsTask> = serde_json::from_str(&json_str).map_err(|e|e.to_string())?;
    let final_tasks = parsed.into_iter().map(|t| TaskInfo {
        name: t.task_name,
        path: t.task_path,
        state: t.state,
        last_run_time: parse_ps_date(t.last_run_time.as_ref()),
        next_run_time: parse_ps_date(t.next_run_time.as_ref()),
        last_result: t.last_task_result.map_or("N/A".to_string(), |r| r.to_string()),
    }).collect();
    Ok(final_tasks)
}

#[command]
pub async fn enable_task(app: AppHandle, task_path: String) -> Result<(), String> {
    let command = format!("Enable-ScheduledTask -TaskPath \"{}\"", task_path.replace('"',"''"));
    let output = app.shell().command("powershell").args(&["-Command", &command]).output().await.map_err(|e|e.to_string())?;
    if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).to_string()); }
    Ok(())
}

#[command]
pub async fn disable_task(app: AppHandle, task_path: String) -> Result<(), String> {
    let command = format!("Disable-ScheduledTask -TaskPath \"{}\"", task_path.replace('"',"''"));
    let output = app.shell().command("powershell").args(&["-Command", &command]).output().await.map_err(|e|e.to_string())?;
    if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).to_string()); }
    Ok(())
}

#[command]
pub async fn run_task(app: AppHandle, task_path: String) -> Result<(), String> {
     let command = format!("Start-ScheduledTask -TaskPath \"{}\"", task_path.replace('"',"''"));
     let output = app.shell().command("powershell").args(&["-Command", &command]).output().await.map_err(|e|e.to_string())?;
     if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).to_string()); }
     Ok(())
} 