import { saveAs } from "file-saver";
import JSZip from "jszip";

import {
  fetchADEPDocumentBundle,
  formatDateOrDash,
  type ADEPDocumentBundle,
  type ADEPDocumentTeam,
} from "@/lib/adepDocumentBundle";

const TEMPLATE_PATH = "/templates/Atilla_Coskun_Acil_Durum_Plani_2026.docx";
const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML_NS = "http://www.w3.org/XML/1998/namespace";

const ADEP_DEFINITION_ROWS: Array<[string, string]> = [
  [
    "Acil Durum",
    "İşyerinin tamamında veya bir kısmında meydana gelebilecek ya da işyerini dışarıdan etkileyebilecek; yangın, patlama, doğal afet, tehlikeli kimyasal yayılımı, zehirlenme, sabotaj, iş kazası ve benzeri ivedilikle müdahale, mücadele, ilk yardım veya tahliye gerektiren olaylardır.",
  ],
  [
    "Acil Durum Planı",
    "Acil durumlarda yapılacak iş ve işlemler ile uygulamaya yönelik eylemlerin yer aldığı plandır.",
  ],
  [
    "Acil Durum Ekibi",
    "Yangın, deprem ve benzeri olaylarda tahliye, ilk müdahale, arama-kurtarma, koruma, söndürme ve ilk yardım çalışmalarını yürütmek üzere görevlendirilen eğitimli çalışanlardan oluşan ekiptir.",
  ],
  [
    "Acil Eylem",
    "Acil durumlara karşı alınacak önlem ve uygulanacak müdahalelerin bütünüdür.",
  ],
  [
    "Büyük Kaza",
    "Kuruluşun işletilmesi sırasında kontrolsüz gelişmelerden kaynaklanan ve kuruluş içinde veya dışında insan sağlığı ve çevre için ciddi tehlike oluşturabilen emisyon, yangın veya patlama olayıdır.",
  ],
  [
    "Güvenli Yer / Acil Toplanma Alanı",
    "Acil durumların olumsuz sonuçlarından çalışanların etkilenmeyeceği mesafede veya korunakta belirlenmiş yerdir.",
  ],
  [
    "Kaza",
    "Ölüme, hastalığa, yaralanmaya, hasara veya diğer kayıplara sebebiyet veren istenmeyen olaydır.",
  ],
  [
    "İş Kazası",
    "İşin yürütümü nedeniyle meydana gelen, çalışanı bedenen veya ruhen zarara uğratan olaydır.",
  ],
  [
    "Yangın",
    "Katı, sıvı veya gaz halindeki yanıcı maddelerin ısı ve oksijenle birleşerek kontrol dışı yanmasıdır.",
  ],
  [
    "Deprem",
    "Fay üzerinde biriken enerjinin aniden boşalması sonucu meydana gelen yer sarsıntısıdır.",
  ],
  [
    "Sızıntı / Dökülme",
    "İnsan sağlığına ve çevreye zarar verebilecek maddelerin kaptan, tesisattan veya ekipmandan sızarak/dökülerek boşalmasıdır.",
  ],
  [
    "İlk Yardım",
    "Herhangi bir nedenle hastalanan veya kazaya uğrayan kişiye, durumunun kötüleşmesini önlemek amacıyla olay yerinde yapılan tıbbi olmayan geçici müdahaledir.",
  ],
  [
    "Sabotaj",
    "İşyerinin, üretim tesislerinin, araçlarının, enerji/ulaştırma/haberleşme sistemlerinin veya özel tesislerin geçici veya sürekli faaliyet dışı kalmasını sağlamak amacıyla gerçekleştirilen yıkıcı faaliyettir.",
  ],
];

const safeFileName = (value: string) =>
  value
    .replace(/[^\w-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const safeText = (value?: string | null, fallback = "-") => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");

const serializeXml = (xml: XMLDocument) => new XMLSerializer().serializeToString(xml);

const getElements = (parent: ParentNode, tagName: string) =>
  Array.from(parent.getElementsByTagNameNS(WORD_NS, tagName));

const getChildElements = (parent: Element, tagName: string) =>
  Array.from(parent.childNodes).filter(
    (node): node is Element => node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === tagName,
  );

const getTables = (xml: XMLDocument) => getElements(xml, "tbl");
const getRows = (table: Element) => getChildElements(table, "tr");
const getCells = (row: Element) => getChildElements(row, "tc");
const getParagraphs = (parent: ParentNode) => getElements(parent, "p");
const getRuns = (parent: ParentNode) => getElements(parent, "r");
const getTextNodes = (parent: ParentNode) => getElements(parent, "t");

const createParagraph = (xml: XMLDocument) => xml.createElementNS(WORD_NS, "w:p");
const createRun = (xml: XMLDocument) => xml.createElementNS(WORD_NS, "w:r");
const createText = (xml: XMLDocument) => xml.createElementNS(WORD_NS, "w:t");

const getOrCreateTextNode = (cell: Element) => {
  const xml = cell.ownerDocument;
  const textNodes = getTextNodes(cell);
  if (textNodes.length) return textNodes[0];

  const paragraph = getParagraphs(cell)[0] ?? (() => {
    const next = createParagraph(xml);
    cell.appendChild(next);
    return next;
  })();

  const run = getRuns(paragraph)[0] ?? (() => {
    const next = createRun(xml);
    paragraph.appendChild(next);
    return next;
  })();

  const text = createText(xml);
  run.appendChild(text);
  return text;
};

const setTextNodeValue = (textNode: Element, value: string) => {
  if (/\s/.test(value)) {
    textNode.setAttributeNS(XML_NS, "xml:space", "preserve");
  } else {
    textNode.removeAttributeNS(XML_NS, "space");
  }
  textNode.textContent = value;
};

const setCellText = (cell: Element | undefined, value: string) => {
  if (!cell) return;
  const normalized = value ?? "";
  const primaryNode = getOrCreateTextNode(cell);
  setTextNodeValue(primaryNode, normalized);
  getTextNodes(cell)
    .slice(1)
    .forEach((node) => {
      node.textContent = "";
    });
};

const setParagraphText = (paragraph: Element | undefined, value: string) => {
  if (!paragraph) return;
  const xml = paragraph.ownerDocument;
  const textNodes = getTextNodes(paragraph);
  const primaryNode =
    textNodes[0] ??
    (() => {
      const run = getRuns(paragraph)[0] ?? (() => {
        const next = createRun(xml);
        paragraph.appendChild(next);
        return next;
      })();
      const text = createText(xml);
      run.appendChild(text);
      return text;
    })();

  setTextNodeValue(primaryNode, value);
  textNodes.slice(1).forEach((node) => {
    node.textContent = "";
  });
};

const getParagraphText = (paragraph: Element | undefined) =>
  paragraph ? getTextNodes(paragraph).map((node) => node.textContent || "").join(" ").trim() : "";

const findParagraphIndex = (paragraphs: Element[], matcher: (text: string) => boolean) =>
  paragraphs.findIndex((paragraph) => matcher(getParagraphText(paragraph)));

const cloneRow = (table: Element, sourceRowIndex: number) => {
  const rows = getRows(table);
  const sourceRow = rows[sourceRowIndex];
  if (!sourceRow) {
    throw new Error("Word şablonundaki tablo satırı bulunamadı.");
  }

  const clone = sourceRow.cloneNode(true) as Element;
  table.appendChild(clone);
  return clone;
};

const ensureRowCount = (table: Element, minimumCount: number, templateRowIndex: number) => {
  let rows = getRows(table);
  while (rows.length < minimumCount) {
    cloneRow(table, templateRowIndex);
    rows = getRows(table);
  }
  return rows;
};

const setTableCell = (tables: Element[], tableIndex: number, rowIndex: number, cellIndex: number, value: string) => {
  const row = getRows(tables[tableIndex])[rowIndex];
  const cell = getCells(row)[cellIndex];
  setCellText(cell, value);
};

const formatMonthYear = (monthYear?: string | null, fallbackDate?: string | null) => {
  const normalized = monthYear?.trim();
  if (normalized) return normalized.toLocaleUpperCase("tr-TR");

  const base = fallbackDate ? new Date(fallbackDate) : null;
  if (base && !Number.isNaN(base.getTime())) {
    return base.toLocaleDateString("tr-TR", {
      month: "long",
      year: "numeric",
    }).toLocaleUpperCase("tr-TR");
  }

  return "ADEP";
};

const splitMonthYear = (monthYear?: string | null, fallbackDate?: string | null) => {
  const normalized = monthYear?.trim();
  if (normalized) {
    const match = normalized.match(/^([^\d]+?)\s+(\d{4})$/);
    if (match) {
      return {
        month: match[1].trim().toLocaleUpperCase("tr-TR"),
        year: match[2],
      };
    }
  }

  const base = fallbackDate ? new Date(fallbackDate) : null;
  if (base && !Number.isNaN(base.getTime())) {
    return {
      month: base.toLocaleDateString("tr-TR", { month: "long" }).toLocaleUpperCase("tr-TR"),
      year: base.toLocaleDateString("tr-TR", { year: "numeric" }),
    };
  }

  return { month: "-", year: "-" };
};

const getTeamEntries = (team: ADEPDocumentTeam | undefined) => {
  const leaderName = [team?.team_leader?.first_name, team?.team_leader?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  const memberRecords = (team?.memberRecords || []).map((member) => ({
    id: member.id,
    name:
      member.full_name?.trim() ||
      [member.first_name, member.last_name].filter(Boolean).join(" ").trim() ||
      "Bilinmeyen Çalışan",
    phone: safeText(member.phone, "-"),
    tc: safeText(member.tc_number, "-"),
  }));

  const dedupedMembers = memberRecords.filter(
    (member, index, list) => list.findIndex((candidate) => candidate.id === member.id) === index,
  );

  const leaderTc = safeText(team?.team_leader?.tc_number, "-");
  const names = leaderName
    ? [
        {
          name: leaderName,
          phone: safeText(team?.team_leader?.phone, "-"),
          tc: leaderTc,
        },
        ...dedupedMembers.filter((member) => member.name !== leaderName),
      ]
    : dedupedMembers;

  return names.map((member, index) => ({
    tc: member.tc,
    title: index === 0 ? "Ekip Başkanı" : index === 1 ? "Ekip Başkan Yardımcısı" : "Üye",
    name: member.name,
    phone: member.phone,
  }));
};

const fillSimpleRows = (
  table: Element,
  rows: Array<Array<string>>,
  startRowIndex: number,
  templateRowIndex: number,
  preserveCellIndexes: number[] = [],
) => {
  const requiredTotalRows = Math.max(startRowIndex + rows.length, templateRowIndex + 1);
  const tableRows = ensureRowCount(table, requiredTotalRows, templateRowIndex);

  for (let rowIndex = startRowIndex; rowIndex < tableRows.length; rowIndex += 1) {
    const tableRow = tableRows[rowIndex];
    const cells = getCells(tableRow);
    const source = rows[rowIndex - startRowIndex];

    if (!source) {
      cells.forEach((cell, cellIndex) => {
        if (!preserveCellIndexes.includes(cellIndex)) {
          setCellText(cell, "");
        }
      });
      continue;
    }

    source.forEach((value, cellIndex) => setCellText(cells[cellIndex], value));
  }
};

const buildSignatureRows = (bundle: ADEPDocumentBundle) => {
  const responsible = bundle.plan.plan_data.gorevli_bilgileri;
  const general = bundle.plan.plan_data.genel_bilgiler;
  const tarih = formatDateOrDash(general.hazirlanma_tarihi || bundle.plan.created_at);

  const rows = [
    {
      name: safeText(responsible.isveren_vekil.ad_soyad),
      tcOrCertificate: safeText(responsible.isveren_vekil.tc_no),
      duty: "İşveren / İşveren Vekili",
      date: tarih,
    },
    {
      name: safeText(responsible.isg_uzmani.ad_soyad),
      tcOrCertificate: safeText(responsible.isg_uzmani.belge_no || responsible.isg_uzmani.tc_no),
      duty: "İş Güvenliği Uzmanı",
      date: tarih,
    },
    {
      name: safeText(responsible.isyeri_hekimi.ad_soyad),
      tcOrCertificate: safeText(responsible.isyeri_hekimi.belge_no || responsible.isyeri_hekimi.tc_no),
      duty: "İşyeri Hekimi",
      date: tarih,
    },
  ];

  const teamDutyMap = [
    { keyword: "söndür", duty: "Söndürme Elemanı" },
    { keyword: "kurtarma", duty: "Kurtarma Elemanı" },
    { keyword: "koruma", duty: "Koruma Elemanı" },
    { keyword: "ilkyard", duty: "İlkyardım Elemanı" },
  ];

  teamDutyMap.forEach(({ keyword, duty }) => {
    const team = bundle.teams.find((item) =>
      item.team_name.toLocaleLowerCase("tr-TR").includes(keyword),
    );
    const leaderName = [team?.team_leader?.first_name, team?.team_leader?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (leaderName) {
      rows.push({
        name: leaderName,
        tcOrCertificate: "-",
        duty,
        date: tarih,
      });
    }
  });

  return rows;
};

const replaceWordTemplate = async (bundle: ADEPDocumentBundle) => {
  const templateResponse = await fetch(TEMPLATE_PATH);
  if (!templateResponse.ok) {
    throw new Error("Acil durum Word şablonu yüklenemedi.");
  }

  const zip = await JSZip.loadAsync(await templateResponse.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");
  const headerXml = await zip.file("word/header1.xml")?.async("string");
  const footerXml = await zip.file("word/footer1.xml")?.async("string");

  if (!documentXml) {
    throw new Error("Word şablonunun document.xml dosyası okunamadı.");
  }

  const plan = bundle.plan;
  const general = plan.plan_data.genel_bilgiler;
  const workplace = plan.plan_data.isyeri_bilgileri;
  const osgb = plan.plan_data.osgb_bilgileri;
  const responsible = plan.plan_data.gorevli_bilgileri;
  const documentInfo = plan.plan_data.dokuman_bilgileri;
  const { month, year } = splitMonthYear(documentInfo.ay_yil, documentInfo.dokuman_tarihi || general.hazirlanma_tarihi);
  const companyName = safeText(plan.company_name);
  const workplaceAddress = safeText(workplace.adres);

  const xml = parseXml(documentXml);
  const tables = getTables(xml);
  const paragraphs = getParagraphs(xml);

  setParagraphText(paragraphs[0], safeText(documentInfo.plan_basligi, "ACİL DURUM PLANI"));
  setParagraphText(paragraphs[1], formatDateOrDash(documentInfo.dokuman_tarihi || general.hazirlanma_tarihi || plan.created_at));
  setParagraphText(paragraphs[2], companyName);
  setParagraphText(paragraphs[3], safeText(documentInfo.plan_alt_basligi, "ACİL DURUM EYLEM PLANI"));

  const purposeHeadingIndex = findParagraphIndex(
    paragraphs,
    (text) => text.includes("1.1.") && text.toLocaleUpperCase("tr-TR").includes("AMA"),
  );
  if (purposeHeadingIndex >= 0) {
    setParagraphText(
      paragraphs[purposeHeadingIndex + 1],
      `Bu planın amacı; ${companyName} işyerinde ve işverene ait şantiye/çalışma alanlarında oluşabilecek acil durumlarda insan sağlığı, can güvenliği, çevre ve iş sürekliliğinin korunması için uygulanacak usul ve esasları belirlemektir.`,
    );
  }

  const scopeHeadingIndex = findParagraphIndex(
    paragraphs,
    (text) => text.includes("1.2.") && text.toLocaleUpperCase("tr-TR").includes("KAPSAM"),
  );
  if (scopeHeadingIndex >= 0) {
    setParagraphText(
      paragraphs[scopeHeadingIndex + 1],
      `Bu plan, ${companyName} firmasının ${workplaceAddress} adresinde ve işverenin şantiyeleri dahil faaliyet gösterdiği tüm işyeri adreslerinde meydana gelebilecek acil durumlar için alınacak önlemleri ve acil durumlarda yürütülecek çalışmaları kapsar.`,
    );
  }

  setTableCell(tables, 0, 0, 1, safeText(osgb.unvan));
  setTableCell(tables, 0, 1, 1, safeText(osgb.adres));
  setTableCell(tables, 0, 2, 1, safeText(osgb.telefon));
  setTableCell(
    tables,
    0,
    3,
    1,
    [osgb.web, osgb.email].filter(Boolean).join(" | ") || "-",
  );

  setTableCell(tables, 1, 0, 1, safeText(plan.company_name));
  setTableCell(tables, 1, 1, 1, safeText(workplace.adres));
  setTableCell(tables, 1, 2, 1, safeText(workplace.sgk_sicil_no));
  setTableCell(tables, 1, 3, 1, safeText(workplace.tehlike_sinifi || plan.hazard_class));
  setTableCell(tables, 1, 4, 1, String(plan.employee_count || 0));
  setTableCell(tables, 1, 5, 1, formatDateOrDash(general.hazirlanma_tarihi || plan.created_at));
  setTableCell(tables, 1, 6, 1, formatDateOrDash(general.gecerlilik_tarihi));

  const shortRoleRows = [
    [safeText(responsible.isveren_vekil.ad_soyad), "İşveren / İşveren Vekili"],
    [safeText(responsible.isg_uzmani.ad_soyad), "İş Güvenliği Uzmanı"],
    [safeText(responsible.isyeri_hekimi.ad_soyad), "İşyeri Hekimi"],
    [
      safeText(
        bundle.teams.find((team) => team.team_name.toLocaleLowerCase("tr-TR").includes("söndür"))?.team_leader?.first_name
          ? [
              bundle.teams.find((team) => team.team_name.toLocaleLowerCase("tr-TR").includes("söndür"))?.team_leader?.first_name,
              bundle.teams.find((team) => team.team_name.toLocaleLowerCase("tr-TR").includes("söndür"))?.team_leader?.last_name,
            ]
              .filter(Boolean)
              .join(" ")
          : "",
      ),
      "Söndürme Elemanı",
    ],
    [
      safeText(
        bundle.teams.find((team) => team.team_name.toLocaleLowerCase("tr-TR").includes("kurtarma"))?.team_leader?.first_name
          ? [
              bundle.teams.find((team) => team.team_name.toLocaleLowerCase("tr-TR").includes("kurtarma"))?.team_leader?.first_name,
              bundle.teams.find((team) => team.team_name.toLocaleLowerCase("tr-TR").includes("kurtarma"))?.team_leader?.last_name,
            ]
              .filter(Boolean)
              .join(" ")
          : "",
      ),
      "Kurtarma Elemanı",
    ],
    [
      safeText(
        bundle.teams.find((team) => team.team_name.toLocaleLowerCase("tr-TR").includes("koruma"))?.team_leader?.first_name
          ? [
              bundle.teams.find((team) => team.team_name.toLocaleLowerCase("tr-TR").includes("koruma"))?.team_leader?.first_name,
              bundle.teams.find((team) => team.team_name.toLocaleLowerCase("tr-TR").includes("koruma"))?.team_leader?.last_name,
            ]
              .filter(Boolean)
              .join(" ")
          : "",
      ),
      "Koruma Elemanı",
    ],
    [
      safeText(
        bundle.teams.find((team) => team.team_name.toLocaleLowerCase("tr-TR").includes("ilkyard"))?.team_leader?.first_name
          ? [
              bundle.teams.find((team) => team.team_name.toLocaleLowerCase("tr-TR").includes("ilkyard"))?.team_leader?.first_name,
              bundle.teams.find((team) => team.team_name.toLocaleLowerCase("tr-TR").includes("ilkyard"))?.team_leader?.last_name,
            ]
              .filter(Boolean)
              .join(" ")
          : "",
      ),
      "İlkyardım Elemanı",
    ],
  ];

  fillSimpleRows(
    tables[2],
    shortRoleRows.map(([name, duty]) => [name, duty]),
    1,
    1,
  );

  setTableCell(tables, 3, 0, 1, safeText(plan.company_name));
  setTableCell(tables, 3, 1, 1, safeText(workplace.adres));
  setTableCell(tables, 3, 2, 1, safeText(workplace.sgk_sicil_no));
  setTableCell(tables, 3, 2, 3, safeText(workplace.is_kolu || plan.sector));
  setTableCell(tables, 3, 3, 1, month);
  setTableCell(tables, 3, 4, 1, year);
  setTableCell(tables, 3, 4, 3, safeText(workplace.tehlike_sinifi || plan.hazard_class));
  setTableCell(tables, 3, 5, 1, formatDateOrDash(documentInfo.dokuman_tarihi || general.hazirlanma_tarihi || plan.created_at));
  setTableCell(tables, 3, 5, 3, formatDateOrDash(general.gecerlilik_tarihi));
  setTableCell(tables, 3, 6, 1, safeText(responsible.isveren_vekil.ad_soyad));
  setTableCell(tables, 3, 6, 3, safeText(responsible.isveren_vekil.telefon));
  setTableCell(tables, 3, 6, 5, safeText(responsible.isveren_vekil.tc_no));
  setTableCell(tables, 3, 7, 1, safeText(responsible.isg_uzmani.ad_soyad));
  setTableCell(tables, 3, 7, 3, safeText(responsible.isg_uzmani.belge_no));
  setTableCell(
    tables,
    3,
    7,
    5,
    `${safeText(responsible.isg_uzmani.tc_no)} | Tel: ${safeText(responsible.isg_uzmani.telefon)}`,
  );
  setTableCell(tables, 3, 8, 1, safeText(responsible.isyeri_hekimi.ad_soyad));
  setTableCell(tables, 3, 8, 3, safeText(responsible.isyeri_hekimi.belge_no));
  setTableCell(
    tables,
    3,
    8,
    5,
    `${safeText(responsible.isyeri_hekimi.tc_no)} | Tel: ${safeText(responsible.isyeri_hekimi.telefon)}`,
  );
  setTableCell(tables, 3, 9, 1, safeText(responsible.calisan_temsilcisi.ad_soyad));
  setTableCell(tables, 3, 9, 3, formatDateOrDash(responsible.calisan_temsilcisi.egitim_tarihi));
  setTableCell(
    tables,
    3,
    9,
    5,
    `${safeText(responsible.calisan_temsilcisi.tc_no)} | Tel: ${safeText(responsible.calisan_temsilcisi.telefon)}`,
  );
  setTableCell(tables, 3, 10, 1, "");
  setTableCell(tables, 3, 10, 3, "");
  setTableCell(tables, 3, 10, 5, "Tel:");
  setTableCell(tables, 3, 11, 1, safeText(responsible.destek_elemani.ad_soyad));
  setTableCell(tables, 3, 11, 3, safeText(responsible.destek_elemani.telefon));
  setTableCell(tables, 3, 11, 5, safeText(responsible.destek_elemani.tc_no));
  setTableCell(tables, 3, 12, 1, safeText(responsible.bilgi_sahibi_kisi.ad_soyad));
  setTableCell(tables, 3, 12, 3, safeText(responsible.bilgi_sahibi_kisi.telefon));
  setTableCell(tables, 3, 12, 5, safeText(responsible.bilgi_sahibi_kisi.tc_no));

  fillSimpleRows(
    tables[4],
    ADEP_DEFINITION_ROWS.map(([term, description]) => [term, description]),
    1,
    1,
  );

  setTableCell(tables, 5, 1, 0, safeText(responsible.isveren_vekil.ad_soyad));
  setTableCell(tables, 5, 1, 1, safeText(responsible.isveren_vekil.unvan, "İşveren / İşveren Vekili"));
  setTableCell(tables, 5, 1, 2, "Tüm işyeri");
  setTableCell(tables, 5, 1, 3, safeText(responsible.isveren_vekil.telefon));
  setTableCell(
    tables,
    5,
    1,
    4,
    "Gelen ihbarı değerlendirir, acil durum prosedürünün uygulanmasına karar verir ve ekipleri koordine eder.",
  );

  const teamTableMap = [
    { tableIndex: 6, keyword: "söndür" },
    { tableIndex: 7, keyword: "kurtarma" },
    { tableIndex: 8, keyword: "koruma" },
    { tableIndex: 9, keyword: "ilkyard" },
  ];

  teamTableMap.forEach(({ tableIndex, keyword }) => {
    const team = bundle.teams.find((item) =>
      item.team_name.toLocaleLowerCase("tr-TR").includes(keyword),
    );
    const entries = getTeamEntries(team);
    const minimumRows = Math.max(entries.length + 1, 5);
    const teamRows = ensureRowCount(tables[tableIndex], minimumRows, 1);

    for (let rowIndex = 1; rowIndex < teamRows.length; rowIndex += 1) {
      const row = teamRows[rowIndex];
      const cells = getCells(row);
      const entry = entries[rowIndex - 1];

      setCellText(cells[0], String(rowIndex));
      setCellText(cells[1], entry?.tc ?? "-");
      if (rowIndex === 1) {
        setCellText(cells[2], "Ekip Başkanı");
      } else if (rowIndex === 2) {
        setCellText(cells[2], "Ekip Başkan Yardımcısı");
      } else {
        setCellText(cells[2], "Üye");
      }
      setCellText(cells[3], entry?.name ?? "");
      setCellText(cells[4], entry?.phone ?? "");
    }
  });

  const contactsRows = bundle.contacts.map((contact) => [safeText(contact.institution_name), safeText(contact.phone_number)]);
  fillSimpleRows(tables[10], contactsRows, 1, 1);

  const equipmentPairs: Array<Array<string>> = [];
  for (let index = 0; index < bundle.equipmentInventory.length; index += 2) {
    const left = bundle.equipmentInventory[index];
    const right = bundle.equipmentInventory[index + 1];
    equipmentPairs.push([
      safeText(left?.equipment_name, ""),
      [left?.quantity ? `${left.quantity} adet` : "", left?.location].filter(Boolean).join(" / "),
      safeText(right?.equipment_name, ""),
      [right?.quantity ? `${right.quantity} adet` : "", right?.location].filter(Boolean).join(" / "),
    ]);
  }
  fillSimpleRows(tables[11], equipmentPairs, 1, 1);

  setTableCell(tables, 12, 1, 1, safeText(plan.plan_data.toplanma_yeri.aciklama));

  const signatureRows = buildSignatureRows(bundle).map((entry, index) => [
    String(index + 1),
    entry.name,
    entry.tcOrCertificate,
    entry.duty,
    entry.date,
    "",
  ]);
  fillSimpleRows(tables[13], signatureRows, 1, 1);

  zip.file("word/document.xml", serializeXml(xml));

  if (headerXml) {
    const header = parseXml(headerXml);
    const headerParagraphs = getParagraphs(header);
    setParagraphText(
      headerParagraphs[0],
      `${safeText(documentInfo.plan_alt_basligi, "ACİL DURUM EYLEM PLANI")} - ${formatMonthYear(
        documentInfo.ay_yil,
        documentInfo.dokuman_tarihi || general.hazirlanma_tarihi,
      )}`,
    );
    zip.file("word/header1.xml", serializeXml(header));
  }

  if (footerXml) {
    const footer = parseXml(footerXml);
    const footerParagraphs = getParagraphs(footer);
    if (footerParagraphs[0]) {
      const paragraphTexts = getTextNodes(footerParagraphs[0]);
      if (paragraphTexts[0]) {
        setTextNodeValue(paragraphTexts[0], safeText(plan.company_name));
      } else {
        setParagraphText(footerParagraphs[0], safeText(plan.company_name));
      }
    }
    zip.file("word/footer1.xml", serializeXml(footer));
  }

  return zip.generateAsync({ type: "blob" });
};

export const generateADEPWordDocument = async (planId: string): Promise<Blob> => {
  const bundle = await fetchADEPDocumentBundle(planId);
  return replaceWordTemplate(bundle);
};

export const downloadADEPWordDocument = async (planId: string) => {
  const bundle = await fetchADEPDocumentBundle(planId);
  const blob = await replaceWordTemplate(bundle);
  const fallbackName = safeFileName(bundle.plan.plan_name || bundle.plan.company_name || "adep-plan");
  saveAs(blob, `${fallbackName || "adep-plan"}.docx`);
};
