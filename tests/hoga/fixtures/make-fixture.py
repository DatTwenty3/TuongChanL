"""Trích dữ liệu 5 tệp Excel mẫu của VHGpro 4 thành vhg-templates.json (cần openpyxl)."""
import glob, json, os, sys, warnings
import openpyxl

warnings.filterwarnings("ignore")
src = sys.argv[1] if len(sys.argv) > 1 else "."
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vhg-templates.json")
kinds = ["lienKhoi", "napRoi", "thamThuNapRoi", "thamThuLienKhoi", "khongCo"]


def val(v):
    return round(v, 10) if isinstance(v, float) else v


files = sorted(glob.glob(os.path.join(src, "*.xlsx")))
assert len(files) == 5, "cần đúng 5 tệp .xlsx (1.HO GA … 5.HO GA …)"
allx = {}
for k, f in zip(kinds, files):
    wb = openpyxl.load_workbook(f, data_only=True)
    ds = wb.worksheets[1]
    rows = []
    for r in range(4, 60):
        if ds.cell(r, 2).value in (None, ""):
            continue
        rows.append({openpyxl.utils.get_column_letter(c): val(ds.cell(r, c).value) for c in range(1, 28) if ds.cell(r, c).value is not None})

    def cells(name):
        ws = wb[name]
        return [[c.coordinate, val(c.value)] for row in ws.iter_rows(min_row=1, max_row=ws.max_row) for c in row if c.value is not None]

    cf = {a: v for a, v in cells("CF.Ga")}
    allx[k] = {"sheet": ds.title, "rows": rows, "cfGa": cf, "cfCong": cells("CF.Cong"), "cfData": cells("CF.Data"), "klhg": {a: v for a, v in cells("KL HG")}}
json.dump(allx, open(out, "w", encoding="utf-8"), ensure_ascii=False)
print("đã ghi", out)
