// Lettura minima di un file .xlsx (zip + XML), senza librerie esterne.
// Ritorna { nomeFoglio: [[valori riga 1], [valori riga 2], ...] } con i valori "grezzi"
// (numeri, stringhe, booleani); le date restano numeri seriali di Excel.

const td = new TextDecoder("utf-8");

async function inflateRaw(bytes) {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function unzip(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Il file non è un Excel valido (zip non riconosciuto).");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("Excel danneggiato (indice zip).");
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const loc = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nlen));
    files[name] = { method, csize, loc };
    p += 46 + nlen + elen + clen;
  }
  return {
    names: Object.keys(files),
    async read(name) {
      const f = files[name];
      if (!f) return null;
      const ln = dv.getUint16(f.loc + 26, true);
      const le = dv.getUint16(f.loc + 28, true);
      const start = f.loc + 30 + ln + le;
      const data = u8.subarray(start, start + f.csize);
      const out = f.method === 0 ? data : await inflateRaw(data);
      return td.decode(out);
    },
  };
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export function unescapeXml(s) {
  return s
    .replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e) =>
      e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e])
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function attrs(s) {
  const out = {};
  for (const m of s.matchAll(/([\w:]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = unescapeXml(m[2]);
  return out;
}

function textOf(xml) {
  // concatena i <t> (anche nelle stringhe con formattazione), ignorando la fonetica <rPh>
  xml = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let s = "";
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) s += m[1];
  return unescapeXml(s);
}

export function colIndex(ref) {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

export function colLetter(i) {
  let s = "";
  i += 1;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

function parseSheet(xml, shared) {
  const rows = [];
  const body = xml.slice(xml.indexOf("<sheetData"));
  for (const rm of body.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const ra = attrs(rm[1]);
    const rIdx = ra.r ? parseInt(ra.r, 10) - 1 : rows.length;
    const row = [];
    let auto = 0;
    for (const cm of (rm[2] || "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = attrs(cm[1]);
      const ci = a.r ? colIndex(a.r) : auto;
      auto = ci + 1;
      const inner = cm[2] || "";
      const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
      const raw = vm ? unescapeXml(vm[1]) : null;
      let v = null;
      switch (a.t) {
        case "s": v = raw == null ? null : shared[parseInt(raw, 10)] ?? null; break;
        case "str": v = raw; break;
        case "inlineStr": v = textOf(inner); break;
        case "b": v = raw === "1"; break;
        case "e": v = null; break;
        default: v = raw == null || raw === "" ? null : Number(raw);
      }
      if (v !== null && v !== "") row[ci] = v;
    }
    rows[rIdx] = row;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}

export async function readWorkbook(buf) {
  const z = await unzip(buf);
  const wbXml = await z.read("xl/workbook.xml");
  if (!wbXml) throw new Error("Il file non sembra un Excel (.xlsx).");
  const relsXml = (await z.read("xl/_rels/workbook.xml.rels")) || "";
  const rels = {};
  for (const m of relsXml.matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const a = attrs(m[1]);
    rels[a.Id] = a.Target;
  }
  const sstXml = (await z.read("xl/sharedStrings.xml")) || "";
  const shared = [];
  for (const m of sstXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textOf(m[1]));
  const sheets = {};
  for (const m of wbXml.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const a = attrs(m[1]);
    let target = rels[a["r:id"]] || "";
    target = target.startsWith("/") ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
    const xml = await z.read(target);
    if (xml) sheets[a.name] = parseSheet(xml, shared);
  }
  return sheets;
}
