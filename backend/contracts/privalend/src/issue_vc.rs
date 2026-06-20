use crate::host::tenant::tenant_context;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct IssueVcInput {
    user_did: String,
    score: u32,
    tier: String,
    max_loan_amount: u64,
    reference: String,
    issuer_did: String,
    issued_at: String,
    expires_at: String,
}

#[derive(Serialize)]
struct CredentialSubject {
    id: String,
    #[serde(rename = "creditTier")]
    credit_tier: String,
    #[serde(rename = "creditScore")]
    credit_score: u32,
    #[serde(rename = "maxLoanAmount")]
    max_loan_amount: u64,
    #[serde(rename = "assessmentMethod")]
    assessment_method: String,
    #[serde(rename = "teeAttestation")]
    tee_attestation: String,
    #[serde(rename = "loanReference")]
    loan_reference: String,
}

#[derive(Serialize)]
struct CredentialProof {
    #[serde(rename = "type")]
    proof_type: String,
    created: String,
    #[serde(rename = "proofPurpose")]
    proof_purpose: String,
    #[serde(rename = "verificationMethod")]
    verification_method: String,
    #[serde(rename = "proofValue")]
    proof_value: String,
    pending: String,
}

#[derive(Serialize)]
struct VerifiableCredential {
    #[serde(rename = "@context")]
    context: Vec<String>,
    id: String,
    #[serde(rename = "type")]
    credential_type: Vec<String>,
    issuer: String,
    #[serde(rename = "issuanceDate")]
    issuance_date: String,
    #[serde(rename = "expirationDate")]
    expiration_date: String,
    #[serde(rename = "credentialSubject")]
    credential_subject: CredentialSubject,
    proof: CredentialProof,
}

#[derive(Serialize)]
struct IssueVcOutput {
    credential: VerifiableCredential,
    mode: String,
    #[serde(rename = "issuedInsideTee")]
    issued_inside_tee: bool,
}

fn tier_display(tier: &str, score: u32) -> String {
    match tier.to_lowercase().as_str() {
        "prime" => "A+".to_string(),
        "near_prime" => "B+".to_string(),
        "subprime" => "C".to_string(),
        _ if score >= 750 => "A+".to_string(),
        _ if score >= 650 => "B+".to_string(),
        _ => tier.to_uppercase(),
    }
}

pub fn issue_credit_credential(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: IssueVcInput = serde_json::from_slice(input)
        .map_err(|e| format!("parse input: {e}"))?;

    let tid = tenant_context::tenant_did();
    let now = req.issued_at.clone();
    let expiry = req.expires_at.clone();

    let tier_label = tier_display(&req.tier, req.score);
    let vc_id = format!("https://privalend.demo/credentials/{}", req.reference);

    let credential = VerifiableCredential {
        context: vec![
            "https://www.w3.org/2018/credentials/v1".to_string(),
            "https://privalend.demo/schemas/credit/v1".to_string(),
        ],
        id: vc_id,
        credential_type: vec![
            "VerifiableCredential".to_string(),
            "CreditTierCredential".to_string(),
        ],
        issuer: req.issuer_did.clone(),
        issuance_date: now.clone(),
        expiration_date: expiry,
        credential_subject: CredentialSubject {
            id: req.user_did.clone(),
            credit_tier: tier_label,
            credit_score: req.score,
            max_loan_amount: req.max_loan_amount,
            assessment_method: "TEE-confidential-computation".to_string(),
            tee_attestation: "Intel-TDX".to_string(),
            loan_reference: req.reference.clone(),
        },
        proof: CredentialProof {
            proof_type: "Ed25519Signature2020".to_string(),
            created: now,
            proof_purpose: "assertionMethod".to_string(),
            verification_method: format!("{}#keys-1", req.issuer_did),
            proof_value: format!("zTeePending:{}", &hex::encode(&tid)[..8]),
            pending: "sign-sd-jwt-vc host interface (Coming soon on T3N testnet)".to_string(),
        },
    };

    let output = IssueVcOutput {
        credential,
        mode: "tee".to_string(),
        issued_inside_tee: true,
    };

    serde_json::to_vec(&output).map_err(|e| e.to_string())
}
