use std::{env, fs, path::PathBuf};

fn main() {
    let profile = env::var("PROFILE").unwrap_or_else(|_| "release".to_string());
    let is_auto_build = env::var("ROUTEX_AUTO_BUILD")
        .map(|value| value.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let build_variant = env::var("ROUTEX_TAURI_BUILD_VARIANT")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            if is_auto_build {
                "autobuild".to_string()
            } else if profile == "debug" {
                "dev".to_string()
            } else {
                "release".to_string()
            }
        });

    println!("cargo:rerun-if-env-changed=ROUTEX_AUTO_BUILD");
    println!("cargo:rerun-if-env-changed=ROUTEX_TAURI_BUILD_VARIANT");
    println!("cargo:rustc-env=ROUTEX_TAURI_BUILD_VARIANT={build_variant}");

    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR"));
    for resource_dir in ["../extra/sidecar", "../extra/files"] {
        let path = manifest_dir.join(resource_dir);
        fs::create_dir_all(&path).unwrap_or_else(|error| {
            panic!("failed to create resource dir {}: {error}", path.display())
        });
    }

    tauri_build::build()
}
