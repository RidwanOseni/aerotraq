"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { DrillIcon as Drone, BarChart2, Shield, FileText, Clock, HandCoins, Store } from "lucide-react" // Added HandCoins and Store import
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
    { name: "Revenue", href: "/revenue", icon: HandCoins },
    { name: "Marketplace", href: "/marketplace-preview", icon: Store }, // Added new Marketplace item
]

export default function Navbar() {
    const pathname = usePathname()
    const { isConnected, address } = useAccount();
    const { disconnect } = useDisconnect();

    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const formatAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const handleDropdownSelect = () => {
        setDropdownOpen(false);
    };

    return (
        <nav className="flex items-center justify-between p-4 border-b">
            <Link href="/" className="flex items-center space-x-2">
                <Drone className="h-6 w-6 text-primary" />
                <span className="font-bold text-xl">Drone Registry</span>
            </Link>

            <div className="hidden md:flex space-x-4">
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
                            <item.icon className="mr-2 h-4 w-4" />
                            {item.name}
                        </Link>
                    )
                })}

                {/* Register Flight Dropdown */}
                <div className="relative">
                    <Button
                        variant="ghost"
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="flex items-center"
                    >
                        Register Flight
                        {/* Optional: Add a chevron icon for dropdown */}
                    </Button>
                    {dropdownOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 py-1">
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
            </div>

            <div className="hidden md:flex items-center space-x-4">
                {isClient ? (
                    isConnected ? (
                        <div className="flex items-center space-x-2">
                            <span className="text-sm text-muted-foreground">
                                Wallet connected: {address ? formatAddress(address) : ''}
                            </span>
                            <Button variant="outline" size="sm" onClick={() => disconnect()} className="text-sm">Disconnect</Button>
                        </div>
                    ) : (
                        <WalletConnect />
                    )
                ) : (
                    <span className="text-sm text-muted-foreground">Wallet Status...</span>
                )}
            </div>

            <MobileMenu items={navItems} /> {/* Pass navItems to MobileMenu */}
        </nav>
    );
}