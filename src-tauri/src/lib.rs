use tauri_plugin_sql::{Migration, MigrationKind};

/// Database file name, relative to the app config directory.
const DATABASE: &str = "sqlite:getitdone.db";

/// Where the access token for GitHub is kept in the credential store of the operating system (#30).
const TOKEN_SERVICE: &str = "io.github.goerks.getitdone";
const TOKEN_USER: &str = "github-token";

fn token_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(TOKEN_SERVICE, TOKEN_USER).map_err(|error| error.to_string())
}

/// The stored token, or `None` when there is none.
#[tauri::command]
fn github_token_get() -> Result<Option<String>, String> {
    match token_entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn github_token_set(token: String) -> Result<(), String> {
    token_entry()?
        .set_password(&token)
        .map_err(|error| error.to_string())
}

/// Removes the token. Removing a token that is not there is not an error.
#[tauri::command]
fn github_token_delete() -> Result<(), String> {
    match token_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
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
            description: "github",
            sql: include_str!("../migrations/012_github.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            github_token_get,
            github_token_set,
            github_token_delete
        ])
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE, migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running Get It Done");
}
