"use client";

import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAccount } from "wagmi";

// The interface for the props received by ComplianceSuggestions component
interface ComplianceSuggestionsProps {
  messages: string[]; // Corrected: Prop name changed from 'suggestions' to 'messages' to match usage
}

export function ComplianceSuggestions({ messages }: ComplianceSuggestionsProps) { // Corrected: Destructure 'messages' directly
  const { isConnected } = useAccount();

  return (
    <Alert className="mt-4">
      <AlertTitle>AI Compliance Suggestions</AlertTitle>
      <AlertDescription>
        Based on your flight details, here are some compliance recommendations
        {isConnected ? (
          <ul className="list-disc list-inside mt-2">
            {messages.map((suggestion, index) => ( // Use 'messages' here
              <li key={index} className="text-sm">
                - {suggestion}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm mt-2">
            Please connect your wallet to see compliance suggestions.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}