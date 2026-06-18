use crate::host::interfaces::{http as http_iface, kv_store, logging};
use crate::host::tenant::tenant_context;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct OffersInput {
    tier: String,
    amount: u64,
    term_months: u32,
    purpose: String,
}

#[derive(Serialize)]
struct OffersOutput {
    offers: Vec<LoanOffer>,
    total_found: usize,
}

#[derive(Serialize)]
struct LoanOffer {
    id: String,
    lender: String,
    amount: u64,
    interest_rate: f64,
    term_months: u32,
    monthly_payment: f64,
    total_cost: f64,
    features: Vec<String>,
}

pub fn fetch_offers(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: OffersInput = serde_json::from_slice(input)
        .map_err(|e| format!("parse input: {e}"))?;

    let _ = logging::info(&format!(
        "Fetching offers for tier={}, amount=${}, term={}mo",
        req.tier, req.amount, req.term_months
    ));

    // Read lender API key from secrets
    let tid = tenant_context::tenant_did();
    let secrets_map = format!("z:{}:secrets", hex::encode(&tid));
    let _api_key = kv_store::get(&secrets_map, b"lender_api_key")
        .map_err(|e| format!("kv read: {e}"))?
        .ok_or("lender_api_key not found in secrets")?;

    // Call mock bank API to get offers (no PII in this request)
    let request_body = serde_json::json!({
        "tier": req.tier,
        "requested_amount": req.amount,
        "term_months": req.term_months,
        "purpose": req.purpose,
    });

    let resp = http_iface::call(&http_iface::Request {
        method: http_iface::Verb::Post,
        url: "http://localhost:4000/api/offers".to_string(),
        headers: Some(vec![
            ("Content-Type".to_string(), "application/json".to_string()),
            ("Authorization".to_string(), "Bearer mock_lender_key_12345".to_string()),
        ]),
        payload: Some(serde_json::to_vec(&request_body).map_err(|e| e.to_string())?),
    })
    .map_err(|e| format!("lender API call failed: {e}"))?;

    if resp.code == 200 {
        let _ = logging::info("Successfully retrieved offers from lender API");
        Ok(resp.payload)
    } else {
        // Fallback: generate offers based on tier (for demo resilience)
        let _ = logging::info("Lender API unavailable, generating demo offers");
        let offers = generate_demo_offers(&req);
        serde_json::to_vec(&offers).map_err(|e| e.to_string())
    }
}

fn generate_demo_offers(req: &OffersInput) -> OffersOutput {
    let base_rate = match req.tier.as_str() {
        "prime" => 4.5,
        "near_prime" => 7.2,
        "subprime" => 12.5,
        _ => 15.0,
    };

    let amount = req.amount as f64;
    let term = req.term_months as f64;

    let offers = vec![
        LoanOffer {
            id: "offer_citi_001".to_string(),
            lender: "CitiBank".to_string(),
            amount: req.amount,
            interest_rate: base_rate,
            term_months: req.term_months,
            monthly_payment: calculate_monthly(amount, base_rate, term),
            total_cost: calculate_monthly(amount, base_rate, term) * term,
            features: vec!["No origination fee".to_string(), "Rate lock 60 days".to_string()],
        },
        LoanOffer {
            id: "offer_chase_002".to_string(),
            lender: "JPMorgan Chase".to_string(),
            amount: req.amount,
            interest_rate: base_rate + 0.3,
            term_months: req.term_months,
            monthly_payment: calculate_monthly(amount, base_rate + 0.3, term),
            total_cost: calculate_monthly(amount, base_rate + 0.3, term) * term,
            features: vec!["Cashback $500".to_string(), "Flexible repayment".to_string()],
        },
        LoanOffer {
            id: "offer_dbs_003".to_string(),
            lender: "DBS Bank".to_string(),
            amount: req.amount,
            interest_rate: base_rate - 0.2,
            term_months: req.term_months,
            monthly_payment: calculate_monthly(amount, base_rate - 0.2, term),
            total_cost: calculate_monthly(amount, base_rate - 0.2, term) * term,
            features: vec!["Lowest rate guarantee".to_string(), "No early repayment penalty".to_string()],
        },
    ];

    OffersOutput {
        total_found: offers.len(),
        offers,
    }
}

fn calculate_monthly(principal: f64, annual_rate: f64, months: f64) -> f64 {
    let monthly_rate = annual_rate / 100.0 / 12.0;
    if monthly_rate == 0.0 {
        return principal / months;
    }
    let factor = (1.0 + monthly_rate).powf(months);
    (principal * monthly_rate * factor) / (factor - 1.0)
}
