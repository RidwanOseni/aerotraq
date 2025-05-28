import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers"; // Import the Providers component
import Navbar from "@/components/navbar"; // Import the Navbar component
import { Toaster } from "@/components/ui/sonner"; // Import the Toaster component from shadcn/ui's Sonner module [9]

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Drone Registry", // [3]
  description: "Register your drone flights and manage insurance claims", // [3]
};

export default function RootLayout({
  children, // [4]
}: {
  children: React.ReactNode; // [4]
}) {
  return (
    // Wrap everything inside Providers [4]
    <Providers>
      {/* Apply font class [4] */}
      <html lang="en" className={inter.className}>
        {/* Head content can go here */}
        <head />
        <body>
          <Navbar />
          <main>{children}</main>
          {/* Add the Toaster component here */}
          {/* This component is where toast notifications will be rendered */}
          <Toaster />
        </body>
      </html>
    </Providers>
  );
}