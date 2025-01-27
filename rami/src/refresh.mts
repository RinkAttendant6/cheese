import process from 'node:process';
import {
  extractDmarcParts,
  doSpfExpansion,
  getDmarcRecord,
  getDnsRecord,
} from './cheese.mts';

const domain = process.argv[2] ?? 'hotmail.com';

const SPF_EXPANSION_EXCLUDE_LIST = [
  'amazonses.com',
  'brightspace.com',
  'google.com',
  'protection.outlook.com',
  'qualtrics.com',
];

const { parts: spfParts, records: spfRecord } = await doSpfExpansion(
  domain,
  SPF_EXPANSION_EXCLUDE_LIST
);

const dmarcDnsRecord = await getDnsRecord('_dmarc.' + domain);
const dmarcRecord = getDmarcRecord(dmarcDnsRecord.Answer);
const dmarcParts = extractDmarcParts(dmarcRecord ?? '');

console.log({
  spfRecord,
  spfParts,
  dmarcRecord,
  dmarcParts,
});
