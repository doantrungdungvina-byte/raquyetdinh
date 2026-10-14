 "use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Settings2, Download, Upload, RotateCcw, Trophy, SlidersHorizontal, Pencil, Check, X, FileSpreadsheet, Printer, FileDown } from "lucide-react";
import * as XLSX from "xlsx";

type Choice = { id: string; name: string; scores: number[] };
const STORAGE_KEY = "decision-maker-v1";
const starterCriteria = ["An toàn", "Lợi nhuận", "Thanh khoản", "Tiêu chí 4", "Tiêu chí 5"];
const starterChoices: Choice[] = [
  { id: "gold", name: "Vàng", scores: [3, 3, 7, 0, 0] },
  { id: "stocks", name: "Chứng khoán", scores: [6, 6, 6, 0, 0] },
  { id: "property", name: "BĐS", scores: [7, 5, 3, 0, 0] },
  { id: "deposit", name: "Tiền gửi", scores: [10, 3, 7, 0, 0] },
];
const makeId = () => Math.random().toString(36).slice(2, 10);

export default function Home() {
  const [title, setTitle] = useState("Danh sách lựa chọn");
  const [criteria, setCriteria] = useState<string[]>(starterCriteria);
  const [choices, setChoices] = useState<Choice[]>(starterChoices);
  const [loaded, setLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editTitle, setEditTitle] = useState(false);
  const [newChoice, setNewChoice] = useState("");
  const [maxScore, setMaxScore] = useState(10);
  const [totalCapital, setTotalCapital] = useState(1000000000);
  const [direction, setDirection] = useState<"high" | "low">("high");
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.title) setTitle(d.title);
        if (Array.isArray(d.criteria) && d.criteria.length) setCriteria(d.criteria);
        if (Array.isArray(d.choices)) setChoices(d.choices);
        if (d.maxScore) setMaxScore(d.maxScore);
        if (Number.isFinite(d.totalCapital) && d.totalCapital >= 0) setTotalCapital(d.totalCapital);
        if (d.direction) setDirection(d.direction);
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ title, criteria, choices, maxScore, direction, totalCapital }));
  }, [loaded, title, criteria, choices, maxScore, direction, totalCapital]);

  const ranked = useMemo(() => {
    const rows = choices.map(c => {
      const scores = criteria.map((_, i) => Number(c.scores[i] || 0));
      const total = scores.reduce((a, b) => a + b, 0);
      return { ...c, scores, total };
    });
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);
    return rows.map(r => ({
      ...r,
      rank: 1 + rows.filter(o => direction === "high" ? o.total > r.total : o.total < r.total).length,
      percent: grandTotal > 0 ? r.total / grandTotal * 100 : 0
    })).sort((a, b) => direction === "high" ? b.total - a.total : a.total - b.total);
  }, [choices, criteria, direction]);

  const visibleRows = ranked.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
  const best = ranked[0];

  function updateScore(id: string, index: number, value: string) {
    const n = value === "" ? 0 : Math.max(0, Math.min(maxScore, Number(value) || 0));
    setChoices(prev => prev.map(c => c.id === id ? { ...c, scores: criteria.map((_, i) => i === index ? n : Number(c.scores[i] || 0)) } : c));
  }
  function renameCriterion(index: number, value: string) {
    setCriteria(prev => prev.map((c, i) => i === index ? value : c));
  }
  function addCriterion() {
    setCriteria(prev => [...prev, `Tiêu chí ${prev.length + 1}`]);
    setChoices(prev => prev.map(c => ({ ...c, scores: [...c.scores, 0] })));
  }
  function removeCriterion(index: number) {
    if (criteria.length <= 1) return;
    setCriteria(prev => prev.filter((_, i) => i !== index));
    setChoices(prev => prev.map(c => ({ ...c, scores: c.scores.filter((_, i) => i !== index) })));
  }
  function addChoice() {
    if (!newChoice.trim()) return;
    setChoices(prev => [...prev, { id: makeId(), name: newChoice.trim(), scores: criteria.map(() => 0) }]);
    setNewChoice("");
  }
  function renameChoice(id: string, name: string) {
    setChoices(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  }
  function exportExcel() {
    const rows = ranked.map((r, i) => ({
      "Xếp hạng": i + 1, "Danh sách lựa chọn": r.name,
      ...Object.fromEntries(criteria.map((c, j) => [c || `Tiêu chí ${j + 1}`, r.scores[j]])),
      "Tổng điểm": r.total, "% tổng điểm": `${r.percent.toFixed(2)}%`,
      "Tổng vốn đầu tư": totalCapital,
      "Số vốn phân bổ": ranked.reduce((sum, x) => sum + x.total, 0) > 0 ? Math.round(r.total / ranked.reduce((sum, x) => sum + x.total, 0) * totalCapital) : 0
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh sách lựa chọn");
    XLSX.writeFile(wb, "Danh-sach-lua-chon.xlsx");
  }
  function importExcel(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        // Read raw rows to support templates where criterion names are on row 2.
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false });
        if (matrix.length < 2) return alert("File Excel chưa có đủ tiêu đề và dữ liệu.");
        const row1 = (matrix[0] || []).map(v => String(v ?? "").trim());
        const row2 = (matrix[1] || []).map(v => String(v ?? "").trim());
        const optionIndex = Math.max(0, row1.findIndex(v => /danh sách lựa chọn|lựa chọn|phương án|option|name/i.test(v)));
        const criterionStart = Math.max(0, row1.findIndex(v => /tiêu chí đánh giá/i.test(v)));
        const start = criterionStart > 0 ? criterionStart : Math.min(optionIndex + 1, row2.length);
        const end = Math.max(row1.length, row2.length);
        const columns: { index: number; label: string }[] = [];
        for (let i = start; i < end; i++) {
          const label = row2[i] || row1[i];
          if (label && !/tổng điểm|xếp hạng|^%$|% tổng điểm|^rank$/i.test(label)) columns.push({ index: i, label });
        }
        if (!columns.length) throw new Error("Không tìm thấy cột tiêu chí đánh giá.");
        const nextCriteria = columns.map(c => c.label);
        const nextChoices = matrix.slice(2).filter(row => String(row?.[optionIndex] ?? "").trim()).map(row => ({
          id: makeId(), name: String(row?.[optionIndex]).trim(),
          scores: columns.map(c => {
            const n = Number(row?.[c.index]);
            return Number.isFinite(n) ? Math.max(0, Math.min(maxScore, n)) : 0;
          })
        }));
        setCriteria(nextCriteria);
        setChoices(nextChoices);
        setTitle("Danh sách lựa chọn");
        alert(`Đã nhập ${nextChoices.length} lựa chọn và ${nextCriteria.length} tiêu chí.`);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Không thể đọc file Excel.");
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileRef.current) fileRef.current.value = "";
  }
  function resetAll() {
    if (!confirm("Khôi phục dữ liệu mẫu? Dữ liệu đang chỉnh sửa sẽ bị thay thế.")) return;
    setTitle("Danh sách lựa chọn"); setCriteria(starterCriteria); setChoices(starterChoices); setMaxScore(10); setDirection("high");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><div className="brandMark">Q</div><div><div className="brandName">DECISION DESK</div><div className="brandSub">CÔNG CỤ HỖ TRỢ RA QUYẾT ĐỊNH</div></div></div>
        <div className="topActions">
          <button className="btn ghost" onClick={() => fileRef.current?.click()}><Upload size={16}/> Nhập Excel</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => importExcel(e.target.files?.[0])}/>
          <button className="btn ghost" onClick={exportExcel}><Download size={16}/> Xuất Excel</button>
          <button className="btn ghost printAction" onClick={() => window.print()} title="In bảng đánh giá"><Printer size={16}/> Print Out</button>
          <button className="btn ghost printAction" onClick={() => window.print()} title="Trong hộp thoại in, chọn Save as PDF"><FileDown size={16}/> PDF</button>
          <button className="btn primary noPrint" onClick={() => setShowSettings(v => !v)}><Settings2 size={16}/> Cài đặt</button>
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow"><span className="dot"/> WORKSPACE RA QUYẾT ĐỊNH</div>
        <div className="titleLine">
          {editTitle ? <input className="titleInput" value={title} onChange={e => setTitle(e.target.value)} onBlur={() => setEditTitle(false)} onKeyDown={e => e.key === "Enter" && setEditTitle(false)} autoFocus/> : <h1>{title}</h1>}
          <button className="iconBtn" aria-label="Đổi tên bảng" title="Đổi tên bảng" onClick={() => setEditTitle(true)}><Pencil size={17}/></button>
        </div>
        <p className="heroText">Đặt tiêu chí, chấm điểm từng lựa chọn và xem thứ hạng tự động để có quyết định rõ ràng hơn.</p>
        <div className="heroMeta"><span><SlidersHorizontal size={15}/> {choices.length} lựa chọn</span><span>{criteria.length} tiêu chí đánh giá</span><span>Thang điểm 0–{maxScore}</span></div>
      </section>

      {showSettings && <section className="settings panel">
        <div className="sectionHead"><div><h2>Cài đặt đánh giá</h2><p>Điều chỉnh quy tắc chấm điểm cho bảng này.</p></div><button className="iconBtn" onClick={() => setShowSettings(false)}><X size={18}/></button></div>
        <div className="settingsGrid">
          <label>Điểm tối đa mỗi tiêu chí<input type="number" min="1" max="100" value={maxScore} onChange={e => { const v = Math.max(1, Math.min(100, Number(e.target.value) || 10)); setMaxScore(v); setChoices(prev => prev.map(c => ({...c, scores: c.scores.map(s => Math.min(s, v))}))); }}/></label>
          <label>Quy tắc xếp hạng<select value={direction} onChange={e => setDirection(e.target.value as "high" | "low")}><option value="high">Tổng điểm cao hơn xếp hạng cao</option><option value="low">Tổng điểm thấp hơn xếp hạng cao</option></select></label>
          <div className="settingNote">Mặc định tất cả tiêu chí có trọng số như nhau. Phiên bản này chưa áp dụng trọng số riêng cho từng tiêu chí.</div>
        </div>
        <div className="criteriaEditor">
          <div className="criteriaTitle">Tên tiêu chí đánh giá <span>{criteria.length} tiêu chí</span></div>
          {criteria.map((c, i) => <div className="criterionRow" key={i}><span className="criterionNum">{String(i+1).padStart(2,"0")}</span><input value={c} onChange={e => renameCriterion(i, e.target.value)} placeholder={`Tiêu chí ${i+1}`}/><button className="iconBtn danger" title="Xóa tiêu chí" onClick={() => removeCriterion(i)} disabled={criteria.length <= 1}><Trash2 size={16}/></button></div>)}
          <button className="btn addCriterion" onClick={addCriterion}><Plus size={16}/> Thêm tiêu chí</button>
        </div>
      </section>}

      <section className="stats">
        <div className="statCard"><div className="statLabel">SỐ LỰA CHỌN</div><div className="statValue">{choices.length}</div><div className="statHint">Các phương án đang so sánh</div></div>
        <div className="statCard"><div className="statLabel">SỐ TIÊU CHÍ</div><div className="statValue">{criteria.length}</div><div className="statHint">Có thể đổi tên hoặc thêm mới</div></div>
        <div className="statCard highlight"><div className="statLabel"><Trophy size={14}/> LỰA CHỌN ĐANG DẪN ĐẦU</div><div className="statValue winnerValue">{best?.name || "—"}</div><div className="statHint">{best ? `${best.total} điểm · ${best.percent.toFixed(1)}% tổng điểm` : "Thêm lựa chọn để bắt đầu"}</div></div>
      </section>

      <section className="panel tablePanel">
        <div className="sectionHead tableHeading"><div><h2>Bảng đánh giá</h2><p className="screenOnlyHint">Nhập điểm trực tiếp vào ô. Tổng điểm và xếp hạng được tính tự động.</p><p className="printOnlyHint">Báo cáo tổng hợp các lựa chọn, tiêu chí và điểm đánh giá.</p></div><div className="tableTools"><input className="search" placeholder="Tìm lựa chọn..." value={search} onChange={e => setSearch(e.target.value)}/><button className="iconBtn" title="Khôi phục dữ liệu mẫu" onClick={resetAll}><RotateCcw size={17}/></button></div></div>
        <div className="tableWrap"><table><thead><tr><th className="rankCol">HẠNG</th><th className="nameCol">DANH SÁCH LỰA CHỌN</th>{criteria.map((c, i) => <th key={i} className="scoreCol"><span>{c || `Tiêu chí ${i+1}`}</span><small>0–{maxScore} điểm</small></th>)}<th className="totalCol">TỔNG ĐIỂM</th><th className="percentCol">% ĐIỂM</th><th></th></tr></thead>
          <tbody>{visibleRows.map((r, idx) => <tr key={r.id} className={idx === 0 && search === "" ? "topRow" : ""}><td className="rankCell"><span className={`rankBadge ${r.rank === 1 ? "first" : ""}`}>{r.rank === 1 ? <Trophy size={14}/> : r.rank}</span></td><td><input className="nameField" value={r.name} onChange={e => renameChoice(r.id, e.target.value)} aria-label="Tên lựa chọn"/></td>{criteria.map((c, i) => <td key={i}><input className="scoreInput" type="number" min="0" max={maxScore} value={r.scores[i] ?? 0} onChange={e => updateScore(r.id, i, e.target.value)} aria-label={`${r.name} - ${c}`}/></td>)}<td><strong className="totalNum">{r.total}</strong><div className="miniBar"><span style={{width: `${Math.min(100, r.total / Math.max(1, criteria.length * maxScore) * 100)}%`}}/></div></td><td><div className="percentCell">{r.percent.toFixed(1)}%</div></td><td><button className="iconBtn danger" title="Xóa lựa chọn" onClick={() => setChoices(prev => prev.filter(c => c.id !== r.id))}><Trash2 size={16}/></button></td></tr>)}
          {visibleRows.length === 0 && <tr><td colSpan={criteria.length + 5} className="empty">Chưa có lựa chọn phù hợp. Hãy thêm lựa chọn mới bên dưới.</td></tr>}</tbody></table></div>
        <div className="addRow"><form onSubmit={e => {e.preventDefault(); addChoice();}}><input value={newChoice} onChange={e => setNewChoice(e.target.value)} placeholder="Nhập tên lựa chọn mới, ví dụ: Quỹ mở..." aria-label="Tên lựa chọn mới"/><button className="btn primary" type="submit"><Plus size={16}/> Thêm lựa chọn</button></form><span className="autosave"><Check size={14}/> Tự lưu trên trình duyệt này</span></div>
      </section>

      <section className="panel capitalPanel">
        <div className="sectionHead capitalHeading">
          <div>
            <div className="eyebrow">PHÂN BỔ NGUỒN VỐN</div>
            <h2>Bảng phân bổ vốn đầu tư</h2>
            <p>Phân bổ vốn theo tỷ trọng điểm của từng lựa chọn trong tổng điểm.</p>
          </div>
          <label className="capitalInputWrap">Tổng số vốn đầu tư
            <div className="capitalInputLine">
              <input type="number" min="0" step="1000000" value={totalCapital} onChange={e => setTotalCapital(Math.max(0, Number(e.target.value) || 0))} aria-label="Tổng số vốn đầu tư"/>
              <span>VNĐ</span>
            </div>
            <small>{new Intl.NumberFormat("vi-VN").format(totalCapital)} đ</small>
          </label>
        </div>
        <div className="capitalSummary">
          <div><span>Tổng vốn phân bổ</span><strong>{new Intl.NumberFormat("vi-VN", {maximumFractionDigits: 0}).format(ranked.reduce((sum, r) => sum + (ranked.reduce((s, x) => s + x.total, 0) > 0 ? r.total / ranked.reduce((s, x) => s + x.total, 0) * totalCapital : 0), 0))} đ</strong></div>
          <div><span>Số lựa chọn</span><strong>{ranked.length}</strong></div>
          <div><span>Phương pháp</span><strong>Tỷ trọng điểm</strong></div>
        </div>
        <div className="tableWrap capitalTableWrap">
          <table className="capitalTable">
            <thead><tr><th>HẠNG</th><th>DANH SÁCH LỰA CHỌN</th><th>TỔNG ĐIỂM</th><th>% ĐIỂM</th><th>CÔNG THỨC PHÂN BỔ</th><th>SỐ VỐN ĐẦU TƯ</th></tr></thead>
            <tbody>
              {ranked.map(r => <tr key={r.id}>
                <td><span className={`rankBadge ${r.rank === 1 ? "first" : ""}`}>{r.rank === 1 ? <Trophy size={14}/> : r.rank}</span></td>
                <td><strong className="capitalChoice">{r.name || "Chưa đặt tên"}</strong></td>
                <td><strong>{r.total}</strong></td>
                <td><strong className="capitalPercent">{r.percent.toFixed(2)}%</strong></td>
                <td className="formulaCell">{r.percent.toFixed(2)}% × {new Intl.NumberFormat("vi-VN", {maximumFractionDigits: 0}).format(totalCapital)} đ</td>
                <td><strong className="capitalAmount">{new Intl.NumberFormat("vi-VN", {maximumFractionDigits: 0}).format(ranked.reduce((sum, x) => sum + x.total, 0) > 0 ? r.total / ranked.reduce((sum, x) => sum + x.total, 0) * totalCapital : 0)} đ</strong></td>
              </tr>)}
              {ranked.length === 0 && <tr><td colSpan={6} className="empty">Thêm lựa chọn trong Bảng đánh giá để tính vốn đầu tư.</td></tr>}
            </tbody>
            <tfoot><tr><td colSpan={5}>TỔNG VỐN ĐẦU TƯ PHÂN BỔ</td><td><strong>{new Intl.NumberFormat("vi-VN", {maximumFractionDigits: 0}).format(ranked.reduce((sum, r) => sum + r.total, 0) > 0 ? totalCapital : 0)} đ</strong></td></tr></tfoot>
          </table>
        </div>
        <p className="capitalNote">Cách tính: % điểm của lựa chọn = điểm lựa chọn ÷ tổng điểm của tất cả lựa chọn × 100%. Số vốn đầu tư = % điểm × tổng số vốn đầu tư. Nếu tất cả lựa chọn có tổng điểm bằng 0, vốn chưa được phân bổ.</p>
      </section>

      <section className="insightGrid">
        <div className="panel insightPanel"><div className="sectionHead"><div><h2>So sánh tổng điểm</h2><p>Nhìn nhanh mức điểm của từng lựa chọn.</p></div></div><div className="barList">{ranked.map(r => <div className="barItem" key={r.id}><div className="barLabels"><span>{r.name || "Chưa đặt tên"}</span><strong>{r.total}</strong></div><div className="barTrack"><span style={{width: `${Math.min(100, r.total / Math.max(1, criteria.length * maxScore) * 100)}%`}}/></div></div>)}{ranked.length === 0 && <p className="empty">Chưa có dữ liệu.</p>}</div></div>
        <div className="panel recommendation"><div className="recommendIcon"><Trophy size={21}/></div><div className="eyebrow">GỢI Ý THEO ĐIỂM SỐ</div><h2>{best?.name || "Chưa có lựa chọn"}</h2><p>{best ? `Đang đứng hạng ${best.rank} với ${best.total} điểm trên tổng tối đa ${criteria.length * maxScore} điểm.` : "Hãy thêm lựa chọn và chấm điểm để xem kết quả."}</p><div className="disclaimer">Kết quả là công cụ hỗ trợ so sánh theo điểm bạn nhập, không thay thế việc cân nhắc rủi ro và hoàn cảnh thực tế.</div></div>
      </section>
      <section className="donationSection noPrint">
        <div className="donationIntro">
          <div className="coffeeIcon"><span>☕</span></div>
          <div>
            <div className="eyebrow">SUPPORT THIS PROJECT</div>
            <h2>Buy me a Coffee</h2>
            <p>Nếu Decision Desk hữu ích với bạn, hãy ủng hộ để giúp duy trì và phát triển công cụ bạn nhé 😊</p>
          </div>
        </div>
        <div className="donationCards">
          <div className="donationCard">
            <div className="donationCardHead"><span className="paymentDot momoDot">M</span><div><strong>Momo · VietQR</strong><small>Quét mã bằng ứng dụng ngân hàng hoặc MoMo</small></div></div>
            <a className="donationQrLink" href="https://me.momo.vn/zbfAIwTbIvuOINC7" target="_blank" rel="noopener noreferrer" aria-label="Mở liên kết chuyển tiền MoMo">
              <img src="/momo-vietqr.png" alt="Mã QR MoMo VietQR để ủng hộ" className="donationQr momoQr"/>
            </a>
            <div className="qrCaption">Quét mã QR hoặc bấm nút bên dưới để mở MoMo</div>
            <a className="paymentLink momoPaymentLink" href="https://me.momo.vn/zbfAIwTbIvuOINC7" target="_blank" rel="noopener noreferrer">Mở MoMo để ủng hộ ↗</a>
          </div>
          <div className="donationCard">
            <div className="donationCardHead"><span className="paymentDot bankDot">T</span><div><strong>Techcombank · VietQR</strong><small>Ủng hộ qua chuyển khoản ngân hàng</small></div></div>
            <a className="donationQrLink" href="/techcombank-qr.png" target="_blank" rel="noopener noreferrer" aria-label="Mở mã QR Techcombank kích thước lớn">
              <img src="/techcombank-qr.png" alt="Mã QR Techcombank để ủng hộ" className="donationQr bankQr"/>
            </a>
            <div className="qrCaption">Quét mã QR bằng ứng dụng ngân hàng</div>
            <a className="paymentLink bankPaymentLink" href="/techcombank-qr.png" target="_blank" rel="noopener noreferrer">Mở QR chuyển khoản ↗</a>
          </div>
        </div>
      </section>
      <footer><span>DECISION DESK · DANH SÁCH LỰA CHỌN</span><span>Dữ liệu hiện được lưu trong trình duyệt của thiết bị đang sử dụng.</span></footer>
    </main>
  );
}