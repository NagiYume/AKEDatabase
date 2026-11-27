AKEData telah pindah ke domain www.akedata.wiki. Domain lama, akedata.top, kini dialihkan ke sini.

# Catatan Pembaruan Versi AKEData

### v1.3.9

Menambahkan draf [AKEGF](https://www.akedata.wiki/?plugin=akegf&id=home) v0.3, contoh beberapa karakter, dan [Pemeriksa format AKEGF](/?plugin=akegf&id=validator). Artikel riset, AKEGF, dan pengumuman memakai perender Markdown dan penyorotan sintaks yang sama.

### v1.2.11

#### Navigasi tingkat kedua dan antarmuka bersama

- Navigasi tingkat kedua pada modul pencarian utama dibangun ulang dengan struktur item, status aktif, jumlah, penanda perubahan versi, pencarian, filter, serta interaksi desktop dan seluler yang konsisten.
- Lapisan antarmuka bersama diperkenalkan untuk tombol, kolom input, pemilih, sakelar, filter, kartu, tampilan status, dan tabel, sehingga mengurangi perbedaan tampilan dan penggunaan antar modul.

#### Pengaturan dan tampilan

- Dialog pengaturan global dan pengumuman situs didesain ulang dengan pengelompokan yang lebih jelas serta tampilan yang konsisten pada tema terang, gelap, dan nyaman untuk mata.
- Status memuat, konten kosong, dan kesalahan diseragamkan. Judul dan isi tabel bersama kini rata tengah secara bawaan.

### v1.2.10-1

#### Perbandingan versi Arsip

- Saat menggunakan data Latest, Arsip dibandingkan dengan Hotfix terakhir dari versi gim sebelumnya. Arsip yang ditambahkan pada versi ini disematkan di bagian teratas dan ditandai secara global pada ikhtisar halaman awal, serta disematkan dan ditandai di dalam kategori direktorinya; entri baru dalam setiap grup juga ditampilkan lebih dahulu. Versi historis tetap tidak menampilkan penanda baru.

### v1.2.10

#### Arsip

- Menambahkan modul Arsip publik baru. Halaman awal merangkum seluruh arsip serta mendukung direktori berdasarkan media dan kategori, pencarian teks lengkap, dan tautan langsung ke grup arsip.
- Halaman detail menampilkan judul dan isi teks berformat, gambar arsip asli dari dalam gim, serta memungkinkan pergantian gambar yang berbeda menurut gender karakter utama.
- Arsip audiovisual hanya menyediakan transkripsi teks per baris dan tidak memutar audio.

#### Pengalaman dan stabilitas

- Mendukung direktori desktop dan seluler, pemulihan status penelusuran, serta ekspor sebagai gambar panjang.
- Menyempurnakan tampilan penanda penyamaran pada teks berformat dan penanganan gambar yang tidak tersedia.

### v1.2.9

#### Serba-serbi dan pusat tugas

- Menambahkan modul Serba-serbi yang dapat diperluas dengan alat yang bekerja mandiri. Isi awalnya mencakup tugas mingguan, Protocol Pass, serta tugas aktivitas Latihan, Kontrak, Racing Dungeon, dan Turnamen.
- Tugas Protocol Pass dapat difilter menurut minggu dan kini menampilkan semua level pada ketiga jalur hadiah.

#### Ikon dan informasi perolehan

- Menambahkan generator ikon karakter untuk memilih karakter dan skill, melihat pratinjau komposit, lalu mengunduhnya sebagai PNG.
- Toko kini menampilkan syarat pembukaan dan level Material Dispatch; detail perlengkapan mencantumkan sumber seperti toko, misi, dan peti templat di peta. Tautan peta OEM dihitung secara dinamis dari LevelData hanya setelah diklik.

#### Pengalaman dan stabilitas

- Menyeragamkan gambar pengganti ketika pemuatan gagal, serta memperbaiki pengguliran mandiri Serba-serbi, kontrol seluler, dan beberapa tata letak hadiah tugas.
- Modul data pertempuran baru `v3_skill` dan modul data Buff `v3_buff` masih dalam tahap validasi dan belum tersedia pada versi ini.

### v1.2.8

#### Bilah samping dan tata letak

- Bilah samping utama dan bilah samping setiap modul kini dapat diubah lebarnya dengan menyeret, dan lebar yang disesuaikan disimpan secara terpisah. Saat bilah menyempit, entri yang memiliki ikon hanya menampilkan ikon, sedangkan entri tanpa ikon tetap menampilkan nama agar mudah dikenali.
- Tombol Pengaturan global dan ekspor gambar panjang di kiri bawah kini menempati area bawah khusus dan tidak lagi menutupi daftar modul.

#### Status penelusuran

- Dalam sesi kunjungan yang sama, kembali ke suatu modul akan memulihkan halaman, entri, dan posisi gulir yang sebelumnya dibuka.
- Posisi gulir detail disimpan secara terpisah untuk setiap entri dalam modul yang sama. Memuat ulang halaman akan menghapus status sementara ini dan kembali menampilkan halaman awal.

### v1.2.7

#### Dungeon dan aktivitas

- Detail dungeon kini menampilkan hadiah tetap dan acak yang dapat diperoleh berulang dengan memakai Sanity, terpisah dari hadiah penyelesaian pertama.
- Blok pada lini masa aktivitas kini ditempatkan berdasarkan waktu mulai dan selesai yang tepat, bukan disejajarkan per hari penuh.

#### Ikhtisar dan gambar

- Kartu karakter dan bilah samping kini menampilkan ikon elemen dan profesi, dengan warna elemen yang dikalibrasi ulang serta ikon yang dipilih berdasarkan ID profesi.
- Bintang kelangkaan di ikhtisar Karakter dan Senjata serta tingkat bahaya di ikhtisar Musuh telah dihapus. Filter, pengurutan, dan data detail tidak berubah.
- Ikon inline rich text, tautan istilah, dan tooltip kini diselesaikan melalui domain data aktif, memperbaiki host `data.akedata.wiki` yang hilang dan jalur `//public/...` yang salah.

### v1.2.6

#### Komunikasi Baker

- Menambahkan modul Baker untuk melihat percakapan lengkap Operator, kontak, dan grup, dengan filter tipe, pencarian teks lengkap, serta deep link URL.
- Beberapa percakapan dengan kontak yang sama kini ditampilkan sebagai entri terpisah di bilah samping, dan pilihan dialog dapat mengubah cabang lanjutan.
- Mendukung teks, gambar, lampiran item dan misi, pesan sistem, reaksi, serta gambar pilihan `sns_emoji`, disertai perbaikan avatar, pengguliran, dan tata letak desktop/mobile.

### v1.2.5

#### Gambar dan unggahan aset

- Gambar kini mempertahankan struktur asli di bawah `assets/beyond/dynamicassets/gameplay`, dan semua modul menggunakan jalur baru.
- Aset yang hilang akibat pencocokan direktori dan pemetaan internal beyond-sdk yang tidak lengkap telah diperbaiki, termasuk pemisahan tepat antara `charremoteicon` dan `charremoteicon700`.
- AKE Data Tool kini dapat mengunggah gambar, data Json, atau keduanya serta memeriksa ukuran saat ini dan puncak perkiraan seluruh bucket R2; unggahan diblokir pada 10 GB.
- `pluginversion` dan `jsversion` memperbarui HTML modul dan JavaScript secara terpisah sehingga aset yang tidak berubah tetap memakai cache lokal.
- Modul Baker tidak disertakan dalam versi ini dan ditunda ke `1.2.6`.

### v1.2.3

#### Modul dan visibilitas

- Modul Misi disembunyikan sementara dan ditandai “Dalam pengembangan”. Modul debug BuffData, SkillData, dan SpawnerConfig dinonaktifkan, serta deskripsi Echoes of War diperbarui.
- Saat “Tampilkan modul tersembunyi” dimatikan, ID internal karakter, perlengkapan, aktivitas, Buff, dan data lain tidak ditampilkan. Nilai mentah dan rumus perhitungan kini selalu tersedia.
- Pengubah atribut dikelompokkan berdasarkan sumber seperti kemunculan, Buff, atau stage. Buff atribut di modul Musuh ikut dihitung; saat mode tersembunyi mati, ID Buff dan Buff tanpa efek atribut tidak ditampilkan.

#### Musuh dan mode permainan

- Dungeon, Contingency Contract, dan Echoes of War memakai satu renderer musuh untuk atribut level, Buff saat muncul, dan hasil modifikasi. Resistansi elemen baru (94–99) digunakan, sedangkan koefisien lama (80–85) tidak lagi ditampilkan.
- Rotasi Echoes of War dapat dibuka atau ditutup, dengan warna bingkai untuk status aktif, akan datang, dan selesai. Hanya rotasi aktif yang terbuka secara default, dan hanya konfigurasi musuh pada tingkat kesulitan tertinggi yang dibuka di setiap rotasi.
- Jika deskripsi sifat dan bonus sifat sama pada ketiga tingkat kesulitan, deskripsi ditampilkan sekali sebelum daftar. Perbedaan tetap ditampilkan pada tingkat kesulitan masing-masing.
- Memperbaiki rendering `v2cc-term-param` di Contingency Contract. Konfigurasi aktivitas diciutkan secara default dan syarat pembukaan misi disembunyikan.

#### Aktivitas dan antarmuka

- Halaman awal Aktivitas kini memiliki lini masa kalender dengan tanggal mulai, selesai, dan status. Tersedia tooltip tanggal, judul di luar layar tetap terlihat di tepi kiri, serta ikon setinggi baris di sisi kanan. Kembali melalui tombol Beranda kini merender ulang lini masa dengan benar.
- Memperbaiki baris baru yang di-escape dalam deskripsi skill karakter dan senjata. Ikon komponen bawaan tampil di samping tombol biaya pembuatan perlengkapan.
- Ekspor gambar panjang tidak lagi eksperimental dan aktif secara default. Sidebar dikecualikan dan nama file sesuai dengan modul atau halaman saat ini.

#### Pemuatan data dan pengumuman

- Cache persisten TableCfg hanya berubah ketika Hotfix berubah. Json dan gambar menggunakan revisi data bersama yang independen dan tidak dimuat ulang hanya karena versi situs atau Hotfix berubah.
- Pengumuman kini merender judul, daftar, dan kode sebaris Markdown dengan benar. Halaman Tentang dan README juga menambahkan tautan mitra data “终末地一图流”.

### v1.2.2

Nilai mentah dan rumus kini dibuka dalam popover persisten saat angka diklik, menggantikan tooltip tertunda saat kursor diarahkan. Mengklik nilai lain mengganti isi; mengklik area kosong halaman atau menekan Esc menutup popover. Posisi diperbarui saat menggulir atau mengubah ukuran, mendukung perangkat seluler dan papan ketik, serta tidak mengubah gaya visual angka.

Memperbaiki handler klik induk pada beberapa modul yang mencegah klik mouse nyata membuka popover. Nilai skill `chr_0032_lizhiyan` yang tampil sebagai `[object Object]` juga diperbaiki.

### v1.2.1

Memperbaiki masalah yang dapat menyebabkan beberapa gambar game keliru diminta dari `www.akedata.wiki` setelah berpindah modul atau Service Worker dimulai ulang. Jalur gambar kini ditulis ulang secara sinkron ke `data.akedata.wiki` saat dimasukkan ke halaman.

Service Worker kini memulihkan asal data dan revisi data bersama dari URL pendaftarannya. Perutean gambar tetap benar meskipun browser menghentikan lalu memulai ulang Worker. Ikon situs juga dimuat langsung dari asal data.

Menambahkan penguraian data musuh `LevelScriptData` ke perhitungan atribut Dungeon, Contingency Contract, dan Echoes of War. Musuh, level, dan Buff saat muncul yang ditentukan langsung dalam skrip, serta Buff bersyarat dari spawner, kini ikut dihitung. Stage tanpa SpawnerConfig juga dapat dihitung dengan benar. Pemuatan awal Buff kondisi Contingency Contract dan perhitungan ulang setelah kondisi berubah juga telah diperbaiki.

Meningkatkan tooltip nilai mentah. Nilai tanpa perubahan perhitungan tetap menampilkan nilai asli; nilai yang diubah oleh atribut, Buff, kondisi kontrak, atau ekspresi kini menampilkan nilai asli, parameter substitusi, rumus lengkap, dan hasil akhir. Pelacakan rumus mencakup Dungeon, Contingency Contract, Echoes of War, musuh, serta ekspresi karakter, senjata, perlengkapan, dan item.

### v1.2.0

Menambahkan perbandingan data antarversi game. Saat `Latest` dipilih, situs otomatis membandingkannya dengan Hotfix terakhir dari versi game sebelumnya. Entri baru selalu ditempatkan di depan dan diberi tag; tag perubahan serta Diff detail dapat diaktifkan melalui opsi eksperimental di pengaturan global yang secara default nonaktif.

Diff detail hanya membandingkan informasi yang benar-benar ditampilkan di halaman, menandai penghapusan dengan merah dan penambahan dengan hijau, serta mengabaikan field tersembunyi. Aktivitas tidak termasuk dalam deteksi entri baru. Perlengkapan dan medali dibandingkan berdasarkan ID individual, dan set atau kategorinya juga diberi tag. Bingkai kartu tetap mengikuti warna rarity.

### v1.2.0-pre2

Pemetaan Attribute lengkap telah diperbarui dengan ID 93–100 dan disinkronkan ke `maps.json` untuk seluruh 14 bahasa.

Modul musuh dan dungeon kini menggunakan parameter resistansi elemen baru (ID 94–99). ID koefisien resistansi lama 80–85 tidak lagi ditampilkan pada kartu atribut, ringkasan modifier, maupun tooltip Buff terkait.

### v1.1.9

Menambahkan modul khusus tantangan permanen “Gema Perang”, dengan tampilan per musim dan rotasi untuk stage, tingkat kesulitan, gelar peringkat, hadiah merit, dan petunjuk resmi. Modul ini juga menampilkan gelombang musuh, peta posisi spawn, Buff saat spawn, serta atribut yang disesuaikan dengan level, lengkap dengan pergantian gelombang dan sorotan peta yang saling terhubung.

### v1.1.8

Menambahkan mode debug dan penyegaran paksa cache web; memperbaiki node atribut karakter dan parsing biaya pengembangan berdasarkan deskripsi item; mengalihkan tipe aktivitas ke ActivityTagTable; membaca style dan istilah rich text langsung dari TableCfg; serta menambahkan tombol beranda di sidebar untuk modul yang memiliki halaman awal.

### v1.1.6

Menambahkan pengumuman dalam situs dan hitung mundur pembaruan, mengadaptasi kelompok skill dua wujud Jue, mengoptimalkan petunjuk pemuatan, serta menghapus banyak modul v2 yang telah dihentikan.

### v1.1.5

Meluncurkan kerangka multibahasa yang mendukung pergantian bahasa untuk antarmuka, modul, opsi filter, dan pemetaan data, sekaligus menambahkan kumpulan awal sumber daya multibahasa.

### v1.1.4

Memperbaiki parameter versi permintaan data, memisahkan versi penyegaran sumber daya aplikasi dan data publik, serta menyatukan penentuan versi cache halaman dan Service Worker.

### v1.1.3

Menambahkan efek penggunaan consumable dan resep crafting pada modul item, melengkapi relasi material dan hasil, gaya detail, serta adaptasi data v3 terkait.

### v1.1.2

Menambahkan pintu masuk ringkasan berbentuk kartu berkelompok untuk modul karakter, senjata, musuh, perlengkapan, aktivitas, item, dungeon, medali, penelitian, dan modul lainnya.

### v1.1.1

Mendesain ulang filter kategori item dengan dukungan pelipatan dan jumlah hasil filter, sekaligus meningkatkan deduplikasi permintaan, cache IndexedDB, dan tampilan progres pemuatan data.

### v1.1.0

Meluncurkan lapisan adaptasi data v3 berbasis TableCfg dan Json untuk modul kueri utama, serta menambahkan mekanisme penonaktifan modul dan cache berkas data besar.

### v1.0.31

Sempat menambahkan pergantian antarmuka Mandarin-Inggris, direktori data, dan konfigurasi internasionalisasi terkait, tetapi fitur tersebut kemudian di-rollback sepenuhnya dan tidak dilanjutkan pada tahap ini.

### v1.0.30

Menambahkan pembungkus cache permintaan terpadu dan mengalihkan setiap halaman ke akeFetch untuk memuat data, sehingga mengurangi permintaan berulang dan mengoptimalkan pemuatan saat berpindah modul.

### v1.0.29

Memisahkan script tertanam dari halaman utama dan setiap modul ke direktori plugin/js, serta memusatkan pengelolaan routing, pengaturan, perhitungan atribut, dan controller modul.

### v1.0.28

Menambahkan petunjuk nilai mentah untuk parameter di sebagian besar modul, serta memperbaiki perhitungan HP monster dan kesalahan tampilan "pengurangan semua damage".

### v1.0.27

Menambahkan visualisasi wave monster pada Contingency Contract dengan koordinat spawn, pergantian wave, dan sorotan tertaut, serta memperbaiki statistik penggabungan untuk wave berulang.

### v1.0.26

Menambahkan pemeriksaan atribut musuh pada Contingency Contract, dengan perhitungan dan tampilan atribut aktual berdasarkan level, Buff saat spawn, serta tag kontrak yang dipilih.

### v1.0.25

Memuat awal dan membuka modul Contingency Contract yang dibatasi Token, dengan dukungan pencarian season, kondisi dan konflik tag, skor, reward, misi, serta tampilan shop.

### v1.0.24

Memperbarui tampilan skill karakter v2, memperbaiki urutan Combo Skill dan Ultimate Skill, serta mempertahankan parameter penting seperti cooldown dan konsumsi energi.

### v1.0.23

Membuka resmi modul penelitian, meningkatkan Markdown, syntax highlighting, indeks daftar isi, navigasi anchor, dan pratinjau gambar, serta menambahkan artikel penelitian mekanisme.

### v1.0.22

Menambahkan pembatasan akses modul dan konten berbasis Token, dengan dukungan persistensi Token, penambahan massal, penghapusan, serta pemuatan awal konten yang dilindungi.

### v1.0.21

Menambahkan koefisien physical abnormal damage dan arts abnormal damage pada tabel pertumbuhan atribut karakter v2, dengan presisi berbeda sesuai mode tampilan.

### v1.0.20

Menyesuaikan urutan dan beberapa nama atribut detail musuh, memajukan entri interrupt resistance dan execution, serta menyeragamkan istilah pada entri bonus damage.

### v1.0.19

Menambahkan tampilan equipment ID pada modul perlengkapan, merapikan gaya v2 karakter, senjata, dan perlengkapan, serta memperbaiki warna atribut dan pemilihan nilai pertumbuhan.

### v1.0.18

Menambahkan deep link untuk modul dan entri, menyinkronkan address bar saat navigasi dan menangani konten tersembunyi atau tidak ada, sekaligus melengkapi tampilan tipe koreksi atribut karakter.

### v1.0.17

Merilis resmi senjata v2 dengan pencarian senjata serta tampilan data mendetail untuk atribut level, material breakthrough, potential, dan skill.

### v1.0.16

Merilis resmi perlengkapan v2, menampilkan komponen berdasarkan set beserta atribut utama dan subatribut, set skill, resep crafting, jaminan precision forging, serta informasi enhancement.

### v1.0.15

Merilis resmi dungeon v2 dengan detail seri dungeon, reward, dan musuh, serta parsing konfigurasi spawn dan Buff untuk menampilkan wave dan atribut setelah koreksi.

### v1.0.14

Merilis resmi musuh v2 dengan pencarian, daftar mobile, atribut level, varian musuh, koreksi atribut, resistance, dan informasi stagger.

### v1.0.13

Merilis resmi karakter v2, merombak informasi atribut, skill, talent, potential, dan pertumbuhan karakter, serta memperbaiki tampilan trait, gambar, dan node.

### v1.0.12

Meningkatkan timeline SkillData v2 dengan filter action, flowchart cabang kondisi, visibilitas node, dan petunjuk durasi frame, serta memperbaiki sebagian nilai monster.

### v1.0.11

Menambahkan tampilan debug SkillData v2 tersembunyi yang menyajikan logika skill melalui timeline dan action node, serta mendukung pencarian dan pemeriksaan data mentah.

### v1.0.10

Melanjutkan perombakan karakter v2 dengan membangun detail karakter baru dan menghubungkan data karakter lengkap, sekaligus menyempurnakan pemetaan field dan struktur tampilan.

### v1.0.9

Menambahkan modul kueri SpawnerConfig untuk menelusuri data spawner berdasarkan scene dan konfigurasi, serta menyesuaikan pintu masuk kueri BuffData dan SkillData.

### v1.0.8

Menambahkan modul kueri BuffData dan SkillData dengan penelusuran manifest, pencarian, dan tampilan detail, sebagai pintu masuk penelitian data pertempuran tingkat dasar.

### v1.0.7

Menambahkan kueri informasi aktivitas, menyesuaikan tampilan default tag karakter dan mendukung tag khusus Rossi, sekaligus menambahkan statistik kunjungan situs.

### v1.0.6

Menambahkan daftar sponsor beserta gayanya pada halaman Tentang, sehingga tampilan informasi apresiasi proyek menjadi lebih lengkap.

### v1.0.5

Menyelesaikan adaptasi mobile untuk modul utama karakter, senjata, musuh, perlengkapan, item, dungeon, achievement, dan lainnya, termasuk ketiga tema.

### v1.0.4

Menambahkan fungsi filter pada modul karakter, senjata, dan item, serta merombak area filter daftar agar pencarian di antara banyak entri lebih efisien.

### v1.0.3

Menambahkan antarmuka kueri item dan mendaftarkan modul item, dengan dukungan daftar item, detail, serta tampilan informasi dasar terkait.

### v1.0.2

Menambahkan ikon skill dan tampilan base skill pada halaman karakter, termasuk tipe facility, level skill, deskripsi, dan syarat unlock, serta memperbaiki data terkait.

### v1.0.1

Memperbaiki tampilan data atribut tetap musuh yang tidak normal, sekaligus menyempurnakan informasi musuh pada halaman dungeon.

### v1.0.0

AKEData 1.0 resmi diluncurkan dengan penyempurnaan terpusat pada konten kueri dungeon, serta menaikkan versi proyek dari 0.99 menjadi 1.0.
