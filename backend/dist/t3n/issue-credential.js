import { createHash } from "crypto";
import { emitInspectorEvent } from "../websocket.js";
import { config } from "../config.js";
function tierDisplay(tier, score) {
    switch (tier.toLowerCase()) {
        case "prime":
            return "A+";
        case "near_prime":
            return "B+";
        case "subprime":
            return "C";
        default:
            if (score >= 750)
                return "A+";
            if (score >= 650)
                return "B+";
            return tier.toUpperCase();
    }
}
function addMonths(iso, months) {
    const d = new Date(iso);
    d.setMonth(d.getMonth() + months);
    return d.toISOString();
}
function generateProofValue(seed) {
    return "z" + createHash("sha256").update(seed).digest("base64url").slice(0, 43);
}
function generateDemoJws(seed) {
    const header = Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ iss: config.privalend.did, vc: seed.slice(0, 16) })).toString("base64url");
    const sig = createHash("sha256").update(seed + "jws").digest("base64url");
    return `${header}.${payload}.${sig}`;
}
export function buildDemoCredential(input) {
    const issuerDid = input.issuerDid ?? config.privalend.did;
    const issuanceDate = new Date().toISOString();
    const expirationDate = addMonths(issuanceDate, 12);
    const tierLabel = tierDisplay(input.tier, input.score);
    const vcId = `https://privalend.demo/credentials/${input.reference}`;
    const proofSeed = `${input.reference}:${input.userDid}:${input.score}:${issuanceDate}`;
    return {
        "@context": [
            "https://www.w3.org/2018/credentials/v1",
            "https://privalend.demo/schemas/credit/v1",
        ],
        id: vcId,
        type: ["VerifiableCredential", "CreditTierCredential"],
        issuer: issuerDid,
        issuanceDate,
        expirationDate,
        credentialSubject: {
            id: input.userDid,
            creditTier: tierLabel,
            creditScore: input.score,
            maxLoanAmount: input.maxLoanAmount,
            assessmentMethod: "TEE-confidential-computation",
            teeAttestation: "Intel-TDX",
            loanReference: input.reference,
        },
        proof: {
            type: "Ed25519Signature2020",
            created: issuanceDate,
            proofPurpose: "assertionMethod",
            verificationMethod: `${issuerDid}#keys-1`,
            proofValue: generateProofValue(proofSeed),
            jws: generateDemoJws(proofSeed),
            pending: "Demo signature — awaiting T3N sign-sd-jwt-vc on testnet",
        },
    };
}
/** VC issuance uses privalend v0.2.1+ (issue-credit-credential, no logging host). */
export const VC_CONTRACT_VERSION = "0.2.1";
async function tryTeeIssueCredential(input, privalend, agent) {
    const issuerDid = input.issuerDid ?? privalend.auth.did;
    const issuanceDate = new Date().toISOString();
    const expirationDate = addMonths(issuanceDate, 12);
    const teeInput = {
        user_did: input.userDid,
        score: input.score,
        tier: input.tier,
        max_loan_amount: input.maxLoanAmount,
        reference: input.reference,
        issuer_did: issuerDid,
        issued_at: issuanceDate,
        expires_at: expirationDate,
    };
    const versionsToTry = [VC_CONTRACT_VERSION, privalend.scriptVersion]
        .filter((v, i, arr) => arr.indexOf(v) === i);
    for (const version of versionsToTry) {
        try {
            const teeOutput = await agent.client.executeAndDecode({
                script_name: privalend.scriptName,
                script_version: version,
                function_name: "issue-credit-credential",
                input: teeInput,
            });
            if (!teeOutput?.credential)
                continue;
            return {
                mode: "tee",
                credential: teeOutput.credential,
                issuedInsideTee: teeOutput.issued_inside_tee ?? true,
            };
        }
        catch (e) {
            console.log(`[VC] TEE v${version} unavailable (${e.message?.slice(0, 100)})`);
        }
    }
    return null;
}
export async function issueCreditCredential(input, privalend, agent, step = 4) {
    emitInspectorEvent({
        type: "system",
        step,
        title: "🪪 Issuing Verifiable Credit Credential",
        content: `Attempting TEE issuance via issue-credit-credential...\nSubject: ${input.userDid}\nScore: ${input.score} | Tier: ${tierDisplay(input.tier, input.score)}\nReference: ${input.reference}`,
        highlight: "blue",
    });
    const teeResult = await tryTeeIssueCredential(input, privalend, agent);
    if (teeResult) {
        emitVcInspectorEvent(teeResult, step);
        return teeResult;
    }
    const demoResult = {
        mode: "demo",
        credential: buildDemoCredential(input),
        issuedInsideTee: false,
    };
    emitVcInspectorEvent(demoResult, step);
    return demoResult;
}
function emitVcInspectorEvent(result, step) {
    const badge = result.mode === "tee" ? "TEE-ISSUED" : "DEMO MODE";
    emitInspectorEvent({
        type: "vc_issued",
        step,
        title: `🪪 Verifiable Credit Credential [${badge}]`,
        content: JSON.stringify(result.credential, null, 2),
        highlight: result.mode === "tee" ? "green" : "yellow",
    });
}
