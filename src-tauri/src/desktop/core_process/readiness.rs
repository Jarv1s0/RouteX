use crate::desktop::prelude::*;
use crate::desktop::*;

pub(crate) fn expected_runtime_group_count(runtime_config: &Value) -> usize {
    let mode = runtime_config
        .get("mode")
        .and_then(Value::as_str)
        .unwrap_or("rule");
    if mode == "direct" {
        return 0;
    }

    runtime_config
        .get("proxy-groups")
        .and_then(Value::as_array)
        .map(|groups| {
            groups
                .iter()
                .filter(|group| {
                    !group
                        .get("hidden")
                        .and_then(Value::as_bool)
                        .unwrap_or(false)
                })
                .count()
        })
        .unwrap_or(0)
}

pub(crate) fn controller_provider_count(value: &Value) -> Option<usize> {
    value
        .get("providers")
        .and_then(Value::as_object)
        .map(|providers| providers.len())
}

pub(crate) fn controller_providers_ready(value: Value, expected_count: usize) -> (bool, usize) {
    let actual_count = controller_provider_count(&value).unwrap_or(0);
    (
        expected_count == 0 || actual_count >= expected_count,
        actual_count,
    )
}

pub(crate) fn wait_for_renderer_data_ready(
    state: &State<'_, CoreState>,
    runtime_config: &Value,
) -> Result<(), String> {
    let expected_group_count = expected_runtime_group_count(runtime_config);
    let mut last_error = String::from("Mihomo renderer data is not available");

    for _ in 0..50 {
        let rules_ready = match core_request(state, reqwest::Method::GET, "/rules", None, None) {
            Ok(_) => true,
            Err(error) => {
                last_error = error;
                std::thread::sleep(Duration::from_millis(200));
                continue;
            }
        };

        let proxies = match core_request(state, reqwest::Method::GET, "/proxies", None, None) {
            Ok(value) => value,
            Err(error) => {
                last_error = error;
                std::thread::sleep(Duration::from_millis(200));
                continue;
            }
        };

        let groups = build_mihomo_groups_value(&proxies, runtime_config);
        let actual_group_count = groups.as_array().map(|items| items.len()).unwrap_or(0);
        // Mihomo may drop or rewrite configured groups after overrides are applied, so the
        // renderer-ready check must not wait for the configured group count to reappear exactly.
        let groups_ready = expected_group_count == 0 || actual_group_count > 0;

        if rules_ready && groups_ready {
            return Ok(());
        }

        last_error = format!(
            "waiting for renderer groups to become available: configured {expected_group_count}, got {actual_group_count}"
        );
        std::thread::sleep(Duration::from_millis(200));
    }

    Err(format!(
        "Timed out waiting for Mihomo renderer data to become ready: {last_error}"
    ))
}

pub(crate) fn wait_for_core_ready(
    state: &State<'_, CoreState>,
    runtime_config: &Value,
) -> Result<(), String> {
    let mut last_error = String::from("Mihomo controller is not available");
    let tun_enabled = runtime_tun_enabled(runtime_config);
    // TUN 模式下核心需要先初始化 Wintun/虚拟网卡才会开放 HTTP controller，
    // 给更多次数（150 次 × 100ms = 15 秒上限）；非 TUN 给 60 次（6 秒）。
    // 相比之前 100/50 × 200ms = 20s/10s，响应延迟减半，总超时也减半。
    let controller_ready_retries = if tun_enabled { 150 } else { 60 };
    let poll_interval_ms = 100u64;
    let expected_rule_providers = runtime_config
        .get("rule-providers")
        .and_then(Value::as_object)
        .map(|providers| providers.len())
        .unwrap_or(0);
    let expected_proxy_providers = runtime_config
        .get("proxy-providers")
        .and_then(Value::as_object)
        .map(|providers| providers.len())
        .unwrap_or(0);

    let started_at = Instant::now();
    for attempt in 0..controller_ready_retries {
        match core_request(state, reqwest::Method::GET, "/rules", None, None) {
            Ok(_) => {
                eprintln!(
                    "[desktop.core_ready] controller ready after {}ms (attempt {}{})",
                    started_at.elapsed().as_millis(),
                    attempt,
                    if tun_enabled { ", TUN mode" } else { "" }
                );
                // providers 就绪检查：只要求 controller 暴露 provider 数据结构。
                // 必须等到配置声明的 provider 数量出现在 controller 里，否则渲染端会缓存空
                // provider 列表，只剩 rules 引用数量，导致规则集和规则总数显示错误。
                let provider_wait_start = Instant::now();
                let mut providers_ready = false;
                let mut actual_proxy_providers = 0usize;
                let mut actual_rule_providers = 0usize;
                for _ in 0..100 {
                    let proxy_ready = if expected_proxy_providers == 0 {
                        true
                    } else {
                        let (ready, count) = core_request(
                            state,
                            reqwest::Method::GET,
                            "/providers/proxies",
                            None,
                            None,
                        )
                        .ok()
                        .map(|value| controller_providers_ready(value, expected_proxy_providers))
                        .unwrap_or((false, 0));
                        actual_proxy_providers = count;
                        ready
                    };

                    let rule_ready = if expected_rule_providers == 0 {
                        true
                    } else {
                        let (ready, count) = core_request(
                            state,
                            reqwest::Method::GET,
                            "/providers/rules",
                            None,
                            None,
                        )
                        .ok()
                        .map(|value| controller_providers_ready(value, expected_rule_providers))
                        .unwrap_or((false, 0));
                        actual_rule_providers = count;
                        ready
                    };

                    if proxy_ready && rule_ready {
                        providers_ready = true;
                        break;
                    }

                    std::thread::sleep(Duration::from_millis(poll_interval_ms));
                }

                if providers_ready {
                    if let Err(error) = wait_for_renderer_data_ready(state, runtime_config) {
                        eprintln!(
                            "[desktop.core_ready] renderer data not fully ready yet: {}",
                            error
                        );
                    }
                } else {
                    eprintln!(
                        "[desktop.core_ready] providers not fully ready after {}ms, continuing anyway \
                         (proxy_providers={actual_proxy_providers}/{expected_proxy_providers}, \
                         rule_providers={actual_rule_providers}/{expected_rule_providers})",
                        provider_wait_start.elapsed().as_millis()
                    );
                }
                return Ok(());
            }
            Err(error) => {
                last_error = error;
                std::thread::sleep(Duration::from_millis(poll_interval_ms));
            }
        }
    }

    Err(format!(
        "Timed out waiting for Mihomo controller to become ready after {}ms: {last_error}",
        started_at.elapsed().as_millis()
    ))
}
