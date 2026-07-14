use super::*;
use crate::desktop::prelude::*;
use crate::desktop::*;

pub fn escape_task_xml_text(value: &Path) -> String {
    value
        .to_string_lossy()
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

pub fn build_routex_run_task_xml_for_paths(routex_run_path: &Path, exe_path: &Path) -> String {
    let routex_run_path = escape_task_xml_text(routex_run_path);
    let exe_path = escape_task_xml_text(exe_path);
    format!(
        r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers />
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>Parallel</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>false</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>3</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{}</Command>
      <Arguments>"{}"</Arguments>
    </Exec>
  </Actions>
</Task>
"#,
        routex_run_path, exe_path
    )
}

pub fn build_routex_run_task_xml(app: &tauri::AppHandle) -> Result<String, String> {
    let routex_run_path = routex_run_binary_task_path(app)?;
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(build_routex_run_task_xml_for_paths(
        &routex_run_path,
        &exe_path,
    ))
}

pub fn build_routex_autorun_task_xml_for_paths(routex_run_path: &Path, exe_path: &Path) -> String {
    let routex_run_path = escape_task_xml_text(routex_run_path);
    let exe_path = escape_task_xml_text(exe_path);
    format!(
        r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <Delay>PT3S</Delay>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>Parallel</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>false</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>3</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{}</Command>
      <Arguments>"{}" {}</Arguments>
    </Exec>
  </Actions>
</Task>
"#,
        routex_run_path, exe_path, ROUTEX_STARTUP_ARG
    )
}

pub fn build_routex_autorun_task_xml(app: &tauri::AppHandle) -> Result<String, String> {
    let routex_run_path = routex_run_binary_task_path(app)?;
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(build_routex_autorun_task_xml_for_paths(
        &routex_run_path,
        &exe_path,
    ))
}

#[cfg(target_os = "windows")]
pub fn check_windows_task_matches_current_app(
    task_name: &str,
    app: &tauri::AppHandle,
    required_argument: Option<&str>,
) -> bool {
    let routex_run_path = match routex_run_binary_task_path(app) {
        Ok(path) => path,
        Err(_) => return false,
    };
    let exe_path = match std::env::current_exe() {
        Ok(path) => path,
        Err(_) => return false,
    };
    let output = match schtasks_output(&["/query", "/tn", task_name, "/xml"]) {
        Ok(output) if output.status.success() => output,
        _ => return false,
    };
    let xml = String::from_utf8_lossy(&output.stdout);
    task_xml_matches_current_exec(&xml, &routex_run_path, &exe_path, required_argument)
}

pub fn task_xml_matches_current_exec(
    xml: &str,
    routex_run_path: &Path,
    exe_path: &Path,
    required_argument: Option<&str>,
) -> bool {
    let command = format!(
        "<Command>{}</Command>",
        escape_task_xml_text(routex_run_path)
    );
    let exe_argument = format!("\"{}\"", escape_task_xml_text(exe_path));

    xml.contains(&command)
        && xml.contains(&exe_argument)
        && required_argument
            .map(|argument| xml.contains(argument))
            .unwrap_or(true)
}
