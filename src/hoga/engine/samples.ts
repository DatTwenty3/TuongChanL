// Dữ liệu mẫu (20 ga mỗi loại) lấy từ các tệp Excel nhập liệu mẫu đi kèm VHGpro 4.
import type { GaKind, GaRow } from './types';

export const SAMPLE_ROWS: Record<GaKind, GaRow[]> =  {
"lienKhoi": [
{
"name": "G400-1",
"count": 1,
"L": 2000,
"B": 1250,
"H": 1300,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "R300x400",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "D400",
"depth": 300
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 450,
"t": 100,
"out": "D10A150",
"in": "D10A150"
},
"level": 55.24
},
{
"name": "G500-2",
"count": 1,
"L": 1150,
"B": 1350,
"H": 1450,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D400",
"depth": 700
},
{
"spec": "D500",
"depth": 280
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 450,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 56.36
},
{
"name": "G600-3",
"count": 1,
"L": 1200,
"B": 1450,
"H": 1500,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D600",
"depth": 270
},
{
"spec": "",
"depth": 0
},
{
"spec": "D400",
"depth": 250
},
{
"spec": "D500",
"depth": 300
}
],
"neck": {
"h": 350,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 57.42
},
{
"name": "G800-1",
"count": 1,
"L": 1250,
"B": 1550,
"H": 1550,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D800",
"depth": 300
},
{
"spec": "D500",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "D400",
"depth": 320
}
],
"neck": {
"h": 300,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 54.64
},
{
"name": "G800-2",
"count": 1,
"L": 1300,
"B": 1650,
"H": 1600,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "600x800",
"depth": 250
},
{
"spec": "",
"depth": 0
},
{
"spec": "D800",
"depth": 310
},
{
"spec": "D500",
"depth": 330
}
],
"neck": {
"h": 400,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 56.84
},
{
"name": "G800-3",
"count": 1,
"L": 1350,
"B": 1750,
"H": 1650,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 200,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "D700",
"depth": 320
},
{
"spec": "D800",
"depth": 320
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 450,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 55
},
{
"name": "G1000-1",
"count": 1,
"L": 1400,
"B": 1850,
"H": 1750,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 200,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D1000",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "D800",
"depth": 340
}
],
"neck": {
"h": 500,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 57.12
},
{
"name": "G1200-1",
"count": 1,
"L": 1950,
"B": 1450,
"H": 1850,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 200,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D1200",
"depth": 300
},
{
"spec": "600x600",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "D700",
"depth": 300
}
],
"neck": {
"h": 460,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 54.32
},
{
"name": "G1200-2",
"count": 1,
"L": 1500,
"B": 2000,
"H": 1900,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 200,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "D1200",
"depth": 330
},
{
"spec": "600x800",
"depth": 300
}
],
"neck": {
"h": 365,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 55.89
},
{
"name": "G1250-1",
"count": 1,
"L": 1550,
"B": 2100,
"H": 1950,
"bottom": {
"t": 200,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 200,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 200,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "D800",
"depth": 330
},
{
"spec": "600x600",
"depth": 340
},
{
"spec": "D1250",
"depth": 330
}
],
"neck": {
"h": 380,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 55.74
},
{
"name": "G1250-2",
"count": 1,
"L": 1600,
"B": 2200,
"H": 2050,
"bottom": {
"t": 200,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 200,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 200,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "D1250",
"depth": 300
},
{
"spec": "600x800",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 410,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 54.68
},
{
"name": "G1250-3",
"count": 1,
"L": 1700,
"B": 2300,
"H": 2150,
"bottom": {
"t": 200,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 200,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 200,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "D1250",
"depth": 350
},
{
"spec": "600x800",
"depth": 360
},
{
"spec": "800x800",
"depth": 310
}
],
"neck": {
"h": 520,
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"level": 53.36
},
{
"name": "G1250-4",
"count": 1,
"L": 1800,
"B": 2400,
"H": 2250,
"bottom": {
"t": 250,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 250,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 250,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "1000x1000",
"depth": 350
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "D1250",
"depth": 300
}
],
"neck": {
"h": 340,
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"level": 58.67
},
{
"name": "G1250-5",
"count": 1,
"L": 1900,
"B": 2500,
"H": 2350,
"bottom": {
"t": 250,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 250,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 250,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "600x800",
"depth": 300
},
{
"spec": "D1250",
"depth": 350
},
{
"spec": "600x800",
"depth": 350
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 390,
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"level": 54.96
},
{
"name": "G1500-1",
"count": 1,
"L": 2000,
"B": 2600,
"H": 2400,
"bottom": {
"t": 250,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 250,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 250,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "1000x1000",
"depth": 300
},
{
"spec": "D800",
"depth": 300
},
{
"spec": "D1250",
"depth": 390
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 370,
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"level": 58.54
},
{
"name": "G1500-2",
"count": 1,
"L": 2200,
"B": 2700,
"H": 2500,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "1200x1200",
"depth": 350
},
{
"spec": "D1500",
"depth": 380
},
{
"spec": "800x800",
"depth": 350
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 290,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 56.67
},
{
"name": "G1500-3",
"count": 1,
"L": 2300,
"B": 2800,
"H": 2700,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "1500x1500",
"depth": 400
},
{
"spec": "D1250",
"depth": 350
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 345,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 56.84
},
{
"name": "G2000-1",
"count": 1,
"L": 3000,
"B": 2800,
"H": 3000,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "2000x1600",
"depth": 400
},
{
"spec": "1200x1200",
"depth": 380
}
],
"neck": {
"h": 320,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 57.49
},
{
"name": "G2000-2",
"count": 1,
"L": 3200,
"B": 3000,
"H": 3300,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "2000x2000",
"depth": 550
},
{
"spec": "1000x1000",
"depth": 370
},
{
"spec": "D1800",
"depth": 450
},
{
"spec": "1500x1500",
"depth": 390
}
],
"neck": {
"h": 300,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 55.25
},
{
"name": "G2500-1",
"count": 1,
"L": 3200,
"B": 3500,
"H": 3700,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "2000x2500",
"depth": 500
},
{
"spec": "2000x2000",
"depth": 450
},
{
"spec": "D1500",
"depth": 400
},
{
"spec": "2000x1600",
"depth": 460
}
],
"neck": {
"h": 350,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 53.46
}
],
"napRoi": [
{
"name": "G400-1",
"count": 1,
"L": 1000,
"B": 1100,
"H": 1200,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "R400x400",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "D500",
"depth": 300
}
],
"neck": {
"h": 400,
"t": 125,
"out": "D10A150",
"in": "D10A150"
},
"level": 55.24
},
{
"name": "G500-2",
"count": 1,
"L": 1150,
"B": 1350,
"H": 1450,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D400",
"depth": 700
},
{
"spec": "D500",
"depth": 280
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 450,
"t": 125,
"out": "D10A150",
"in": "D10A150"
},
"level": 56.36
},
{
"name": "G600-3",
"count": 1,
"L": 1200,
"B": 1450,
"H": 1500,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D600",
"depth": 270
},
{
"spec": "",
"depth": 0
},
{
"spec": "D400",
"depth": 250
},
{
"spec": "D500",
"depth": 300
}
],
"neck": {
"h": 350,
"t": 125,
"out": "D10A150",
"in": "D10A150"
},
"level": 57.42
},
{
"name": "G800-1",
"count": 1,
"L": 1250,
"B": 1550,
"H": 1550,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D800",
"depth": 300
},
{
"spec": "D600",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "D400",
"depth": 320
}
],
"neck": {
"h": 300,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 54.64
},
{
"name": "G800-2",
"count": 1,
"L": 1300,
"B": 1650,
"H": 1600,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "600x800",
"depth": 250
},
{
"spec": "",
"depth": 0
},
{
"spec": "D800",
"depth": 310
},
{
"spec": "D500",
"depth": 330
}
],
"neck": {
"h": 400,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 56.84
},
{
"name": "G800-3",
"count": 1,
"L": 1350,
"B": 1750,
"H": 1650,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 200,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "D700",
"depth": 320
},
{
"spec": "D800",
"depth": 320
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 450,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 55
},
{
"name": "G1000-1",
"count": 1,
"L": 1400,
"B": 1850,
"H": 1750,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 200,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D1000",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "D800",
"depth": 340
}
],
"neck": {
"h": 500,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 57.12
},
{
"name": "G1200-1",
"count": 1,
"L": 1950,
"B": 1450,
"H": 1850,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 200,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D1200",
"depth": 300
},
{
"spec": "600x600",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "D700",
"depth": 300
}
],
"neck": {
"h": 460,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 54.32
},
{
"name": "G1200-2",
"count": 1,
"L": 1500,
"B": 2000,
"H": 1900,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 200,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "D1200",
"depth": 330
},
{
"spec": "600x800",
"depth": 300
}
],
"neck": {
"h": 365,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 55.89
},
{
"name": "G1250-1",
"count": 1,
"L": 1550,
"B": 2100,
"H": 1950,
"bottom": {
"t": 200,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 200,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 200,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "D800",
"depth": 330
},
{
"spec": "600x600",
"depth": 340
},
{
"spec": "D1250",
"depth": 330
}
],
"neck": {
"h": 380,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 55.74
},
{
"name": "G1250-2",
"count": 1,
"L": 1600,
"B": 2200,
"H": 2050,
"bottom": {
"t": 200,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 200,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 200,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "D1250",
"depth": 300
},
{
"spec": "600x800",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 410,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 54.68
},
{
"name": "G1250-3",
"count": 1,
"L": 1700,
"B": 2300,
"H": 2150,
"bottom": {
"t": 200,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 200,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 200,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "D1250",
"depth": 350
},
{
"spec": "600x800",
"depth": 360
},
{
"spec": "800x800",
"depth": 310
}
],
"neck": {
"h": 520,
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"level": 53.36
},
{
"name": "G1250-4",
"count": 1,
"L": 1800,
"B": 2400,
"H": 2250,
"bottom": {
"t": 250,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 250,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 250,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "1000x1000",
"depth": 350
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 340,
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"level": 58.67
},
{
"name": "G1250-5",
"count": 1,
"L": 1900,
"B": 2500,
"H": 2350,
"bottom": {
"t": 250,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 250,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 250,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "600x800",
"depth": 300
},
{
"spec": "D1250",
"depth": 350
},
{
"spec": "600x800",
"depth": 350
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 390,
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"level": 54.96
},
{
"name": "G1500-1",
"count": 1,
"L": 2000,
"B": 2600,
"H": 2400,
"bottom": {
"t": 250,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 250,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 250,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "1000x1000",
"depth": 300
},
{
"spec": "D800",
"depth": 300
},
{
"spec": "D1250",
"depth": 390
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 370,
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"level": 58.54
},
{
"name": "G1500-2",
"count": 1,
"L": 2200,
"B": 2700,
"H": 2500,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "1200x1200",
"depth": 350
},
{
"spec": "D1500",
"depth": 380
},
{
"spec": "800x800",
"depth": 350
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 290,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 56.67
},
{
"name": "G1500-3",
"count": 1,
"L": 2300,
"B": 2800,
"H": 2700,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "1500x1500",
"depth": 400
},
{
"spec": "D1250",
"depth": 350
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 345,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 56.84
},
{
"name": "G2000-1",
"count": 1,
"L": 3000,
"B": 2800,
"H": 3000,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "2000x1600",
"depth": 400
},
{
"spec": "1200x1200",
"depth": 380
}
],
"neck": {
"h": 320,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 57.49
},
{
"name": "G2000-2",
"count": 1,
"L": 3200,
"B": 3000,
"H": 3300,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "2000x2000",
"depth": 550
},
{
"spec": "1000x1000",
"depth": 370
},
{
"spec": "D1500",
"depth": 450
},
{
"spec": "1500x1500",
"depth": 390
}
],
"neck": {
"h": 300,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 55.25
},
{
"name": "G2500-1",
"count": 1,
"L": 3200,
"B": 3500,
"H": 3700,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "2000x2500",
"depth": 500
},
{
"spec": "2000x2000",
"depth": 450
},
{
"spec": "D1500",
"depth": 400
},
{
"spec": "2000x1600",
"depth": 460
}
],
"neck": {
"h": 350,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 53.46
}
],
"thamThuNapRoi": [
{
"name": "G400-1",
"count": 1,
"L": 1000,
"B": 1100,
"H": 1200,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "R400x600",
"depth": 0
},
{
"spec": "D400",
"depth": 300
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 500,
"t": 125,
"out": "D10A150",
"in": "D10A150"
},
"level": 55.24
},
{
"name": "G500-2",
"count": 1,
"L": 1150,
"B": 1350,
"H": 1450,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D400",
"depth": 350
},
{
"spec": "D500",
"depth": 280
},
{
"spec": "",
"depth": 0
},
{
"spec": "D200",
"depth": 320
}
],
"neck": {
"h": 500,
"t": 125,
"out": "D10A150",
"in": "D10A150"
},
"level": 56.36
},
{
"name": "G600-3",
"count": 1,
"L": 1200,
"B": 1450,
"H": 1500,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D600",
"depth": 270
},
{
"spec": "",
"depth": 0
},
{
"spec": "D400",
"depth": 250
},
{
"spec": "D500",
"depth": 300
}
],
"neck": {
"h": 500,
"t": 125,
"out": "D10A150",
"in": "D10A150"
},
"level": 57.42
},
{
"name": "G800-1",
"count": 1,
"L": 1250,
"B": 1550,
"H": 1550,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D800",
"depth": 300
},
{
"spec": "D600",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 500,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 54.64
},
{
"name": "G800-2",
"count": 1,
"L": 1300,
"B": 1650,
"H": 1600,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "600x800",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "D800",
"depth": 310
},
{
"spec": "D500",
"depth": 330
}
],
"neck": {
"h": 500,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 56.84
},
{
"name": "G800-3",
"count": 1,
"L": 1350,
"B": 1750,
"H": 1650,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 200,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "D700",
"depth": 320
},
{
"spec": "D800",
"depth": 300
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 500,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 55
},
{
"name": "G1000-1",
"count": 1,
"L": 1400,
"B": 1850,
"H": 1750,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 200,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D1000",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "D800",
"depth": 340
}
],
"neck": {
"h": 500,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 57.12
},
{
"name": "G1200-1",
"count": 1,
"L": 1950,
"B": 1450,
"H": 1850,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 200,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D1200",
"depth": 300
},
{
"spec": "600x600",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "D700",
"depth": 300
}
],
"neck": {
"h": 550,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 54.32
},
{
"name": "G1200-2",
"count": 1,
"L": 1500,
"B": 2000,
"H": 1900,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 200,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "D1200",
"depth": 330
},
{
"spec": "600x800",
"depth": 300
}
],
"neck": {
"h": 550,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 55.89
},
{
"name": "G1250-1",
"count": 1,
"L": 1550,
"B": 2100,
"H": 1950,
"bottom": {
"t": 200,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 200,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 200,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "D800",
"depth": 350
},
{
"spec": "600x600",
"depth": 340
},
{
"spec": "D1250",
"depth": 330
}
],
"neck": {
"h": 550,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 55.74
},
{
"name": "G1250-2",
"count": 1,
"L": 1600,
"B": 2200,
"H": 2050,
"bottom": {
"t": 200,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 200,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 200,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "D1250",
"depth": 300
},
{
"spec": "600x800",
"depth": 400
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 550,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 54.68
},
{
"name": "G1250-3",
"count": 1,
"L": 1700,
"B": 2300,
"H": 2150,
"bottom": {
"t": 200,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 200,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 200,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "D1250",
"depth": 350
},
{
"spec": "600x800",
"depth": 360
},
{
"spec": "800x800",
"depth": 310
}
],
"neck": {
"h": 550,
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"level": 53.36
},
{
"name": "G1250-4",
"count": 1,
"L": 1800,
"B": 2400,
"H": 2250,
"bottom": {
"t": 250,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 250,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 250,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "1000x1000",
"depth": 350
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 550,
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"level": 58.67
},
{
"name": "G1250-5",
"count": 1,
"L": 1900,
"B": 2500,
"H": 2350,
"bottom": {
"t": 250,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 250,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 250,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "600x800",
"depth": 300
},
{
"spec": "D1250",
"depth": 350
},
{
"spec": "600x800",
"depth": 350
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 550,
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"level": 54.96
},
{
"name": "G1500-1",
"count": 1,
"L": 2000,
"B": 2600,
"H": 2400,
"bottom": {
"t": 250,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 250,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 250,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "1000x1000",
"depth": 300
},
{
"spec": "D800",
"depth": 300
},
{
"spec": "D1500",
"depth": 390
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 550,
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"level": 58.54
},
{
"name": "G1500-2",
"count": 1,
"L": 2200,
"B": 2700,
"H": 2500,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "1200x1200",
"depth": 350
},
{
"spec": "D1500",
"depth": 380
},
{
"spec": "800x800",
"depth": 350
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 550,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 56.67
},
{
"name": "G1500-3",
"count": 1,
"L": 2300,
"B": 2800,
"H": 2700,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "1500x1500",
"depth": 400
},
{
"spec": "D1250",
"depth": 350
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 550,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 56.84
},
{
"name": "G2000-1",
"count": 1,
"L": 3000,
"B": 2800,
"H": 3000,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "2000x1600",
"depth": 400
},
{
"spec": "1200x1200",
"depth": 380
}
],
"neck": {
"h": 550,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 57.49
},
{
"name": "G2000-2",
"count": 1,
"L": 3200,
"B": 3000,
"H": 3300,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "2000x2000",
"depth": 550
},
{
"spec": "1000x1000",
"depth": 370
},
{
"spec": "D1800",
"depth": 450
},
{
"spec": "1500x1500",
"depth": 390
}
],
"neck": {
"h": 550,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 55.25
},
{
"name": "G2500-1",
"count": 1,
"L": 3200,
"B": 3500,
"H": 3700,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "2000x2500",
"depth": 500
},
{
"spec": "2000x2000",
"depth": 450
},
{
"spec": "D1500",
"depth": 400
},
{
"spec": "2000x1600",
"depth": 460
}
],
"neck": {
"h": 550,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 53.46
}
],
"thamThuLienKhoi": [
{
"name": "G400-1",
"count": 1,
"L": 1000,
"B": 1100,
"H": 1200,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D400",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "D500",
"depth": 300
},
{
"spec": "R300x400",
"depth": 0
}
],
"neck": {
"h": 500,
"t": 125,
"out": "D10A150",
"in": "D10A150"
},
"level": 55.24
},
{
"name": "G500-2",
"count": 1,
"L": 1150,
"B": 1350,
"H": 1450,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D400",
"depth": 350
},
{
"spec": "D500",
"depth": 280
},
{
"spec": "",
"depth": 0
},
{
"spec": "D200",
"depth": 320
}
],
"neck": {
"h": 500,
"t": 125,
"out": "D10A150",
"in": "D10A150"
},
"level": 56.36
},
{
"name": "G600-3",
"count": 1,
"L": 1200,
"B": 1450,
"H": 1500,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D600",
"depth": 270
},
{
"spec": "",
"depth": 0
},
{
"spec": "D400",
"depth": 250
},
{
"spec": "D500",
"depth": 300
}
],
"neck": {
"h": 500,
"t": 125,
"out": "D10A150",
"in": "D10A150"
},
"level": 57.42
},
{
"name": "G800-1",
"count": 1,
"L": 1250,
"B": 1550,
"H": 1550,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D800",
"depth": 300
},
{
"spec": "D600",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 500,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 54.64
},
{
"name": "G800-2",
"count": 1,
"L": 1300,
"B": 1650,
"H": 1600,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 150,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "600x800",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "D800",
"depth": 310
},
{
"spec": "D500",
"depth": 330
}
],
"neck": {
"h": 500,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 56.84
},
{
"name": "G800-3",
"count": 1,
"L": 1350,
"B": 1750,
"H": 1650,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 200,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "D700",
"depth": 320
},
{
"spec": "D800",
"depth": 300
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 500,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 55
},
{
"name": "G1000-1",
"count": 1,
"L": 1400,
"B": 1850,
"H": 1750,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 200,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D1000",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "D800",
"depth": 340
}
],
"neck": {
"h": 500,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 57.12
},
{
"name": "G1200-1",
"count": 1,
"L": 1950,
"B": 1450,
"H": 1850,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 200,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D1200",
"depth": 300
},
{
"spec": "600x600",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "D700",
"depth": 300
}
],
"neck": {
"h": 550,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 54.32
},
{
"name": "G1200-2",
"count": 1,
"L": 1500,
"B": 2000,
"H": 1900,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 200,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "D1200",
"depth": 330
},
{
"spec": "600x800",
"depth": 300
}
],
"neck": {
"h": 550,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 55.89
},
{
"name": "G1250-1",
"count": 1,
"L": 1550,
"B": 2100,
"H": 1950,
"bottom": {
"t": 200,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 200,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 200,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "D800",
"depth": 350
},
{
"spec": "600x600",
"depth": 340
},
{
"spec": "D1250",
"depth": 330
}
],
"neck": {
"h": 550,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 55.74
},
{
"name": "G1250-2",
"count": 1,
"L": 1600,
"B": 2200,
"H": 2050,
"bottom": {
"t": 200,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 200,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 200,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "D1250",
"depth": 300
},
{
"spec": "600x800",
"depth": 400
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 550,
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"level": 54.68
},
{
"name": "G1250-3",
"count": 1,
"L": 1700,
"B": 2300,
"H": 2150,
"bottom": {
"t": 200,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 200,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 200,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "D1250",
"depth": 350
},
{
"spec": "600x800",
"depth": 360
},
{
"spec": "800x800",
"depth": 310
}
],
"neck": {
"h": 550,
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"level": 53.36
},
{
"name": "G1250-4",
"count": 1,
"L": 1800,
"B": 2400,
"H": 2250,
"bottom": {
"t": 250,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 250,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 250,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "1000x1000",
"depth": 350
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 550,
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"level": 58.67
},
{
"name": "G1250-5",
"count": 1,
"L": 1900,
"B": 2500,
"H": 2350,
"bottom": {
"t": 250,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 250,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 250,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "600x800",
"depth": 300
},
{
"spec": "D1250",
"depth": 350
},
{
"spec": "600x800",
"depth": 350
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 550,
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"level": 54.96
},
{
"name": "G1500-1",
"count": 1,
"L": 2000,
"B": 2600,
"H": 2400,
"bottom": {
"t": 250,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 250,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 250,
"up": "D12A150",
"low": "D12A150"
},
"pipes": [
{
"spec": "1000x1000",
"depth": 300
},
{
"spec": "D800",
"depth": 300
},
{
"spec": "D1500",
"depth": 390
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 550,
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"level": 58.54
},
{
"name": "G1500-2",
"count": 1,
"L": 2200,
"B": 2700,
"H": 2500,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "1200x1200",
"depth": 350
},
{
"spec": "D1500",
"depth": 380
},
{
"spec": "800x800",
"depth": 350
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 550,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 56.67
},
{
"name": "G1500-3",
"count": 1,
"L": 2300,
"B": 2800,
"H": 2700,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "1500x1500",
"depth": 400
},
{
"spec": "D1250",
"depth": 350
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 550,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 56.84
},
{
"name": "G2000-1",
"count": 1,
"L": 3000,
"B": 2800,
"H": 3000,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "2000x1600",
"depth": 400
},
{
"spec": "1200x1200",
"depth": 380
}
],
"neck": {
"h": 550,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 57.49
},
{
"name": "G2000-2",
"count": 1,
"L": 3200,
"B": 3000,
"H": 3300,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "2000x2000",
"depth": 550
},
{
"spec": "1000x1000",
"depth": 370
},
{
"spec": "D1800",
"depth": 450
},
{
"spec": "1500x1500",
"depth": 390
}
],
"neck": {
"h": 550,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 55.25
},
{
"name": "G2500-1",
"count": 1,
"L": 3200,
"B": 3500,
"H": 3700,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 250,
"up": "D14A150",
"low": "D14A150"
},
"pipes": [
{
"spec": "2000x2500",
"depth": 500
},
{
"spec": "2000x2000",
"depth": 450
},
{
"spec": "D1500",
"depth": 400
},
{
"spec": "2000x1600",
"depth": 460
}
],
"neck": {
"h": 550,
"t": 250,
"out": "D10A150",
"in": "D10A150"
},
"level": 53.46
}
],
"khongCo": [
{
"name": "G400-1",
"count": 1,
"L": 820,
"B": 390,
"H": 1000,
"bottom": {
"t": 120,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 120,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 50,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D400",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 55.24
},
{
"name": "G500-2",
"count": 1,
"L": 820,
"B": 390,
"H": 1000,
"bottom": {
"t": 120,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 120,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 50,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "R400x600",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "R400x600",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 56.36
},
{
"name": "G600-3",
"count": 1,
"L": 1200,
"B": 1450,
"H": 1500,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D600",
"depth": 270
},
{
"spec": "",
"depth": 0
},
{
"spec": "D400",
"depth": 250
},
{
"spec": "D500",
"depth": 300
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 57.42
},
{
"name": "G800-1",
"count": 1,
"L": 1250,
"B": 1550,
"H": 1550,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D800",
"depth": 500
},
{
"spec": "D600",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "D400",
"depth": 320
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 54.64
},
{
"name": "G800-2",
"count": 1,
"L": 1300,
"B": 1650,
"H": 1600,
"bottom": {
"t": 150,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 150,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "600x800",
"depth": 450
},
{
"spec": "",
"depth": 0
},
{
"spec": "D800",
"depth": 310
},
{
"spec": "D500",
"depth": 330
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 56.84
},
{
"name": "G800-3",
"count": 1,
"L": 1350,
"B": 1750,
"H": 1650,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "D700",
"depth": 320
},
{
"spec": "D800",
"depth": 320
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 55
},
{
"name": "G1000-1",
"count": 1,
"L": 1400,
"B": 1850,
"H": 1750,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D1000",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "D800",
"depth": 340
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 57.12
},
{
"name": "G1200-1",
"count": 1,
"L": 1950,
"B": 1450,
"H": 1850,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D1200",
"depth": 300
},
{
"spec": "600x600",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "D700",
"depth": 300
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 54.32
},
{
"name": "G1200-2",
"count": 1,
"L": 1500,
"B": 2000,
"H": 1900,
"bottom": {
"t": 200,
"low": "D10A150",
"up": "D10A150"
},
"wall": {
"t": 200,
"out": "D10A150",
"in": "D10A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "D1200",
"depth": 330
},
{
"spec": "600x800",
"depth": 300
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 55.89
},
{
"name": "G1250-1",
"count": 1,
"L": 1550,
"B": 2100,
"H": 1950,
"bottom": {
"t": 200,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 200,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "D800",
"depth": 330
},
{
"spec": "600x600",
"depth": 340
},
{
"spec": "D1250",
"depth": 330
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 55.74
},
{
"name": "G1250-2",
"count": 1,
"L": 1600,
"B": 2200,
"H": 2050,
"bottom": {
"t": 200,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 200,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "D1250",
"depth": 300
},
{
"spec": "600x800",
"depth": 300
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 54.68
},
{
"name": "G1250-3",
"count": 1,
"L": 1700,
"B": 2300,
"H": 2150,
"bottom": {
"t": 200,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 200,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "D1250",
"depth": 350
},
{
"spec": "600x800",
"depth": 360
},
{
"spec": "800x800",
"depth": 310
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 53.36
},
{
"name": "G1250-4",
"count": 1,
"L": 1800,
"B": 2400,
"H": 2250,
"bottom": {
"t": 250,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 250,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "1000x1000",
"depth": 350
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 58.67
},
{
"name": "G1250-5",
"count": 1,
"L": 1900,
"B": 2500,
"H": 2350,
"bottom": {
"t": 250,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 250,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "600x800",
"depth": 300
},
{
"spec": "D1250",
"depth": 350
},
{
"spec": "600x800",
"depth": 350
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 54.96
},
{
"name": "G1500-1",
"count": 1,
"L": 2000,
"B": 2600,
"H": 2400,
"bottom": {
"t": 250,
"low": "D12A150",
"up": "D12A150"
},
"wall": {
"t": 250,
"out": "D12A150",
"in": "D12A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "1000x1000",
"depth": 300
},
{
"spec": "D800",
"depth": 300
},
{
"spec": "D1250",
"depth": 390
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 58.54
},
{
"name": "G1500-2",
"count": 1,
"L": 2200,
"B": 2700,
"H": 2500,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "1200x1200",
"depth": 350
},
{
"spec": "D1500",
"depth": 380
},
{
"spec": "800x800",
"depth": 350
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 56.67
},
{
"name": "G1500-3",
"count": 1,
"L": 2300,
"B": 2800,
"H": 2700,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "1500x1500",
"depth": 400
},
{
"spec": "D1250",
"depth": 350
},
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 56.84
},
{
"name": "G2000-1",
"count": 1,
"L": 3000,
"B": 2800,
"H": 3000,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "",
"depth": 0
},
{
"spec": "",
"depth": 0
},
{
"spec": "2000x1600",
"depth": 400
},
{
"spec": "1200x1200",
"depth": 380
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 57.49
},
{
"name": "G2000-2",
"count": 1,
"L": 3200,
"B": 3000,
"H": 3300,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "2000x2000",
"depth": 550
},
{
"spec": "1000x1000",
"depth": 370
},
{
"spec": "D1500",
"depth": 450
},
{
"spec": "1500x1500",
"depth": 390
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 55.25
},
{
"name": "G2500-1",
"count": 1,
"L": 3200,
"B": 3500,
"H": 3700,
"bottom": {
"t": 300,
"low": "D14A150",
"up": "D14A150"
},
"wall": {
"t": 300,
"out": "D14A150",
"in": "D14A150"
},
"roof": {
"t": 120,
"up": "D10A150",
"low": "D10A150"
},
"pipes": [
{
"spec": "2000x2500",
"depth": 500
},
{
"spec": "2000x2000",
"depth": 450
},
{
"spec": "D1500",
"depth": 400
},
{
"spec": "2000x1600",
"depth": 460
}
],
"neck": {
"h": 0,
"t": 0,
"out": "",
"in": ""
},
"level": 53.46
}
]
} as unknown as Record<GaKind, GaRow[]>;
