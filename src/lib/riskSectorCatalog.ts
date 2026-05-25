import {
  doesRiskSectorMatch,
  getRiskSectorTemplateConfig,
  getSectorMinimumRiskItemCount,
  normalizeRiskSectorKey,
  RISK_TEMPLATE_CONFIGS,
} from "@/lib/risk/riskTemplateConfig";

export type RiskSectorCatalogItem = {
  code: string;
  name: string;
  itemCount: number;
  icon: string;
  group: string;
};

export const RISK_SECTOR_CATALOG: RiskSectorCatalogItem[] = RISK_TEMPLATE_CONFIGS.map((config) => ({
  code: config.code,
  name: config.name,
  itemCount: config.itemCount,
  icon: config.icon,
  group: config.group,
}));

export { doesRiskSectorMatch, getRiskSectorTemplateConfig, getSectorMinimumRiskItemCount };

export function buildCatalogKey(name: string) {
  return normalizeRiskSectorKey(name);
}
