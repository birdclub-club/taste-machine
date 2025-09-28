// Media proxy for Abstract NFTs
// Priority: Alchemy NFT API → IPFS reconstruction → original URL → SVG placeholder

import { NextRequest } from "next/server";
import { supabase } from "@lib/supabase";
import { generateFallbackIPFSUrl } from "@/lib/reservoir-image-optimizer";
import { enqueueTokenForIngest } from "@/lib/media-ingest-queue";

export const runtime = "edge";

// Feature flags
const ENABLE_MEDIA_MAPPING = true; // ✅ Re-enabled - database mappings fixed
// CDN-only mode (default ON). Disable only with NEXT_PUBLIC_CDN_ONLY=0
const CDN_ONLY = false; // Keep API proxy as fallback
const ENABLE_CDN_REDIRECT = true; // ✅ Re-enabled - CDN URLs working
const CDN_BASE = process.env.NEXT_PUBLIC_CDN_BASE || 'https://cdn.tastemachine.xyz'; // ✅ Re-enabled
const IS_DEV = process.env.NODE_ENV !== 'production';

// Normalize and bucket requested sizes to reduce variant cardinality
function bucketWidth(raw: string | null): number {
  const w = Math.max(64, Math.min(2048, parseInt(raw || '512', 10) || 512));
  const buckets = [384, 512, 1024];
  let best = buckets[0];
  for (const b of buckets) {
    if (Math.abs(b - w) < Math.abs(best - w)) best = b;
  }
  return best;
}

function bucketDpr(raw: string | null): number {
  const d = Math.max(1, Math.min(3, parseFloat(raw || '1') || 1));
  // snap to 1, 2, 3
  if (d < 1.5) return 1;
  if (d < 2.5) return 2;
  return 3;
}

// In-memory LRU cache for resolved media URLs (per edge instance)
type LruEntry = { value: string; expiresAt: number };
class SimpleLru {
  private map: Map<string, LruEntry> = new Map();
  private capacity: number;
  private ttlMs: number;
  constructor(capacity: number, ttlMs: number) {
    this.capacity = capacity;
    this.ttlMs = ttlMs;
  }
  get(key: string): string | null {
    const now = Date.now();
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt < now) {
      this.map.delete(key);
      return null;
    }
    // refresh LRU order
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }
  set(key: string, value: string) {
    const now = Date.now();
    const entry: LruEntry = { value, expiresAt: now + this.ttlMs };
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, entry);
    if (this.map.size > this.capacity) {
      const oldestKey = this.map.keys().next().value as string | undefined;
      if (oldestKey) this.map.delete(oldestKey);
    }
  }
}

// Module-level singletons (per edge isolate)
const urlLru = new SimpleLru(256, 24 * 60 * 60 * 1000); // 24h TTL
const inflightMap: Map<string, Promise<UpstreamResult>> = new Map();
const lastRunBatchAtByContract: Map<string, number> = new Map();

type UpstreamResult = {
  ok: boolean;
  status: number;
  contentType: string;
  etag?: string | null;
  lastModified?: string | null;
  body: ArrayBuffer | null;
  headers?: Record<string, string>;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  // @ts-ignore - allow fetch-style passing
  return (async () => {
    try {
      // If this is a fetch promise, it should accept signal; callers will wire it
      const result: any = await promise;
      return result as T;
    } finally {
      clearTimeout(timer);
    }
  })();
}

// Map inbound chain identifiers to the exact DB key used in nft_media_map
function normalizeChainKeyForDb(chain: string | null | undefined): string {
  if (!chain) return "eip155:2741";
  const lc = chain.toLowerCase();
  if (lc.startsWith('solana')) return 'solana:mainnet';
  if (lc.startsWith('eip155:')) return lc;
  // Numeric EVM chain id
  if (/^\d+$/.test(lc)) return `eip155:${lc}`;
  return lc;
}

// Treat Abstract aliases as equivalent: some data is keyed under 8453, some under 2741
function getAbstractAliases(chainKey: string): string[] {
  if (chainKey === 'eip155:8453') return ['eip155:8453', 'eip155:2741'];
  if (chainKey === 'eip155:2741') return ['eip155:2741', 'eip155:8453'];
  return [chainKey];
}

function stableKey(params: { chain: string; contract: string; tokenId: string; width: string; dpr: string }): string {
  const chainKey = normalizeChainKeyForDb(params.chain);
  return `${chainKey}:${params.contract.toLowerCase()}:${params.tokenId}:${params.width}:${params.dpr}`;
}

function isLikelyImage(buffer: ArrayBuffer, contentType?: string | null): boolean {
  if (contentType && contentType.toLowerCase().startsWith('image/')) return true;
  const bytes = new Uint8Array(buffer);
  // PNG
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
  // JPEG
  if (bytes.length > 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
  // GIF
  if (bytes.length > 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return true;
  // WEBP (RIFF....WEBP)
  if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return true;
  return false;
}

function extractIpfsPath(url: string): string | null {
  try {
    if (url.startsWith('ipfs://')) {
      return url.replace('ipfs://', '');
    }
    const u = new URL(url);
    const match = u.pathname.match(/\/ipfs\/(.*)$/);
    if (match && match[1]) return match[1];
  } catch {}
  return null;
}

function buildGatewayUrls(ipfsPath: string): string[] {
  const gateways = [
    'https://cloudflare-ipfs.com/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://cf-ipfs.com/ipfs/'
  ];
  return gateways.map(g => g + ipfsPath);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const contract = searchParams.get("contract") || searchParams.get("c");
  const tokenId = searchParams.get("tokenId") || searchParams.get("t");
  const chainParam = searchParams.get("chain") 
    || searchParams.get("chainId") 
    || process.env.NEXT_PUBLIC_ABSTRACT_CHAIN_ID 
    || process.env.ABSTRACT_CHAIN_ID 
    || "eip155:2741";
  const originalUrl = searchParams.get("url");
  const widthBucket = bucketWidth(searchParams.get("w"));
  const dprBucket = bucketDpr(searchParams.get("dpr") || req.headers.get("dpr"));

  if (!contract || !tokenId) {
    return new Response("Missing contract or tokenId", { status: 400 });
  }

  try {
    const key = stableKey({ chain: chainParam, contract, tokenId, width: String(widthBucket), dpr: String(dprBucket) });

    // Coalesce identical requests
    const existing = inflightMap.get(key);
    if (existing) {
      const result = await existing;
      return buildResponseFromUpstream(result);
    }

    const promise = (async (): Promise<UpstreamResult> => {
      // 0) Mapping-based read-through (storage/CDN) when enabled
      if (ENABLE_MEDIA_MAPPING) {
        try {
          const primaryKey = normalizeChainKeyForDb(chainParam);
          const chainCandidates = getAbstractAliases(primaryKey);
          const isSolana = primaryKey.startsWith('solana');
          const contractKey = isSolana ? contract! : contract!.toLowerCase();

          let mapRow: any = null;
          for (const ck of chainCandidates) {
            const { data } = await supabase
              .from('nft_media_map')
              .select('asset_hash, status, media_assets(storage_key)')
              .eq('chain', ck)
              .eq('contract', contractKey)
              .eq('token_id', String(tokenId))
              .limit(1);
            const row = Array.isArray(data) ? data[0] : data;
            if (row) { mapRow = row; break; }
          }
          console.log(`🔍 Media mapping query result for ${contract}:${tokenId}:`, mapRow ? `found ${mapRow.asset_hash} (status: ${mapRow.status})` : 'not found');
          if (mapRow && mapRow.status === 'ok' && mapRow.asset_hash) {
            console.log(`✅ Found media mapping: ${mapRow.asset_hash} for ${contract}:${tokenId}`);
            let masterPath = (mapRow as any).media_assets?.storage_key || `media/${mapRow.asset_hash}/master.webp`;
            // Normalize to path for CDN transform when a full URL sneaks in
            try {
              if (masterPath.startsWith('http')) {
                const u = new URL(masterPath);
                masterPath = u.pathname.replace(/^\//, '');
              }
            } catch {}
            // Prefer direct CDN variant redirect to pre-generated sizes
            if (ENABLE_CDN_REDIRECT && CDN_BASE) {
              console.log(`🔗 CDN redirect enabled: ${CDN_BASE}`);
              const needed = Math.ceil(widthBucket * dprBucket);
              const size = needed <= 256 ? 256 : needed <= 512 ? 512 : needed <= 1024 ? 1024 : 2048;
              const sep = CDN_BASE.endsWith('/') ? '' : '/';
              const variantUrl = `${CDN_BASE}${sep}media/${mapRow.asset_hash}/w${size}.webp`;
              // In local/dev, some CDNs block hotlinking; stream bytes through same-origin instead
              const host = req.headers.get('host') || '';
              const xfh = req.headers.get('x-forwarded-host') || '';
              const isLocal = host.includes('localhost') || host.includes('127.0.0.1') || xfh.includes('localhost');
              if (process.env.NODE_ENV !== 'production' || isLocal) {
                const streamed = await fetchUpstream(variantUrl);
                if (streamed.ok && streamed.body) {
                  streamed.headers = {
                    ...(streamed.headers || {}),
                    'Cache-Control': 'public, max-age=600, s-maxage=86400, stale-while-revalidate=2592000',
                    'Vary': 'Accept, DPR, Width, Save-Data',
                    'Cross-Origin-Resource-Policy': 'cross-origin',
                    'Timing-Allow-Origin': '*',
                    'X-Img-Source': 'cdn-stream',
                    'X-Img-Params': `w=${widthBucket};dpr=${dprBucket}`
                  };
                  return streamed as UpstreamResult;
                }
              }
              // Default: 302 to leverage CDN directly
              return {
                ok: true,
                status: 302,
                contentType: 'text/plain',
                body: null,
                headers: {
                  'Location': variantUrl,
                  'Cache-Control': 'public, max-age=600, s-maxage=86400, stale-while-revalidate=2592000',
                  'Vary': 'Accept, DPR, Width, Save-Data',
                  'Cross-Origin-Resource-Policy': 'cross-origin',
                  'Timing-Allow-Origin': '*',
                  'X-Img-Source': 'redirector',
                  'X-Img-Params': `w=${widthBucket};dpr=${dprBucket}`
                }
              } as UpstreamResult;
            } else if (masterPath.startsWith('http')) {
              // Dev shim: if storage_key is absolute, redirect directly in dev
              return {
                ok: true,
                status: 302,
                contentType: 'text/plain',
                body: null,
                headers: {
                  'Location': masterPath,
                  'Cache-Control': 'public, max-age=600, s-maxage=86400, stale-while-revalidate=2592000',
                  'Vary': 'Accept, DPR, Width, Save-Data',
                  'Cross-Origin-Resource-Policy': 'cross-origin',
                  'Timing-Allow-Origin': '*',
                  'X-Img-Source': 'redirector-dev',
                  'X-Img-Params': `w=${widthBucket};dpr=${dprBucket}`
                }
              } as UpstreamResult;
            }
          }
        } catch {}
      }

      // Try URL LRU first (resolved media URL)
      const cachedResolved = urlLru.get(key);
      if (cachedResolved) {
        const resolved = await fetchUpstream(cachedResolved); 
        if (resolved.ok && resolved.body && isLikelyImage(resolved.body, resolved.contentType)) return resolved;
      }

      // FORCE CDN REDIRECT - Check nfts_unified table for image URL
      if (CDN_BASE && ENABLE_CDN_REDIRECT) {
        console.log(`🚀 V2 MEDIA PIPELINE: Checking nft_media_map for ${contract}:${tokenId}`);
        
        try {
          const chainKey = normalizeChainKeyForDb(chainParam);
          // For nft_media_map, use simple chain IDs (not EIP-155 format)
          const chainCandidates = chainKey === 'eip155:2741' ? ['2741', '8453'] : 
                                  chainKey === 'eip155:8453' ? ['8453', '2741'] : 
                                  [chainKey.replace('eip155:', '')];
          const isSolana = chainKey.startsWith('solana');
          const contractKey = isSolana ? contract! : contract!.toLowerCase();
          
          console.log(`🔍 Searching nft_media_map: chains=${JSON.stringify(chainCandidates)}, contract=${contractKey}, tokenId=${String(tokenId)}`);
          
          let nftRow: any = null;
          for (const ck of chainCandidates) {
            console.log(`🔍 Trying chain: ${ck}`);
            
            try {
              const { data, error } = await withTimeout(
                supabase
                  .from('nft_media_map')
                  .select('asset_hash, status, source_uri')
                  .eq('chain', ck)
                  .eq('contract', contractKey)
                  .eq('token_id', String(tokenId))
                  .limit(1),
                1500 // 1.5 second timeout
              );
              
              console.log(`🔍 nft_media_map query result for ${ck}:`, { 
                data: Array.isArray(data) ? data[0] : data, 
                count: Array.isArray(data) ? data.length : (data ? 1 : 0),
                error: error?.message,
                fullData: data // DEBUG: show full data
              });
              
              const row = Array.isArray(data) ? data[0] : data;
              if (row && row.status === 'ok' && row.asset_hash) { 
                nftRow = row; 
                console.log(`✅ Found media mapping: status=${row.status}, asset_hash=${row.asset_hash}`);
                break;
              } else if (row) {
                console.log(`⚠️ Found row but status=${row.status}, asset_hash=${row.asset_hash}`);
              }
            } catch (timeoutError) {
              console.log(`⏰ Query timeout for chain ${ck}, trying next...`);
              continue;
            }
          }
          
          // 🚫 DISABLED: CDN direct redirect to fix CORS issues
          if (false) { // FIRST: Try to construct CDN URL directly from contract/tokenId
          const cdnUrl = `https://cdn.tastemachine.xyz/media/${contract!.toLowerCase()}/${tokenId}.png`;
          console.log(`🚀 Trying CDN URL first: ${cdnUrl}`);
          
          try {
            const cdnResponse = await fetch(cdnUrl, { 
              method: 'HEAD',
              headers: { 'Referer': 'https://tastemachine.xyz' }
            });
            
            if (cdnResponse.ok) {
              console.log(`✅ CDN image found! Redirecting to: ${cdnUrl}`);
              return {
                ok: true,
                status: 302,
                contentType: 'text/plain',
                body: null,
                headers: {
                  'Location': cdnUrl,
                  'Cache-Control': 'public, max-age=86400, s-maxage=604800',
                  'X-Img-Source': 'cdn-direct'
                }
              } as UpstreamResult;
            } else {
              console.log(`❌ CDN image not found (${cdnResponse.status}), checking database...`);
            }
          } catch (cdnError) {
            console.log(`❌ CDN check failed:`, cdnError);
          }
          } // End of disabled CDN redirect block

          console.log(`🚀 Skipping CDN redirect - proxying through API to prevent CORS issues`);

          if (nftRow && nftRow.asset_hash) {
            // Get the storage_key from media_assets for the actual R2 path
            const { data: mediaAsset, error: mediaError } = await supabase
              .from('media_assets')
              .select('storage_key, mime')
              .eq('asset_hash', nftRow.asset_hash)
              .single();
              
            if (mediaError || !mediaAsset?.storage_key) {
              console.log(`❌ No storage_key found for asset hash: ${nftRow.asset_hash}`);
              return {
                ok: true,
                status: 200,
                contentType: 'image/svg+xml',
                body: new TextEncoder().encode(generatePlaceholderSvg(tokenId)).buffer,
                headers: {
                  'Cache-Control': 'public, max-age=120',
                  'X-Img-Source': 'placeholder-no-storage-key'
                }
              } as UpstreamResult;
            }
            
            // Use the storage_key directly for the CDN URL
            const assetCdnUrl = `${CDN_BASE}/${mediaAsset.storage_key}`;
            
            console.log(`✅ V2 Media Pipeline: Redirecting to ${assetCdnUrl}`);
            return {
              ok: true,
              status: 302,
              contentType: 'text/plain',
              body: null,
              headers: {
                'Location': assetCdnUrl,
                'Cache-Control': 'public, max-age=86400, s-maxage=604800',
                'X-Img-Source': 'v2-media-pipeline'
              }
            } as UpstreamResult;
          } else {
            console.log(`❌ No processed media asset found in nft_media_map for ${contract}:${tokenId}`);
          }
        } catch (error) {
          console.log(`❌ nft_media_map query error for ${contract}:${tokenId}:`, error);
        }
      }

      // If CDN-only mode and mapping/LRU miss, immediately return placeholder and enqueue ingest
      if (CDN_ONLY) {
        console.log(`🚨 CDN_ONLY mode: serving placeholder for ${contract}:${tokenId}`);
        return {
          ok: true,
          status: 200,
          contentType: 'image/svg+xml',
          body: new TextEncoder().encode(generatePlaceholderSvg(tokenId)).buffer,
          headers: {
            'Cache-Control': IS_DEV ? 'public, max-age=5' : 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
            'Vary': 'Accept, DPR, Width, Save-Data',
            'X-Img-Source': 'placeholder-cdn-only',
            'ETag': `W/"ph-${tokenId}"`
          }
        } as UpstreamResult;
      }

      // 1) Alchemy NFT API: resolve canonical media URL (Abstract)
      const alchemyKey = process.env.ALCHEMY_KEY;
      if (alchemyKey) {
        const alchemyMedia = await resolveWithAlchemy(alchemyKey, chainParam, contract, tokenId);
        if (alchemyMedia) {
          const resolved = await fetchUpstream(alchemyMedia);
          if (resolved.ok && resolved.body && isLikelyImage(resolved.body, resolved.contentType)) {
            urlLru.set(key, alchemyMedia);
            return resolved;
          }
        }
      }

      // 2) Try IPFS via resilient gateways (avoid Pinata)
      // (a) Use collection-specific reconstruction if available to get the IPFS path
      const reconstructed = generateFallbackIPFSUrl({ contractAddress: contract, tokenId });
      let ipfsPath: string | null = null;
      if (reconstructed) ipfsPath = extractIpfsPath(reconstructed);
      // (b) If no reconstruction, try to derive from originalUrl if ipfs-like
      if (!ipfsPath && originalUrl) ipfsPath = extractIpfsPath(originalUrl);
      if (ipfsPath) {
        const candidates = buildGatewayUrls(ipfsPath);
        for (const url of candidates) {
          const res = await fetchUpstream(url);
          if (res.ok && res.body && isLikelyImage(res.body, res.contentType)) return res;
        }
      }

      // 3) Final: original URL (gateway or http) if provided
      if (originalUrl) {
        // First try as-is
        let resolved = await fetchUpstream(originalUrl);
        if (resolved.ok && resolved.body && isLikelyImage(resolved.body, resolved.contentType)) return resolved;
        // Retry once without query params to dodge bad variants
        try {
          const stripped = originalUrl.split('?')[0];
          resolved = await fetchUpstream(stripped);
          if (resolved.ok && resolved.body && isLikelyImage(resolved.body, resolved.contentType)) return resolved;
          // If still not an image and the stripped form is ipfs-like, try gateways
          const path = extractIpfsPath(stripped);
          if (path) {
            const candidates = buildGatewayUrls(path);
            for (const url of candidates) {
              const res = await fetchUpstream(url);
              if (res.ok && res.body && isLikelyImage(res.body, res.contentType)) return res;
            }
          }
        } catch {}
      }

      // 4) Placeholder as last resort
      // Best-effort enqueue for ingest so future requests hit mapping
      if (ENABLE_MEDIA_MAPPING) {
        try {
          const chainKey = normalizeChainId(chainParam);
          enqueueTokenForIngest({ chain: chainKey, contract: contract!.toLowerCase(), tokenId: String(tokenId), sourceUri: originalUrl || undefined });
        } catch {}
      }
      return {
        ok: true,
        status: 200,
        contentType: 'image/svg+xml',
        body: new TextEncoder().encode(generatePlaceholderSvg(tokenId)).buffer,
      };
    })();

    inflightMap.set(key, promise);
    const result = await promise.finally(() => inflightMap.delete(key));
    return buildResponseFromUpstream(result);
  } catch (error) {
    return generatePlaceholder(tokenId);
  }
}

export async function HEAD(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const contract = searchParams.get("contract") || searchParams.get("c");
  const tokenId = searchParams.get("tokenId") || searchParams.get("t");
  const chainParam = searchParams.get("chain") || "eip155:2741";
  const widthBucket = bucketWidth(searchParams.get("w"));
  const dprBucket = bucketDpr(searchParams.get("dpr"));
  if (!contract || !tokenId) return new Response(null, { status: 400 });
  try {
    if (ENABLE_MEDIA_MAPPING) {
      const primaryKey = normalizeChainKeyForDb(chainParam);
      const chainCandidates = getAbstractAliases(primaryKey);
      const isSolana = primaryKey.startsWith('solana');
      const contractKey = isSolana ? contract : contract.toLowerCase();
      let mapRow: any = null;
      for (const ck of chainCandidates) {
        const { data } = await supabase
          .from('nft_media_map')
          .select('asset_hash, status, media_assets(storage_key)')
          .eq('chain', ck)
          .eq('contract', contractKey)
          .eq('token_id', String(tokenId))
          .limit(1);
        const row = Array.isArray(data) ? data[0] : data;
        if (row) { mapRow = row; break; }
      }
      if (mapRow && mapRow.status === 'ok' && mapRow.asset_hash) {
        const needed = Math.ceil(widthBucket * dprBucket);
        const size = needed <= 256 ? 256 : needed <= 512 ? 512 : needed <= 1024 ? 1024 : 2048;
        const variantUrl = CDN_BASE ? `${CDN_BASE}${CDN_BASE.endsWith('/') ? '' : '/'}media/${mapRow.asset_hash}/w${size}.webp` : '';
        return new Response(null, {
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=300, s-maxage=300',
            'Vary': 'Accept, DPR, Width, Save-Data',
            'Cross-Origin-Resource-Policy': 'cross-origin',
            'Timing-Allow-Origin': '*',
            'X-Img-Source': 'mapping',
            'X-Img-Params': `w=${widthBucket};dpr=${dprBucket}`,
            ...(variantUrl ? { 'Location': variantUrl } : {}),
          }
        });
      } else if (!mapRow) {
        // If not mapped, proactively enqueue via service and return placeholder
        try {
          const origin = req.headers.get('origin') || (req as any).nextUrl?.origin || '';
          if (origin) {
            await fetch(`${origin}/api/media/ingest`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chain: normalizeChainKeyForDb(chainParam), contract: contract!.toLowerCase(), tokenId: String(tokenId), sourceUri: null })
            }).catch(() => undefined);

            // Opportunistically trigger a small batch for this contract (cooldown to avoid spam)
            try {
              const now = Date.now();
              const cKey = contract!.toLowerCase();
              const last = lastRunBatchAtByContract.get(cKey) || 0;
              const cooldownMs = IS_DEV ? 3000 : 30000;
              if (now - last > cooldownMs) {
                lastRunBatchAtByContract.set(cKey, now);
                await fetch(`${origin}/api/media/run-batch`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ contract: cKey, limit: 25, ignoreRetryAfter: '1', apiKey: process.env.ALCHEMY_KEY || '' })
                }).catch(() => undefined);
              }
            } catch {}
          }
        } catch {}
      }
    }
  } catch {}
  // Fallback: unknown, return placeholder headers
  return new Response(null, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=120',
      'Vary': 'Accept, DPR, Width, Save-Data',
      'X-Img-Source': 'placeholder'
    }
  });
}

function buildCdnTransformUrl(masterPath: string, width: number, dpr: number): string {
  if (!CDN_BASE) return masterPath;
  // Cloudflare-style example (adjust downstream):
  // /cdn-cgi/image/width=512,dpr=2,format=auto/<origin-path>
  const params = [`width=${width}`, `dpr=${dpr}`, 'format=auto'].join(',');
  const sep = CDN_BASE.endsWith('/') ? '' : '/';
  return `${CDN_BASE}${sep}cdn-cgi/image/${params}/${masterPath}`;
}

function mapChainIdToReservoirName(chain: string): string {
  // Accept forms like "eip155:8453" or "8453" or names
  const normalized = chain.includes(':') ? chain.split(':')[1] : chain;
  switch (normalized) {
    case '1': return 'ethereum';
    case '8453': return process.env.RESERVOIR_CHAIN_SLUG || 'base';
    case '137': return 'polygon';
    case '42161': return 'arbitrum';
    case '10': return 'optimism';
    case '56': return 'bsc';
    case '43114': return 'avalanche';
    default: return 'base';
  }
}

// Resolve media URL via Alchemy NFT API for Abstract/Base-like networks
async function resolveWithAlchemy(apiKey: string, chainId: string, contract: string, tokenId: string): Promise<string | null> {
  // Map chainId to Alchemy network slug
  // Abstract mainnet is 2741 per docs; accept both eip155:2741 and eip155:8453 (legacy mapping) via env
  const normalized = chainId.includes(':') ? chainId.split(':')[1] : chainId;
  let network: string | null = null;
  if (normalized === '2741') {
    network = 'abstract-mainnet';
  } else if (normalized === '8453') {
    // Some projects alias Abstract to Base chain id historically; allow explicit override
    network = process.env.ALCHEMY_NETWORK_OVERRIDE || 'abstract-mainnet';
  }
  if (!network) return null;

  try {
    const url = `https://${network}.g.alchemy.com/nft/v3/${apiKey}/getNFTMetadata?contractAddress=${encodeURIComponent(contract)}&tokenId=${encodeURIComponent(tokenId)}&refreshCache=false`;
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null) as any;
    const media: string | undefined = data?.media?.[0]?.gateway || data?.raw?.metadata?.image || data?.tokenUri?.gateway;
    if (!media) return null;
    if (media.startsWith('ipfs://')) {
      const cid = media.replace('ipfs://', '');
      return `https://gateway.pinata.cloud/ipfs/${cid}`;
    }
    return media;
  } catch {
    return null;
  }
}

// 🎨 Simple placeholder generator
function generatePlaceholder(tokenId: string): Response {
  const svg = generatePlaceholderSvg(tokenId);
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=2592000',
      'Access-Control-Allow-Origin': '*',
      'Vary': 'Accept, DPR, Width, Save-Data',
    },
  });
}

function generatePlaceholderSvg(tokenId: string): string {
  const hash = simpleHash(tokenId);
  const hue = hash % 360;
  const lightness = 40 + (hash % 30);
  return `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="hsl(${hue}, 70%, ${lightness}%)"/>
      <text x="256" y="240" text-anchor="middle" dominant-baseline="middle" 
            fill="white" font-family="Arial" font-size="28" font-weight="bold">
        Token #${tokenId}
      </text>
      <text x="256" y="286" text-anchor="middle" dominant-baseline="middle" 
            fill="white" font-family="Arial" font-size="18" opacity="0.9">
        Temporarily Unavailable
      </text>
    </svg>
  `;
}

// Simple hash function for consistent colors
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

async function fetchUpstream(url: string): Promise<UpstreamResult> {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 7000);
    const resp = await fetch(url, { redirect: 'follow', signal: ctrl.signal as any });
    clearTimeout(timeout);
    if (!resp.ok || !resp.body) {
      return { ok: false, status: resp.status || 502, contentType: 'application/octet-stream', body: null };
    }
    const contentType = resp.headers.get('Content-Type') || 'image/jpeg';
    const etag = resp.headers.get('ETag');
    const lastModified = resp.headers.get('Last-Modified');
    const arrayBuffer = await resp.arrayBuffer();
    return { ok: true, status: 200, contentType, etag, lastModified, body: arrayBuffer };
  } catch (e) {
    return { ok: false, status: 504, contentType: 'application/octet-stream', body: null };
  }
}

function buildResponseFromUpstream(result: UpstreamResult): Response {
  // Allow 302 redirects without body
  if (result.status === 302 && result.headers?.Location) {
    return new Response(null, { status: 302, headers: result.headers });
  }
  if (!result.ok || !result.body) {
    return new Response('Upstream error', { status: result.status || 502 });
  }
  const headers: Record<string, string> = {
    'Content-Type': result.contentType,
    // Strong edge cache with SWR
    'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
    'Access-Control-Allow-Origin': '*',
    'Vary': 'Accept, DPR, Width, Save-Data',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Timing-Allow-Origin': '*',
    'X-Img-Source': 'upstream'
  };
  if (result.etag) headers['ETag'] = result.etag;
  if (result.lastModified) headers['Last-Modified'] = result.lastModified;
  // Merge custom headers (non-conflicting)
  if (result.headers) {
    for (const [k, v] of Object.entries(result.headers)) headers[k] = v;
  }
  return new Response(result.body, { status: result.status || 200, headers });
}