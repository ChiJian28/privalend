"use client";

import { motion } from "framer-motion";
import type { LoanOffer } from "@/hooks/useWorkflow";

interface Props {
  offers: LoanOffer[];
  onSelect: (offerId: string) => void;
  isLoading: boolean;
}

export function StepOffers({ offers, onSelect, isLoading }: Props) {
  return (
    <div className="max-w-lg mx-auto pt-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Your Matched Offers</h2>
        <p className="text-sm text-slate-500">
          {offers.length} lenders matched your profile. Select one to apply instantly.
        </p>
        <div className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-blue-50 rounded-full text-[10px] text-blue-600 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Offers fetched via http::call — No PII was sent to lenders
        </div>
      </div>

      <div className="space-y-4">
        {offers.map((offer, i) => (
          <motion.div
            key={offer.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <OfferCard offer={offer} onSelect={onSelect} isLoading={isLoading} isBest={i === 0} />
          </motion.div>
        ))}
      </div>

      <p className="text-center text-[10px] text-slate-400 mt-6">
        When you click &quot;Apply&quot;, your PII is resolved by T3N inside the enclave.<br />
        The AI agent sends only <code className="text-red-500">{"{{profile.*}}"}</code> placeholders.
      </p>
    </div>
  );
}

function OfferCard({ offer, onSelect, isLoading, isBest }: { offer: LoanOffer; onSelect: (id: string) => void; isLoading: boolean; isBest: boolean }) {
  return (
    <div className={`relative p-5 rounded-xl border transition-all hover:shadow-md ${
      isBest ? "bg-white border-blue-200 shadow-sm" : "bg-white border-slate-100"
    }`}>
      {isBest && (
        <div className="absolute -top-2 left-4 px-2 py-0.5 bg-blue-600 text-white text-[9px] font-semibold rounded-full">
          BEST RATE
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{offer.lender}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-2xl font-bold text-blue-600">{offer.interest_rate}%</span>
            <span className="text-xs text-slate-400">APR</span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-lg font-semibold text-slate-900">${offer.monthly_payment.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500">/month × {offer.term_months}mo</div>
          <div className="text-[10px] text-slate-400">Total: ${offer.total_cost.toLocaleString()}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        {offer.features.map((f, i) => (
          <span key={i} className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded text-[10px] text-slate-600">
            {f}
          </span>
        ))}
      </div>

      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => onSelect(offer.id)}
        disabled={isLoading}
        className={`w-full mt-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
          isLoading
            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
            : isBest
              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm hover:shadow-md"
              : "bg-slate-900 text-white hover:bg-slate-800"
        }`}
      >
        {isLoading ? "Submitting..." : "One-Click Apply →"}
      </motion.button>
    </div>
  );
}
