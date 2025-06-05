"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { DrillIcon as Drone, BarChart2, Shield, FileText, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MobileMenu } from "@/components/mobile-menu" // Import MobileMenu component
import { WalletConnect } from "@/components/wallet-connect"
import { useState, useEffect } from "react"
import { useAccount, useDisconnect } from "wagmi"; // Import useAccount and useDisconnect from wagmi for wallet connection

const navItems = [
  { name: "Dashboard", href: "/", icon: BarChart2 },
  { name: "Purchase Insurance", href: "/purchase-insurance", icon: Shield },
  { name: "File Claim", href: "/file-claim", icon: FileText },
  { name: "Flight History", href: "/flight-history", icon: Clock },
]

export default function Navbar() {
  const pathname = usePathname()
  const { isConnected, address } = useAccount(); // Get wallet connection state
  const { disconnect } = useDisconnect(); // Get disconnect function
  const [dropdownOpen, setDropdownOpen] = useState(false); // State for dropdown visibility

  // New state to track if the component has mounted on the client (from your fix.txt) [6]
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Set isClient to true once the component mounts on the client [7]
    setIsClient(true);
  }, []);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`; // Format the address
  };

  const handleDropdownSelect = () => {
    setDropdownOpen(false); // Close the dropdown when an option is selected
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <Drone className="h-6 w-6" />
          <span className="font-bold text-lg">Drone Registry</span>
        </Link>
        <nav className="hidden md:flex items-center space-x-4">
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
                <item.icon className="mr-2 h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
          {/* Dropdown for Register Flight */}
          <div className="relative">
            <Button
              variant="ghost"
              onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center"
            >
              Register Flight
              {/* Optional: Add a chevron icon for dropdown */}
            </Button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                <div className="py-1">
                  <Link
                    href="/register-flight/basic"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={handleDropdownSelect} // Close dropdown on selection
                  >
                    Basic Registration
                  </Link>
                  <Link
                    href="/register-flight"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={handleDropdownSelect} // Close dropdown on selection
                  >
                    Full Registration
                  </Link>
                </div>
              </div>
            )}
          </div>
        </nav>
        {/*
          **CRITICAL CHANGE:** Pass the navItems array to the MobileMenu component as the 'items' prop.
          This ensures the MobileMenu component receives the data it expects for rendering.
        */}
        <MobileMenu items={navItems} />

        {/* Wallet connection status display (from your fix.txt) [8] */}
        {isClient ? ( // Only render wallet status dynamically once the component is mounted on the client
          isConnected ? (
            <div className="hidden md:flex items-center space-x-2">
              <span className="text-sm font-medium">Wallet connected: {address ? formatAddress(address) : ''}</span>
              <Button onClick={() => disconnect()} className="text-sm">Disconnect</Button>
            </div>
          ) : (
            <div className="hidden md:flex items-center space-x-2">
              <WalletConnect /> {/* Render WalletConnect without props */}
            </div>
          )
        ) : (
          // Placeholder for server-side rendering or during initial client hydration
          <div className="hidden md:flex items-center space-x-2">
            <span className="text-sm font-medium">Wallet Status...</span>
          </div>
        )}
      </div>
    </header>
  );
}