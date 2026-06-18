use crate::host::interfaces::{http_with_placeholders as hwp, logging};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct ApplicationInput {
    offer_id: String,
    loan_amount: u64,
    term_months: u32,
    lender: String,
}

#[derive(Serialize)]
struct ApplicationOutput {
    status: String,
    reference: String,
    lender: String,
    message: String,
}

pub fn submit_application(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: ApplicationInput = serde_json::from_slice(input)
        .map_err(|e| format!("parse input: {e}"))?;

    let _ = logging::info(&format!(
        "Submitting application to {} for offer {}",
        req.lender, req.offer_id
    ));

    // Build the application payload with PII placeholders.
    // The TEE node resolves {{profile.*}} from the user's profile
    // INSIDE the enclave — plaintext PII never enters this WASM.
    let application_body = serde_json::json!({
        "application": {
            "offer_id": req.offer_id,
            "loan_amount": req.loan_amount,
            "term_months": req.term_months,
            "applicant": {
                "full_name": "{{profile.first_name}} {{profile.last_name}}",
                "email": "{{profile.verified_contacts.email.value}}",
                "date_of_birth": "{{profile.date_of_birth}}",
                "id_number": "{{profile.id_number}}",
                "phone": "{{profile.verified_contacts.phone.value}}"
            },
            "consent": {
                "credit_check": true,
                "data_sharing": true,
                "timestamp": "2026-06-18T00:00:00Z"
            }
        }
    });

    let resp = hwp::call(&hwp::Request {
        method: hwp::Verb::Post,
        url: "http://localhost:4000/api/applications".to_string(),
        headers: Some(vec![
            ("Content-Type".to_string(), "application/json".to_string()),
            ("Authorization".to_string(), "Bearer mock_lender_key_12345".to_string()),
            ("X-Lender".to_string(), req.lender.clone()),
        ]),
        payload: Some(serde_json::to_vec(&application_body).map_err(|e| e.to_string())?),
    })
    .map_err(|e| format_http_error(e))?;

    if resp.code == 200 || resp.code == 201 {
        let _ = logging::info("Application submitted successfully — PII never left the enclave");
        // Parse lender response or return success
        if !resp.payload.is_empty() {
            Ok(resp.payload)
        } else {
            let output = ApplicationOutput {
                status: "approved".to_string(),
                reference: format!("PL-{}", &req.offer_id[6..]),
                lender: req.lender,
                message: "Application submitted. PII resolved inside TEE, never exposed to agent.".to_string(),
            };
            serde_json::to_vec(&output).map_err(|e| e.to_string())
        }
    } else {
        let body = String::from_utf8_lossy(&resp.payload);
        Err(format!("Lender API error: HTTP {} — {}", resp.code, body))
    }
}

fn format_http_error(e: hwp::HttpError) -> String {
    match e {
        hwp::HttpError::EgressDenied(host) => format!("egress denied for host {host}"),
        hwp::HttpError::PlaceholderDenied(marker) => format!("placeholder not permitted: {marker}"),
        hwp::HttpError::PlaceholderUnknown(field) => format!("user profile missing field: {field}"),
        hwp::HttpError::PlaceholderNoUserContext => "no user context bound for placeholder resolution".to_string(),
        hwp::HttpError::UpstreamError(reason) => format!("upstream: {reason}"),
    }
}
