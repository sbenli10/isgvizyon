type DeviceType = "mobile" | "tablet" | "desktop";

const BROWSER_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Edge", pattern: /Edg\/([\d.]+)/i },
  { name: "Samsung Internet", pattern: /SamsungBrowser\/([\d.]+)/i },
  { name: "Opera", pattern: /OPR\/([\d.]+)/i },
  { name: "Chrome", pattern: /Chrome\/([\d.]+)/i },
  { name: "Firefox", pattern: /Firefox\/([\d.]+)/i },
  { name: "Safari", pattern: /Version\/([\d.]+).*Safari/i },
];

const OS_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Windows", pattern: /Windows NT/i },
  { name: "Android", pattern: /Android/i },
  { name: "iOS", pattern: /iPhone|iPad|iPod/i },
  { name: "macOS", pattern: /Mac OS X|Macintosh/i },
  { name: "Linux", pattern: /Linux/i },
];

const detectDeviceType = (userAgent: string, viewportWidth: number): DeviceType => {
  if (/iPad|Tablet/i.test(userAgent)) return "tablet";
  if (/Mobi|Android/i.test(userAgent)) {
    return viewportWidth >= 768 ? "tablet" : "mobile";
  }
  return "desktop";
};

const matchPattern = (userAgent: string, patterns: Array<{ name: string; pattern: RegExp }>) => {
  for (const candidate of patterns) {
    const match = userAgent.match(candidate.pattern);
    if (match) {
      return {
        name: candidate.name,
        version: match[1] || "unknown",
      };
    }
  }

  return {
    name: "Unknown",
    version: "unknown",
  };
};

export type RuntimeDeviceInfo = {
  browserName: string;
  browserVersion: string;
  osName: string;
  deviceType: DeviceType;
  userAgent: string;
  language: string;
  platform: string;
  viewportWidth: number;
  viewportHeight: number;
  pixelRatio: number;
  screenWidth: number;
  screenHeight: number;
  deviceMemory: number | null;
  hardwareConcurrency: number | null;
};

export const getRuntimeDeviceInfo = (): RuntimeDeviceInfo => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      browserName: "Unknown",
      browserVersion: "unknown",
      osName: "Unknown",
      deviceType: "desktop",
      userAgent: "",
      language: "unknown",
      platform: "unknown",
      viewportWidth: 0,
      viewportHeight: 0,
      pixelRatio: 1,
      screenWidth: 0,
      screenHeight: 0,
      deviceMemory: null,
      hardwareConcurrency: null,
    };
  }

  const userAgent = navigator.userAgent || "";
  const browser = matchPattern(userAgent, BROWSER_PATTERNS);
  const os = OS_PATTERNS.find((candidate) => candidate.pattern.test(userAgent))?.name || "Unknown";
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  return {
    browserName: browser.name,
    browserVersion: browser.version,
    osName: os,
    deviceType: detectDeviceType(userAgent, viewportWidth),
    userAgent,
    language: navigator.language || "unknown",
    platform: navigator.platform || "unknown",
    viewportWidth,
    viewportHeight,
    pixelRatio: window.devicePixelRatio || 1,
    screenWidth: window.screen?.width || 0,
    screenHeight: window.screen?.height || 0,
    deviceMemory: "deviceMemory" in navigator ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null : null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
  };
};
