"use client";

import Link from "next/link";

import { usePathname } from "next/navigation";

import {
  DrillIcon as Drone,
  BarChart2,
  Shield, // Kept for the new 'Insurance' dropdown
  FileText, // Kept for 'File Claim' within 'Insurance' dropdown
  Clock,
  HandCoins,
  Store,
  ChevronDown, // Added for dropdown indication
} from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";

import { MobileMenu } from "@/components/mobile-menu";

import { useState, useEffect, useRef } from "react";

import { useAccount, useDisconnect } from "wagmi";

import { useConnectModal } from "@tomo-inc/tomo-evm-kit";

// The useConnectModal hook from Tomo's EVM Kit provides a seamless wallet connection experience:
// - Integrates Tomo's user-friendly wallet connection modal
// - Handles multiple wallet providers and connection states
// - Provides a consistent connection experience across the application
// The openConnectModal function is used in the "Connect Wallet" button to trigger
// Tomo's standardized connection flow, ensuring a smooth onboarding process for users.


interface MobileMenuProps {
  navItems: {
    name: string;
    href: string;
    icon: React.ElementType; // Corrected type for Lucide icons
  }[];
  formatAddress: (addr: string) => string;
}

const navItems = [
  { name: "Dashboard", href: "/", icon: BarChart2 },
  // Removed "Purchase Insurance" and "File Claim" from top-level navigation
  { name: "Flight History", href: "/flight-history", icon: Clock },
  { name: "Revenue", href: "/revenue", icon: HandCoins },
  { name: "Marketplace", href: "/marketplace-preview", icon: Store },
];

export default function Navbar() {
  const pathname = usePathname();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const [registerDropdownOpen, setRegisterDropdownOpen] = useState(false);
  const [insuranceDropdownOpen, setInsuranceDropdownOpen] = useState(false);

  // Re-introduce a client-side flag specifically for rendering wallet-dependent UI
  const [isClientSide, setIsClientSide] = useState(false);

  // This useEffect will only run on the client after the component mounts
  useEffect(() => {
    setIsClientSide(true);
  }, []);

  // Ref to detect clicks outside of any dropdown to close them
  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(event.target as Node)) {
        setRegisterDropdownOpen(false);
        setInsuranceDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleDropdownSelect = () => {
    setRegisterDropdownOpen(false);
    setInsuranceDropdownOpen(false);
  };

  return (
    <>
      {/* Mobile Menu for small screens */}
      {/* Assuming MobileMenuProps is correctly defined and passed elsewhere */}
      <MobileMenu
        items={[
          { name: "Dashboard", href: "/", icon: BarChart2 },
          { name: "Flight History", href: "/flight-history", icon: Clock },
          { name: "Revenue", href: "/revenue", icon: HandCoins },
          { name: "Marketplace", href: "/marketplace-preview", icon: Store },
          // These items are added here for the mobile menu explicitly
          { name: "Purchase Insurance", href: "/purchase-insurance", icon: Shield },
          { name: "File Claim", href: "/file-claim", icon: FileText },
          { name: "Basic Registration", href: "/register-flight/basic", icon: Drone },
          { name: "Full Registration", href: "/register-flight", icon: Drone },
        ]}
      />

      {/* Desktop Navigation */}
      <div className="flex justify-between items-center px-6 py-4 bg-background shadow-sm" ref={dropdownContainerRef}> {/* Add ref to container for click outside */}
        <Link href="/" className="text-xl font-bold text-foreground">
        <img src="/aerotraq-logo.svg" alt="Aerotraq Logo" className="h-9 w-auto" />
          Drone Registry
        </Link>
        <nav className="flex items-center space-x-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center px-4 py-2 text-sm font-medium transition-colors rounded-md",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                {item.name}
              </Link>
            );
          })}

          {/* Register Flight Dropdown */}
          <div className="relative">
            <Button
              variant="ghost"
              onClick={() => setRegisterDropdownOpen(!registerDropdownOpen)}
              className="flex items-center"
            >
              Register Flight
              <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${registerDropdownOpen ? 'rotate-180' : ''}`} />
            </Button>
            {registerDropdownOpen && (
              <div
                className="absolute left-0 top-full mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="menu-button"
                tabIndex={-1}
              >
                <Link
                  href="/register-flight/basic"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={handleDropdownSelect}
                >
                  Basic Registration
                </Link>
                <Link
                  href="/register-flight"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={handleDropdownSelect}
                >
                  Full Registration
                </Link>
              </div>
            )}
          </div>

          {/* NEW: Insurance Dropdown */}
          <div className="relative">
            <Button
              variant="ghost"
              onClick={() => setInsuranceDropdownOpen(!insuranceDropdownOpen)}
              className="flex items-center"
            >
              {/* Icon for Insurance */}
              <Shield className="mr-2 h-4 w-4" />
              Insurance
              <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${insuranceDropdownOpen ? 'rotate-180' : ''}`} />
            </Button>
            {insuranceDropdownOpen && (
              <div
                className="absolute left-0 top-full mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="menu-button"
                tabIndex={-1}
              >
                <Link
                  href="/purchase-insurance"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={handleDropdownSelect}
                >
                  Purchase Insurance
                </Link>
                <Link
                  href="/file-claim"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={handleDropdownSelect}
                >
                  File Claim
                </Link>
              </div>
            )}
          </div>

          {/* Wallet Connection Section */}
          <div className="ml-auto flex items-center space-x-2">
            {isClientSide ? ( // Conditionally render this block only on the client
              isConnected && address ? (
                <>
                  <span className="text-sm text-muted-foreground">
                    Wallet connected: {formatAddress(address)}
                  </span>
                  <Button variant="outline" onClick={() => disconnect()}>
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button onClick={() => openConnectModal()}>Connect Wallet</Button>
              )
            ) : (
              // Render a consistent placeholder on both server and client until client-side hydration is complete
              <Button disabled className="opacity-50 cursor-not-allowed">Loading Wallet...</Button>
            )}
          </div>
        </nav>
      </div>
    </>
  );
}
