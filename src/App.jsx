import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const rp = (num) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num || 0);

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settings, setSettings] = useState({ gaji_diri_persen: 40, brand_persen: 60 });
  const [packaging, setPackaging] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchAll = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const [setRes, pkgRes, prodRes, ordRes, expRes] = await Promise.all([
        supabase.from('app_settings').select('*').maybeSingle(),
        supabase.from('packaging_items').select('*').order('id'),
        supabase.from('products').select('*').order('kode_produk'),
        supabase.from('orders').select('*').order('tanggal_pemesanan', { ascending: false }),
        supabase.from('expenses').select('*').order('tanggal', { ascending: false }),
      ]);

      if (setRes.data) setSettings(setRes.data);
      if (pkgRes.data) setPackaging(pkgRes.data);
      if (prodRes.data) setProducts(prodRes.data);
      if (ordRes.data) setOrders(ordRes.data);
      if (expRes.data) setExpenses(expRes.data);

      const firstErr =
        pkgRes.error || prodRes.error || ordRes.error || expRes.error;
      if (firstErr) setErrorMsg(firstErr.message);
    } catch (err) {
      setErrorMsg(err.message || 'Gagal terhubung ke Supabase');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const financeSummary = useMemo(() => {
    let omzet = 0, uangMasuk = 0, gajiDiri = 0, danaBrand = 0, totalHpp = 0;
    const gPersen = settings.gaji_diri_persen / 100;
    const bPersen = settings.brand_persen / 100;

    orders.forEach((o) => {
      const bersih =
        Number(o.harga_satuan) * Number(o.jumlah) -
        Number(o.potongan || 0) -
        Number(o.ongkos_jasa_bantu || 0);
      const hppTotal = Number(o.hpp_satuan || 0) * Number(o.jumlah);
      const margin = bersih - hppTotal;

      omzet += Number(o.harga_satuan) * Number(o.jumlah) - Number(o.potongan || 0);
      uangMasuk += Number(o.uang_masuk || 0);
      totalHpp += hppTotal;
      if (margin > 0) {
        gajiDiri += margin * gPersen;
        danaBrand += margin * bPersen;
      }
    });

    const totalPengeluaran = expenses.reduce((acc, e) => acc + Number(e.nominal || 0), 0);
    return { omzet, uangMasuk, gajiDiri, danaBrand, totalHpp, totalPengeluaran };
  }, [orders, expenses, settings]);

  if (!supabase) {
    return (
      <div className="min-h-screen bg-rose-50 flex items-center justify-center p-5">
        <div className="bg-white p-5 rounded-2xl border border-rose-200 max-w-md w-full space-y-2 text-xs">
          <div className="font-bold text-sm text-rose-600">
            ⚠️ Kunci Database Vercel Belum Terbaca
          </div>
          <ul className="bg-stone-50 p-3 rounded-xl space-y-1 font-mono text-[11px]">
            <li>VITE_SUPABASE_URL: {supabaseUrl ? '✅ Terisi' : '❌ Masih Kosong'}</li>
            <li>VITE_SUPABASE_ANON_KEY: {supabaseKey ? '✅ Terisi' : '❌ Masih Kosong'}</li>
          </ul>
          <p className="text-stone-500">
            Isi variabel di Vercel Settings → Environment Variables, lalu Redeploy.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-rose-50/50 flex flex-col items-center justify-center text-rose-800">
        <p className="text-2xl mb-2">🧶</p>
        <p className="font-medium text-sm">Memuat Data ZORA STAR...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 pb-24 max-w-2xl mx-auto shadow-sm">
      <header className="bg-gradient-to-r from-rose-500 to-pink-500 text-white px-5 py-4 sticky top-0 z-20 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-bold text-lg tracking-wide">✨ ZORA STAR</h1>
            <p className="text-xs text-rose-100">Crochet Studio & HPP Manager</p>
          </div>
          <div className="text-right text-xs bg-white/15 px-3 py-1.5 rounded-full">
            Split {settings.gaji_diri_persen}% : {settings.brand_persen}%
          </div>
        </div>
      </header>

      {errorMsg && (
        <div className="m-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          <b>Info Database:</b> {errorMsg}
        </div>
      )}

      <main className="p-4">
        {activeTab === 'dashboard' && (
          <DashboardTab
            orders={orders}
            summary={financeSummary}
            settings={settings}
            onRefresh={fetchAll}
          />
        )}
        {activeTab === 'hpp' && (
          <HppTab
            products={products}
            packaging={packaging}
            settings={settings}
            onRefresh={fetchAll}
          />
        )}
        {activeTab === 'transaksi' && (
          <TransaksiTab
            orders={orders}
            expenses={expenses}
            products={products}
            onRefresh={fetchAll}
          />
        )}
        {activeTab === 'laporan' && (
          <LaporanTab
            orders={orders}
            expenses={expenses}
            settings={settings}
            onUpdateSettings={async (newGaji) => {
              const newBrand = 100 - newGaji;
              await supabase
                .from('app_settings')
                .upsert({ id: 1, gaji_diri_persen: newGaji, brand_persen: newBrand });
              fetchAll();
            }}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white border-t border-stone-200 flex justify-around py-2 px-1 z-30">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: '📊' },
          { id: 'hpp', label: 'Katalog HPP', icon: '🧮' },
          { id: 'transaksi', label: 'Transaksi', icon: '🛍️' },
          { id: 'laporan', label: 'Laba Rugi', icon: '📑' },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition ${
                active
                  ? 'text-rose-600 bg-rose-50 font-semibold'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              <span className="text-base mb-0.5">{tab.icon}</span>
              <span className="text-[11px]">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function DashboardTab({ orders, summary, settings, onRefresh }) {
  const antrian = orders.filter((o) => o.status_pengerjaan !== 'Selesai');
  const belumLunas = orders.filter((o) => o.status_pelunasan === 'DP');

  const updateStatusKerja = async (id, nextStatus) => {
    await supabase.from('orders').update({ status_pengerjaan: nextStatus }).eq('id', id);
    onRefresh();
  };

  const lunasiOrder = async (order) => {
    const tagihanTotal =
      Number(order.harga_satuan) * Number(order.jumlah) - Number(order.potongan || 0);
    await supabase
      .from('orders')
      .update({
        status_pelunasan: 'Lunas',
        uang_masuk: tagihanTotal,
        tanggal_pelunasan: new Date().toISOString().slice(0, 10),
      })
      .eq('id', order.id);
    onRefresh();
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-stone-100 shadow-sm">
          <p className="text-xs text-stone-400">Perkiraan Omzet</p>
          <p className="text-base font-bold text-stone-800 mt-0.5">{rp(summary.omzet)}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-stone-100 shadow-sm">
          <p className="text-xs text-stone-400">Uang Masuk / DP</p>
          <p className="text-base font-bold text-emerald-600 mt-0.5">{rp(summary.uangMasuk)}</p>
        </div>
        <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-100">
          <p className="text-xs text-rose-600 font-medium">
            Gaji Diri ({settings.gaji_diri_persen}%)
          </p>
          <p className="text-base font-bold text-rose-700 mt-0.5">{rp(summary.gajiDiri)}</p>
        </div>
        <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-100">
          <p className="text-xs text-amber-700 font-medium">
            Dana Brand ({settings.brand_persen}%)
          </p>
          <p className="text-base font-bold text-amber-800 mt-0.5">{rp(summary.danaBrand)}</p>
        </div>
      </div>

      <section>
        <div className="flex justify-between items-center mb-2.5">
          <h2 className="font-bold text-sm text-stone-700">
            🧶 Antrian Rajutan ({antrian.length})
          </h2>
        </div>
        {antrian.length === 0 ? (
          <p className="text-xs text-stone-400 bg-white p-4 rounded-xl text-center">
            Semua pesanan sudah selesai dirajut!
          </p>
        ) : (
          <div className="space-y-2.5">
            {antrian.map((o) => (
              <div
                key={o.id}
                className="bg-white p-3.5 rounded-2xl border border-stone-100 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                      {o.kode_produk || 'CUSTOM'}
                    </span>
                    <h3 className="font-bold text-sm mt-1">
                      {o.nama_produk} ({o.jumlah}x)
                    </h3>
                    <p className="text-xs text-stone-500">
                      Pembeli:{' '}
                      <span className="font-medium text-stone-700">{o.nama_pembeli}</span> (
                      {o.asal_negara})
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
                      o.status_pengerjaan === 'Proses Pengerjaan'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {o.status_pengerjaan}
                  </span>
                </div>
                {(o.warna || o.note_custom) && (
                  <div className="mt-2 text-xs bg-stone-50 p-2 rounded-lg text-stone-600">
                    {o.warna && (
                      <p>
                        <b>Warna:</b> {o.warna}
                      </p>
                    )}
                    {o.note_custom && (
                      <p>
                        <b>Note:</b> {o.note_custom}
                      </p>
                    )}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  {o.status_pengerjaan === 'Belum Dikerjakan' && (
                    <button
                      onClick={() => updateStatusKerja(o.id, 'Proses Pengerjaan')}
                      className="flex-1 bg-amber-500 text-white text-xs font-semibold py-2 rounded-xl"
                    >
                      Mulai Kerjakan
                    </button>
                  )}
                  <button
                    onClick={() => updateStatusKerja(o.id, 'Selesai')}
                    className="flex-1 bg-emerald-600 text-white text-xs font-semibold py-2 rounded-xl"
                  >
                    ✅ Tandai Selesai
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-bold text-sm text-stone-700 mb-2.5">
          💳 Menunggu Pelunasan ({belumLunas.length})
        </h2>
        <div className="space-y-2">
          {belumLunas.map((o) => {
            const total =
              Number(o.harga_satuan) * Number(o.jumlah) - Number(o.potongan || 0);
            const sisa = total - Number(o.uang_masuk || 0);
            return (
              <div
                key={o.id}
                className="bg-white p-3.5 rounded-2xl border border-amber-100 flex justify-between items-center"
              >
                <div>
                  <p className="font-bold text-sm">{o.nama_pembeli}</p>
                  <p className="text-xs text-stone-500">{o.nama_produk}</p>
                  <p className="text-xs text-rose-600 font-semibold mt-0.5">
                    Kurang: {rp(sisa)}
                  </p>
                </div>
                <button
                  onClick={() => lunasiOrder(o)}
                  className="bg-stone-800 text-white text-xs font-medium px-3 py-2 rounded-xl"
                >
                  Set Lunas
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function HppTab({ products, packaging, settings, onRefresh }) {
  const [filterCat, setFilterCat] = useState('ALL');
  const [showForm, setShowForm] = useState(false);

  const [kategori, setKategori] = useState('WEARABLE');
  const [namaProduk, setNamaProduk] = useState('');
  const [namaBenang, setNamaBenang] = useState('');
  const [selectedPkg, setSelectedPkg] = useState([]);
  const [biayaBenang, setBiayaBenang] = useState('');
  const [biayaHardware, setBiayaHardware] = useState('');
  const [biayaAksesoris, setBiayaAksesoris] = useState('');
  const [biayaRing, setBiayaRing] = useState('');
  const [biayaLain, setBiayaLain] = useState('');
  const [hargaJual, setHargaJual] = useState('');

  const totalKemasan = selectedPkg.reduce((sum, id) => {
    const item = packaging.find((p) => p.id === id);
    return sum + (item ? Number(item.harga) : 0);
  }, 0);

  const calcTotalHpp =
    totalKemasan +
    Number(biayaBenang || 0) +
    Number(biayaHardware || 0) +
    Number(biayaAksesoris || 0) +
    Number(biayaRing || 0) +
    Number(biayaLain || 0);

  const generateNextCode = (cat) => {
    const prefix = cat === 'WEARABLE' ? 'WR-' : 'AK-';
    const count = products.filter((p) => p.kategori === cat).length + 1;
    return `${prefix}${String(count).padStart(3, '0')}`;
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const kode = generateNextCode(kategori);
    await supabase.from('products').insert([
      {
        kode_produk: kode,
        kategori,
        nama_produk: namaProduk,
        nama_benang: namaBenang,
        biaya_kemasan: totalKemasan,
        biaya_benang: Number(biayaBenang || 0),
        biaya_hardware: Number(biayaHardware || 0),
        biaya_aksesoris: Number(biayaAksesoris || 0),
        biaya_ring: Number(biayaRing || 0),
        biaya_lain: Number(biayaLain || 0),
        harga_jual: Number(hargaJual || 0),
      },
    ]);
    setShowForm(false);
    setNamaProduk('');
    setNamaBenang('');
    setSelectedPkg([]);
    setBiayaBenang('');
    setBiayaHardware('');
    setBiayaAksesoris('');
    setBiayaRing('');
    setBiayaLain('');
    setHargaJual('');
    onRefresh();
  };

  const filtered = products.filter((p) => filterCat === 'ALL' || p.kategori === filterCat);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-1.5 bg-stone-200/70 p-1 rounded-xl text-xs font-medium">
          {['ALL', 'WEARABLE', 'AKSESORI'].map((c) => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              className={`px-3 py-1.5 rounded-lg ${
                filterCat === c ? 'bg-white text-rose-600 shadow-sm' : 'text-stone-600'
              }`}
            >
              {c === 'ALL' ? 'Semua' : c}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-rose-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-sm"
        >
          + Produk Baru
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSaveProduct}
          className="bg-white p-4 rounded-2xl border border-rose-200 space-y-3 shadow-sm"
        >
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-rose-700">Tambah Produk & Hitung HPP</h3>
            <span className="text-xs font-mono bg-rose-50 text-rose-600 px-2 py-0.5 rounded">
              Kode: {generateNextCode(kategori)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-stone-500">Kategori</label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                className="w-full border rounded-xl p-2 text-xs mt-0.5"
              >
                <option value="WEARABLE">WEARABLE (Tas/Baju)</option>
                <option value="AKSESORI">AKSESORI (Ganci/Boneka)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-stone-500">Nama Produk *</label>
              <input
                required
                value={namaProduk}
                onChange={(e) => setNamaProduk(e.target.value)}
                placeholder="Contoh: Daisy Bag"
                className="w-full border rounded-xl p-2 text-xs mt-0.5"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-stone-500">Jenis Benang yang Dipakai</label>
            <input
              value={namaBenang}
              onChange={(e) => setNamaBenang(e.target.value)}
              placeholder="Milk cotton, messy yarn..."
              className="w-full border rounded-xl p-2 text-xs mt-0.5"
            />
          </div>

          <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-100">
            <div className="flex justify-between text-xs font-semibold text-amber-900 mb-2">
              <span>Checklist Kemasan</span>
              <span>Total: {rp(totalKemasan)}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {packaging.map((pkg) => {
                const checked = selectedPkg.includes(pkg.id);
                return (
                  <label
                    key={pkg.id}
                    className="flex items-center gap-1.5 text-[11px] bg-white p-1.5 rounded-lg border border-amber-100 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedPkg(
                          checked
                            ? selectedPkg.filter((i) => i !== pkg.id)
                            : [...selectedPkg, pkg.id]
                        )
                      }
                    />
                    <span className="truncate flex-1">{pkg.nama}</span>
                    <span className="text-stone-400">{pkg.harga / 1000}k</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-stone-500">Biaya Benang (Rp)</label>
              <input
                type="number"
                value={biayaBenang}
                onChange={(e) => setBiayaBenang(e.target.value)}
                className="w-full border rounded-xl p-2 text-xs mt-0.5"
              />
            </div>
            <div>
              <label className="text-[11px] text-stone-500">
                {kategori === 'WEARABLE' ? 'Magnet (Rp)' : 'Gantungan Kunci (Rp)'}
              </label>
              <input
                type="number"
                value={biayaHardware}
                onChange={(e) => setBiayaHardware(e.target.value)}
                className="w-full border rounded-xl p-2 text-xs mt-0.5"
              />
            </div>
            <div>
              <label className="text-[11px] text-stone-500">
                {kategori === 'WEARABLE' ? 'Pouch / Puring (Rp)' : 'Aksesori Tambahan (Rp)'}
              </label>
              <input
                type="number"
                value={biayaAksesoris}
                onChange={(e) => setBiayaAksesoris(e.target.value)}
                className="w-full border rounded-xl p-2 text-xs mt-0.5"
              />
            </div>
            <div>
              <label className="text-[11px] text-stone-500">
                {kategori === 'WEARABLE' ? 'Ring D (Rp)' : 'Jump Ring (Rp)'}
              </label>
              <input
                type="number"
                value={biayaRing}
                onChange={(e) => setBiayaRing(e.target.value)}
                className="w-full border rounded-xl p-2 text-xs mt-0.5"
              />
            </div>
            <div>
              <label className="text-[11px] text-stone-500">Bahan Lain-lain (Rp)</label>
              <input
                type="number"
                value={biayaLain}
                onChange={(e) => setBiayaLain(e.target.value)}
                className="w-full border rounded-xl p-2 text-xs mt-0.5"
              />
            </div>
            <div>
              <label className="text-[11px] text-rose-600 font-semibold">Harga Jual (Rp)</label>
              <input
                type="number"
                required
                value={hargaJual}
                onChange={(e) => setHargaJual(e.target.value)}
                className="w-full border border-rose-300 rounded-xl p-2 text-xs mt-0.5"
              />
            </div>
          </div>

          <div className="bg-stone-900 text-white p-3 rounded-xl flex justify-between items-center text-xs">
            <div>
              <p className="text-stone-400">
                Total HPP: <b className="text-white">{rp(calcTotalHpp)}</b>
              </p>
              <p className="text-emerald-400 mt-0.5">
                Estimasi Margin: <b>{rp(Number(hargaJual || 0) - calcTotalHpp)}</b>
              </p>
            </div>
            <button type="submit" className="bg-rose-500 px-4 py-2 rounded-xl font-bold">
              Simpan
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2.5">
        {filtered.map((p) => {
          const totalHpp =
            Number(p.biaya_kemasan) +
            Number(p.biaya_benang) +
            Number(p.biaya_hardware) +
            Number(p.biaya_aksesoris) +
            Number(p.biaya_ring) +
            Number(p.biaya_lain);
          const margin = Number(p.harga_jual) - totalHpp;
          const marginPct =
            p.harga_jual > 0 ? ((margin / p.harga_jual) * 100).toFixed(1) : '0.0';
          const gaji = margin > 0 ? margin * (settings.gaji_diri_persen / 100) : 0;
          const brand = margin > 0 ? margin * (settings.brand_persen / 100) : 0;

          return (
            <div
              key={p.id}
              className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-mono font-bold bg-stone-100 text-stone-600 px-2 py-0.5 rounded">
                    {p.kode_produk}
                  </span>
                  <h3 className="font-bold text-sm mt-1">{p.nama_produk}</h3>
                  {p.nama_benang && (
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Benang: {p.nama_benang}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-rose-600">{rp(p.harga_jual)}</p>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
                    Margin {marginPct}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-stone-100 text-[11px]">
                <div>
                  <p className="text-stone-400">Total HPP</p>
                  <p className="font-semibold">{rp(totalHpp)}</p>
                </div>
                <div>
                  <p className="text-stone-400">Gaji ({settings.gaji_diri_persen}%)</p>
                  <p className="font-semibold text-rose-600">{rp(gaji)}</p>
                </div>
                <div>
                  <p className="text-stone-400">Brand ({settings.brand_persen}%)</p>
                  <p className="font-semibold text-amber-700">{rp(brand)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TransaksiTab({ orders, expenses, products, onRefresh }) {
  const [subTab, setSubTab] = useState('order');
  const [showOrderForm, setShowOrderForm] = useState(false);

  const [isCustom, setIsCustom] = useState(false);
  const [selectedCode, setSelectedCode] = useState('');
  const [namaProduk, setNamaProduk] = useState('');
  const [hppSatuan, setHppSatuan] = useState(0);
  const [hargaSatuan, setHargaSatuan] = useState(0);
  const [jumlah, setJumlah] = useState(1);
  const [namaPembeli, setNamaPembeli] = useState('');
  const [asalNegara, setAsalNegara] = useState('Indonesia');
  const [noWa, setNoWa] = useState('');
  const [alamat, setAlamat] = useState('');
  const [warna, setWarna] = useState('');
  const [noteCustom, setNoteCustom] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Transfer BCA');
  const [potongan, setPotongan] = useState(0);
  const [ongkosBantu, setOngkosBantu] = useState(0);
  const [uangMasuk, setUangMasuk] = useState(0);
  const [statusPelunasan, setStatusPelunasan] = useState('DP');

  const [expTipe, setExpTipe] = useState('BAHAN_BAKU');
  const [expNama, setExpNama] = useState('');
  const [expWarna, setExpWarna] = useState('');
  const [expQty, setExpQty] = useState(1);
  const [expNominal, setExpNominal] = useState('');

  const handleSelectProduct = (code) => {
    setSelectedCode(code);
    const found = products.find((p) => p.kode_produk === code);
    if (found) {
      const hpp =
        Number(found.biaya_kemasan) +
        Number(found.biaya_benang) +
        Number(found.biaya_hardware) +
        Number(found.biaya_aksesoris) +
        Number(found.biaya_ring) +
        Number(found.biaya_lain);
      setNamaProduk(found.nama_produk);
      setHppSatuan(hpp);
      setHargaSatuan(Number(found.harga_jual));
    }
  };

  const handleSaveOrder = async (e) => {
    e.preventDefault();
    await supabase.from('orders').insert([
      {
        nama_pembeli: namaPembeli,
        asal_negara: asalNegara,
        no_wa: noWa,
        alamat,
        kode_produk: isCustom ? 'CUSTOM' : selectedCode,
        nama_produk: namaProduk,
        is_custom: isCustom,
        hpp_satuan: Number(hppSatuan || 0),
        harga_satuan: Number(hargaSatuan || 0),
        jumlah: Number(jumlah || 1),
        warna,
        note_custom: noteCustom,
        payment_method: paymentMethod,
        potongan: Number(potongan || 0),
        ongkos_jasa_bantu: Number(ongkosBantu || 0),
        uang_masuk: Number(uangMasuk || 0),
        status_pelunasan: statusPelunasan,
        status_pengerjaan: 'Belum Dikerjakan',
      },
    ]);
    setShowOrderForm(false);
    setNamaPembeli('');
    setWarna('');
    setNoteCustom('');
    setPotongan(0);
    setUangMasuk(0);
    onRefresh();
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    await supabase.from('expenses').insert([
      {
        tipe: expTipe,
        nama_item: expNama,
        detail_warna_kode: expWarna,
        jumlah_satuan: Number(expQty || 1),
        nominal: Number(expNominal || 0),
      },
    ]);
    setExpNama('');
    setExpWarna('');
    setExpQty(1);
    setExpNominal('');
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 bg-stone-200/70 p-1 rounded-xl text-xs font-semibold">
        <button
          onClick={() => setSubTab('order')}
          className={`flex-1 py-2 rounded-lg ${
            subTab === 'order' ? 'bg-white text-rose-600 shadow-sm' : 'text-stone-600'
          }`}
        >
          Catatan Penjualan ({orders.length})
        </button>
        <button
          onClick={() => setSubTab('expense')}
          className={`flex-1 py-2 rounded-lg ${
            subTab === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-stone-600'
          }`}
        >
          Pengeluaran & Benang ({expenses.length})
        </button>
      </div>

      {subTab === 'order' ? (
        <>
          <button
            onClick={() => setShowOrderForm(!showOrderForm)}
            className="w-full bg-rose-500 text-white text-xs font-bold py-3 rounded-xl shadow-sm"
          >
            + Catat Orderan Baru
          </button>

          {showOrderForm && (
            <form
              onSubmit={handleSaveOrder}
              className="bg-white p-4 rounded-2xl border border-rose-200 space-y-3 text-xs"
            >
              <div className="flex items-center justify-between bg-stone-50 p-2 rounded-xl">
                <span className="font-semibold">Tipe Pesanan:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCustom(false)}
                    className={`px-2.5 py-1 rounded-lg ${
                      !isCustom ? 'bg-rose-500 text-white' : 'bg-white border'
                    }`}
                  >
                    Katalog
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustom(true);
                      setSelectedCode('CUSTOM');
                      setNamaProduk('');
                      setHppSatuan(0);
                    }}
                    className={`px-2.5 py-1 rounded-lg ${
                      isCustom ? 'bg-rose-500 text-white' : 'bg-white border'
                    }`}
                  >
                    Custom Order
                  </button>
                </div>
              </div>

              {!isCustom ? (
                <div>
                  <label className="text-stone-500">Pilih Produk Katalog *</label>
                  <select
                    required
                    value={selectedCode}
                    onChange={(e) => handleSelectProduct(e.target.value)}
                    className="w-full border rounded-xl p-2 mt-0.5"
                  >
                    <option value="">-- Pilih Kode Produk --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.kode_produk}>
                        {p.kode_produk} — {p.nama_produk}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-stone-500">Nama Produk Custom *</label>
                  <input
                    required
                    value={namaProduk}
                    onChange={(e) => setNamaProduk(e.target.value)}
                    placeholder="Contoh: Custom Bow Crochet Bag"
                    className="w-full border rounded-xl p-2 mt-0.5"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-stone-500">HPP Satuan</label>
                  <input
                    type="number"
                    value={hppSatuan}
                    onChange={(e) => setHppSatuan(e.target.value)}
                    className="w-full border rounded-xl p-2 mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-stone-500">Harga Deal</label>
                  <input
                    type="number"
                    required
                    value={hargaSatuan}
                    onChange={(e) => setHargaSatuan(e.target.value)}
                    className="w-full border rounded-xl p-2 mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-stone-500">Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={jumlah}
                    onChange={(e) => setJumlah(e.target.value)}
                    className="w-full border rounded-xl p-2 mt-0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-stone-500">Nama Pembeli *</label>
                  <input
                    required
                    value={namaPembeli}
                    onChange={(e) => setNamaPembeli(e.target.value)}
                    className="w-full border rounded-xl p-2 mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-stone-500">Negara</label>
                  <input
                    value={asalNegara}
                    onChange={(e) => setAsalNegara(e.target.value)}
                    className="w-full border rounded-xl p-2 mt-0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-stone-500">No. WA / Sosmed</label>
                  <input
                    value={noWa}
                    onChange={(e) => setNoWa(e.target.value)}
                    className="w-full border rounded-xl p-2 mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-stone-500">Warna Benang</label>
                  <input
                    value={warna}
                    onChange={(e) => setWarna(e.target.value)}
                    className="w-full border rounded-xl p-2 mt-0.5"
                  />
                </div>
              </div>

              <div>
                <label className="text-stone-500">Alamat & Catatan Custom</label>
                <input
                  value={noteCustom}
                  onChange={(e) => setNoteCustom(e.target.value)}
                  placeholder="Request tali, deadline, alamat..."
                  className="w-full border rounded-xl p-2 mt-0.5"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-stone-500">Diskon (Rp)</label>
                  <input
                    type="number"
                    value={potongan}
                    onChange={(e) => setPotongan(e.target.value)}
                    className="w-full border rounded-xl p-2 mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-stone-500">Ongkos Bantu</label>
                  <input
                    type="number"
                    value={ongkosBantu}
                    onChange={(e) => setOngkosBantu(e.target.value)}
                    className="w-full border rounded-xl p-2 mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-stone-500">Metode Bayar</label>
                  <input
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="BCA / PayPal / QRIS"
                    className="w-full border rounded-xl p-2 mt-0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-emerald-50 p-2.5 rounded-xl">
                <div>
                  <label className="text-emerald-800 font-semibold">Uang Masuk (Rp)</label>
                  <input
                    type="number"
                    value={uangMasuk}
                    onChange={(e) => setUangMasuk(e.target.value)}
                    className="w-full border rounded-xl p-2 mt-0.5 bg-white"
                  />
                </div>
                <div>
                  <label className="text-emerald-800 font-semibold">Status Bayar</label>
                  <select
                    value={statusPelunasan}
                    onChange={(e) => setStatusPelunasan(e.target.value)}
                    className="w-full border rounded-xl p-2 mt-0.5 bg-white"
                  >
                    <option value="DP">DP</option>
                    <option value="Lunas">Lunas</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-stone-900 text-white font-bold py-2.5 rounded-xl"
              >
                Simpan Transaksi
              </button>
            </form>
          )}

          <div className="space-y-2.5">
            {orders.map((o) => (
              <div
                key={o.id}
                className="bg-white p-3.5 rounded-2xl border border-stone-100 shadow-sm text-xs"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-stone-800">
                        {o.nama_pembeli}
                      </span>
                      <span className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-500">
                        🌍 {o.asal_negara}
                      </span>
                    </div>
                    <p className="text-stone-600 font-medium mt-0.5">
                      {o.nama_produk} ({o.jumlah}x) {o.warna && `• ${o.warna}`}
                    </p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      {o.tanggal_pemesanan} • {o.payment_method || '-'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-stone-800">
                      {rp(o.harga_satuan * o.jumlah - o.potongan)}
                    </p>
                    <span
                      className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        o.status_pelunasan === 'Lunas'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {o.status_pelunasan} ({rp(o.uang_masuk)})
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <form
            onSubmit={handleSaveExpense}
            className="bg-white p-4 rounded-2xl border border-stone-200 space-y-2.5 text-xs"
          >
            <h3 className="font-bold text-sm">Catat Pengeluaran / Belanja Benang</h3>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={expTipe}
                onChange={(e) => setExpTipe(e.target.value)}
                className="border rounded-xl p-2"
              >
                <option value="BAHAN_BAKU">Pembelian Bahan Baku</option>
                <option value="OPERASIONAL">Pengeluaran Usaha</option>
              </select>
              <input
                required
                value={expNama}
                onChange={(e) => setExpNama(e.target.value)}
                placeholder={
                  expTipe === 'BAHAN_BAKU' ? 'Nama Benang / Aksesoris' : 'Nama Pengeluaran'
                }
                className="border rounded-xl p-2"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                value={expWarna}
                onChange={(e) => setExpWarna(e.target.value)}
                placeholder="Warna / Ket"
                className="border rounded-xl p-2"
              />
              <input
                type="number"
                min="1"
                value={expQty}
                onChange={(e) => setExpQty(e.target.value)}
                placeholder="Jumlah Gulung"
                className="border rounded-xl p-2"
              />
              <input
                type="number"
                required
                value={expNominal}
                onChange={(e) => setExpNominal(e.target.value)}
                placeholder="Total Nominal (Rp)"
                className="border rounded-xl p-2"
              />
            </div>
            {expTipe === 'BAHAN_BAKU' && expNominal > 0 && expQty > 0 && (
              <p className="text-[11px] text-rose-600 font-medium">
                Harga per satuan: {rp(expNominal / expQty)}
              </p>
            )}
            <button
              type="submit"
              className="w-full bg-rose-500 text-white font-bold py-2.5 rounded-xl"
            >
              Simpan Pengeluaran
            </button>
          </form>

          <div className="space-y-2">
            {expenses.map((e) => (
              <div
                key={e.id}
                className="bg-white p-3 rounded-xl border border-stone-100 flex justify-between items-center text-xs"
              >
                <div>
                  <span className="text-[10px] font-bold text-stone-400">
                    {e.tipe} • {e.tanggal}
                  </span>
                  <p className="font-bold text-stone-800">
                    {e.nama_item} {e.detail_warna_kode && `(${e.detail_warna_kode})`}
                  </p>
                  {e.jumlah_satuan > 1 && (
                    <p className="text-[11px] text-stone-400">
                      {e.jumlah_satuan} pcs @ {rp(e.nominal / e.jumlah_satuan)}
                    </p>
                  )}
                </div>
                <p className="font-bold text-rose-600">-{rp(e.nominal)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LaporanTab({ orders, expenses, settings, onUpdateSettings }) {
  const [startDate, setStartDate] = useState('2026-07-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [bebanListrik, setBebanListrik] = useState(0);
  const [bebanSewa, setBebanSewa] = useState(0);
  const [bebanAlat, setBebanAlat] = useState(0);
  const [bebanLain, setBebanLain] = useState(0);
  const [pajakPersen, setPajakPersen] = useState(0);

  const filteredOrders = orders.filter(
    (o) => o.tanggal_pemesanan >= startDate && o.tanggal_pemesanan <= endDate
  );
  const filteredExpenses = expenses.filter(
    (e) => e.tanggal >= startDate && e.tanggal <= endDate
  );

  const penjualanBersih = filteredOrders.reduce(
    (sum, o) => sum + (o.harga_satuan * o.jumlah - o.potongan - o.ongkos_jasa_bantu),
    0
  );
  const totalHpp = filteredOrders.reduce(
    (sum, o) => sum + o.hpp_satuan * o.jumlah,
    0
  );
  const grossProfit = penjualanBersih - totalHpp;

  const totalPengeluaranTercatat = filteredExpenses.reduce(
    (sum, e) => sum + Number(e.nominal),
    0
  );
  const totalBebanManual =
    Number(bebanListrik) + Number(bebanSewa) + Number(bebanAlat) + Number(bebanLain);
  const labaSebelumPajak = grossProfit - totalPengeluaranTercatat - totalBebanManual;
  const nominalPajak =
    labaSebelumPajak > 0 ? labaSebelumPajak * (Number(pajakPersen) / 100) : 0;
  const nettProfit = labaSebelumPajak - nominalPajak;

  return (
    <div className="space-y-4 text-xs">
      <div className="bg-white p-4 rounded-2xl border border-stone-100 flex justify-between items-center">
        <div>
          <p className="font-bold text-stone-800">Persentase Gaji Diri</p>
          <p className="text-[11px] text-stone-400">
            Sisa {100 - settings.gaji_diri_persen}% otomatis masuk Dana Brand
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min="0"
            max="100"
            value={settings.gaji_diri_persen}
            onChange={(e) => onUpdateSettings(Number(e.target.value))}
            className="w-16 border rounded-xl p-1.5 text-center font-bold text-rose-600"
          />
          <span className="font-bold">%</span>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-stone-100 space-y-2">
        <p className="font-bold text-stone-700">Periode Laporan Laba Rugi</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-stone-400">Periode Awal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border rounded-xl p-2 mt-0.5"
            />
          </div>
          <div>
            <label className="text-[11px] text-stone-400">Periode Akhir</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border rounded-xl p-2 mt-0.5"
            />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-stone-100 space-y-2.5">
        <div className="flex justify-between py-1">
          <span className="text-stone-500">Penjualan (Pemasukan Bersih)</span>
          <span className="font-semibold">{rp(penjualanBersih)}</span>
        </div>
        <div className="flex justify-between py-1 border-b border-stone-100 pb-2.5">
          <span className="text-stone-500">Harga Pokok Produksi (HPP)</span>
          <span className="font-semibold text-rose-600">-{rp(totalHpp)}</span>
        </div>
        <div className="flex justify-between py-1 text-sm font-bold text-emerald-700">
          <span>GROSS PROFIT</span>
          <span>{rp(grossProfit)}</span>
        </div>

        <div className="pt-2 border-t border-stone-100 space-y-2">
          <p className="font-bold text-stone-600">Beban Operasional & Tambahan</p>
          <div className="flex justify-between items-center text-stone-500">
            <span>Pengeluaran Tercatat (Tab Transaksi)</span>
            <span className="font-semibold text-stone-700">
              {rp(totalPengeluaranTercatat)}
            </span>
          </div>
          {[
            { label: 'Listrik & Internet', val: bebanListrik, set: setBebanListrik },
            { label: 'Sewa Tempat', val: bebanSewa, set: setBebanSewa },
            { label: 'Penyusutan Alat Rajut', val: bebanAlat, set: setBebanAlat },
            { label: 'Biaya Lain-lain', val: bebanLain, set: setBebanLain },
          ].map((b) => (
            <div key={b.label} className="flex justify-between items-center">
              <span className="text-stone-500">{b.label}</span>
              <input
                type="number"
                value={b.val}
                onChange={(e) => b.set(e.target.value)}
                className="w-28 border rounded-lg p-1.5 text-right"
              />
            </div>
          ))}
          <div className="flex justify-between items-center">
            <span className="text-stone-500">Pajak (%)</span>
            <input
              type="number"
              value={pajakPersen}
              onChange={(e) => setPajakPersen(e.target.value)}
              className="w-20 border rounded-lg p-1.5 text-right"
            />
          </div>
        </div>

        <div className="mt-3 p-3.5 rounded-xl bg-stone-900 text-white flex justify-between items-center">
          <div>
            <p className="text-[11px] text-stone-400">NETT PROFIT BERSIH</p>
            <p className="text-lg font-bold text-emerald-400">{rp(nettProfit)}</p>
          </div>
          <span className="text-2xl">📈</span>
        </div>
      </div>
    </div>
  );
}
