/** Client / sponsor / contract party resolution — mirrors project_planner_helpers.js */

export type ContractPartySource = 'client' | 'sponsor';

export interface PartyFields {
  company: string;
  rep: string;
  address: string;
  tin: string;
}

export interface ContractPartyProfile {
  clientCompany?: string;
  clientRep?: string;
  clientAddress?: string;
  clientTin?: string;
  useCustomSponsor?: boolean;
  sponsorCompany?: string;
  sponsorRep?: string;
  sponsorAddress?: string;
  sponsorTin?: string;
  contractPartySource?: ContractPartySource | string;
}

export function resolveClientParty(profile?: ContractPartyProfile | null): PartyFields {
  return {
    company: profile?.clientCompany?.trim() || '',
    rep: profile?.clientRep?.trim() || '',
    address: profile?.clientAddress?.trim() || '',
    tin: profile?.clientTin?.trim() || '',
  };
}

export function resolveSponsorParty(profile?: ContractPartyProfile | null): PartyFields {
  if (profile?.useCustomSponsor) {
    return {
      company: profile.sponsorCompany?.trim() || '',
      rep: profile.sponsorRep?.trim() || '',
      address: profile.sponsorAddress?.trim() || '',
      tin: profile.sponsorTin?.trim() || '',
    };
  }
  return resolveClientParty(profile);
}

export function resolveContractParty(profile?: ContractPartyProfile | null): PartyFields {
  if (profile?.contractPartySource === 'sponsor') {
    return resolveSponsorParty(profile);
  }
  return resolveClientParty(profile);
}

export function getContractPartySource(profile?: ContractPartyProfile | null): ContractPartySource {
  return profile?.contractPartySource === 'sponsor' ? 'sponsor' : 'client';
}

export function getContractPartyDisplayName(profile?: ContractPartyProfile | null) {
  const party = resolveContractParty(profile);
  return party.company || profile?.clientCompany?.trim() || profile?.clientRep?.trim() || 'Untitled Client';
}
