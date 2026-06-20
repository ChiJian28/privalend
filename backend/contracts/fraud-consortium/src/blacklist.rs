use crate::host::interfaces::kv_store;
use crate::host::tenant::tenant_context;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct BlacklistInput {
    user_did: String,
}

#[derive(Serialize)]
struct BlacklistOutput {
    is_flagged: bool,
    risk_level: String,
    checked_at: String,
    consortium_id: String,
}

#[derive(Deserialize)]
struct BlacklistEntry {
    flagged: bool,
    reason: String,
    reported_at: String,
}

pub fn check_blacklist(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: BlacklistInput = serde_json::from_slice(input)
        .map_err(|e| format!("parse input: {e}"))?;

    let tid = tenant_context::tenant_did();
    let map_name = format!("z:{}:fraud_blacklist", hex::encode(&tid));

    // Look up the user DID in the blacklist KV map
    let result = kv_store::get(&map_name, req.user_did.as_bytes())
        .map_err(|e| format!("kv read: {e}"))?;

    let (is_flagged, risk_level) = match result {
        Some(entry_bytes) => {
            let entry: BlacklistEntry = serde_json::from_slice(&entry_bytes)
                .map_err(|e| format!("parse entry: {e}"))?;

            (entry.flagged, "high".to_string())
        }
        None => {
            (false, "low".to_string())
        }
    };

    let output = BlacklistOutput {
        is_flagged,
        risk_level,
        checked_at: "2026-06-18T00:00:00Z".to_string(),
        consortium_id: format!("did:t3n:{}", hex::encode(&tid)),
    };

    serde_json::to_vec(&output).map_err(|e| e.to_string())
}
