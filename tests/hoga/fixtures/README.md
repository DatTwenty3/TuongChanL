# Fixture đối chiếu VHGpro (không commit)

`vhg-templates.json` (bị `.gitignore`) là bản trích từ 5 tệp Excel mẫu "HO GA v4" đi kèm VHGpro 4: dữ liệu nhập, cấu hình CF.Ga / CF.Cong / CF.Data
và các giá trị đã tính của sheet `KL HG`. Đó là dữ liệu của bên thứ ba nên không đưa lên repo công khai.

Tạo lại trên máy có VHGpro 4:

```bash
python make-fixture.py "E:/3. data/rea/VHGpro 4/Excels"
```

Thiếu tệp này thì các phép đối chiếu Excel (`quantities`, `oracle-other-kinds`, `import`) tự bỏ qua; các test còn lại (thép, bản vẽ, giao diện, DXF, cấu hình) vẫn chạy.
