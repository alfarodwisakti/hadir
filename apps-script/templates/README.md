# Template sheet untuk Google Sheets

Buat 3 sheet dengan nama persis berikut:

1. Admin
2. Siswa
3. Presensi

Import file CSV yang tersedia di folder ini ke masing-masing sheet.

## Admin.csv
username,password,nama,role
admin,admin123,Admin Utama,Admin

## Siswa.csv
nomorQr,barcode,nama,kelas
2408001,2408001,AFIFAH SYAHIRA FITRI,8.G
...

## Presensi.csv
tanggal,jam,nomorQr,nama,kelas,status,metode,keterangan
2026-09-18,06:45:12,2408001,AFIFAH SYAHIRA FITRI,8.G,Hadir,Scan,
...

Setelah sheet dibuat, ganti nilai `SPREADSHEET_ID` di [apps-script/PresensiDigital.gs](../PresensiDigital.gs) dengan ID spreadsheet Anda lalu deploy ulang Web App.
