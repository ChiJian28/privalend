import { createRequire } from "node:module";
import type { Request, Response } from "express";
import { config } from "../config.js";

const require = createRequire(import.meta.url);
const express = require("express") as typeof import("express");

const app = express();
app.use(express.json());

// Store the last received payload for the frontend to fetch and display
let lastReceivedPayload: any = null;
let lastReceivedAt: string | null = null;

/**
 * Dynamic Pricing Engine:
 * Rate = Base Rate (4.0%) + (850 - credit_score) * 0.02%
 * Credit scores range from 300-850
 */
function dynamicRate(creditScore: number): number {
  const BASE_RATE = 4.0;
  const clampedScore = Math.max(300, Math.min(850, creditScore));
  return Math.round((BASE_RATE + (850 - clampedScore) * 0.02) * 100) / 100;
}

/**
 * POST /api/offers
 * Mock lender endpoint: returns loan offers based on credit score with dynamic pricing
 */
app.post("/api/offers", (req: Request, res: Response) => {
  const { tier, requested_amount, term_months, purpose, credit_score } = req.body;

  console.log(`[MockBank] Received offer request: tier=${tier}, credit_score=${credit_score}, amount=$${requested_amount}`);

  const amount = requested_amount || 50000;
  const term = term_months || 36;

  // Use dynamic pricing if credit_score is provided, otherwise fall back to tier-based
  let baseRate: number;
  if (credit_score && credit_score >= 300) {
    baseRate = dynamicRate(credit_score);
    console.log(`[MockBank] 📊 Dynamic pricing: score ${credit_score} → rate ${baseRate}%`);
  } else {
    baseRate = tier === "prime" ? 4.5 : tier === "near_prime" ? 7.2 : 12.5;
  }

  const offers = [
    {
      id: "offer_dbs_003",
      lender: "DBS Bank",
      amount,
      interest_rate: Math.round((baseRate - 0.2) * 100) / 100,
      term_months: term,
      monthly_payment: calculateMonthly(amount, baseRate - 0.2, term),
      total_cost: calculateMonthly(amount, baseRate - 0.2, term) * term,
      features: ["Lowest rate guarantee", "No early repayment penalty"],
    },
    {
      id: "offer_citi_001",
      lender: "CitiBank",
      amount,
      interest_rate: baseRate,
      term_months: term,
      monthly_payment: calculateMonthly(amount, baseRate, term),
      total_cost: calculateMonthly(amount, baseRate, term) * term,
      features: ["No origination fee", "Rate lock 60 days"],
    },
    {
      id: "offer_chase_002",
      lender: "JPMorgan Chase",
      amount,
      interest_rate: Math.round((baseRate + 0.3) * 100) / 100,
      term_months: term,
      monthly_payment: calculateMonthly(amount, baseRate + 0.3, term),
      total_cost: calculateMonthly(amount, baseRate + 0.3, term) * term,
      features: ["Cashback $500", "Flexible repayment"],
    },
  ];

  res.json({ offers, total_found: offers.length, pricing_method: credit_score ? "dynamic" : "tier-based", applied_base_rate: baseRate });
});

/**
 * POST /api/applications
 * Mock lender endpoint: receives loan application WITH resolved PII
 * (T3N node has already replaced {{profile.*}} placeholders with real data)
 */
app.post("/api/applications", (req: Request, res: Response) => {
  const payload = req.body;
  const lender = req.headers["x-lender"] || "Unknown";

  console.log(`[MockBank] 🎉 Received loan application from lender: ${lender}`);
  console.log(`[MockBank] Applicant: ${payload.application?.applicant?.full_name}`);
  console.log(`[MockBank] Amount: $${payload.application?.loan_amount}`);
  console.log(`[MockBank] ⚡ PII was resolved by T3N — Agent never saw this data!`);

  lastReceivedPayload = payload;
  lastReceivedAt = new Date().toISOString();

  res.status(201).json({
    status: "approved",
    reference: `PL-${Date.now().toString(36).toUpperCase()}`,
    lender,
    message: "Application approved. Welcome aboard!",
    decision_time_ms: 1200,
  });
});

/**
 * GET /last-received
 * Returns the last payload received by the mock bank.
 * Frontend uses this to show the "Bank Actually Received" panel.
 */
app.get("/last-received", (_req: Request, res: Response) => {
  if (!lastReceivedPayload) {
    return res.status(404).json({ error: "No applications received yet" });
  }
  res.json({
    payload: lastReceivedPayload,
    received_at: lastReceivedAt,
    note: "This is what the bank received AFTER T3N resolved all {{profile.*}} placeholders with real PII inside the TEE.",
  });
});

/**
 * GET /health
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "mock-bank-api" });
});

function calculateMonthly(principal: number, annualRate: number, months: number): number {
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return Math.round(((principal * monthlyRate * factor) / (factor - 1)) * 100) / 100;
}

export function startMockBankServer(): Promise<void> {
  return new Promise((resolve) => {
    app.listen(config.mockBank.port, () => {
      console.log(`[MockBank] Mock Bank API running on port ${config.mockBank.port}`);
      resolve();
    });
  });
}
