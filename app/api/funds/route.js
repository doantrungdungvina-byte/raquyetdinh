import { NextResponse } from "next/server";

const funds = [
  ["E1VFVN30","E1VFVN30 — ETF VN30"],["FUEVFVND","FUEVFVND — ETF Diamond"],["FUESSV50","FUESSV50 — ETF VNX50"],["FUESSVFL","FUESSVFL — ETF VNFinLead"],["FUEMAV30","FUEMAV30 — ETF VN30"],["FUEKIV30","FUEKIV30 — ETF VN30"],
  ["BVFED","BVFED"],["BMFF","BMFF"],["DCDS","DCDS — DC Dynamic Securities"],
  ["DCDE","DCDE"],["DFVN-CAF","DFVN-CAF"],["EVESG","EVESG"],["MAGEF","MAGEF"],
  ["MBVF","MBVF"],["PHVSF","PHVSF"],["SSISCA","SSISCA"],["TBLF","TBLF"],
  ["VDEF","VDEF"],["VESAF","VESAF"],["VEOF","VEOF"],["VFF","VFF"],["VIBF","VIBF"],
  ["VLGF","VLGF"],["VNDAF","VNDAF"],["VNDBF","VNDBF"],["UVEEF","UVEEF"],
  ["VCBF-AIF","VCBF-AIF"],["VCBF-BCF","VCBF-BCF"],["VCBF-FIF","VCBF-FIF"],
  ["VCBF-MGF","VCBF-MGF"],["VCBF-TBF","VCBF-TBF"],["VCAMDF","VCAMDF"],
  ["KDEF","KDEF"],["GDEGF","GDEGF"],["NTPPF","NTPPF"],["RVPIF","RVPIF"],
  ["TCGF","TCGF"],["SSI-PDF","SSI-PDF"],["AEIF","AEIF"],["LPLF","LPLF"],
  ["ABEF","ABEF"],["DCAF","DCAF"]
].map(([symbol,label]) => ({symbol,label}));

export async function GET() {
  return NextResponse.json({ funds, source: "Danh sách mã khởi tạo; NAV cần xác minh theo nguồn quỹ." });
}
