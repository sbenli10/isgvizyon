// ====================================================
// COMPLIANCE RULE ENGINE
// ====================================================

import { DurationCalculator } from '../utils/calculation.js';

export class RuleEngine {
  /**
   * Comprehensive compliance check
   */
  async checkCompliance(companyData) {
    const flags = [];
    let riskScore = 0;

    // Rule 1: Süre kontrolü
    try {
      const required = DurationCalculator.calculateRequiredMinutes(
        companyData.employeeCount,
        companyData.hazardClass
      );

      const status = DurationCalculator.getComplianceStatus(
        companyData.assignedMinutes,
        required
      );

      if (status.status === 'CRITICAL') {
        flags.push({
          rule: 'DURATION_CHECK',
          severity: 'CRITICAL',
          message: `Eksik süre: ${Math.abs(status.diff)} dk/ay`,
          requiredMinutes: required,
          assignedMinutes: companyData.assignedMinutes,
        });
        riskScore += 30;
      } else if (status.status === 'WARNING') {
        flags.push({
          rule: 'DURATION_CHECK',
          severity: 'WARNING',
          message: 'Sınır değerde süre ataması',
          requiredMinutes: required,
          assignedMinutes: companyData.assignedMinutes,
        });
        riskScore += 15;
      }
    } catch (error) {
      flags.push({
        rule: 'DURATION_CHECK',
        severity: 'ERROR',
        message: `Hesaplama hatası: ${error.message}`,
      });
      riskScore += 50;
    }

    // Rule 2: Kurul zorunluluğu
    if (companyData.employeeCount >= 50) {
      // TODO: Kurul kontrolü (DB'den çek)
      flags.push({
        rule: 'KURUL_CHECK',
        severity: 'INFO',
        message: 'İSG Kurulu zorunluluğu var',
      });
      riskScore += 5;
    }

    // Rule 3: Sözleşme geçerliliği
    if (companyData.contractEnd) {
      const daysUntilEnd = this.getDaysUntil(companyData.contractEnd);

      if (daysUntilEnd < 0) {
        flags.push({
          rule: 'CONTRACT_EXPIRY',
          severity: 'CRITICAL',
          message: `Sözleşme ${Math.abs(daysUntilEnd)} gün önce sona erdi!`,
          contractEnd: companyData.contractEnd,
        });
        riskScore += 40;
      } else if (daysUntilEnd <= 30) {
        flags.push({
          rule: 'CONTRACT_EXPIRY',
          severity: 'WARNING',
          message: `Sözleşme ${daysUntilEnd} gün içinde sona erecek`,
          contractEnd: companyData.contractEnd,
        });
        riskScore += 20;
      }
    }

    // Rule 4: Çok Tehlikeli sınıf kontrolleri
    if (companyData.hazardClass === 'Çok Tehlikeli') {
      flags.push({
        rule: 'HAZARD_CLASS_CHECK',
        severity: 'INFO',
        message: 'Aylık ziyaret zorunluluğu var',
      });
      riskScore += 5;
    }

    // Rule 5: Duplicate SGK kontrolü
    // TODO: Supabase'den mevcut SGK kayıtlarını kontrol et

    // Normalize risk score (0-100)
    riskScore = Math.min(riskScore, 100);

    return {
      companyName: companyData.companyName,
      sgkNo: companyData.sgkNo,
      riskScore,
      riskLevel: this.getRiskLevel(riskScore),
      flags,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Tarih farkı hesapla
   */
  getDaysUntil(dateString) {
    const target = new Date(dateString);
    const now = new Date();
    const diff = target - now;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Risk seviyesi belirle
   */
  getRiskLevel(score) {
    if (score >= 70) return { level: 'CRITICAL', label: 'Kritik', color: 'red' };
    if (score >= 40) return { level: 'HIGH', label: 'Yüksek', color: 'orange' };
    if (score >= 20) return { level: 'MEDIUM', label: 'Orta', color: 'yellow' };
    return { level: 'LOW', label: 'Düşük', color: 'green' };
  }

  /**
   * Predictive analiz
   */
  predictRisks(companyData, timeframeMonths = 3) {
    const predictions = [];

    // Sözleşme bitişi tahmini
    if (companyData.contractEnd) {
      const daysUntilEnd = this.getDaysUntil(companyData.contractEnd);
      const monthsUntilEnd = daysUntilEnd / 30;

      if (monthsUntilEnd <= timeframeMonths && monthsUntilEnd > 0) {
        predictions.push({
          type: 'CONTRACT_EXPIRY',
          severity: 'WARNING',
          message: `${Math.floor(monthsUntilEnd)} ay içinde sözleşme yenilenmelidir`,
          estimatedDate: companyData.contractEnd,
        });
      }
    }

    // Çalışan artışı simülasyonu
    const projectedEmployeeGrowth = companyData.employeeCount * 1.1; // %10 artış varsayımı
    
    try {
      const currentRequired = DurationCalculator.calculateRequiredMinutes(
        companyData.employeeCount,
        companyData.hazardClass
      );
      const projectedRequired = DurationCalculator.calculateRequiredMinutes(
        Math.ceil(projectedEmployeeGrowth),
        companyData.hazardClass
      );

      if (projectedRequired > currentRequired) {
        predictions.push({
          type: 'CAPACITY_PLANNING',
          severity: 'INFO',
          message: `Çalışan artışında ${projectedRequired - currentRequired} dk/ay ek süre gerekecek`,
          projectedEmployees: Math.ceil(projectedEmployeeGrowth),
          additionalMinutes: projectedRequired - currentRequired,
        });
      }
    } catch (error) {
      console.error('Prediction error:', error);
    }

    return predictions;
  }
}