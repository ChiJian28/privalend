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

    // T3N testnet http-with-placeholders host currently fails — demo approval inside TEE.
    let output = ApplicationOutput {
        status: "approved".to_string(),
        reference: format!("PL-{}", &req.offer_id[6..]),
        lender: req.lender,
        message: "Demo approval inside TEE (http-with-placeholders unavailable on testnet).".to_string(),
    };
    serde_json::to_vec(&output).map_err(|e| e.to_string())
}
