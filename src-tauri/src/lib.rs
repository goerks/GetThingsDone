use tauri_plugin_sql::{Migration, MigrationKind};

/// Database file name, relative to the app config directory.
const DATABASE: &str = "sqlite:getitdone.db";

/// Where the access token of a service is kept in the credential store of the operating system (#30, #66): one entry per
/// service, so the token of one service never reaches another. GitHub keeps the entry it has always had.
const TOKEN_SERVICE: &str = "io.github.goerks.getitdone";

fn token_entry(service: &str) -> Result<keyring::Entry, String> {
    let user = match service {
        "github" => "github-token".to_string(),
        "jira" | "gitlab" => format!("{service}-token"),
        _ => return Err(format!("unknown service: {service}")),
    };
    keyring::Entry::new(TOKEN_SERVICE, &user).map_err(|error| error.to_string())
}

/// The stored token of a service, or `None` when there is none.
#[tauri::command]
fn sync_token_get(service: String) -> Result<Option<String>, String> {
    match token_entry(&service)?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

/// A request of the sync to Jira Cloud (#66, ADR 0008).
#[derive(serde::Deserialize)]
struct HttpRequest {
    method: String,
    url: String,
    headers: std::collections::HashMap<String, String>,
    body: Option<String>,
}

#[derive(serde::Serialize)]
struct HttpResponse {
    status: u16,
    headers: std::collections::HashMap<String, String>,
    body: String,
}

/// Only https to Atlassian is allowed, so the command cannot be used to reach anything else.
fn allowed_host(url: &reqwest::Url) -> bool {
    url.scheme() == "https"
        && url.host_str().is_some_and(|host| {
            host.ends_with(".atlassian.net") || host == "api.atlassian.com"
        })
}

/// Sends one request to Jira and returns the answer as it is (a status of 4xx or 5xx is an answer, not an error).
#[tauri::command]
async fn http_request(request: HttpRequest) -> Result<HttpResponse, String> {
    let url = reqwest::Url::parse(&request.url).map_err(|error| error.to_string())?;
    if !allowed_host(&url) {
        return Err("host not allowed".to_string());
    }
    let method = match request.method.as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        _ => return Err("method not allowed".to_string()),
    };
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;
    let mut builder = client.request(method, url);
    for (name, value) in &request.headers {
        builder = builder.header(name, value);
    }
    if let Some(body) = request.body {
        builder = builder.body(body);
    }
    let response = builder.send().await.map_err(|error| error.to_string())?;
    let status = response.status().as_u16();
    let headers = response
        .headers()
        .iter()
        .filter_map(|(name, value)| Some((name.to_string(), value.to_str().ok()?.to_string())))
        .collect();
    let body = response.text().await.map_err(|error| error.to_string())?;
    Ok(HttpResponse { status, headers, body })
}

#[tauri::command]
fn sync_token_set(service: String, token: String) -> Result<(), String> {
    token_entry(&service)?
        .set_password(&token)
        .map_err(|error| error.to_string())
}

/// Removes the token. Removing a token that is not there is not an error.
#[tauri::command]
fn sync_token_delete(service: String) -> Result<(), String> {
    match token_entry(&service)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

/// Opens a web address in the default browser. The web view of the app does not open `target="_blank"` links by itself.
/// Only http and https addresses are opened, and the address is passed as one argument, never through a shell.
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    let allowed = url.starts_with("https://") || url.starts_with("http://");
    if !allowed || url.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err("only http and https addresses can be opened".to_string());
    }
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("rundll32")
        .args(["url.dll,FileProtocolHandler", url.as_str()])
        .spawn();
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(url.as_str()).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let result = std::process::Command::new("xdg-open").arg(url.as_str()).spawn();
    result.map(|_| ()).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "epic_palette",
            sql: include_str!("../migrations/002_epic_palette.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "sprints",
            sql: include_str!("../migrations/003_sprints.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "custom_fields",
            sql: include_str!("../migrations/004_custom_fields.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "field_defaults",
            sql: include_str!("../migrations/005_field_defaults.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "more_field_types",
            sql: include_str!("../migrations/006_more_field_types.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "releases",
            sql: include_str!("../migrations/007_releases.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "settings",
            sql: include_str!("../migrations/008_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "release_events",
            sql: include_str!("../migrations/009_release_events.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "status_values",
            sql: include_str!("../migrations/010_status_values.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "sprint_states",
            sql: include_str!("../migrations/011_sprint_states.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "definitions",
            sql: include_str!("../migrations/012_definitions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "change_log",
            sql: include_str!("../migrations/013_change_log.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "members",
            sql: include_str!("../migrations/014_members.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "github",
            sql: include_str!("../migrations/015_github.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "sync",
            sql: include_str!("../migrations/016_sync.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 17,
            description: "sprint_sync",
            sql: include_str!("../migrations/017_sprint_sync.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            sync_token_get,
            sync_token_set,
            sync_token_delete,
            http_request,
            open_external
        ])
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE, migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running Get It Done");
}
