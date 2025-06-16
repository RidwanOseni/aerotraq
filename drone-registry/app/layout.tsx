import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./WagmiProviderWrapper"; // Ensure this path correctly points to your WagmiProviderWrapper.tsx
import Navbar from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Drone Registry",
  description: "Register your drone flights and manage insurance claims",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
          async
          defer
        />
      </head>
      <body className={inter.className}>
        {/* Wrap Navbar and children inside Providers to ensure Wagmi context is available */}
        <Providers>
          <Navbar />
          {children}
        </Providers>
        <Toaster /> {/* Toaster should typically be outside the provider, but still within the body */}
      </body>
    </html>
  );
}