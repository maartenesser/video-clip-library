/**
 * eMudhra CA compromise (Oct 2026, Mozilla bug 2083449): removes every eMudhra / emSign root
 * from Node's default CA store. The compromised TLS intermediates chain to "emSign ECC Root CA - G3",
 * which Node's bundled store still trusts before Node 24.22.1 / 22.23.4 / 26.12.1. Node's bundled store has no
 * Sectigo "AAA Certificate Services", so dropping the emSign roots closes the forged-certificate path.
 * Typed port of the shared distrust-emudhra.mjs preload. Remove once Vercel serves Node >= 24.22.1.
 */
import { X509Certificate } from "node:crypto";
import tls from "node:tls";

const PATTERN = /emSign|eMudhra/i;

export interface TlsCaApi {
  getCACertificates?: (type: "default") => string[];
  setDefaultCACertificates?: (certs: string[]) => void;
}

export type DistrustResult =
  { removed: number; remaining: number; supported: true } | { removed: 0; supported: false; error?: string };

function log(fields: DistrustResult): void {
  try {
    // stderr, never stdout
    process.stderr.write(`${JSON.stringify({ msg: "tls-hardening", ...fields })}\n`);
  } catch {
    // stderr closed: nothing useful to do
  }
}

function isEmudhra(pem: string): boolean {
  try {
    const cert = new X509Certificate(pem);

    return PATTERN.test(cert.subject) || PATTERN.test(cert.issuer);
  } catch {
    return false;
  }
}

// Cast: older @types/node releases do not declare getCACertificates/setDefaultCACertificates.
const nodeTls = tls as unknown as TlsCaApi;
let applied: DistrustResult | undefined;

export function distrustEmudhra(api: TlsCaApi = nodeTls): DistrustResult {
  if (applied && api === nodeTls) return applied;
  let result: DistrustResult;

  try {
    if (typeof api.getCACertificates !== "function" || typeof api.setDefaultCACertificates !== "function") {
      result = { removed: 0, supported: false };
    } else {
      const current = api.getCACertificates("default");
      const keep = current.filter((pem) => !isEmudhra(pem));

      if (keep.length !== current.length) api.setDefaultCACertificates(keep);
      result = { removed: current.length - keep.length, remaining: keep.length, supported: true };
    }
  } catch (error) {
    result = { removed: 0, supported: false, error: String(error) };
  }
  log(result);
  if (api === nodeTls) applied = result;

  return result;
}
