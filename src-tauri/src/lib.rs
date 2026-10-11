use tauri_plugin_sql::{Migration, MigrationKind};

/// Database file name, relative to the app config directory.
const DATABASE: &str = "sqlite:getitdone.db";

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
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE, migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running Get It Done");
}
