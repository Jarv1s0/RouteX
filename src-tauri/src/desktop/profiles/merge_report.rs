use super::super::prelude::*;
use super::super::*;

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProfileMergeMember {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) primary: bool,
    pub(crate) nodes: Vec<String>,
    pub(crate) providers: Vec<String>,
    pub(crate) renamed: Vec<ProfileMergeRename>,
    pub(crate) discarded: Vec<ProfileMergeDiscard>,
    pub(crate) discarded_providers: Vec<ProfileMergeDiscard>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct ProfileMergeRename {
    pub(crate) kind: &'static str,
    pub(crate) from: String,
    pub(crate) to: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProfileMergeDiscard {
    pub(crate) name: String,
    pub(crate) dialer_proxy: String,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProfileMergeTarget {
    pub(crate) name: String,
    pub(crate) added_nodes: usize,
    pub(crate) added_providers: usize,
    pub(crate) skipped_nodes: Vec<String>,
    pub(crate) skipped_providers: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProfileMergeReport {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) primary_id: Option<String>,
    pub(crate) members: Vec<ProfileMergeMember>,
    pub(crate) available_targets: Vec<String>,
    pub(crate) missing_targets: Vec<String>,
    pub(crate) targets: Vec<ProfileMergeTarget>,
}

fn is_merge_target(group: &Value) -> bool {
    matches!(
        group.get("type").and_then(Value::as_str),
        Some("select" | "url-test" | "fallback" | "load-balance")
    )
}

pub(crate) fn profile_merge_provider_dialers(provider: &Value) -> Vec<String> {
    let mut dialers = Vec::new();
    if let Some(dialer) = provider
        .get("override")
        .and_then(|value| value.get("dialer-proxy"))
        .and_then(Value::as_str)
    {
        return vec![dialer.to_string()];
    }
    if let Some(payload) = provider.get("payload").and_then(Value::as_array) {
        dialers.extend(payload.iter().filter_map(|node| {
            node.get("dialer-proxy")
                .and_then(Value::as_str)
                .map(str::to_string)
        }));
    }
    dialers
}

fn append_group_references(group: &mut Value, key: &str, names: &[String]) {
    if names.is_empty() {
        return;
    }
    let mut references = array_string_values(group.get(key));
    for name in names {
        if !references.contains(name) {
            references.push(name.clone());
        }
    }
    group[key] = json!(references);
}

// Only extend explicitly selected primary groups. Secondary policies and rules
// remain outside the runtime configuration. Keep filters and group options intact.
pub(crate) fn attach_merged_profile_nodes(
    profile: &mut Value,
    target_names: &[String],
    report: &mut ProfileMergeReport,
) {
    let mut groups = profile
        .get("proxy-groups")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    report.available_targets = groups
        .iter()
        .filter(|group| is_merge_target(group))
        .filter_map(value_name)
        .collect();
    let providers = profile
        .get("proxy-providers")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let mut graph = HashMap::<String, HashSet<String>>::new();
    let all_nodes = profile
        .get("proxies")
        .and_then(Value::as_array)
        .map(|nodes| nodes.iter().filter_map(value_name).collect::<Vec<_>>())
        .unwrap_or_default();
    for group in &groups {
        if let Some(name) = value_name(group) {
            let neighbors = graph.entry(name).or_default();
            neighbors.extend(array_string_values(group.get("proxies")));
            if group.get("include-all").and_then(Value::as_bool) == Some(true)
                || group.get("include-all-proxies").and_then(Value::as_bool) == Some(true)
            {
                neighbors.extend(all_nodes.iter().cloned());
            }
            let mut used = array_string_values(group.get("use"));
            if group.get("include-all").and_then(Value::as_bool) == Some(true)
                || group.get("include-all-providers").and_then(Value::as_bool) == Some(true)
            {
                used.extend(providers.keys().cloned());
            }
            for provider in used.iter().filter_map(|name| providers.get(name)) {
                neighbors.extend(profile_merge_provider_dialers(provider));
            }
        }
    }
    for proxy in profile
        .get("proxies")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        if let (Some(name), Some(dialer)) = (
            value_name(proxy),
            proxy.get("dialer-proxy").and_then(Value::as_str),
        ) {
            graph.entry(name).or_default().insert(dialer.to_string());
        }
    }
    let nodes = report
        .members
        .iter()
        .filter(|member| !member.primary)
        .flat_map(|member| member.nodes.iter().cloned())
        .collect::<Vec<_>>();
    let provider_names = report
        .members
        .iter()
        .filter(|member| !member.primary)
        .flat_map(|member| member.providers.iter().cloned())
        .collect::<Vec<_>>();
    for name in dedupe_ids(target_names.iter().cloned()) {
        let Some(group) = groups
            .iter_mut()
            .find(|group| value_name(group).as_deref() == Some(&name) && is_merge_target(group))
        else {
            report.missing_targets.push(name);
            continue;
        };
        let mut target = ProfileMergeTarget {
            name: name.clone(),
            ..Default::default()
        };
        let existing_nodes = array_string_values(group.get("proxies"));
        let existing_providers = array_string_values(group.get("use"));
        let mut safe_nodes = Vec::new();
        let mut safe_providers = Vec::new();
        for node in &nodes {
            if can_reach(&graph, node, &name) {
                target.skipped_nodes.push(node.clone());
            } else {
                safe_nodes.push(node.clone());
                graph.entry(name.clone()).or_default().insert(node.clone());
                if !existing_nodes.contains(node) {
                    target.added_nodes += 1;
                }
            }
        }
        for provider_name in &provider_names {
            let dialers = providers
                .get(provider_name)
                .map(profile_merge_provider_dialers)
                .unwrap_or_default();
            if dialers
                .iter()
                .any(|dialer| can_reach(&graph, dialer, &name))
            {
                target.skipped_providers.push(provider_name.clone());
            } else {
                safe_providers.push(provider_name.clone());
                graph.entry(name.clone()).or_default().extend(dialers);
                if !existing_providers.contains(provider_name) {
                    target.added_providers += 1;
                }
            }
        }
        append_group_references(group, "proxies", &safe_nodes);
        append_group_references(group, "use", &safe_providers);
        report.targets.push(target);
    }
    if profile.get("proxy-groups").is_some() {
        profile["proxy-groups"] = json!(groups);
    }
}
