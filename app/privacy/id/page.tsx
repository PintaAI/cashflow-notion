import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kebijakan Privasi | Ethos",
  description: "Kebijakan Privasi untuk Ethos dan layanan Cashflow Notion.",
};

const lastUpdated = "6 Juli 2026";

const sections = [
  {
    title: "Informasi yang kami kumpulkan",
    body: [
      "Informasi akun seperti nama, alamat email, foto profil, penyedia autentikasi, sesi, dan preferensi aplikasi.",
      "Data ruang kerja finansial yang Anda buat, termasuk dompet, anggota, entri kas, kategori, anggaran, preset isi cepat, entri berulang, transfer, snapshot audit, mata uang, dan konteks nilai tukar.",
      "Catatan dan file yang Anda buat atau unggah, termasuk judul catatan, konten catatan, ikon, keanggotaan catatan bersama, gambar struk, gambar dompet, dan gambar profil.",
      "Data notifikasi opsional seperti token langganan push dan konteks ruang kerja yang diperlukan untuk mengirim pengingat yang Anda aktifkan.",
      "Data teknis seperti perangkat, peramban, permintaan, dan log layanan yang membantu kami mengamankan, mengoperasikan, men-debug, dan meningkatkan layanan.",
    ],
  },
  {
    title: "Bagaimana kami menggunakan informasi",
    body: [
      "Untuk menyediakan aplikasi Ethos, menyinkronkan data antar perangkat Anda, mengautentikasi akun Anda, dan menjaga ruang kerja finansial Anda tetap tersedia secara luring dan daring.",
      "Untuk mendukung fitur kolaborasi seperti dompet bersama, catatan bersama, undangan, peran anggota, dan pencarian pengguna untuk kolaborator yang diundang.",
      "Untuk memproses fitur opsional yang Anda pilih gunakan, seperti unggahan gambar, ekstraksi struk, bantuan pembagian tagihan, transkripsi, pengingat, dan alat bantuan AI.",
      "Untuk menjaga keamanan, mencegah penyalahgunaan, memecahkan masalah, meningkatkan keandalan, dan mematuhi kewajiban hukum.",
    ],
  },
  {
    title: "Layanan pihak ketiga",
    body: [
      "Kami menggunakan penyedia layanan untuk mengoperasikan aplikasi, termasuk hosting, basis data, penyimpanan objek, autentikasi, perpesanan waktu-nyata, notifikasi push, dan penyedia pemrosesan AI opsional.",
      "Saat Anda masuk dengan Google atau Apple, penyedia tersebut memproses autentikasi sesuai dengan kebijakan privasi mereka masing-masing.",
      "Saat Anda menggunakan fitur berbasis AI, konten yang diperlukan untuk fitur tersebut, seperti gambar struk atau teks audio/transkrip, dapat dikirim ke penyedia AI atau transkripsi yang dikonfigurasi hanya untuk melakukan tindakan yang diminta.",
      "Kami tidak menjual informasi pribadi Anda.",
    ],
  },
  {
    title: "Pelacakan dan periklanan",
    body: [
      "Ethos tidak menggunakan SDK periklanan pihak ketiga dan tidak melacak Anda di seluruh aplikasi atau situs web milik perusahaan lain untuk tujuan periklanan.",
      "Jika ini berubah di masa depan, kami akan memperbarui kebijakan ini dan pengungkapan privasi App Store sebelum mengaktifkan perilaku tersebut.",
    ],
  },
  {
    title: "Berbagi dan kolaborasi",
    body: [
      "Jika Anda bergabung atau mengundang orang lain ke dompet atau catatan, anggota ruang kerja bersama tersebut dapat melihat data ruang kerja, detail profil anggota, dan aktivitas yang diperlukan untuk kolaborasi.",
      "Jangan menambahkan informasi sensitif ke ruang kerja bersama kecuali Anda bermaksud agar anggota lain dapat mengaksesnya.",
    ],
  },
  {
    title: "Penyimpanan dan penghapusan data",
    body: [
      "Kami menyimpan data akun dan ruang kerja selama akun Anda aktif atau selama diperlukan untuk menyediakan layanan.",
      "Anda dapat menghapus akun Anda dari dalam Ethos. Penghapusan akun akan menghapus akun pengguna, sesi, token OAuth, ruang kerja pribadi yang tidak memiliki anggota tersisa, catatan pribadi yang tidak memiliki anggota tersisa, dan langganan push terkait.",
      "Jika dompet atau catatan bersama memiliki anggota lain, kepemilikan dapat dialihkan atau keanggotaan Anda dapat dihapus sehingga anggota yang tersisa dapat terus menggunakan ruang kerja bersama.",
      "Beberapa catatan mungkin tetap ada untuk waktu terbatas dalam cadangan, log, catatan keamanan, atau jika penyimpanan diwajibkan oleh hukum.",
    ],
  },
  {
    title: "Keamanan",
    body: [
      "Kami menggunakan autentikasi, kontrol akses, penyimpanan aman, dan transportasi terenkripsi untuk melindungi informasi Anda.",
      "Tidak ada sistem yang dapat dijamin sepenuhnya aman, jadi Anda harus menggunakan kode sandi perangkat yang kuat dan menjaga keamanan penyedia akun Anda.",
    ],
  },
  {
    title: "Anak-anak",
    body: [
      "Ethos tidak ditujukan untuk anak-anak di bawah 13 tahun, dan kami tidak dengan sengaja mengumpulkan informasi pribadi dari anak-anak di bawah 13 tahun.",
    ],
  },
  {
    title: "Perubahan pada kebijakan ini",
    body: [
      "Kami dapat memperbarui Kebijakan Privasi ini ketika aplikasi, penyedia layanan, atau persyaratan hukum berubah. Versi terbaru akan selalu tersedia di halaman ini.",
    ],
  },
  {
    title: "Kontak",
    body: [
      "Untuk pertanyaan privasi atau permintaan penghapusan yang tidak dapat diselesaikan di dalam aplikasi, hubungi pengembang melalui kontak dukungan yang tercantum di halaman produk App Store.",
    ],
  },
];

export default function PrivacyPageId() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-10 lg:px-16">
      <article className="mx-auto max-w-3xl rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <p className="text-sm font-medium text-muted-foreground">Terakhir diperbarui: {lastUpdated}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Kebijakan Privasi</h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground">
          Kebijakan Privasi ini menjelaskan bagaimana Ethos dan layanan Cashflow Notion mengumpulkan, menggunakan, dan melindungi informasi saat Anda menggunakan aplikasi seluler, aplikasi web, API, dan layanan terkait.
        </p>

        <div className="mt-10 space-y-9">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
              <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-7 text-muted-foreground sm:text-base">
                {section.body.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
