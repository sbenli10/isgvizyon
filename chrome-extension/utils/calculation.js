// ====================================================
// MEVZUATA UYGUN SÜRE HESAPLAMA
// ====================================================

export class DurationCalculator {
  /**
   * 6331 Sayılı Kanun ve İSG Hizmetleri Yönetmeliği
   * EK-4 tablosuna göre hesaplama
   */
  static calculateRequiredMinutes(employeeCount, hazardClass) {
    const rules = this.getRules();
    
    const rule = rules.find((r) => {
      return (
        employeeCount >= r.minEmployees &&
        employeeCount <= r.maxEmployees &&
        r.hazardClass === hazardClass
      );
    });

    if (!rule) {
      throw new Error('No matching rule found');
    }

    return rule.minutesPerMonth;
  }

  /**
   * Mevzuat tablosu (EK-4)
   */
  static getRules() {
    return [
      // Az Tehlikeli
      { minEmployees: 1, maxEmployees: 10, hazardClass: 'Az Tehlikeli', minutesPerMonth: 20 },
      { minEmployees: 11, maxEmployees: 50, hazardClass: 'Az Tehlikeli', minutesPerMonth: 45 },
      { minEmployees: 51, maxEmployees: 100, hazardClass: 'Az Tehlikeli', minutesPerMonth: 90 },
      { minEmployees: 101, maxEmployees: 250, hazardClass: 'Az Tehlikeli', minutesPerMonth: 150 },
      { minEmployees: 251, maxEmployees: 500, hazardClass: 'Az Tehlikeli', minutesPerMonth: 240 },
      { minEmployees: 501, maxEmployees: 1000, hazardClass: 'Az Tehlikeli', minutesPerMonth: 390 },
      { minEmployees: 1001, maxEmployees: 2000, hazardClass: 'Az Tehlikeli', minutesPerMonth: 660 },
      { minEmployees: 2001, maxEmployees: Infinity, hazardClass: 'Az Tehlikeli', minutesPerMonth: 1200 },

      // Tehlikeli
      { minEmployees: 1, maxEmployees: 10, hazardClass: 'Tehlikeli', minutesPerMonth: 30 },
      { minEmployees: 11, maxEmployees: 50, hazardClass: 'Tehlikeli', minutesPerMonth: 90 },
      { minEmployees: 51, maxEmployees: 100, hazardClass: 'Tehlikeli', minutesPerMonth: 180 },
      { minEmployees: 101, maxEmployees: 250, hazardClass: 'Tehlikeli', minutesPerMonth: 300 },
      { minEmployees: 251, maxEmployees: 500, hazardClass: 'Tehlikeli', minutesPerMonth: 480 },
      { minEmployees: 501, maxEmployees: 1000, hazardClass: 'Tehlikeli', minutesPerMonth: 780 },
      { minEmployees: 1001, maxEmployees: 2000, hazardClass: 'Tehlikeli', minutesPerMonth: 1320 },
      { minEmployees: 2001, maxEmployees: Infinity, hazardClass: 'Tehlikeli', minutesPerMonth: 2400 },

      // Çok Tehlikeli
      { minEmployees: 1, maxEmployees: 10, hazardClass: 'Çok Tehlikeli', minutesPerMonth: 60 },
      { minEmployees: 11, maxEmployees: 50, hazardClass: 'Çok Tehlikeli', minutesPerMonth: 180 },
      { minEmployees: 51, maxEmployees: 100, hazardClass: 'Çok Tehlikeli', minutesPerMonth: 360 },
      { minEmployees: 101, maxEmployees: 250, hazardClass: 'Çok Tehlikeli', minutesPerMonth: 600 },
      { minEmployees: 251, maxEmployees: 500, hazardClass: 'Çok Tehlikeli', minutesPerMonth: 960 },
      { minEmployees: 501, maxEmployees: 1000, hazardClass: 'Çok Tehlikeli', minutesPerMonth: 1560 },
      { minEmployees: 1001, maxEmployees: 2000, hazardClass: 'Çok Tehlikeli', minutesPerMonth: 2640 },
      { minEmployees: 2001, maxEmployees: Infinity, hazardClass: 'Çok Tehlikeli', minutesPerMonth: 4800 },
    ];
  }

  /**
   * Compliance durumu hesapla
   */
  static getComplianceStatus(assignedMinutes, requiredMinutes) {
    const diff = assignedMinutes - requiredMinutes;
    const percentage = (assignedMinutes / requiredMinutes) * 100;

    if (percentage < 90) {
      return { status: 'CRITICAL', label: 'Eksik Atama', color: 'red', diff };
    }
    if (percentage < 100) {
      return { status: 'WARNING', label: 'Sınırda', color: 'yellow', diff };
    }
    if (percentage <= 110) {
      return { status: 'COMPLIANT', label: 'Uyumlu', color: 'green', diff };
    }
    return { status: 'EXCESS', label: 'Fazla Atama', color: 'blue', diff };
  }

  /**
   * Kapasite hesapla
   */
  static calculateCapacity(experts, assignments) {
    return experts.map((expert) => {
      const assigned = assignments
        .filter((a) => a.expertId === expert.id)
        .reduce((sum, a) => sum + a.assignedMinutes, 0);

      const capacity = expert.maxMinutesPerMonth || 9600; // 160 saat default
      const remaining = capacity - assigned;
      const utilizationRate = (assigned / capacity) * 100;

      return {
        expertId: expert.id,
        expertName: expert.name,
        capacity,
        assigned,
        remaining,
        utilizationRate,
        isOverloaded: utilizationRate > 100,
      };
    });
  }
}