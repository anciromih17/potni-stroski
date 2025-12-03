const DEFAULT_PRICE_PER_KM = 0.43;

export function normalizePdfText(text) {
    if (!text) return '';
    text = String(text);
    text = text.replace(/\u00A0/g, ' ');
    text = text.replace(/[\u2012\u2013\u2014\u2015–—]/g, '-');
    text = text.replace(/[ \t]+/gu, ' ');
    text = text.replace(/\r\n?/g, '\n');
    return text.trim();
}

export function euMoneyToFloat(s) {
    if (s === null || s === undefined) return 0.0;
    s = String(s).replace(/\u00A0/g, ' ');
    let clean = s.replace(/[^0-9,.\-]/g, '');
    if (!clean) return 0.0;

    const hasComma = clean.indexOf(',') !== -1;
    const hasDot = clean.indexOf('.') !== -1;

    if (hasComma && hasDot) {
        const lastComma = clean.lastIndexOf(',');
        const lastDot = clean.lastIndexOf('.');
        if (lastComma > lastDot) {
            clean = clean.replace(/\./g, '');
            clean = clean.replace(',', '.');
        } else {
            clean = clean.replace(/,/g, '');
        }
    } else if (hasComma) {
        clean = clean.replace(/\./g, '');
        clean = clean.replace(',', '.');
    }
    const n = parseFloat(clean);
    return Number.isFinite(n) ? n : 0.0;
}

const moneyWithEuroRe = /(\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2})(\s*€)?/gu;
const numericTokenRe = /(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/g;

function pickOnlyRoute(lines, text) {
    const headerMarkers = ['Začetek', 'Konec', 'Datum', 'Predlagatelj', 'Odobritelj', 'Pot', 'Cena', 'Podjet', 'Pošta', 'POŠTA'];

    function trimBeforeLastMarker(s) {
        if (!s) return s;
        let lastPos = -1;
        const datePat = /(?:\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{4})(?:\s*ob\s*\d{1,2}:\d{2})?/gi;
        for (const m of s.matchAll(datePat)) {
            lastPos = Math.max(lastPos, (m.index || 0) + String(m[0]).length);
        }
        for (const mk of headerMarkers) {
            const idx = s.toLowerCase().lastIndexOf(mk.toLowerCase());
            if (idx !== -1) lastPos = Math.max(lastPos, idx + mk.length);
        }
        if (lastPos > 0 && lastPos < s.length) {
            return s.slice(lastPos).trim();
        }
        return s;
    }

    function extractShortestDashCandidate(s) {
        if (!s) return '';
        s = s.replace(/\s{2,}/g, ' ').trim();
        const dashPattern = /([^\d\n]{1,200}?\s*-\s*[^\d\n]{1,200}(?:\s*-\s*[^\d\n]{1,200}){0,3})/gu;
        const matches = [...s.matchAll(dashPattern)].map(m => m[1].trim());
        if (!matches.length) return '';
        matches.sort((a, b) => a.length - b.length);
        for (const cand of matches) {
            const low = cand.toLowerCase();
            if (headerMarkers.some(h => low.includes(h.toLowerCase()))) continue;
            if (/[:;\/\|]/.test(cand)) continue;
            return cand;
        }
        return matches[0];
    }

    const lineCandidates = [];
    for (const ln of lines) {
        if (ln.includes(' - ')) {
            const afterTrim = trimBeforeLastMarker(ln);
            if (afterTrim.length > 220) {
                const parts = afterTrim.split(/[\.\;\|\/]\s*/).map(s => s.trim()).filter(Boolean);
                for (const p of parts) {
                    if (p.includes(' - ')) lineCandidates.push(p);
                }
            } else {
                lineCandidates.push(afterTrim);
            }
        }
    }

    const scored = lineCandidates
        .map(s => ({ s: s.trim(), len: s.trim().length, dashes: (s.match(/ - /g) || []).length }))
        .filter(x => x.s && x.len > 3 && x.len < 400)
        .filter(x => !/naziv|podjet|vozil|vozilo|podjetja|pošta|vrsta prevoza|ime\/priimek|podpi|predlagatelj|odobritelj/i.test(x.s));

    if (scored.length) {
        const extracted = [];
        for (const it of scored) {
            const cand = extractShortestDashCandidate(it.s);
            if (cand) extracted.push({ cand, len: cand.length, dashes: (cand.match(/ - /g) || []).length });
        }
        if (extracted.length) {
            extracted.sort((a, b) => {
                if (b.dashes !== a.dashes) return b.dashes - a.dashes;
                return a.len - b.len;
            });
            return cleanRouteString(extracted[0].cand);
        }
        return cleanRouteString(scored[0].s);
    }

    const globalRaw = [];
    const globalPattern = /([A-ZČŠĐĆŽ][^\n-]{1,200}(?:\s*-\s*[A-ZČŠĐĆŽ][^\n-]{1,200}){1,4})/gu;
    for (const m of text.matchAll(globalPattern)) {
        const s = String(m[1]).trim();
        if (!/naziv|podjet|vozil|podjetja|pošta|vrsta prevoza|predlagatelj|odobritelj/i.test(s)) {
            globalRaw.push(s);
        }
    }
    if (globalRaw.length) {
        const extracted = globalRaw.map(s => ({ cand: extractShortestDashCandidate(s), len: extractShortestDashCandidate(s).length }))
            .filter(x => x.cand);
        if (extracted.length) {
            extracted.sort((a, b) => a.len - b.len);
            return cleanRouteString(extracted[0].cand);
        }
        return cleanRouteString(globalRaw[0]);
    }

    return '';
}

function cleanRouteString(route) {
    if (!route) return '';
    let r = route.trim();
    r = r.replace(/^\s*(?:\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{4})(?:\s*ob\s*\d{1,2}:\d{2})?\s*/iu, '');
    r = r.replace(/^\s*ob\s*\d{1,2}:\d{2}\s*/iu, '');
    r = r.replace(/\s*\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\s*€?\s*$/u, '').trim();
    r = r.replace(/\s+\d+$/u, '').trim();
    r = r.replace(/\s{2,}/g, ' ');
    return r;
}

function findPriceKmTotalTriplet(text) {
    const matches = [];
    for (const m of text.matchAll(moneyWithEuroRe)) {
        matches.push({ raw: m[1], euro: !!m[2], value: euMoneyToFloat(m[1]), index: m.index });
    }
    for (let i = 0; i + 2 < matches.length; i++) {
        const a = matches[i], b = matches[i + 1], c = matches[i + 2];
        if ((c.index - a.index) > 400) continue;
        const price = a.value, km = b.value, total = c.value;
        if (price > 0 && km > 0) {
            const calc = Math.round(price * km * 100) / 100;
            const diff = Math.abs(calc - total);
            if ((total > 0 && diff <= Math.max(0.5, 0.02 * total)) || (total > 0 && Math.abs((total / (price || 1)) - km) <= 1.5)) {
                return {
                    pricePerKmRaw: a.raw,
                    pricePerKm: price,
                    kmRaw: b.raw,
                    kmValue: km,
                    totalRaw: c.raw + (/\€/.test(c.raw) ? '' : ' €'),
                    totalValue: total,
                    startIndex: a.index,
                    endIndex: c.index
                };
            }
        }
    }
    return null;
}

function scanLinesForPriceAndKm(lines) {
    for (let i = 0; i < lines.length; i++) {
        const winStart = Math.max(0, i - 1);
        const winEnd = Math.min(lines.length - 1, i + 1);
        const windowText = lines.slice(winStart, winEnd + 1).join(' ');
        if (!windowText.includes(' - ') && !/kilometr/i.test(windowText) && !/\bkm\b/i.test(windowText) && !/znesek/i.test(windowText)) {
            continue;
        }

        const matches = [];
        for (const m of windowText.matchAll(moneyWithEuroRe)) {
            matches.push({
                raw: m[1],
                withEuro: !!m[2],
                value: euMoneyToFloat(m[1]),
                index: m.index
            });
        }
        if (matches.length === 0) continue;

        const priceCandidates = matches.filter(m => m.withEuro && m.value > 0 && m.value < 10);
        const kmCandidates = matches.filter(m => (!m.withEuro) && m.value >= 0.01 && m.value < 10000);

        let best = null;
        for (const p of priceCandidates) {
            for (const k of kmCandidates) {
                const dist = Math.abs((p.index || 0) - (k.index || 0));
                if ((p.index || 0) === (k.index || 0)) continue;
                if (!best || dist < best.dist) best = { price: p, km: k, dist };
            }
        }

        if (!best) {
            const smallNoEuro = matches.filter(m => (!m.withEuro) && m.value > 0 && m.value < 10);
            const largeNoEuro = matches.filter(m => (!m.withEuro) && m.value >= 10);
            for (const p of smallNoEuro) {
                for (const k of largeNoEuro) {
                    const dist = Math.abs((p.index || 0) - (k.index || 0));
                    if ((p.index || 0) === (k.index || 0)) continue;
                    if (!best || dist < best.dist) best = { price: p, km: k, dist };
                }
            }
        }

        if (best) {
            const priceVal = best.price.value;
            const kmVal = best.km.value;
            if (priceVal > 0 && kmVal > 0) {
                return {
                    kmRaw: String(best.km.raw),
                    kmValue: kmVal,
                    priceRaw: String(best.price.raw) + (best.price.withEuro ? ' €' : ''),
                    priceValue: priceVal,
                    computedTotal: Math.round(priceVal * kmVal * 100) / 100,
                    windowText
                };
            }
        }
    }
    return null;
}

function findPricePerKmInDoc(text) {
    const perKmPat = /(\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2})\s*€\s*(?:\/|\u002F)?\s*(?:km|KM|Km)?/gi;
    for (const m of text.matchAll(perKmPat)) {
        const v = euMoneyToFloat(m[1]);
        if (v > 0 && v < 10) return { raw: m[1], value: v };
    }
    const moneyRe = /(\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2})\s*€/gu;
    for (const m of text.matchAll(moneyRe)) {
        const v = euMoneyToFloat(m[1]);
        if (v > 0 && v < 10) return { raw: m[1], value: v };
    }
    return null;
}

export function extractReportDataFromPdfText(origText) {
    const text = normalizePdfText(origText || '');
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    const dateTimeRe = /(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})\s+ob\s+(\d{1,2}:\d{2})/giu;
    const skupajRe = /(Skupaj|Skupni\s+znesek|Končni\s+znesek|Total)/iu;

    const dtAll = [...text.matchAll(dateTimeRe)].map(m => m[0]);
    const start_dt = dtAll[0] ? dtAll[0].trim() : '';
    const end_dt = dtAll[1] ? dtAll[1].trim() : '';

    let route = '';
    let mid_raw = '';
    let mid_value = 0.0;
    let final_raw = '';
    let final_val = 0.0;
    let price_per_km_raw = '';
    let price_per_km = 0.0;

    const onlyRoute = pickOnlyRoute(lines, text);
    if (onlyRoute) route = onlyRoute;

    const trip = findPriceKmTotalTriplet(text);
    if (trip) {
        price_per_km = trip.pricePerKm;
        price_per_km_raw = trip.pricePerKmRaw + ' €';
        mid_raw = trip.kmRaw;
        mid_value = trip.kmValue;
        final_raw = trip.totalRaw;
        final_val = trip.totalValue;
        const before = text.slice(0, trip.startIndex || 0);
        if (!route) route = pickOnlyRoute(lines, before) || '';
    }

    if ((!mid_value || mid_value === 0)) {
        const scan = scanLinesForPriceAndKm(lines);
        if (scan) {
            mid_raw = scan.kmRaw;
            mid_value = scan.kmValue;
            if (scan.priceValue && scan.priceValue > 0) {
                price_per_km = scan.priceValue;
                price_per_km_raw = scan.priceRaw;
            }
            if (!route) route = pickOnlyRoute(lines, text) || route;
        }
    }

    const tableKm = (function findKmFromTable(lines, route, fullText) {
        function extractKmFromWindowText(windowText) {
            if (!windowText) return null;
            const numericMatches = [...windowText.matchAll(numericTokenRe)].map(m => ({ raw: m[1], idx: m.index, val: euMoneyToFloat(m[1]) }));
            if (!numericMatches.length) return null;
            const euroMatches = [...windowText.matchAll(/€|EUR|\bEUR\b/gi)];
            if (euroMatches.length) {
                const euroIdx = euroMatches[euroMatches.length - 1].index;
                const numsBeforeEuro = numericMatches.filter(nm => nm.idx < euroIdx);
                if (numsBeforeEuro.length) {
                    let best = numsBeforeEuro[0];
                    for (const nm of numsBeforeEuro) if (nm.val > best.val) best = nm;
                    if (best) return { raw: best.raw, value: best.val };
                }
            }
            if (numericMatches.length >= 2) {
                const pen = numericMatches[numericMatches.length - 2];
                if (pen) return { raw: pen.raw, value: pen.val };
            }
            let bestAll = numericMatches[0];
            for (const nm of numericMatches) if (nm.val > bestAll.val) bestAll = nm;
            return bestAll ? { raw: bestAll.raw, value: bestAll.val } : null;
        }

        if (route) {
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(route) || route.includes(lines[i]) || lines[i].includes(route.split(' - ')[0])) {
                    const windowText = lines.slice(i, Math.min(lines.length, i + 3)).join(' ');
                    const km = extractKmFromWindowText(windowText);
                    if (km && km.value >= 0.01) return km;
                }
            }
        }

        for (let i = 0; i < lines.length; i++) {
            const ln = lines[i];
            const nums = [...ln.matchAll(numericTokenRe)];
            if (/€|EUR|\bZnesek\b|\bZnesek \(EUR\)\b/i.test(ln) || nums.length >= 2 || ln.includes('Kilometri') || ln.includes('Pot')) {
                const windowText = lines.slice(i, Math.min(lines.length, i + 3)).join(' ');
                const km = extractKmFromWindowText(windowText);
                if (km && km.value >= 0.01) return km;
            }
        }

        const allLines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
        for (let i = 0; i < allLines.length; i++) {
            const ln = allLines[i];
            if (ln.includes(' - ') && /€/.test(ln)) {
                const km = extractKmFromWindowText(ln);
                if (km && km.value >= 0.01) return km;
            }
        }

        return null;
    })(lines, route, text);

    if (tableKm && tableKm.value >= 0.01) {
        mid_raw = tableKm.raw;
        mid_value = tableKm.value;
    }

    if (!price_per_km || price_per_km <= 0) {
        const foundPrice = findPricePerKmInDoc(text);
        if (foundPrice) {
            price_per_km = foundPrice.value;
            price_per_km_raw = foundPrice.raw + ' €';
        } else {
            price_per_km = DEFAULT_PRICE_PER_KM;
            price_per_km_raw = String(DEFAULT_PRICE_PER_KM.toFixed(2)).replace('.', ',') + ' €';
        }
    }

    if ((!mid_value || mid_value === 0)) {
        for (let i = 0; i < lines.length; i++) {
            const ln = lines[i];
            if (/^\s*Pot\b/i.test(ln) || /\bKilometri\b/i.test(ln) || /\bKilometri\b/i.test(lines[Math.max(0, i - 1)] || '')) {
                const window = lines.slice(i, Math.min(lines.length, i + 4)).join(' ');
                const nums = [...window.matchAll(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/g)].map(x => x[1]);
                for (const n of nums) {
                    const v = euMoneyToFloat(n);
                    if (v >= 0.01 && v < 1000000) { mid_raw = n; mid_value = v; break; }
                }
                if (mid_value) break;
            }
        }
        if ((!mid_value || mid_value === 0)) {
            for (const ln of lines) {
                if (skupajRe.test(ln)) {
                    const monies = [...ln.matchAll(moneyWithEuroRe)].map(m => ({ raw: m[1], euro: !!m[2], val: euMoneyToFloat(m[1]) }));
                    if (monies.length >= 2) {
                        mid_raw = monies[monies.length - 2].raw;
                        mid_value = monies[monies.length - 2].val;
                        break;
                    }
                }
            }
        }
        if ((!mid_value || mid_value === 0)) {
            for (const m of text.matchAll(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/g)) {
                const v = euMoneyToFloat(m[1]);
                if (v >= 0.01 && v < 1000000) { mid_raw = m[1]; mid_value = v; break; }
            }
        }
    }

    if (mid_value && price_per_km) {
        final_val = Math.round(price_per_km * mid_value * 100) / 100;
        final_raw = String(final_val.toFixed(2)).replace('.', ',') + ' €';
    }

    const onlyRouteFinal = pickOnlyRoute(lines, text);
    if (onlyRouteFinal) route = onlyRouteFinal;
    if (route) route = cleanRouteString(route);

    return {
        start_dt: start_dt || '',
        end_dt: end_dt || '',
        route: route || '',
        mid_raw: mid_raw || '',
        mid_value: mid_value || 0.0,
        price_per_km_raw: price_per_km_raw || '',
        price_per_km: price_per_km || 0.0,
        final_raw: final_raw || '',
        final_val: final_val || 0.0
    };
}