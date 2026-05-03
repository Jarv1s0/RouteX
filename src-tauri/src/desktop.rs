use std::{
    collections::{HashMap, HashSet, VecDeque},
    fs::{self, OpenOptions},
    io::{Cursor, Read, Seek, SeekFrom, Write},
    net::{TcpListener, ToSocketAddrs},
    path::{Path, PathBuf},
    process::{Child, Command, Output, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering as AtomicOrdering},
        mpsc, Arc, Mutex, OnceLock,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

#[cfg(not(target_os = "windows"))]
use std::os::unix::net::UnixStream;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use boa_engine::{Context as JsContext, Source as JsSource};
use quick_xml::{events::Event, Reader};
use reqwest::blocking::Client;
use ring::rand::{SecureRandom, SystemRandom};
use ring::signature::Ed25519KeyPair;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
#[cfg(target_os = "macos")]
use tauri::menu::AboutMetadata;
use tauri::{
    image::Image,
    menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, PhysicalPosition, Position, RunEvent, State, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};
use tauri_plugin_updater::UpdaterExt;
use time::{macros::format_description, OffsetDateTime};
use walkdir::WalkDir;
use zip::{write::FileOptions, CompressionMethod, ZipArchive, ZipWriter};

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
unsafe extern "system" {
    fn GetACP() -> u32;
    fn GetOEMCP() -> u32;
    fn MultiByteToWideChar(
        code_page: u32,
        flags: u32,
        multi_byte_str: *const i8,
        multi_byte_len: i32,
        wide_char_str: *mut u16,
        wide_char_len: i32,
    ) -> i32;
}

mod constants;
mod gist;
mod models;
mod startup;
mod updater;
#[macro_use]
mod ipc;

use self::{
    constants::*,
    gist::get_gist_url_value,
    ipc::{desktop_check_update, desktop_get_icon_data_urls, desktop_invoke},
    models::*,
    startup::{read_startup_alignment_config, run_startup_alignment},
    updater::{
        cancel_update_download, check_update_manifest, download_and_install_update, fetch_text,
        update_client,
    },
};

include!("desktop/foundation.rs");
include!("desktop/icons.rs");
include!("desktop/common.rs");
include!("desktop/shell_icons.rs");
include!("desktop/shell_window.rs");
include!("desktop/shell_tray_menu.rs");
include!("desktop/shell_app_menu.rs");
include!("desktop/shell_tray_actions.rs");
include!("desktop/shell_shortcuts.rs");
include!("desktop/shell_surfaces.rs");
include!("desktop/webdav.rs");
include!("desktop/diagnostics.rs");
include!("desktop/profiles.rs");
include!("desktop/monitors.rs");
include!("desktop/dialogs.rs");
include!("desktop/resources.rs");
include!("desktop/service_config.rs");
include!("desktop/service_client.rs");
include!("desktop/service_tasks.rs");
include!("desktop/service_startup.rs");
include!("desktop/service_permissions.rs");
include!("desktop/service_lifecycle.rs");
include!("desktop/traffic_monitor.rs");
include!("desktop/network_control.rs");
include!("desktop/runtime_config.rs");
include!("desktop/dns.rs");
include!("desktop/core_process.rs");
include!("desktop/app.rs");

#[cfg(test)]
mod tests;
