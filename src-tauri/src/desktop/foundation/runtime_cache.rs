use crate::desktop::prelude::*;
use crate::desktop::*;
use std::sync::atomic::Ordering as AtomicOrdering;

pub(crate) fn runtime_tun_enabled(runtime_config: &Value) -> bool {
    runtime_config
        .get("tun")
        .and_then(Value::as_object)
        .and_then(|tun| tun.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

pub(crate) fn runtime_config_modified_at_ms(path: &Path) -> Option<u64> {
    fs::metadata(path)
        .ok()?
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as u64)
}

pub(crate) struct ProfileRuntimeConfigCache {
    revision: u64,
    value: Value,
}

pub(crate) fn profile_runtime_config_cache() -> &'static Mutex<Option<ProfileRuntimeConfigCache>> {
    PROFILE_RUNTIME_CONFIG_CACHE.get_or_init(|| Mutex::new(None))
}

pub(crate) fn current_profile_runtime_config_revision() -> u64 {
    PROFILE_RUNTIME_CONFIG_REVISION.load(AtomicOrdering::SeqCst)
}

pub(crate) fn read_cached_profile_runtime_config(revision: u64) -> Option<Value> {
    profile_runtime_config_cache()
        .lock()
        .ok()
        .and_then(|cache| {
            cache
                .as_ref()
                .filter(|cached| cached.revision == revision)
                .map(|cached| cached.value.clone())
        })
}

pub(crate) fn write_cached_profile_runtime_config(revision: u64, value: &Value) {
    if let Ok(mut cache) = profile_runtime_config_cache().lock() {
        if current_profile_runtime_config_revision() == revision {
            *cache = Some(ProfileRuntimeConfigCache {
                revision,
                value: value.clone(),
            });
        }
    }
}

pub(crate) fn invalidate_profile_runtime_config_cache() {
    PROFILE_RUNTIME_CONFIG_REVISION.fetch_add(1, AtomicOrdering::SeqCst);
    if let Ok(mut cache) = profile_runtime_config_cache().lock() {
        *cache = None;
    }
}

pub(crate) fn invalidate_profile_runtime_config_cache_after<T>(
    result: Result<T, String>,
) -> Result<T, String> {
    let value = result?;
    invalidate_profile_runtime_config_cache();
    Ok(value)
}

pub(crate) fn mihomo_http_client() -> Result<&'static Client, String> {
    match MIHOMO_HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(15))
            .no_proxy()
            .build()
            .map_err(|e| e.to_string())
    }) {
        Ok(client) => Ok(client),
        Err(error) => Err(error.clone()),
    }
}
