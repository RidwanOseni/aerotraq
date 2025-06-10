"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { DrillIcon as Drone, BarChart2, Shield, FileText, Clock, HandCoins } from "lucide-react" // Added HandCoins import
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MobileMenu } from "@/components/mobile-menu"
import { WalletConnect } from "@/components/wallet-connect"
import { useState, useEffect } from "react"
import { useAccount, useDisconnect } from "wagmi";

const navItems = [
  { name: "Dashboard", href: "/", icon: BarChart2 },
  { name: "Purchase Insurance", href: "/purchase-insurance", icon: Shield },
  { name: "File Claim", href: "/file-claim", icon: FileText },
  { name: "Flight History", href: "/flight-history", icon: Clock },
  { name: "Revenue", href: "/revenue", icon: HandCoins }, // Added new Revenue item
]

export default function Navbar() {
  const pathname = usePathname()
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // New state to track if the component has mounted on the client
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Set isClient to true once the component mounts on the client
    setIsClient(true);
  }, []);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleDropdownSelect = () => {
    setDropdownOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
        <div className="mr-4 flex items-center">
          <Drone className="h-6 w-6 mr-2" />
          <Link href="/" className="text-xl font-bold">
            Drone Registry
          </Link>
        </div>
        <div className="hidden md:flex items-center space-x-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center px-4 py-2 text-sm font-medium transition-colors rounded-md",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {/* Assuming item.icon is a component */}
                <item.icon className="h-4 w-4 mr-2" /> {/* Render the icon component */}
                {item.name}
              </Link>
            )
          })}
          <div className="relative">
            <Button
              variant="ghost"
              onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center"
            >
              Register Flight
              {/* Optional: Add a chevron icon for dropdown */}
            </Button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                  <Link
                    href="/register-flight/basic"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={handleDropdownSelect}
                  >
                    Basic Registration
                  </Link>
                  <Link
                    href="/register-flight"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={handleDropdownSelect}
                  >
                    Full Registration
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center md:hidden">
          {/*
            CRITICAL CHANGE: Pass the navItems array to the MobileMenu component as the 'items' prop.
            This ensures the MobileMenu component receives the data it expects for rendering.
          */}
          <MobileMenu items={navItems} />
        </div>
        <div className="ml-auto flex items-center space-x-4">
          {/* Wallet connection status display */}
          {isClient ? ( // Only render wallet status dynamically once the component is mounted on the client
            isConnected ? (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Wallet connected: {address ? formatAddress(address) : ''}
                </span>
                <Button onClick={() => disconnect()} className="text-sm">Disconnect</Button>
              </div>
            ) : (
              <WalletConnect />
            )
          ) : (
            // Placeholder for server-side rendering or during initial client hydration
            <span className="text-sm text-muted-foreground">Wallet Status...</span>
          )}
        </div>
      </div>
    </nav>
  );
}