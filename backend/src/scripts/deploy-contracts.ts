/**
 * Contract deployment script.
 * Builds the Rust contracts and deploys them to T3N.
 *
 * Prerequisites:
 * - Rust toolchain installed with wasm32-wasip2 target
 * - cargo install wasm-tools (optional, for verification)
 *
 * Run: npm run setup:contracts
 */

import { execSync } from "child_process";
import { resolve } from "path";
import { existsSync } from "fs";

const CONTRACTS_DIR = resolve(import.meta.dirname, "../../contracts");

function buildContract(name: string, dir: string) {
  console.log(`\n🔨 Building ${name}...`);
  console.log(`   Directory: ${dir}`);

  if (!existsSync(resolve(dir, "Cargo.toml"))) {
    throw new Error(`Cargo.toml not found in ${dir}`);
  }

  try {
    execSync("cargo build --target wasm32-wasip2 --release", {
      cwd: dir,
      stdio: "inherit",
    });

    const wasmFile = resolve(dir, `target/wasm32-wasip2/release/${name.replace(/-/g, "_")}.wasm`);
    if (!existsSync(wasmFile)) {
      throw new Error(`WASM output not found at ${wasmFile}`);
    }

    console.log(`   ✅ Built: ${wasmFile}`);

    // Verify with wasm-tools if available
    try {
      execSync(`wasm-tools component wit "${wasmFile}"`, { stdio: "pipe" });
      console.log(`   ✅ WIT interface verified`);
    } catch {
      console.log(`   ℹ️  wasm-tools not found — skipping verification`);
    }

    return wasmFile;
  } catch (err: any) {
    throw new Error(`Build failed for ${name}: ${err.message}`);
  }
}

async function main() {
  console.log("🏗️  PrivaLend — Contract Build Script");
  console.log("=====================================");

  // Check Rust toolchain
  try {
    execSync("rustup target list --installed", { stdio: "pipe" });
  } catch {
    console.log("\n⚠️  Rust toolchain not found. Installing prerequisites...");
    execSync("rustup target add wasm32-wasip2", { stdio: "inherit" });
  }

  // Build both contracts
  const privalendWasm = buildContract(
    "z-privalend",
    resolve(CONTRACTS_DIR, "privalend")
  );

  const consortiumWasm = buildContract(
    "z-fraud-consortium",
    resolve(CONTRACTS_DIR, "fraud-consortium")
  );

  console.log("\n=====================================");
  console.log("✅ All contracts built successfully!");
  console.log(`   PrivaLend:  ${privalendWasm}`);
  console.log(`   Consortium: ${consortiumWasm}`);
  console.log("\nNext: Run 'npm run setup:tenants' to deploy to T3N testnet.");
  console.log("=====================================\n");
}

main().catch((err) => {
  console.error("\n❌ Build failed:", err.message || err);
  process.exit(1);
});
