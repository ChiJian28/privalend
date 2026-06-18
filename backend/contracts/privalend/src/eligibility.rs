use crate::host::interfaces::{kv_store, logging};
use crate::host::tenant::tenant_context;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct EligibilityInput {
    fraud_result: FraudResult,
    loan_amount: u64,
    term_months: u32,
}

#[derive(Deserialize)]
struct FraudResult {
    is_flagged: bool,
    risk_level: String,
}

#[derive(Serialize)]
struct EligibilityOutput {
    score: u32,
    tier: String,
    max_loan_amount: u64,
    debt_to_income_ratio: f64,
    approved: bool,
}

#[derive(Deserialize)]
struct UserFinancialProfile {
    annual_income: u64,
    total_debt: u64,
    employment_years: u32,
    has_collateral: bool,
    credit_history_months: u32,
}

pub fn assess_eligibility(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: EligibilityInput = serde_json::from_slice(input)
        .map_err(|e| format!("parse input: {e}"))?;

    // Reject if flagged by fraud consortium
    if req.fraud_result.is_flagged {
        let _ = logging::info("Eligibility denied: user flagged in fraud check");
        let output = EligibilityOutput {
            score: 0,
            tier: "rejected".to_string(),
            max_loan_amount: 0,
            debt_to_income_ratio: 0.0,
            approved: false,
        };
        return serde_json::to_vec(&output).map_err(|e| e.to_string());
    }

    // Read user financial profile from KV store (only accessible inside TEE)
    let tid = tenant_context::tenant_did();
    let map_name = format!("z:{}:eligibility-cache", hex::encode(&tid));

    let profile = match kv_store::get(&map_name, b"user_financial_profile") {
        Ok(Some(bytes)) => {
            serde_json::from_slice::<UserFinancialProfile>(&bytes)
                .map_err(|e| format!("parse profile: {e}"))?
        }
        _ => {
            // Fallback demo profile (in production, this would come from user's T3N data)
            let _ = logging::info("Using demo financial profile");
            UserFinancialProfile {
                annual_income: 85000,
                total_debt: 12000,
                employment_years: 3,
                has_collateral: false,
                credit_history_months: 60,
            }
        }
    };

    let _ = logging::info("Computing credit score inside TEE enclave...");

    // Credit scoring algorithm (simplified for demo)
    let dti_ratio = profile.total_debt as f64 / profile.annual_income as f64;
    let mut score: u32 = 500;

    // Income factor
    if profile.annual_income > 100000 { score += 80; }
    else if profile.annual_income > 60000 { score += 60; }
    else if profile.annual_income > 40000 { score += 40; }

    // DTI factor
    if dti_ratio < 0.1 { score += 100; }
    else if dti_ratio < 0.2 { score += 80; }
    else if dti_ratio < 0.3 { score += 50; }
    else if dti_ratio < 0.4 { score += 20; }

    // Employment stability
    if profile.employment_years >= 5 { score += 60; }
    else if profile.employment_years >= 3 { score += 40; }
    else if profile.employment_years >= 1 { score += 20; }

    // Credit history length
    if profile.credit_history_months >= 120 { score += 60; }
    else if profile.credit_history_months >= 60 { score += 40; }
    else if profile.credit_history_months >= 24 { score += 20; }

    // Fraud risk adjustment
    if req.fraud_result.risk_level == "medium" {
        score = score.saturating_sub(50);
    }

    // Determine tier
    let (tier, max_multiplier) = if score >= 750 {
        ("prime", 3.0)
    } else if score >= 650 {
        ("near_prime", 2.0)
    } else if score >= 550 {
        ("subprime", 1.0)
    } else {
        ("declined", 0.0)
    };

    let max_loan_amount = (profile.annual_income as f64 * max_multiplier) as u64;
    let approved = max_loan_amount >= req.loan_amount && tier != "declined";

    let _ = logging::info(&format!(
        "Score: {} | Tier: {} | Max: ${} | Approved: {}",
        score, tier, max_loan_amount, approved
    ));

    let output = EligibilityOutput {
        score,
        tier: tier.to_string(),
        max_loan_amount,
        debt_to_income_ratio: dti_ratio,
        approved,
    };

    serde_json::to_vec(&output).map_err(|e| e.to_string())
}
