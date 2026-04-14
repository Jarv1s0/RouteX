use std::{env, fs, path::PathBuf};

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR"));
    for resource_dir in ["../extra/sidecar", "../extra/files"] {
        let path = manifest_dir.join(resource_dir);
        fs::create_dir_all(&path)
            .unwrap_or_else(|error| panic!("failed to create resource dir {}: {error}", path.display()));
    }

    tauri_build::build()
}
