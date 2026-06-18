import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrivaLend — Privacy-Preserving AI Loan Marketplace",
  description: "Zero-knowledge loan applications powered by Terminal 3 Network TEE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased overflow-hidden h-screen">
        {children}
      </body>
    </html>
  );
}
