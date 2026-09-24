import { notFound } from "next/navigation";
import { getAsset } from "@/lib/assets";
import StockView from "./StockView";

export default async function StockPage({ params }: PageProps<"/stock/[ticker]">) {
  const { ticker } = await params;
  const asset = getAsset(ticker);
  if (!asset) notFound();
  return <StockView ticker={asset.ticker} name={asset.name} xstockSymbol={asset.xstockSymbol} />;
}
