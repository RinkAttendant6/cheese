interface DoHResponse {
  Status: number;
  Question: { name: string; type: number }[];
  Answer: DoHAnswer[];
}

interface DoHAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

/**
 * Get DNS record
 * @param name Domain name
 * @param type Type of DNS record
 * @param dohApi DNS-over-HTTPS API base URL
 */
export const getDnsRecord = async (
  name: string,
  type: string = 'TXT',
  dohApi: string = 'https://cloudflare-dns.com/dns-query'
): Promise<DoHResponse> => {
  const target = new URL(dohApi);
  target.searchParams.set('name', name);
  target.searchParams.set('type', type);
  target.searchParams.set('cd', '0');

  const response = await fetch(target, {
    headers: { Accept: 'application/dns-json' },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
};

const getMatchingRecord = (answers: DoHAnswer[], str: string): string | null =>
  answers
    .map((record) => record.data.replaceAll(/^\s*"?|"?\s*$/g, ''))
    .findLast((r: string) => r.toLowerCase().startsWith(str)) ?? null;

/**
 * Extract the SPF record from DNS records
 * @param answers DoH API answers
 */
export const getSpfRecord = (answers: DoHAnswer[]) =>
  getMatchingRecord(answers, 'v=spf1 ');

/**
 * Expand SPF records for a given domain
 * @param domain Domain to look up and expand
 * @param excludeList Domains to NOT expand
 * @param alreadyRedirected Set to false to follow redirect (max 1 level)
 */
export const doSpfExpansion = async (
  domain: string,
  excludeList: string[] = [],
  alreadyRedirected = false
): Promise<{
  parts: Map<string, string[]>;
  records: Set<string>;
}> => {
  const domains = [domain];
  const output = {
    parts: new Map<string, string[]>(),
    records: new Set<string>(),
  };

  while (domains.length > 0) {
    const currentDomain = domains.shift()!;
    const dnsRecord = await getDnsRecord(currentDomain);
    const record = getSpfRecord(dnsRecord.Answer) ?? '';
    const parts = extractSpfParts(record ?? '');

    output.parts.set(currentDomain, parts);
    output.records.add(record);

    const redirect = parts.find((part) => part.startsWith('redirect='));

    if (redirect && parts.length === 2 && !alreadyRedirected) {
      return doSpfExpansion(redirect.slice(9), excludeList, true);
    }

    const includesToExpand = parts.filter(
      (part) =>
        part.startsWith('include:') &&
        !excludeList.some((d) => part.endsWith(d))
    );

    domains.push(...includesToExpand.map((part) => part.slice(8)));
  }

  return output;
};

/**
 * Extract the DMARC record from DNS records
 * @param answers DoH API answers
 */
export const getDmarcRecord = (answers: DoHAnswer[]) =>
  getMatchingRecord(answers, 'v=dmarc1;');

/**
 * Extract parts from an SPF record
 * @param record SPF record
 */
export const extractSpfParts = (record: string): string[] => {
  return record.split(/\s+/);
};

/**
 * Extract parts from a DMARC record
 * @param record DMARC record
 */
export const extractDmarcParts = (record: string) =>
  Object.fromEntries(
    record
      .replace(/;$/, '')
      .split(';')
      .map((part) => part.trim().split('='))
  );
