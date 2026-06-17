#![cfg_attr(not(target_os = "windows"), allow(dead_code))]

pub(crate) use std::{
    collections::{HashMap, HashSet, VecDeque},
    fs::{self, OpenOptions},
    io::{Cursor, Read, Seek, SeekFrom, Write},
    net::{TcpListener, ToSocketAddrs},
    path::{Path, PathBuf},
    process::{Child, Command, Output, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering as AtomicOrdering},
        mpsc, Arc, Mutex, OnceLock,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

#[cfg(not(target_os = "windows"))]
pub(crate) use std::os::unix::net::UnixStream;
#[cfg(target_os = "windows")]
pub(crate) use std::os::windows::process::CommandExt;

pub(crate) use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
pub(crate) use boa_engine::{Context as JsContext, Source as JsSource};
pub(crate) use quick_xml::{events::Event, Reader};
pub(crate) use reqwest::blocking::Client;
pub(crate) use ring::rand::{SecureRandom, SystemRandom};
pub(crate) use ring::signature::{Ed25519KeyPair, KeyPair};
pub(crate) use serde::{de::DeserializeOwned, Deserialize, Serialize};
pub(crate) use serde_json::{json, Value};
#[cfg(target_os = "macos")]
pub(crate) use tauri::menu::AboutMetadata;
pub(crate) use tauri::{
    image::Image,
    menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, PhysicalPosition, Position, RunEvent, State, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};
pub(crate) use tauri_plugin_global_shortcut::{
    GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState,
};
pub(crate) use tauri_plugin_updater::UpdaterExt;
pub(crate) use time::{macros::format_description, OffsetDateTime};
pub(crate) use walkdir::WalkDir;
pub(crate) use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
extern "system" {
    pub(crate) fn GetACP() -> u32;
    pub(crate) fn GetOEMCP() -> u32;
    pub(crate) fn MultiByteToWideChar(
        code_page: u32,
        flags: u32,
        multi_byte_str: *const i8,
        multi_byte_len: i32,
        wide_char_str: *mut u16,
        wide_char_len: i32,
    ) -> i32;
}

pub(crate) mod constants;
pub(crate) mod gist;
pub(crate) mod models;
pub(crate) mod startup;
pub(crate) mod updater;
#[macro_use]
pub(crate) mod ipc;

pub(crate) mod app;
pub(crate) mod common;
pub(crate) mod config_store;
pub(crate) mod core_process;
pub(crate) mod diagnostics;
pub(crate) mod dialogs;
pub(crate) mod dns;
pub(crate) mod error;
pub(crate) mod foundation;
pub(crate) mod fs_utils;
pub(crate) mod icons;
pub(crate) mod monitors;
pub(crate) mod network_control;
pub(crate) mod profiles;
pub(crate) mod resources;
pub(crate) mod runtime_config;
pub(crate) mod runtime_dir;
pub(crate) mod runtime_logs;
pub(crate) mod geo_detection;
pub(crate) mod service_client;
pub(crate) mod service_config;
pub(crate) mod service_lifecycle;
pub(crate) mod service_permissions;
pub(crate) mod service_startup;
pub(crate) mod service_tasks;
pub(crate) mod shell_app_menu;
pub(crate) mod shell_icons;
pub(crate) mod shell_shortcuts;
pub(crate) mod shell_surfaces;
pub(crate) mod shell_tray_actions;
pub(crate) mod shell_tray_menu;
pub(crate) mod shell_window;
pub(crate) mod traffic_monitor;
pub(crate) mod webdav;

pub use app::run;

#[allow(unused_imports)]
pub(crate) mod prelude {
    pub(crate) use super::constants::*;
    pub(crate) use super::gist::*;
    pub(crate) use super::ipc::*;
    pub(crate) use super::models::*;
    pub(crate) use super::startup::*;
    pub(crate) use super::updater::*;

    pub(crate) use super::app::*;
    pub(crate) use super::common::*;
    pub(crate) use super::config_store::*;
    pub(crate) use super::core_process::*;
    pub(crate) use super::diagnostics::*;
    pub(crate) use super::dialogs::*;
    pub(crate) use super::dns::*;
    pub(crate) use super::error::*;
    pub(crate) use super::foundation::*;
    pub(crate) use super::fs_utils::*;
    pub(crate) use super::icons::*;
    pub(crate) use super::monitors::*;
    pub(crate) use super::network_control::*;
    pub(crate) use super::profiles::*;
    pub(crate) use super::resources::*;
    pub(crate) use super::runtime_config::*;
    pub(crate) use super::runtime_dir::*;
    pub(crate) use super::runtime_logs::*;
    pub(crate) use super::geo_detection::*;
    pub(crate) use super::service_client::*;
    pub(crate) use super::service_config::*;
    pub(crate) use super::service_lifecycle::*;
    pub(crate) use super::service_permissions::*;
    pub(crate) use super::service_startup::*;
    pub(crate) use super::service_tasks::*;
    pub(crate) use super::shell_app_menu::*;
    pub(crate) use super::shell_icons::*;
    pub(crate) use super::shell_shortcuts::*;
    pub(crate) use super::shell_surfaces::*;
    pub(crate) use super::shell_tray_actions::*;
    pub(crate) use super::shell_tray_menu::*;
    pub(crate) use super::shell_window::*;
    pub(crate) use super::traffic_monitor::*;
    pub(crate) use super::webdav::*;
}

#[cfg(test)]
mod tests;
