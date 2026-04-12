// NACE Kodu'na göre tehlike sınıfı belirleme
export function classifyHazardByNACE(naceCode: string): "Az Tehlikeli" | "Tehlikeli" | "Çok Tehlikeli" {
  const code = naceCode.substring(0, 2); // İlk 2 hane
  
  // Çok Tehlikeli Sınıflar
  const veryHazardous = [
    "05", "06", "07", "08", "09", // Madencilik
    "24", "25", // Kimya, metal
    "41", "42", "43", // İnşaat
    "49", "50", "51", // Taşımacılık
  ];
  
  // Tehlikeli Sınıflar
  const hazardous = [
    "10", "11", "12", "13", "14", "15", "16", "17", // İmalat
    "23", "26", "27", "28", "29", "30", "31", "32", "33",
    "35", "36", "37", "38", "39", // Elektrik, atık
    "52", "53", // Depolama
  ];
  
  if (veryHazardous.includes(code)) {
    return "Çok Tehlikeli";
  } else if (hazardous.includes(code)) {
    return "Tehlikeli";
  } else {
    return "Az Tehlikeli";
  }
}

// NACE Kodu'na göre sektör belirleme
export function getSectorByNACE(naceCode: string): string {
  const code = naceCode.substring(0, 2);
  
  const sectorMap: Record<string, string> = {
    "41": "construction",
    "42": "construction",
    "43": "construction",
    "10": "manufacturing",
    "11": "manufacturing",
    "23": "manufacturing",
    "24": "manufacturing",
    "25": "manufacturing",
    "64": "office",
    "65": "office",
    "66": "office",
    "69": "office",
    "70": "office",
  };
  
  return sectorMap[code] || "office";
}