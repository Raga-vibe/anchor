import "server-only";
import {
  ComputeBudgetProgram,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type AddressLookupTableAccount,
} from "@solana/web3.js";
import { USDC_DECIMALS, USDC_MINT, type Asset } from "./assets";
import { evaluateQuote } from "./guard";
import { guardOne } from "./guard-service";
import { getQuote, getSwapInstructions, type JupIx, type JupQuote } from "./jupiter";
import { connection, getShareMultiplier, MEMO_PREFIX, MEMO_PROGRAM_ID } from "./solana";

export const MIN_USDC = 1;
export const MAX_USDC = 1000;

export async function guardedQuote(asset: Asset, usdc: number) {
  if (!(usdc >= MIN_USDC && usdc <= MAX_USDC)) throw new Error(`Amount must be between $${MIN_USDC} and $${MAX_USDC}`);
  const amount = BigInt(Math.round(usdc * 10 ** USDC_DECIMALS));
  const [g, multiplier, quote] = await Promise.all([
    guardOne(asset),
    getShareMultiplier(asset.xstockMint),
    getQuote(USDC_MINT, asset.xstockMint, amount),
  ]);
  if (!g.guard) throw new Error(g.error ?? "Guard unavailable");
  return priceQuote(asset, g.guard, g.session, quote, multiplier);
}

function priceQuote(
  asset: Asset,
  guard: NonNullable<Awaited<ReturnType<typeof guardOne>>["guard"]>,
  session: string,
  quote: JupQuote,
  multiplier: number,
) {
  const usdcIn = Number(quote.inAmount) / 10 ** USDC_DECIMALS;
  const tokensOut = Number(quote.outAmount) / 10 ** asset.xstockDecimals;
  const sharesOut = tokensOut * multiplier;
  const exec = evaluateQuote(guard, usdcIn, sharesOut);
  return {
    ticker: asset.ticker,
    xstockSymbol: asset.xstockSymbol,
    session,
    usdcIn,
    sharesOut,
    multiplier,
    route: quote.routePlan.map((r) => r.swapInfo.label),
    priceImpactPct: Number(quote.priceImpactPct) * 100,
    guard,
    exec,
    quote,
  };
}

export type GuardedQuote = Awaited<ReturnType<typeof guardedQuote>>;

function memoText(q: GuardedQuote) {
  const sign = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(1);
  return [
    MEMO_PREFIX,
    q.xstockSymbol,
    `v=${q.exec.verdict}`,
    `z=${q.guard.z.toFixed(2)}`,
    `prem=${sign(q.guard.premiumBps)}bp`,
    `exec=${sign(q.exec.execPremiumBps)}bp`,
    `sess=${q.session}`,
    `refage=${q.guard.hoursSinceReference.toFixed(1)}h`,
  ].join("|");
}

function toIx(i: JupIx) {
  return new TransactionInstruction({
    programId: new PublicKey(i.programId),
    keys: i.accounts.map((a) => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
    data: Buffer.from(i.data, "base64"),
  });
}

// Jupiter sizes the compute limit for the swap alone; give the memo headroom.
function bumpComputeLimit(ix: TransactionInstruction, extra: number) {
  if (!ix.programId.equals(ComputeBudgetProgram.programId) || ix.data[0] !== 2) return ix;
  const units = ix.data.readUInt32LE(1);
  return ComputeBudgetProgram.setComputeUnitLimit({ units: units + extra });
}

// Builds an unsigned v0 transaction: Jupiter swap + a memo recording the guard's
// verdict, so every buy leaves an auditable trail on-chain.
export async function buildGuardedSwap(asset: Asset, userPublicKey: string, quote: JupQuote) {
  if (quote.outputMint !== asset.xstockMint || quote.inputMint !== USDC_MINT) throw new Error("Quote does not match asset");
  const user = new PublicKey(userPublicKey);

  const [g, multiplier, ixs] = await Promise.all([
    guardOne(asset),
    getShareMultiplier(asset.xstockMint),
    getSwapInstructions(quote, user.toBase58()),
  ]);
  if (!g.guard) throw new Error(g.error ?? "Guard unavailable");
  const priced = priceQuote(asset, g.guard, g.session, quote, multiplier);
  const memo = memoText(priced);

  const conn = connection();
  const [alts, { blockhash, lastValidBlockHeight }] = await Promise.all([
    Promise.all(ixs.addressLookupTableAddresses.map((a) => conn.getAddressLookupTable(new PublicKey(a)))),
    conn.getLatestBlockhash("confirmed"),
  ]);
  const lookupTables = alts.map((r) => r.value).filter((v): v is AddressLookupTableAccount => v !== null);

  const instructions = [
    ...ixs.computeBudgetInstructions.map(toIx).map((ix) => bumpComputeLimit(ix, 20_000)),
    ...(ixs.otherInstructions ?? []).map(toIx),
    ...ixs.setupInstructions.map(toIx),
    toIx(ixs.swapInstruction),
    ...(ixs.cleanupInstruction ? [toIx(ixs.cleanupInstruction)] : []),
    new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from(memo, "utf8") }),
  ];

  const message = new TransactionMessage({ payerKey: user, recentBlockhash: blockhash, instructions }).compileToV0Message(
    lookupTables,
  );
  const tx = new VersionedTransaction(message);
  let serialized: Uint8Array;
  try {
    serialized = tx.serialize();
  } catch {
    throw new Error("This route is too large for one transaction. Try a different amount.");
  }
  return { transaction: Buffer.from(serialized).toString("base64"), lastValidBlockHeight, memo, exec: priced.exec };
}
