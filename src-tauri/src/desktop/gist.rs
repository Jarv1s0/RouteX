use super::*;

fn github_client(app: &tauri::AppHandle) -> Result<Client, String> {
    let controlled_config = read_controlled_config_store(app)?;
    let mixed_port = controlled_config
        .get("mixed-port")
        .and_then(Value::as_u64)
        .unwrap_or(7890);

    let mut builder = Client::builder().timeout(Duration::from_secs(30));
    if mixed_port != 0 {
        let proxy = reqwest::Proxy::http(format!("http://127.0.0.1:{mixed_port}"))
            .map_err(|e| e.to_string())?;
        builder = builder.proxy(proxy);
    }

    builder.build().map_err(|e| e.to_string())
}

fn get_github_token(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    Ok(read_app_config_store(app)?
        .get("githubToken")
        .and_then(Value::as_str)
        .map(str::to_string)
        .filter(|token| !token.trim().is_empty()))
}

fn list_gists(app: &tauri::AppHandle, token: &str) -> Result<Vec<GistInfo>, String> {
    let client = github_client(app)?;
    client
        .get("https://api.github.com/gists")
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"))
        .header("X-GitHub-Api-Version", "2022-11-28")
        .header(reqwest::header::USER_AGENT, "RouteX-Tauri/1.0")
        .send()
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json::<Vec<GistInfo>>()
        .map_err(|e| e.to_string())
}

fn upsert_runtime_gist(
    app: &tauri::AppHandle,
    token: &str,
    gist_id: Option<&str>,
) -> Result<(), String> {
    let client = github_client(app)?;
    let content = serde_yaml::to_string(&current_runtime_value(app, &app.state::<CoreState>())?)
        .map_err(|e| e.to_string())?;
    let payload = json!({
        "description": "Auto Synced RouteX Runtime Config",
        "public": false,
        "files": {
            "routex.yaml": {
                "content": content
            }
        }
    });

    let request = if let Some(id) = gist_id {
        client.patch(format!("https://api.github.com/gists/{id}"))
    } else {
        client.post("https://api.github.com/gists")
    };

    request
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"))
        .header("X-GitHub-Api-Version", "2022-11-28")
        .header(reqwest::header::USER_AGENT, "RouteX-Tauri/1.0")
        .json(&payload)
        .send()
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub(super) fn get_gist_url_value(app: &tauri::AppHandle) -> Result<String, String> {
    let Some(token) = get_github_token(app)? else {
        return Ok(String::new());
    };

    let mut gists = list_gists(app, &token)?;
    if let Some(gist) = gists
        .iter()
        .find(|gist| gist.description.as_deref() == Some("Auto Synced RouteX Runtime Config"))
    {
        return Ok(gist.html_url.clone());
    }

    upsert_runtime_gist(app, &token, None)?;
    gists = list_gists(app, &token)?;
    let gist = gists
        .iter()
        .find(|gist| gist.description.as_deref() == Some("Auto Synced RouteX Runtime Config"))
        .ok_or_else(|| "Gist not found".to_string())?;

    Ok(gist.html_url.clone())
}
