include!("config_app.rs");
include!("config_chains.rs");
include!("config_profiles.rs");
include!("config_overrides.rs");
include!("config_quick_rules.rs");

#[allow(clippy::redundant_closure_call)]
pub(crate) fn register_config_handlers(map: &mut std::collections::HashMap<&'static str, crate::desktop::ipc::IpcHandler>) {
    register_app_config_handlers(map);
    register_chains_config_handlers(map);
    register_profiles_config_handlers(map);
    register_overrides_config_handlers(map);
    register_quick_rules_config_handlers(map);
}
