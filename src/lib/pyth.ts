// Reads Pyth prices straight from Solana: the same PriceUpdateV2 accounts a
// smart contract would read. No API key, and anyone can verify the source.
import "server-only";
import { PublicKey } from "@solana/web3.js";
import { connection } from "./solana";

// Pyth Solana Receiver program: owns every verified PriceUpdateV2 account.
const PYTH_RECEIVER = new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");

export type PythPrice = {
  feedId: string;
  price: number;
  confidence: number;
  publishTimeMs: number;
  fullyVerified: boolean;
};

// PriceUpdateV2 layout: discriminator(8) | write_authority(32) |
// verification_level (enum: Partial{u8} = 2 bytes, Full = 1 byte) |
// feed_id(32) price(i64) conf(u64) exponent(i32) publish_time(i64)
// prev_publish_time(i64) ema_price(i64) ema_conf(u64) | posted_slot(u64)
export function decodePriceUpdateV2(data: Buffer): PythPrice {
  let o = 8 + 32;
  const level = data[o];
  o += level === 0 ? 2 : 1;
  const feedId = data.subarray(o, o + 32).toString("hex");
  o += 32;
  const price = data.readBigInt64LE(o);
  o += 8;
  const conf = data.readBigUInt64LE(o);
  o += 8;
  const expo = data.readInt32LE(o);
  o += 4;
  const publishTime = Number(data.readBigInt64LE(o));
  const scale = 10 ** expo;
  return {
    feedId,
    price: Number(price) * scale,
    confidence: Number(conf) * scale,
    publishTimeMs: publishTime * 1000,
    fullyVerified: level === 1,
  };
}

export async function readPythPrices(accounts: { address: string; feedId: string }[]): Promise<(PythPrice | null)[]> {
  const infos = await connection().getMultipleAccountsInfo(accounts.map((a) => new PublicKey(a.address)));
  return infos.map((info, i) => {
    if (!info || !info.owner.equals(PYTH_RECEIVER)) return null;
    const p = decodePriceUpdateV2(info.data);
    // Guard against a mis-configured address pointing at another feed.
    return p.feedId === accounts[i].feedId ? p : null;
  });
}
