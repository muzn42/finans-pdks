package com.example.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Database(
    entities = [
        BranchEntity::class,
        EmployeeEntity::class,
        AttendanceRecordEntity::class,
        SecurityAlertEntity::class,
        NotificationEntity::class
    ],
    version = 10,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun attendanceDao(): AttendanceDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "finans_pdks_database"
                )
                .fallbackToDestructiveMigration(dropAllTables = true)
                .addCallback(object : Callback() {
                    override fun onCreate(db: SupportSQLiteDatabase) {
                        super.onCreate(db)
                        CoroutineScope(Dispatchers.IO).launch {
                            INSTANCE?.let { database ->
                                seedInitialData(database.attendanceDao())
                            }
                        }
                    }

                    override fun onDestructiveMigration(db: SupportSQLiteDatabase) {
                        super.onDestructiveMigration(db)
                        CoroutineScope(Dispatchers.IO).launch {
                            INSTANCE?.let { database ->
                                seedInitialData(database.attendanceDao())
                            }
                        }
                    }
                })
                .build()
                INSTANCE = instance
                instance
            }
        }

        private suspend fun seedInitialData(dao: AttendanceDao) {
            val branches = listOf(
                BranchEntity(
                    id = 1,
                    name = "Albayrak Finans Genel Müdürlük (Ataşehir)",
                    branchCode = "ŞB-001",
                    city = "İstanbul",
                    address = "Yenişehir Mah. Kızılcık Sok. Albayrak Plaza No:1/35 34779 Ataşehir / İstanbul",
                    latitude = 40.995454,
                    longitude = 29.140893,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_GM_SECURE",
                    phone = "444 88 61",
                    isDefault = true
                ),
                BranchEntity(
                    id = 2,
                    name = "Adana / Seyhan Şube",
                    branchCode = "ŞB-002",
                    city = "Adana",
                    address = "Reşatbey Mah. Atatürk Cad. Duru Apt. A Girişi No:34/A SEYHAN / ADANA",
                    latitude = 36.99142,
                    longitude = 35.33083,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_02_WIFI",
                    phone = "0322 480 02 01",
                    isDefault = false
                ),
                BranchEntity(
                    id = 3,
                    name = "Ankara / Keçiören Şube",
                    branchCode = "ŞB-003",
                    city = "Ankara",
                    address = "Şefkat Mah. Cumhuriyet Cd. No:4 B/A - KEÇİÖREN / ANKARA",
                    latitude = 39.99684,
                    longitude = 32.86325,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_03_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 4,
                    name = "Ankara / Sıhhiye Şube",
                    branchCode = "ŞB-004",
                    city = "Ankara",
                    address = "Eti Mah. Strazburg Cad. No:18/A ÇANKAYA / ANKARA",
                    latitude = 39.92721,
                    longitude = 32.85581,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_04_WIFI",
                    phone = "0312 920 17 06",
                    isDefault = false
                ),
                BranchEntity(
                    id = 5,
                    name = "Ankara / Sincan Şube",
                    branchCode = "ŞB-005",
                    city = "Ankara",
                    address = "Maraşal Çakmak Mah. Atatürk Cd. No:86/B Sincan / ANKARA",
                    latitude = 39.97462,
                    longitude = 32.58014,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_05_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 6,
                    name = "Ankara / Yenimahalle Şube",
                    branchCode = "ŞB-006",
                    city = "Ankara",
                    address = "Çarşı Mh. Akın Cd. No:59A Yenimahalle / ANKARA",
                    latitude = 39.96935,
                    longitude = 32.81642,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_06_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 7,
                    name = "Antalya / Muratpaşa Şube",
                    branchCode = "ŞB-007",
                    city = "Antalya",
                    address = "Tahılpazarı Mah. Adnan Menderes Bulvarı Yüce 3 Apt. No:33/A MURATPAŞA / ANTALYA",
                    latitude = 36.88912,
                    longitude = 30.70341,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_07_WIFI",
                    phone = "0242 277 18 07",
                    isDefault = false
                ),
                BranchEntity(
                    id = 8,
                    name = "Aydın / Efeler Şube",
                    branchCode = "ŞB-008",
                    city = "Aydın",
                    address = "Zafer Mah. Doğu Gazi Bulvarı Dış kapı No:51 D EFELER / AYDIN",
                    latitude = 37.84815,
                    longitude = 27.84523,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_08_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 9,
                    name = "Batman / Merkez Şube",
                    branchCode = "ŞB-009",
                    city = "Batman",
                    address = "Kültür Mah. Turgut Özal Bulvarı No:59/A - MERKEZ / BATMAN",
                    latitude = 37.88954,
                    longitude = 41.13218,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_09_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 10,
                    name = "Bursa / İnegöl Şube",
                    branchCode = "ŞB-010",
                    city = "Bursa",
                    address = "Sinanbey Mh. Nuri Doğrul Cd. No:11/B İNEGÖL / BURSA",
                    latitude = 40.07812,
                    longitude = 29.51334,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_10_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 11,
                    name = "Bursa / Osmangazi Şube (Yakında Hizmetinizde)",
                    branchCode = "ŞB-011",
                    city = "Bursa",
                    address = "Ulu Mh. Kıbrıs Şehitleri Cd. No:62 OSMANGAZİ / BURSA",
                    latitude = 40.19324,
                    longitude = 29.06102,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_11_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 12,
                    name = "Bursa / Yıldırım Şube",
                    branchCode = "ŞB-012",
                    city = "Bursa",
                    address = "Anadolu Mah. Ankarayolu Cad. A Blok No: 121/E YILDIRIM / BURSA",
                    latitude = 40.19165,
                    longitude = 29.08843,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_12_WIFI",
                    phone = "0224 552 01 16",
                    isDefault = false
                ),
                BranchEntity(
                    id = 13,
                    name = "Denizli / Merkezefendi Şube",
                    branchCode = "ŞB-013",
                    city = "Denizli",
                    address = "Saraylar Mah. Enverpaşa Cad. No:11 MERKEZEFENDİ / DENİZLİ",
                    latitude = 37.78342,
                    longitude = 29.08615,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_13_WIFI",
                    phone = "0258 201 00 20",
                    isDefault = false
                ),
                BranchEntity(
                    id = 14,
                    name = "Diyarbakır / Bağlar Şube",
                    branchCode = "ŞB-014",
                    city = "Diyarbakır",
                    address = "Bağlar Mahallesi Şanlıurfa Bulvarı No:141 A/B BAĞLAR / DİYARBAKIR",
                    latitude = 37.91683,
                    longitude = 40.21094,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_14_WIFI",
                    phone = "0412 505 34 14",
                    isDefault = false
                ),
                BranchEntity(
                    id = 15,
                    name = "Erzurum / Yakutiye Şube",
                    branchCode = "ŞB-015",
                    city = "Erzurum",
                    address = "Muratpaşa Mah. Saraybosna Cad. No :35/A YAKUTİYE / ERZURUM",
                    latitude = 39.90552,
                    longitude = 41.26831,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_15_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 16,
                    name = "Eskişehir / Tepebaşı Şube",
                    branchCode = "ŞB-016",
                    city = "Eskişehir",
                    address = "Hacı Ali Bey Mah. Sakarya 1 Cd. No:22A TEPEBAŞI/ ESKİŞEHİR",
                    latitude = 39.77671,
                    longitude = 30.52063,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_16_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 17,
                    name = "Gaziantep / Şahinbey Şube",
                    branchCode = "ŞB-017",
                    city = "Gaziantep",
                    address = "Alaybey Mah. Hürriyet Cad. No:1/E Belediye Pasajı ŞAHİNBEY / GAZİANTEP",
                    latitude = 37.06284,
                    longitude = 37.37921,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_17_WIFI",
                    phone = "0342 233 00 27",
                    isDefault = false
                ),
                BranchEntity(
                    id = 18,
                    name = "Gaziantep / Şehitkamil Şube",
                    branchCode = "ŞB-018",
                    city = "Gaziantep",
                    address = "Batıkent Mah. Hasan Celal Güzel Cd. No:101A ŞEHİTKAMİL / GAZİANTEP",
                    latitude = 37.07841,
                    longitude = 37.34412,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_18_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 19,
                    name = "Giresun / Merkez Şube (Yakında Hizmetinizde)",
                    branchCode = "ŞB-019",
                    city = "Giresun",
                    address = "Hacısiyam Mah. İnönü Cad. No:24A MERKEZ / GİRESUN",
                    latitude = 40.91698,
                    longitude = 38.38741,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_19_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 20,
                    name = "Isparta / Merkez Şube",
                    branchCode = "ŞB-020",
                    city = "Isparta",
                    address = "Yayla Mah. 118 Cumhuriyet Cad. No:25/B A-3 Blok İç Kapı No:4 Isparta Meydan AVM MERKEZ / ISPARTA",
                    latitude = 37.76812,
                    longitude = 30.55642,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_20_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 21,
                    name = "İstanbul / Avcılar Şube",
                    branchCode = "ŞB-021",
                    city = "İstanbul",
                    address = "Cihangir Mah. E-5 Yan Yol Caddesi ( Londra Asfaltı ) NO:223/A AVCILAR / İSTANBUL",
                    latitude = 40.98014,
                    longitude = 28.71753,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_21_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 22,
                    name = "İstanbul / Bağcılar Şube",
                    branchCode = "ŞB-022",
                    city = "İstanbul",
                    address = "Çınar Mahallesi İstanbul Caddesi No:45-47/A Burak Apt. BAĞCILAR / İSTANBUL",
                    latitude = 41.03382,
                    longitude = 28.85671,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_22_WIFI",
                    phone = "0212 912 27 34",
                    isDefault = false
                ),
                BranchEntity(
                    id = 23,
                    name = "İstanbul / Esenler Şube",
                    branchCode = "ŞB-023",
                    city = "İstanbul",
                    address = "Menderes Mah. 301. Sok. Dörtyaka Apt. No:1/H ESENLER / İSTANBUL",
                    latitude = 41.04351,
                    longitude = 28.87562,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_23_WIFI",
                    phone = "0212 912 02 34",
                    isDefault = false
                ),
                BranchEntity(
                    id = 24,
                    name = "İstanbul / Esenyurt Şube",
                    branchCode = "ŞB-024",
                    city = "İstanbul",
                    address = "Sultaniye Mah. Doğan Araslı Bulvarı No: 134/C ESENYURT / İSTANBUL",
                    latitude = 41.03428,
                    longitude = 28.68011,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_24_WIFI",
                    phone = "0212 912 05 34",
                    isDefault = false
                ),
                BranchEntity(
                    id = 25,
                    name = "İstanbul / Fatih Şube",
                    branchCode = "ŞB-025",
                    city = "İstanbul",
                    address = "Atikali Mah. Fevzipaşa Cad. 104/A FATİH / İSTANBUL",
                    latitude = 41.02214,
                    longitude = 28.94385,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_25_WIFI",
                    phone = "0212 912 00 34",
                    isDefault = false
                ),
                BranchEntity(
                    id = 26,
                    name = "İstanbul / Gaziosmanpaşa Şube",
                    branchCode = "ŞB-026",
                    city = "İstanbul",
                    address = "Sarıgöl Mah. Ordu Cad. Esen Apt. No:15/B GAZİOSMANPAŞA / İSTANBUL",
                    latitude = 41.05783,
                    longitude = 28.91234,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_26_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 27,
                    name = "İstanbul / Pendik Şube",
                    branchCode = "ŞB-027",
                    city = "İstanbul",
                    address = "Doğu Mah. 23 Nisan Cad. No:62/A PENDİK / İSTANBUL",
                    latitude = 40.87964,
                    longitude = 29.23451,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_27_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 28,
                    name = "İstanbul / Sancaktepe Şube",
                    branchCode = "ŞB-028",
                    city = "İstanbul",
                    address = "Meclis Mah. Ankara Cad. No:42 SANCAKTEPE / İSTANBUL",
                    latitude = 41.00215,
                    longitude = 29.23164,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_28_WIFI",
                    phone = "0216 912 25 34",
                    isDefault = false
                ),
                BranchEntity(
                    id = 29,
                    name = "İstanbul / Sultangazi Şube",
                    branchCode = "ŞB-029",
                    city = "İstanbul",
                    address = "İsmetpaşa Mah. 48/1 Sok. 645-651/3B SULTANGAZİ / İSTANBUL",
                    latitude = 41.10432,
                    longitude = 28.86145,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_29_WIFI",
                    phone = "0212 912 06 34",
                    isDefault = false
                ),
                BranchEntity(
                    id = 30,
                    name = "İstanbul / Ümraniye Şube",
                    branchCode = "ŞB-030",
                    city = "İstanbul",
                    address = "İstiklal Mah. Alemdağ Cad. No:192 ÜMRANİYE / İSTANBUL",
                    latitude = 41.02563,
                    longitude = 29.09632,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_30_WIFI",
                    phone = "0216 912 00 34",
                    isDefault = false
                ),
                BranchEntity(
                    id = 31,
                    name = "İstanbul / Üsküdar Şube",
                    branchCode = "ŞB-031",
                    city = "İstanbul",
                    address = "Mimar Sinan Mh. Selmanı Pak Cd. No:28 ÜSKÜDAR / İSTANBUL",
                    latitude = 41.02384,
                    longitude = 29.01521,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_31_WIFI",
                    phone = "0216 912 02 34",
                    isDefault = false
                ),
                BranchEntity(
                    id = 32,
                    name = "İstanbul / Zeytinburnu Şube",
                    branchCode = "ŞB-032",
                    city = "İstanbul",
                    address = "Gökalp Mah. Prof. Muammer Aksoy Caddesi Erlüks İş Merkezi No:77 A ZEYTİNBURNU / İSTANBUL",
                    latitude = 40.99412,
                    longitude = 28.90451,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_32_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 33,
                    name = "İzmir / Karabağlar Şube",
                    branchCode = "ŞB-033",
                    city = "İzmir",
                    address = "Aşık Veysel Mah. Yeşillik Cad. No:437-441 KARABAĞLAR / İZMİR",
                    latitude = 38.37854,
                    longitude = 27.13512,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_33_WIFI",
                    phone = "0232 218 18 35",
                    isDefault = false
                ),
                BranchEntity(
                    id = 34,
                    name = "İzmir / Konak Şube",
                    branchCode = "ŞB-034",
                    city = "İzmir",
                    address = "Akdeniz Mah. Fevzipaşa Bulvarı 61/A Altın Asır İş Hanı KONAK / İZMİR",
                    latitude = 38.42371,
                    longitude = 27.13842,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_34_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 35,
                    name = "Kahramanmaraş / Dulkadiroğlu Şube (Yakında Hizmetinizde)",
                    branchCode = "ŞB-035",
                    city = "Kahramanmaraş",
                    address = "Menderes Mh. Trabzon Blv. Dış Kapı No:53/1A-53/1B DULKADİROĞLU / KAHRAMANMARAŞ",
                    latitude = 37.57521,
                    longitude = 36.93714,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_35_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 36,
                    name = "Kayseri / Kocasinan Şube",
                    branchCode = "ŞB-036",
                    city = "Kayseri",
                    address = "Gevher Nesibe Mahallesi İstasyon Cad. No:31/B KOCASİNAN / KAYSERİ",
                    latitude = 38.72485,
                    longitude = 35.48263,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_36_WIFI",
                    phone = "0352 203 00 38",
                    isDefault = false
                ),
                BranchEntity(
                    id = 37,
                    name = "Kocaeli / Gebze Merkez Şube",
                    branchCode = "ŞB-037",
                    city = "Kocaeli",
                    address = "Hacıhalil Mah. 1215 Sok. No:1/GEBZE / KOCAELİ",
                    latitude = 40.79954,
                    longitude = 29.43121,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_37_WIFI",
                    phone = "0262 302 00 41",
                    isDefault = false
                ),
                BranchEntity(
                    id = 38,
                    name = "Kocaeli / İzmit Şube (Yakında Hizmetinizde)",
                    branchCode = "ŞB-038",
                    city = "Kocaeli",
                    address = "Karabaş Mh. Cumhuriyet Blv. No:149/A İzmit / KOCAELİ",
                    latitude = 40.76542,
                    longitude = 29.94081,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_38_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 39,
                    name = "Konya / Nalçacı Şube",
                    branchCode = "ŞB-039",
                    city = "Konya",
                    address = "Musalla Bağları Mah. Telgrafçı Hamdi Bey Cad. No:14/B SELÇUKLU / KONYA",
                    latitude = 37.88142,
                    longitude = 32.49215,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_39_WIFI",
                    phone = "0332 344 01 42",
                    isDefault = false
                ),
                BranchEntity(
                    id = 40,
                    name = "Kütahya / Merkez Şube (Yakında Hizmetinizde)",
                    branchCode = "ŞB-040",
                    city = "Kütahya",
                    address = "Pirler Mh. Adnan Menderes Blv. No:52I MERKEZ / KÜTAHYA",
                    latitude = 39.42014,
                    longitude = 29.98562,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_40_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 41,
                    name = "Malatya / Battalgazi Şube",
                    branchCode = "ŞB-041",
                    city = "Malatya",
                    address = "Şifa Mah. İnönü Cad. Sıtmapınarı Mevki No:171/B BATTALGAZİ / MALATYA",
                    latitude = 38.35142,
                    longitude = 38.32154,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_41_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 42,
                    name = "Manisa / Şehzadeler Şube (Yakında Hizmetinizde)",
                    branchCode = "ŞB-042",
                    city = "Manisa",
                    address = "1nci Anafartalar Mh. Mustafa Kemal Paşa Cd. Kamil Menteş Apt. No:34A Şehzadeler / MANİSA",
                    latitude = 38.61423,
                    longitude = 27.42951,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_42_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 43,
                    name = "Mardin / Artuklu Şube",
                    branchCode = "ŞB-043",
                    city = "Mardin",
                    address = "13 Mart Mah. Vali Ozan Cad. Dış Kapı No: 80/A ARTUKLU / MARDİN",
                    latitude = 37.32145,
                    longitude = 40.72451,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_43_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 44,
                    name = "Mersin / Yenişehir Şube (Yakında Hizmetinizde)",
                    branchCode = "ŞB-044",
                    city = "Mersin",
                    address = "İnönü Mah. Gazi Mustafa Kemal Blv. Büyük Apt.No:415B YENİŞEHİR / MERSİN",
                    latitude = 36.78452,
                    longitude = 34.59641,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_44_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 45,
                    name = "Ordu / Altınordu Şube",
                    branchCode = "ŞB-045",
                    city = "Ordu",
                    address = "Şarkiye Mah. Süleyman Felek Cad. No:52 ALTINORDU / ORDU",
                    latitude = 40.98392,
                    longitude = 37.87891,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_45_WIFI",
                    phone = "0452 212 45 89",
                    isDefault = false
                ),
                BranchEntity(
                    id = 46,
                    name = "Osmaniye / Merkez Şube (Yakında Hizmetinizde)",
                    branchCode = "ŞB-046",
                    city = "Osmaniye",
                    address = "Mehmet Akif Ersoy Mh. Atatürk Cd. No:397/A Merkez/OSMANİYE",
                    latitude = 37.07452,
                    longitude = 36.24781,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_46_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 47,
                    name = "Sakarya / Adapazarı Şube",
                    branchCode = "ŞB-047",
                    city = "Sakarya",
                    address = "Semerciler Mah. Çark Cad. Dış Kapı No: 95 ADAPAZARI / SAKARYA",
                    latitude = 40.77842,
                    longitude = 30.40124,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_47_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 48,
                    name = "Samsun / İlkadım Şube",
                    branchCode = "ŞB-048",
                    city = "Samsun",
                    address = "Kale Mah. Kazım Paşa Cad. NO:40/1 A Blok Fatih Temiz İş Merkezi İLKADIM / SAMSUN",
                    latitude = 41.28954,
                    longitude = 36.33241,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_48_WIFI",
                    phone = "0362 313 02 55",
                    isDefault = false
                ),
                BranchEntity(
                    id = 49,
                    name = "Sivas / Merkez Şube",
                    branchCode = "ŞB-049",
                    city = "Sivas",
                    address = "Eskikale Mah. 13-2 Sokak Dış kapı No: 5/A - MERKEZ / SİVAS",
                    latitude = 39.74852,
                    longitude = 37.01542,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_49_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 50,
                    name = "Şanlıurfa / Karaköprü Şube",
                    branchCode = "ŞB-050",
                    city = "Şanlıurfa",
                    address = "Batıkent Mah. Gap Bulvarı No:125/D KARAKÖPRÜ / ŞANLIURFA",
                    latitude = 37.19452,
                    longitude = 38.79124,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_50_WIFI",
                    phone = "0414 503 30 36",
                    isDefault = false
                ),
                BranchEntity(
                    id = 51,
                    name = "Tokat / Merkez Şube",
                    branchCode = "ŞB-051",
                    city = "Tokat",
                    address = "Kabe -i Mescid Mah. Gazi Osman Paşa Bulv. No:174A Merkez / TOKAT",
                    latitude = 40.31684,
                    longitude = 36.55421,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_51_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 52,
                    name = "Trabzon / Ortahisar Şube",
                    branchCode = "ŞB-052",
                    city = "Trabzon",
                    address = "Cumhuriyet Mah. Yavuz Selim Bulvarı No:173/A ORTAHİSAR / TRABZON",
                    latitude = 41.00542,
                    longitude = 39.72681,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_52_WIFI",
                    phone = "0462 350 01 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 53,
                    name = "Van / İpekyolu Şube",
                    branchCode = "ŞB-053",
                    city = "Van",
                    address = "Halilağa Mah. Kazım Karabekir Bulv. No: 115/A İPEKYOLU / VAN",
                    latitude = 38.49852,
                    longitude = 43.38341,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_53_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                ),
                BranchEntity(
                    id = 54,
                    name = "Yalova / Merkez Şube (Yakında Hizmetinizde)",
                    branchCode = "ŞB-054",
                    city = "Yalova",
                    address = "Süleyman Bey Mh. Sefabey Cd. No:26/A Merkez / YALOVA",
                    latitude = 40.65642,
                    longitude = 29.27451,
                    radiusMeters = 30.0,
                    wifiSsid = "ALBAYRAK_54_WIFI",
                    phone = "444 88 61",
                    isDefault = false
                )
            )
            dao.insertBranches(branches)

            val employees = MockDataGenerator.generate500Employees()
            dao.insertEmployees(employees)

            val now = System.currentTimeMillis()
            val initialRecords = MockDataGenerator.generateSampleRecords(employees, branches)
            dao.insertAttendanceRecords(initialRecords)

            // Seed sample security alert
            dao.insertSecurityAlert(
                SecurityAlertEntity(
                    id = 1,
                    timestamp = now - (1 * 3600 * 1000),
                    employeeId = 1,
                    employeeName = "Ahmet Yılmaz",
                    branchName = "Albayrak Finans Genel Müdürlük (Ataşehir)",
                    alertType = "30M_VIOLATION_ATTEMPT",
                    message = "Personel şube merkezine 48.5 metre mesafeden giriş yapmayı denedi. 30 metre güvenlik kuralı uyarınca işlem engellendi.",
                    distanceMeters = 48.5,
                    severity = "MEDIUM"
                )
            )

            // Seed sample notifications for İK & BT
            val initialNotifications = listOf(
                NotificationEntity(
                    id = 1,
                    timestamp = now - (3 * 3600 * 1000 + 15 * 60 * 1000),
                    targetDepartment = "HR",
                    title = "Mesai Girişi: Zeynep Kaya",
                    message = "Zeynep Kaya (Maslak Şubesi) 08:45'te 2.1m mesafeden kurallara uygun giriş yaptı.",
                    category = "ATTENDANCE_IN",
                    employeeName = "Zeynep Kaya",
                    branchName = "Maslak Finans Merkezi Şubesi",
                    distanceMeters = 2.1,
                    isRead = false
                ),
                NotificationEntity(
                    id = 2,
                    timestamp = now - (2 * 3600 * 1000 + 40 * 60 * 1000),
                    targetDepartment = "HR",
                    title = "⚠️ Geç Kalma Bildirimi: Caner Özdemir",
                    message = "Caner Özdemir (Kadıköy Şubesi) 09:20'de (20 dk gecikmeli) giriş yaptı.",
                    category = "ATTENDANCE_IN",
                    employeeName = "Caner Özdemir",
                    branchName = "Kadıköy Rıhtım Ticari Şube",
                    distanceMeters = 3.4,
                    isRead = false
                ),
                NotificationEntity(
                    id = 3,
                    timestamp = now - (1 * 3600 * 1000),
                    targetDepartment = "IT",
                    title = "🚨 30 Metre Sınırı İhlal Uyarısı!",
                    message = "Ahmet Yılmaz şube merkezine 48.5m mesafedeyken giriş yapmaya çalıştı! Sistem işlemi durdurdu ve İK/BT'ye bildirdi.",
                    category = "GEOFENCE_BREACH",
                    employeeName = "Ahmet Yılmaz",
                    branchName = "Albayrak Finans Genel Müdürlük (Ataşehir)",
                    distanceMeters = 48.5,
                    isRead = false
                )
            )
            for (notif in initialNotifications) {
                dao.insertNotification(notif)
            }
        }
    }
}
