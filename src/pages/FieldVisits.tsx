import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  SortAsc,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  listOsgbCompanyMapLocations,
  listOsgbFieldVisitPlannerWorkspace,
  updateOsgbCompanyMapLocation,
  updateOsgbCompanyVisitAddress,
  upsertOsgbFieldVisitWorkspace,
  type OsgbCompanyMapLocationRecord,
  type OsgbFieldVisitRecord,
  type OsgbFieldVisitWorkspaceData,
} from "@/lib/osgbPlatform";
import { cn } from "@/lib/utils";

type MapMarker = {
  id: string;
  type: "company" | "visit";
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
};

type VisitCreateForm = {
  companyId: string;
  personnelId: string;
  startTime: string;
  endTime: string;
  visitAddress: string;
  notes: string;
};

const emptyVisitCreateForm: VisitCreateForm = {
  companyId: "",
  personnelId: "none",
  startTime: "09:00",
  endTime: "10:00",
  visitAddress: "",
  notes: "",
};

const weekdays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const missingLocationMessage =
  "firmanın konumu bulunamadı. Haritada yalnızca koordinatı hazır olan veya son ziyaret konumundan çıkarılabilen firmalar gösterildi. Toplu güncelleme ile adresi olan firmaların koordinatlarını otomatik çıkarabilirsiniz.";

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const formatDateInput = (date: Date) => formatDateKey(date);

const parseDateInput = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatLongDate = (date: Date) =>
  date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });

const formatTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
};

const buildCalendarDays = (monthDate: Date) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const days: Array<Date | null> = Array.from({ length: mondayOffset }, () => null);

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, month, day));
  }

  while (days.length % 7 !== 0) days.push(null);
  return days;
};

const parseCoordinateText = (value: string | null) => {
  if (!value) return null;
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
};

const normalizeAddress = (company: OsgbCompanyMapLocationRecord) =>
  [company.visitAddress, company.city].filter(Boolean).join(", ");

const getVisitPersonnelNames = (visit: OsgbFieldVisitRecord) =>
  visit.assignedPersonnel.length > 0
    ? visit.assignedPersonnel.map((person) => person.fullName).join(", ")
    : "Personel atanmamış";

const lonToTile = (lon: number, zoom: number) => ((lon + 180) / 360) * 2 ** zoom;
const latToTile = (lat: number, zoom: number) => {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom;
};
const tileToLon = (x: number, zoom: number) => (x / 2 ** zoom) * 360 - 180;
const tileToLat = (y: number, zoom: number) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** zoom;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

const MiniOsmMap = ({
  center,
  markers,
  selectedCompanyName,
  onMarkCompany,
}: {
  center: { latitude: number; longitude: number };
  markers: MapMarker[];
  selectedCompanyName: string | null;
  onMarkCompany: (latitude: number, longitude: number) => void;
}) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startWorldX: number;
    startWorldY: number;
    moved: boolean;
  } | null>(null);
  const [zoom, setZoom] = useState(13);
  const [viewCenter, setViewCenter] = useState(center);
  const [mapSize, setMapSize] = useState({ width: 960, height: 560 });
  const [dragging, setDragging] = useState(false);
  const centerX = lonToTile(viewCenter.longitude, zoom) * 256;
  const centerY = latToTile(viewCenter.latitude, zoom) * 256;
  const minTileX = Math.floor((centerX - mapSize.width / 2) / 256) - 1;
  const maxTileX = Math.floor((centerX + mapSize.width / 2) / 256) + 1;
  const minTileY = Math.floor((centerY - mapSize.height / 2) / 256) - 1;
  const maxTileY = Math.floor((centerY + mapSize.height / 2) / 256) + 1;
  const tileCount = 2 ** zoom;
  const tiles = useMemo(() => {
    const next: Array<{ x: number; y: number }> = [];
    for (let y = minTileY; y <= maxTileY; y += 1) {
      for (let x = minTileX; x <= maxTileX; x += 1) {
        next.push({ x, y });
      }
    }
    return next;
  }, [maxTileX, maxTileY, minTileX, minTileY]);

  useEffect(() => {
    setViewCenter(center);
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const updateSize = () => {
      setMapSize({
        width: element.clientWidth || 960,
        height: element.clientHeight || 560,
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const markerPosition = (marker: MapMarker) => {
    const x = lonToTile(marker.longitude, zoom) * 256 - centerX + mapSize.width / 2;
    const y = latToTile(marker.latitude, zoom) * 256 - centerY + mapSize.height / 2;
    return { left: `${x}px`, top: `${y}px` };
  };

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current?.moved) return;
    if (!selectedCompanyName) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const worldX = centerX + event.clientX - rect.left - mapSize.width / 2;
    const worldY = centerY + event.clientY - rect.top - mapSize.height / 2;
    onMarkCompany(tileToLat(worldY / 256, zoom), tileToLon(worldX / 256, zoom));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWorldX: centerX,
      startWorldY: centerY,
      moved: false,
    };
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startClientX;
    const deltaY = event.clientY - drag.startClientY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 3) {
      drag.moved = true;
    }
    const nextWorldX = drag.startWorldX - deltaX;
    const nextWorldY = drag.startWorldY - deltaY;
    setViewCenter({
      latitude: tileToLat(nextWorldY / 256, zoom),
      longitude: tileToLon(nextWorldX / 256, zoom),
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      window.setTimeout(() => {
        dragRef.current = null;
      }, 0);
    }
    setDragging(false);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setZoom((current) => {
      if (event.deltaY < 0) return Math.min(current + 1, 18);
      return Math.max(current - 1, 6);
    });
  };

  return (
    <div
      ref={mapRef}
      className={cn(
        "relative h-[590px] touch-none overflow-hidden rounded-b-xl bg-[#dfe7f0]",
        selectedCompanyName ? "cursor-crosshair" : dragging ? "cursor-grabbing" : "cursor-grab",
      )}
      onClick={handleMapClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      <div
        className="absolute left-3 top-3 z-20 overflow-hidden rounded border border-slate-300 bg-white shadow"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="block h-8 w-8 border-b border-slate-200 text-xl font-bold text-slate-900 hover:bg-slate-100"
          onClick={(event) => {
            event.stopPropagation();
            setZoom((current) => Math.min(current + 1, 18));
          }}
          aria-label="Haritayı yakınlaştır"
        >
          +
        </button>
        <button
          type="button"
          className="block h-8 w-8 text-2xl font-light text-slate-900 hover:bg-slate-100"
          onClick={(event) => {
            event.stopPropagation();
            setZoom((current) => Math.max(current - 1, 6));
          }}
          aria-label="Haritayı uzaklaştır"
        >
          -
        </button>
      </div>

      {selectedCompanyName ? (
        <div className="absolute left-14 top-3 z-20 rounded-md border border-cyan-400/30 bg-slate-950/85 px-3 py-2 text-xs font-semibold text-cyan-100 shadow-lg">
          {selectedCompanyName} için haritada bir nokta seçin.
        </div>
      ) : null}

      <div className="absolute inset-0">
        {tiles.map(({ x, y }) => {
          const safeX = ((x % tileCount) + tileCount) % tileCount;
          return (
            <img
              key={`${zoom}-${x}-${y}`}
              src={`https://tile.openstreetmap.org/${zoom}/${safeX}/${y}.png`}
              alt=""
              className="absolute h-64 w-64 select-none"
              draggable={false}
              style={{
                left: `${x * 256 - centerX + mapSize.width / 2}px`,
                top: `${y * 256 - centerY + mapSize.height / 2}px`,
              }}
            />
          );
        })}
        {markers.map((marker) => (
          <div
            key={marker.id}
            className="group absolute z-10 -translate-x-1/2 -translate-y-full"
            style={markerPosition(marker)}
          >
            <div
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full border-2 border-white shadow-[0_10px_24px_rgba(15,23,42,0.35)]",
                marker.type === "company" ? "bg-blue-600" : "bg-emerald-500",
              )}
            >
              <MapPin className="h-4 w-4 fill-white text-white" />
            </div>
            <div className="pointer-events-none absolute left-1/2 top-9 hidden w-56 -translate-x-1/2 rounded-md bg-slate-950/95 p-2 text-xs text-white shadow-xl group-hover:block">
              <div className="font-semibold">{marker.title}</div>
              <div className="mt-1 text-slate-300">{marker.subtitle}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="absolute bottom-1 right-1 z-20 rounded bg-white/85 px-1 text-[10px] text-blue-700">
        Leaflet | © OpenStreetMap
      </div>
    </div>
  );
};

export default function FieldVisits() {
  const { user, profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [data, setData] = useState<OsgbFieldVisitWorkspaceData | null>(null);
  const [companyLocations, setCompanyLocations] = useState<OsgbCompanyMapLocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string>("all");
  const [mapOpen, setMapOpen] = useState(false);
  const [mapStartDate, setMapStartDate] = useState(formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [mapEndDate, setMapEndDate] = useState(formatDateInput(today));
  const [mapPersonnelId, setMapPersonnelId] = useState("all");
  const [mapSelectedCompanyId, setMapSelectedCompanyId] = useState<string>("");
  const [showCompanyPanel, setShowCompanyPanel] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [addressDrafts, setAddressDrafts] = useState<Record<string, string>>({});
  const [updatingLocations, setUpdatingLocations] = useState(false);
  const [autoGeocodeAttempted, setAutoGeocodeAttempted] = useState(false);
  const [createVisitOpen, setCreateVisitOpen] = useState(false);
  const [createVisitDate, setCreateVisitDate] = useState(today);
  const [createVisitForm, setCreateVisitForm] = useState<VisitCreateForm>(emptyVisitCreateForm);
  const [savingVisit, setSavingVisit] = useState(false);

  usePageDataTiming(loading);

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [workspace, locations] = await Promise.all([
        listOsgbFieldVisitPlannerWorkspace(organizationId, {
          serviceMonth: formatMonthKey(visibleMonth),
        }),
        listOsgbCompanyMapLocations(organizationId),
      ]);

      setData(workspace);
      setCompanyLocations(locations);
      setAddressDrafts((current) => {
        const next = { ...current };
        for (const company of locations) {
          if (next[company.id] === undefined) next[company.id] = company.visitAddress || "";
        }
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Firma ziyaretleri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, visibleMonth]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const companyLocationById = useMemo(
    () => new globalThis.Map<string, OsgbCompanyMapLocationRecord>(
  companyLocations.map((company) => [company.id, company]),
  )
  , [companyLocations]);
  const filteredCompanies = useMemo(() => {
    const term = companySearch.trim().toLocaleLowerCase("tr-TR");
    const rows = data?.companies ?? [];
    return rows.filter((company) => {
      if (!term) return true;
      return company.companyName.toLocaleLowerCase("tr-TR").includes(term);
    });
  }, [companySearch, data?.companies]);

  const visibleVisits = useMemo(() => {
    const visits = data?.visits ?? [];
    return visits.filter((visit) => {
      if (selectedCompanyId !== "all" && visit.companyId !== selectedCompanyId) return false;
      if (selectedPersonnelId !== "all") {
        return visit.assignedPersonnel.some(
          (person) => person.personnelId === selectedPersonnelId || person.profileId === selectedPersonnelId,
        );
      }
      return true;
    });
  }, [data?.visits, selectedCompanyId, selectedPersonnelId]);

  const visitsByDate = useMemo(() => {
    const grouped = new globalThis.Map<string, OsgbFieldVisitRecord[]>();
    for (const visit of visibleVisits) {
      const key = formatDateKey(new Date(visit.plannedAt));
      grouped.set(key, [...(grouped.get(key) ?? []), visit]);
    }
    return grouped;
  }, [visibleVisits]);

  const selectedDateVisits = visitsByDate.get(formatDateKey(selectedDate)) ?? [];

  const mapVisits = useMemo(() => {
    const start = parseDateInput(mapStartDate);
    start.setHours(0, 0, 0, 0);
    const end = parseDateInput(mapEndDate);
    end.setHours(23, 59, 59, 999);

    return (data?.visits ?? []).filter((visit) => {
      const planned = new Date(visit.plannedAt);
      if (planned < start || planned > end) return false;
      if (mapPersonnelId !== "all") {
        return visit.assignedPersonnel.some(
          (person) => person.personnelId === mapPersonnelId || person.profileId === mapPersonnelId,
        );
      }
      return true;
    });
  }, [data?.visits, mapEndDate, mapPersonnelId, mapStartDate]);

  const latestVisitCoordinateByCompany = useMemo(() => {
   const coordinates = new globalThis.Map<string, { latitude: number; longitude: number; plannedAt: string }>();
    for (const visit of data?.visits ?? []) {
      const coordinate = parseCoordinateText(visit.checkOutLocation) || parseCoordinateText(visit.checkInLocation);
      if (!coordinate) continue;
      const current = coordinates.get(visit.companyId);
      if (!current || new Date(visit.plannedAt) > new Date(current.plannedAt)) {
        coordinates.set(visit.companyId, { ...coordinate, plannedAt: visit.plannedAt });
      }
    }
    return coordinates;
  }, [data?.visits]);

  const companyMarkers = useMemo<MapMarker[]>(() => {
    return companyLocations
      .map((company): MapMarker | null => {
        const fallback = latestVisitCoordinateByCompany.get(company.id);
        const latitude = company.latitude ?? fallback?.latitude ?? null;
        const longitude = company.longitude ?? fallback?.longitude ?? null;

        if (latitude == null || longitude == null) return null;

        return {
          id: `company-${company.id}`,
          type: "company",
          title: company.companyName,
          subtitle: normalizeAddress(company) || "Firma koordinatı kayıtlı",
          latitude,
          longitude,
        };
      })
      .filter((marker): marker is MapMarker => marker !== null);
  }, [companyLocations, latestVisitCoordinateByCompany]);

  const visitMarkers = useMemo<MapMarker[]>(() => {
    return mapVisits
      .map((visit): MapMarker | null => {
        const coordinate = parseCoordinateText(visit.checkOutLocation) || parseCoordinateText(visit.checkInLocation);

        if (!coordinate) return null;

        return {
          id: `visit-${visit.id}`,
          type: "visit",
          title: visit.companyName,
          subtitle: `${formatLongDate(new Date(visit.plannedAt))} - ${getVisitPersonnelNames(visit)}`,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
        };
      })
      .filter((marker): marker is MapMarker => marker !== null);
  }, [mapVisits]);

  const missingCompanies = useMemo(() => {
    return companyLocations.filter((company) => {
      if (company.latitude != null && company.longitude != null) return false;
      return !latestVisitCoordinateByCompany.has(company.id);
    });
  }, [companyLocations, latestVisitCoordinateByCompany]);

  const markers = useMemo(() => [...companyMarkers, ...visitMarkers], [companyMarkers, visitMarkers]);

  const mapCenter = useMemo(() => {
    if (markers.length === 0) return { latitude: 40.653, longitude: 35.834 };
    return {
      latitude: markers.reduce((sum, marker) => sum + marker.latitude, 0) / markers.length,
      longitude: markers.reduce((sum, marker) => sum + marker.longitude, 0) / markers.length,
    };
  }, [markers]);

  const selectedMapCompany = mapSelectedCompanyId ? companyLocationById.get(mapSelectedCompanyId) ?? null : null;

  const openCreateVisitForDate = (date: Date) => {
    setSelectedDate(date);
    setCreateVisitDate(date);
    const preferredCompanyId = selectedCompanyId !== "all" ? selectedCompanyId : "";
    const preferredCompany = preferredCompanyId ? companyLocationById.get(preferredCompanyId) : null;
    setCreateVisitForm({
      ...emptyVisitCreateForm,
      companyId: preferredCompanyId,
      visitAddress: preferredCompany ? normalizeAddress(preferredCompany) : "",
      personnelId: selectedPersonnelId !== "all" ? selectedPersonnelId : "none",
    });
    setCreateVisitOpen(true);
  };

  const handleCreateVisit = async () => {
    if (!organizationId || !user?.id) {
      toast.error("Ziyaret oluşturmak için oturum bilgisi bulunamadı.");
      return;
    }
    if (!createVisitForm.companyId) {
      toast.error("Firma seçmelisiniz.");
      return;
    }

    const plannedAt = `${formatDateKey(createVisitDate)}T${createVisitForm.startTime}:00`;
    const plannedEndAt = createVisitForm.endTime ? `${formatDateKey(createVisitDate)}T${createVisitForm.endTime}:00` : null;
    setSavingVisit(true);
    try {
      await upsertOsgbFieldVisitWorkspace(user.id, organizationId, {
        companyId: createVisitForm.companyId,
        visitType: "onsite_visit",
        plannedAt,
        plannedEndAt,
        visitAddress: createVisitForm.visitAddress || null,
        notes: createVisitForm.notes || null,
        assignedPersonnelIds: createVisitForm.personnelId === "none" ? [] : [createVisitForm.personnelId],
      });
      toast.success("Firma ziyareti oluşturuldu.");
      setCreateVisitOpen(false);
      setCreateVisitForm(emptyVisitCreateForm);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Firma ziyareti oluşturulamadı.");
    } finally {
      setSavingVisit(false);
    }
  };

  const setQuickRange = (range: "thisMonth" | "lastMonth" | "7" | "30" | "90") => {
    const end = new Date();
    const start = new Date();
    if (range === "thisMonth") {
      start.setDate(1);
    } else if (range === "lastMonth") {
      start.setMonth(start.getMonth() - 1, 1);
      end.setDate(0);
    } else {
      start.setDate(start.getDate() - Number(range));
    }
    setMapStartDate(formatDateInput(start));
    setMapEndDate(formatDateInput(end));
  };

  const handleSaveAddress = async (companyId: string) => {
    if (!organizationId) return;
    try {
      await updateOsgbCompanyVisitAddress(organizationId, companyId, addressDrafts[companyId] || null);
      toast.success("Firma adresi güncellendi.");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Firma adresi güncellenemedi.");
    }
  };

  const handleMarkCompany = async (latitude: number, longitude: number) => {
    if (!organizationId || !selectedMapCompany) return;
    try {
      await updateOsgbCompanyMapLocation(organizationId, selectedMapCompany.id, latitude, longitude, "manual-map");
      toast.success(`${selectedMapCompany.companyName} haritada işaretlendi.`);
      setMapSelectedCompanyId("");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Firma konumu kaydedilemedi.");
    }
  };

  const geocodeAddress = async (address: string) => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
    );
    if (!response.ok) throw new Error("Adres konumu çıkarılamadı.");
    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    if (!first) return null;
    return { latitude: Number(first.lat), longitude: Number(first.lon) };
  };

  const handleAutoUpdateLocations = async () => {
    if (!organizationId) return;
    const candidates = missingCompanies.filter((company) => normalizeAddress(company).trim());
    if (candidates.length === 0) {
      toast.warning(missingLocationMessage);
      return;
    }

    setUpdatingLocations(true);
    let updated = 0;
    try {
      for (const company of candidates) {
        const coordinate = await geocodeAddress(normalizeAddress(company));
        if (!coordinate) continue;
        await updateOsgbCompanyMapLocation(organizationId, company.id, coordinate.latitude, coordinate.longitude, "address-geocode");
        updated += 1;
      }
      if (updated > 0) {
        toast.success(`${updated} firma konumu otomatik güncellendi.`);
        await loadData();
      } else {
        toast.warning(missingLocationMessage);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Toplu konum güncellemesi tamamlanamadı.");
    } finally {
      setUpdatingLocations(false);
    }
  };

  useEffect(() => {
    if (!mapOpen) {
      setAutoGeocodeAttempted(false);
      return;
    }
    if (autoGeocodeAttempted || updatingLocations) return;
    if (!missingCompanies.some((company) => normalizeAddress(company).trim())) return;
    setAutoGeocodeAttempted(true);
    void handleAutoUpdateLocations();
  }, [autoGeocodeAttempted, mapOpen, missingCompanies, updatingLocations]);

  const exportReport = () => {
    const header = ["Firma", "Tarih", "Saat", "Durum", "Personel", "Adres", "Not"];
    const rows = visibleVisits.map((visit) => [
      visit.companyName,
      formatLongDate(new Date(visit.plannedAt)),
      formatTime(visit.plannedAt),
      visit.status,
      getVisitPersonnelNames(visit),
      visit.visitAddress || companyLocationById.get(visit.companyId)?.visitAddress || "",
      visit.notes || "",
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `firma-ziyaretleri-${formatMonthKey(visibleMonth)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <div className="min-h-[640px] bg-[#172235] p-5 text-slate-300">
        <div className="h-[620px] animate-pulse rounded-xl border border-slate-700/70 bg-slate-900/50" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-32px)] bg-[#172235] p-4 text-slate-100">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Firma Ziyaretleri</h1>
          <p className="text-sm text-slate-400">Görevlendirdiğiniz personellerin firma ziyaret kayıtlarını takip edin.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 border-cyan-500/60 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 hover:text-cyan-100"
            onClick={() => setMapOpen(true)}
          >
            <MapIcon className="mr-2 h-4 w-4" />
            Haritada Göster
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 border-slate-600 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
            onClick={exportReport}
          >
            <Download className="mr-2 h-4 w-4" />
            Rapor Al
          </Button>
          <Select value={selectedPersonnelId} onValueChange={setSelectedPersonnelId}>
            <SelectTrigger
              id="field-visit-personnel-filter"
              name="field-visit-personnel-filter"
              className="h-9 w-40 border-slate-600 bg-slate-900/60 text-slate-200"
            >
              <UserRound className="mr-2 h-4 w-4 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
              <SelectItem value="all">Tüm Personel</SelectItem>
              {(data?.personnel ?? []).map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div>
      ) : null}

      <div className="grid min-h-[590px] gap-4 xl:grid-cols-[1.1fr_0.62fr_1.42fr]">
        <section className="rounded-xl border border-slate-700/80 bg-[#1d2b40] p-4 shadow-[0_20px_60px_rgba(2,6,23,0.16)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Building2 className="h-4 w-4 text-emerald-300" />
              Firmalar
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-400">
              <SortAsc className="mr-1 h-3.5 w-3.5" />
              A..Z
            </Button>
          </div>
          <Label htmlFor="field-visit-company-search" className="sr-only">
            Firma ara
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              id="field-visit-company-search"
              name="field-visit-company-search"
              value={companySearch}
              onChange={(event) => setCompanySearch(event.target.value)}
              placeholder="Firma ara..."
              className="h-9 border-slate-600 bg-[#24344c] pl-9 text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <div className="mt-3 space-y-2">
            {filteredCompanies.length > 0 ? (
              filteredCompanies.map((company) => {
                const selected = selectedCompanyId === company.id;
                return (
                  <button
                    type="button"
                    key={company.id}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition hover:border-blue-400/50 hover:bg-slate-800/50",
                      selected ? "border-blue-500/60 bg-blue-500/15 text-white" : "border-slate-700 bg-[#24344c] text-slate-200",
                    )}
                    onClick={() => setSelectedCompanyId(selected ? "all" : company.id)}
                  >
                    <span>{company.companyName}</span>
                    <span className="text-xs text-slate-500">{company.hazardClass}</span>
                  </button>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
                Firma bulunamadı.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-700/80 bg-[#1d2b40] p-4 shadow-[0_20px_60px_rgba(2,6,23,0.16)]">
          <div className="mb-6 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-300 hover:bg-slate-800"
              onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-bold text-white">{formatMonthLabel(visibleMonth)}</div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-300 hover:bg-slate-800"
              onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-3 text-center text-xs text-slate-500">
            {weekdays.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-7 gap-3 text-center">
            {buildCalendarDays(visibleMonth).map((day, index) => {
              if (!day) return <div key={`empty-${index}`} className="h-12" />;
              const key = formatDateKey(day);
              const selected = key === formatDateKey(selectedDate);
              const hasVisit = (visitsByDate.get(key) ?? []).length > 0;
              return (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "relative mx-auto grid h-12 w-12 place-items-center rounded-lg text-sm font-semibold transition",
                    selected ? "bg-blue-500 text-white shadow-[0_10px_26px_rgba(59,130,246,0.38)]" : "text-slate-300 hover:bg-slate-800",
                  )}
                  onClick={() => openCreateVisitForDate(day)}
                >
                  {day.getDate()}
                  {hasVisit ? <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-emerald-300" /> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-slate-700/80 bg-[#1d2b40] p-4 shadow-[0_20px_60px_rgba(2,6,23,0.16)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <CalendarDays className="h-4 w-4 text-blue-300" />
              {formatLongDate(selectedDate)}
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500"
              onClick={() => openCreateVisitForDate(selectedDate)}
            >
              Ziyaret Oluştur
            </Button>
          </div>
          {selectedDateVisits.length > 0 ? (
            <div className="space-y-3">
              {selectedDateVisits.map((visit) => (
                <article key={visit.id} className="rounded-lg border border-slate-700 bg-slate-950/25 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{visit.companyName}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {formatTime(visit.plannedAt)} - {getVisitPersonnelNames(visit)}
                      </div>
                    </div>
                    <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
                      {visit.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">{visit.notes || visit.nextActionSummary || "Ziyaret notu girilmedi."}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="grid min-h-[500px] place-items-center text-center text-slate-500">
              <div>
                <MapPin className="mx-auto mb-3 h-12 w-12 text-slate-600" />
                <div className="text-sm">Bu tarihte ziyaret kaydı bulunmuyor.</div>
              </div>
            </div>
          )}
        </section>
      </div>

      <Dialog open={createVisitOpen} onOpenChange={setCreateVisitOpen}>
        <DialogContent
          container={typeof document !== "undefined" ? document.body : null}
          overlayClassName="z-[110] bg-slate-950/80"
          className="z-[120] max-w-xl border-slate-700 bg-[#101827] p-0 text-slate-100 [&>button.absolute]:text-slate-300"
        >
          <DialogHeader className="border-b border-slate-700 px-6 py-5">
            <DialogTitle className="text-base font-bold text-white">Firma ziyareti oluştur</DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              {formatLongDate(createVisitDate)} için saha ziyareti planlayın.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="create-visit-company" className="text-slate-200">
                Firma *
              </Label>
              <Select
                value={createVisitForm.companyId}
                onValueChange={(value) => {
                  const company = companyLocationById.get(value);
                  setCreateVisitForm((current) => ({
                    ...current,
                    companyId: value,
                    visitAddress: current.visitAddress || (company ? normalizeAddress(company) : ""),
                  }));
                }}
              >
                <SelectTrigger id="create-visit-company" name="create-visit-company" className="border-slate-600 bg-[#172235] text-slate-100">
                  <SelectValue placeholder="Firma seçin" />
                </SelectTrigger>
                <SelectContent className="z-[140] border-slate-700 bg-slate-900 text-slate-100">
                  {(data?.companies ?? []).map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="create-visit-date" className="text-slate-200">
                  Tarih
                </Label>
                <Input
                  id="create-visit-date"
                  name="create-visit-date"
                  type="date"
                  value={formatDateKey(createVisitDate)}
                  onChange={(event) => setCreateVisitDate(parseDateInput(event.target.value))}
                  className="border-slate-600 bg-[#172235] text-slate-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-visit-start" className="text-slate-200">
                  Başlangıç
                </Label>
                <Input
                  id="create-visit-start"
                  name="create-visit-start"
                  type="time"
                  value={createVisitForm.startTime}
                  onChange={(event) => setCreateVisitForm((current) => ({ ...current, startTime: event.target.value }))}
                  className="border-slate-600 bg-[#172235] text-slate-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-visit-end" className="text-slate-200">
                  Bitiş
                </Label>
                <Input
                  id="create-visit-end"
                  name="create-visit-end"
                  type="time"
                  value={createVisitForm.endTime}
                  onChange={(event) => setCreateVisitForm((current) => ({ ...current, endTime: event.target.value }))}
                  className="border-slate-600 bg-[#172235] text-slate-100"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-visit-personnel" className="text-slate-200">
                Personel
              </Label>
              <Select
                value={createVisitForm.personnelId}
                onValueChange={(value) => setCreateVisitForm((current) => ({ ...current, personnelId: value }))}
              >
                <SelectTrigger id="create-visit-personnel" name="create-visit-personnel" className="border-slate-600 bg-[#172235] text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[140] border-slate-700 bg-slate-900 text-slate-100">
                  <SelectItem value="none">Personel seçilmedi</SelectItem>
                  {(data?.personnel ?? []).map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-visit-address" className="text-slate-200">
                Ziyaret adresi
              </Label>
              <Input
                id="create-visit-address"
                name="create-visit-address"
                value={createVisitForm.visitAddress}
                onChange={(event) => setCreateVisitForm((current) => ({ ...current, visitAddress: event.target.value }))}
                placeholder="Firma adresi veya saha lokasyonu"
                className="border-slate-600 bg-[#172235] text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-visit-notes" className="text-slate-200">
                Not
              </Label>
              <Textarea
                id="create-visit-notes"
                name="create-visit-notes"
                value={createVisitForm.notes}
                onChange={(event) => setCreateVisitForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Ziyaret amacı, yapılacak işlem veya saha notu"
                className="min-h-24 border-slate-600 bg-[#172235] text-slate-100 placeholder:text-slate-500"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-slate-700 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
              onClick={() => setCreateVisitOpen(false)}
            >
              Vazgeç
            </Button>
            <Button type="button" className="bg-cyan-600 text-slate-950 hover:bg-cyan-400" disabled={savingVisit} onClick={handleCreateVisit}>
              {savingVisit ? "Kaydediliyor..." : "Ziyareti Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent
          container={typeof document !== "undefined" ? document.body : null}
          overlayClassName="z-[110] bg-slate-950/80"
          className="z-[120] max-h-[92vh] max-w-[1180px] gap-0 overflow-hidden border-slate-700 bg-[#1d2b40] p-0 text-slate-100 [&>button.absolute]:right-6 [&>button.absolute]:top-5 [&>button.absolute]:text-slate-300"
        >
          <DialogHeader className="border-b border-slate-700 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-500/15 text-cyan-300">
                <MapIcon className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white">Firma Ziyaretleri Harita Görünümü</DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Firma konumları ile personel ziyaret noktalarını aynı haritada görüntüleyin
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="border-b border-slate-700 bg-[#1d2b40] px-6 py-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-44">
                <Label htmlFor="map-personnel-filter" className="mb-1 block text-[11px] text-slate-400">
                  Personel
                </Label>
                <Select value={mapPersonnelId} onValueChange={setMapPersonnelId}>
                  <SelectTrigger id="map-personnel-filter" name="map-personnel-filter" className="h-9 border-slate-600 bg-[#24344c] text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                    <SelectItem value="all">Tüm Personel</SelectItem>
                    {(data?.personnel ?? []).map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="map-start-date" className="mb-1 block text-[11px] text-slate-400">
                  Başlangıç
                </Label>
                <Input
                  id="map-start-date"
                  name="map-start-date"
                  type="date"
                  value={mapStartDate}
                  onChange={(event) => setMapStartDate(event.target.value)}
                  className="h-9 w-36 border-slate-600 bg-[#24344c] text-slate-100"
                />
              </div>
              <div>
                <Label htmlFor="map-end-date" className="mb-1 block text-[11px] text-slate-400">
                  Bitiş
                </Label>
                <Input
                  id="map-end-date"
                  name="map-end-date"
                  type="date"
                  value={mapEndDate}
                  onChange={(event) => setMapEndDate(event.target.value)}
                  className="h-9 w-36 border-slate-600 bg-[#24344c] text-slate-100"
                />
              </div>
              <div className="h-8 w-px bg-slate-700" />
              {[
                ["thisMonth", "Bu Ay"],
                ["lastMonth", "Geçen Ay"],
                ["7", "Son 7 Gün"],
                ["30", "Son 30 Gün"],
                ["90", "Son 3 Ay"],
              ].map(([range, label]) => (
                <Button
                  key={range}
                  type="button"
                  size="sm"
                  className="h-8 bg-slate-700/70 px-3 text-xs text-slate-100 hover:bg-slate-600"
                  onClick={() => setQuickRange(range as "thisMonth" | "lastMonth" | "7" | "30" | "90")}
                >
                  {label}
                </Button>
              ))}
              <Button type="button" size="sm" className="h-9 bg-cyan-600 text-slate-950 hover:bg-cyan-400" onClick={() => toast.success("Harita filtreleri uygulandı.")}>
                <Filter className="mr-2 h-4 w-4" />
                Filtrele
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-blue-600 ring-2 ring-white" />
                  Firma işaretleri ({companyMarkers.length})
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                  Ziyaret işaretleri ({visitMarkers.length})
                </span>
              </div>
            </div>
          </div>

          {missingCompanies.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-6 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                <AlertTriangle className="h-4 w-4" />
                {missingCompanies.length} firmanın konumu bulunamadı
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 border border-amber-400/50 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
                  disabled={updatingLocations}
                  onClick={handleAutoUpdateLocations}
                >
                  <RefreshCw className={cn("mr-2 h-4 w-4", updatingLocations && "animate-spin")} />
                  Konumları Otomatik Güncelle
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 border border-blue-400/40 bg-blue-500/20 text-blue-100 hover:bg-blue-500/30"
                  onClick={() => setShowCompanyPanel((current) => !current)}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Firmalar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 border border-amber-400/40 bg-slate-900/50 text-amber-100 hover:bg-slate-800"
                  onClick={() => setShowDetailsPanel((current) => !current)}
                >
                  Detaylar
                </Button>
              </div>
            </div>
          ) : null}

          <div className="relative">
            <MiniOsmMap
              center={mapCenter}
              markers={markers}
              selectedCompanyName={selectedMapCompany?.companyName ?? null}
              onMarkCompany={handleMarkCompany}
            />
            {showCompanyPanel ? (
              <aside className="absolute right-4 top-4 max-h-[520px] w-[330px] overflow-auto rounded-lg border border-slate-700 bg-slate-950/92 p-3 shadow-2xl backdrop-blur">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-bold text-white">Firma Konumları</div>
                  <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                </div>
                <div className="space-y-3">
                  {companyLocations.map((company) => {
                    const hasLocation = company.latitude != null && company.longitude != null;
                    const derived = latestVisitCoordinateByCompany.has(company.id);
                    return (
                      <div key={company.id} className="rounded-lg border border-slate-700 bg-slate-900/80 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">{company.companyName}</div>
                            <div className="mt-1 text-xs text-slate-400">
                              {hasLocation ? "Koordinat hazır" : derived ? "Son ziyaret konumundan gösteriliyor" : "Konum bulunamadı"}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            className={cn(
                              "h-8 w-8",
                              mapSelectedCompanyId === company.id ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-200 hover:bg-slate-700",
                            )}
                            onClick={() => setMapSelectedCompanyId((current) => (current === company.id ? "" : company.id))}
                          >
                            <LocateFixed className="h-4 w-4" />
                          </Button>
                        </div>
                        <Label htmlFor={`company-address-${company.id}`} className="mt-3 block text-xs text-slate-400">
                          Firma adresi
                        </Label>
                        <div className="mt-1 flex gap-2">
                          <Input
                            id={`company-address-${company.id}`}
                            name={`company-address-${company.id}`}
                            value={addressDrafts[company.id] ?? ""}
                            onChange={(event) => setAddressDrafts((current) => ({ ...current, [company.id]: event.target.value }))}
                            placeholder="Firma adresini girin"
                            className="h-8 border-slate-700 bg-slate-950 text-xs text-slate-100 placeholder:text-slate-500"
                          />
                          <Button type="button" size="sm" className="h-8 bg-blue-600 text-white hover:bg-blue-500" onClick={() => handleSaveAddress(company.id)}>
                            Kaydet
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </aside>
            ) : null}
            {showDetailsPanel ? (
              <aside className="absolute bottom-4 left-4 max-w-xl rounded-lg border border-slate-700 bg-slate-950/92 p-4 text-sm text-slate-300 shadow-2xl backdrop-blur">
                <div className="font-semibold text-white">Harita durumu</div>
                <p className="mt-2 leading-6">{missingCompanies.length > 0 ? missingLocationMessage : "Tüm firmalar haritada gösterilebilir durumda."}</p>
              </aside>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
