use std::{env, fs, path::PathBuf};

const REQUIRED_RELEASE_RESOURCES: &[&str] = &[
    "../extra/files/country.mmdb",
    "../extra/files/geoip.dat",
    "../extra/files/geoip.metadb",
    "../extra/files/geosite.dat",
];

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
    println!("cargo:rerun-if-env-changed=ROUTEX_UPDATER_PUBLIC_KEY");
    println!("cargo:rerun-if-env-changed=ROUTEX_UPDATER_STABLE_ENDPOINT");
    println!("cargo:rerun-if-env-changed=ROUTEX_UPDATER_AUTOBUILD_ENDPOINT");
    println!("cargo:rerun-if-changed=../build/app.manifest");
    println!("cargo:rustc-env=ROUTEX_TAURI_BUILD_VARIANT={build_variant}");

    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR"));
    for resource_dir in ["../extra/sidecar", "../extra/files"] {
        let path = manifest_dir.join(resource_dir);
        fs::create_dir_all(&path).unwrap_or_else(|error| {
            panic!("failed to create resource dir {}: {error}", path.display())
        });
    }

    for resource in REQUIRED_RELEASE_RESOURCES {
        let path = manifest_dir.join(resource);
        println!("cargo:rerun-if-changed={}", path.display());
        if profile != "debug" {
            let metadata = fs::metadata(&path).unwrap_or_else(|error| {
                panic!(
                    "missing required bundled resource {}: {error}",
                    path.display()
                )
            });
            if metadata.len() == 0 {
                panic!("required bundled resource is empty: {}", path.display());
            }
        }
    }

    let windows =
        tauri_build::WindowsAttributes::new().app_manifest(include_str!("../build/app.manifest"));
    let attributes = tauri_build::Attributes::new().windows_attributes(windows);
    tauri_build::try_build(attributes).expect("failed to run tauri build script")
}
