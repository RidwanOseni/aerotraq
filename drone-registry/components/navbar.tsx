"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { DrillIcon as Drone, BarChart2, Shield, FileText, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MobileMenu } from "@/components/mobile-menu"
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
  const [displayMessage, setDisplayMessage] = useState(""); // State for displaying wallet message
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null); // Timer for message display
  const [dropdownOpen, setDropdownOpen] = useState(false); // State for dropdown visibility

  // Effect to handle wallet connection status
  useEffect(() => {
    if (isConnected && address) {
      setDisplayMessage("Wallet connected");
      const newTimer = setTimeout(() => {
        setDisplayMessage(`Wallet connected: ${formatAddress(address)}`);
      }, 3000);
      setTimer(newTimer);
    } else {
      setDisplayMessage(""); // Clear message if not connected
      if (timer) {
        clearTimeout(timer); // Clear timer if disconnected
      }
    }
  }, [isConnected, address]);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`; // Format the address
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex items-center">
          <Drone className="h-6 w-6 mr-2" />
          <span className="hidden font-bold sm:inline-block">Drone Registry</span>
        </div>

        <nav className="hidden md:flex flex-1 items-center justify-center space-x-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center px-4 py-2 text-sm font-medium transition-colors rounded-md",
                  isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <item.icon className="w-4 h-4 mr-2" />
                {item.name}
              </Link>
            )
          })}

          {/* Dropdown for Register Flight */}
          <div className="relative">
            <Button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center">
              <Drone className="h-4 w-4 mr-2" />
              Register Flight
            </Button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border rounded-md shadow-lg z-10">
                <Link href="/register-flight/basic" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  Basic Registration
                </Link>
                <Link href="/register-flight" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  Full Registration
                </Link>
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center justify-end space-x-2">
          {isConnected ? (
            <>
              <div className="text-green-500">{displayMessage}</div> {/* Display wallet message */}
              <Button onClick={() => disconnect()}>Disconnect</Button> {/* Disconnect button */}
            </>
          ) : (
            <WalletConnect /> // Render WalletConnect without props
          )}
          <MobileMenu items={navItems} />
        </div>
      </div>
    </header>
  )
}