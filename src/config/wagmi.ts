import { http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

const baseSepoliaChain = {
  ...baseSepolia,
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
} as const;

export const config = getDefaultConfig({
  appName: "SupaFund",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "b4c4feab4419d8e9e7fe6eb1a484ef29",
  chains: [baseSepoliaChain],
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
  ssr: true,
});
