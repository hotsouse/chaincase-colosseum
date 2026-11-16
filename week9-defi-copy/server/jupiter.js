import { isSolanaAddress, validateVerificationInput } from './rpc.js';

export const JUPITER_API = 'https://api.jup.ag/swap/v2/order';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export function validateQuoteInput(input) {
  if (!input || input.network !== 'mainnet-beta') {
    throw Object.assign(new Error('Jupiter quotes are available for mainnet-beta only'), { status: 400 });
  }
  const { signature, network } = validateVerificationInput(input);
  if (!isSolanaAddress(input.mint, 32)) {
    throw Object.assign(new Error('Invalid SPL token mint address'), { status: 400 });
  }
  if (!isSolanaAddress(input.destination, 32)) {
    throw Object.assign(new Error('Invalid recipient token account address'), { status: 400 });
  }
  if (typeof input.amount !== 'string' || !/^[1-9]\d{0,19}$/.test(input.amount)) {
    throw Object.assign(new Error('Amount must be a positive raw token amount'), { status: 400 });
  }
  return { signature, network, mint: input.mint, destination: input.destination, amount: input.amount };
}

export async function getJupiterQuote(input, opts = {}) {
  const { mint, amount } = validateQuoteInput(input);
  if (mint === USDC_MINT) {
    throw Object.assign(new Error('The token is already USDC; no conversion quote is needed'), { status: 400 });
  }
  const fetcher = opts.fetcher || globalThis.fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  const url = new URL(JUPITER_API);
  url.search = new URLSearchParams({ inputMint: mint, outputMint: USDC_MINT, amount }).toString();
  try {
    const response = await fetcher(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) throw Object.assign(new Error(`Jupiter quote service returned HTTP ${response.status}`), { status: 503 });
    const body = await response.json();
    if (typeof body.outAmount !== 'string' || !/^\d+$/.test(body.outAmount) || !Number.isInteger(body.feeBps)) {
      throw Object.assign(new Error('Jupiter did not return a usable route quote'), { status: 503 });
    }
    return {
      source: 'JUPITER_SWAP_API_V2', network: 'mainnet-beta', inputMint: mint,
      outputMint: USDC_MINT, inAmount: amount, outAmount: body.outAmount,
      feeBps: body.feeBps, feeMint: typeof body.feeMint === 'string' ? body.feeMint : null,
      router: typeof body.router === 'string' ? body.router : null,
      transactionCreated: false, quotedAt: new Date().toISOString(),
      caution: 'Indicative quote only. No transaction was built or submitted. The route, output and fees can change before any separate swap.',
    };
  } catch (error) {
    if (error.status) throw error;
    throw Object.assign(new Error(error.name === 'AbortError' ? 'Jupiter quote timed out; retry later' : 'Jupiter quote service unavailable; no conversion value can be established'), { status: 503 });
  } finally { clearTimeout(timeout); }
}
