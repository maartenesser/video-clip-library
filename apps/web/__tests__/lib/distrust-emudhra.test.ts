import { describe, expect, it } from 'vitest';
import { X509Certificate } from 'node:crypto';
import tls from 'node:tls';
import { distrustEmudhra, type TlsCaApi } from '@/lib/security/distrust-emudhra';

const EMUDHRA = /emSign|eMudhra/i;
const caApi = tls as unknown as Required<TlsCaApi>;
const emudhraSubjects = () =>
  caApi
    .getCACertificates('default')
    .map((pem) => new X509Certificate(pem).subject)
    .filter((subject) => EMUDHRA.test(subject));

describe('distrustEmudhra', () => {
  it('removes every eMudhra root from the default store', () => {
    expect(distrustEmudhra().supported).toBe(true);
    expect(emudhraSubjects()).toEqual([]);
  });

  it('is a no-op on the second call', () => {
    const first = distrustEmudhra();
    const before = caApi.getCACertificates('default').length;
    expect(distrustEmudhra()).toEqual(first);
    expect(caApi.getCACertificates('default').length).toBe(before);
  });

  it('reports supported:false without throwing when the API is missing', () => {
    expect(distrustEmudhra({ getCACertificates: undefined, setDefaultCACertificates: undefined })).toEqual({
      removed: 0,
      supported: false,
    });
  });
});
