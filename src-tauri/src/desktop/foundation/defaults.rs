use crate::desktop::prelude::*;

pub(crate) fn default_sysproxy_bypass() -> Vec<String> {
    if cfg!(target_os = "linux") {
        return vec![
            "localhost".to_string(),
            ".local".to_string(),
            "127.0.0.1/8".to_string(),
            "192.168.0.0/16".to_string(),
            "10.0.0.0/8".to_string(),
            "172.16.0.0/12".to_string(),
            "::1".to_string(),
        ];
    }

    if cfg!(target_os = "macos") {
        return vec![
            "127.0.0.1/8".to_string(),
            "192.168.0.0/16".to_string(),
            "10.0.0.0/8".to_string(),
            "172.16.0.0/12".to_string(),
            "localhost".to_string(),
            "*.local".to_string(),
            "*.crashlytics.com".to_string(),
            "<local>".to_string(),
        ];
    }

    vec![
        "localhost".to_string(),
        "127.*".to_string(),
        "192.168.*".to_string(),
        "10.*".to_string(),
        "172.16.*".to_string(),
        "172.17.*".to_string(),
        "172.18.*".to_string(),
        "172.19.*".to_string(),
        "172.20.*".to_string(),
        "172.21.*".to_string(),
        "172.22.*".to_string(),
        "172.23.*".to_string(),
        "172.24.*".to_string(),
        "172.25.*".to_string(),
        "172.26.*".to_string(),
        "172.27.*".to_string(),
        "172.28.*".to_string(),
        "172.29.*".to_string(),
        "172.30.*".to_string(),
        "172.31.*".to_string(),
        "<local>".to_string(),
    ]
}

pub(crate) fn default_empty_profile_item() -> ProfileItemData {
    ProfileItemData {
        id: "default".to_string(),
        item_type: "local".to_string(),
        name: "空白订阅".to_string(),
        url: None,
        fingerprint: None,
        ua: None,
        file: None,
        verify: None,
        interval: None,
        home: None,
        updated: None,
        override_ids: None,
        use_proxy: None,
        extra: None,
        locked: None,
        auto_update: Some(true),
    }
}
