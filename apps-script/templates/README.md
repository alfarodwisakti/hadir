# Template sheet untuk Google Sheets

Buat 3 sheet dengan nama persis berikut:

1. Admin
2. Pengunjung
3. Presensi

Catatan: jika Anda masih punya sheet lama bernama Siswa, aplikasi tetap kompatibel, tetapi sheet utama yang dipakai sekarang adalah Pengunjung.

## Admin.csv
username,password,nama,role
admin,admin123,Admin Utama,Admin

## Pengunjung.csv
nomorQr,barcode,nama,kelas
2408001,2408001,AFIFAH SYAHIRA FITRI,8.G
2408002,2408002,AFIQAH KHAIRUNNISA RIZALOV,8.G
2408003,2408003,ALFARIS ADRIAN AKBAR,8.G

## Presensi.csv
tanggal,jam,nomorQr,nama,kelas,status,metode,keterangan
2026-09-18,06:45:12,2408001,AFIFAH SYAHIRA FITRI,8.G,Hadir,Scan,
2026-09-18,06:50:35,2408002,AFIQAH KHAIRUNNISA RIZALOV,8.G,Terlambat,Scan,Terlambat masuk

Setelah sheet dibuat, ganti nilai `SPREADSHEET_ID` di [apps-script/PresensiDigital.gs](../PresensiDigital.gs) dengan ID spreadsheet Anda lalu deploy ulang Web App.
