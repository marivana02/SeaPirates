const PVP_RANKS = [
  { name: 'Tayfa', badge: 'badge_01', min: 1 },
  { name: 'Çırak Gemici', badge: 'badge_02', min: 100 },
  { name: 'Gemici', badge: 'badge_03', min: 250 },
  { name: 'Kıdemli Gemici', badge: 'badge_04', min: 450 },
  { name: 'Çırak Dümenci', badge: 'badge_05', min: 700 },
  { name: 'Dümenci', badge: 'badge_06', min: 1000 },
  { name: 'Kıdemli Dümenci', badge: 'badge_07', min: 1350 },
  { name: 'Tekne Reisi', badge: 'badge_08', min: 1750 },
  { name: 'Kıdemli Tekne Reisi', badge: 'badge_09', min: 2200 },
  { name: 'İkinci Kaptan', badge: 'badge_10', min: 2700 },
  { name: 'Birinci Kaptan', badge: 'badge_11', min: 3250 },
  { name: 'Kaptan', badge: 'badge_12', min: 3850 },
  { name: 'Kıdemli Kaptan', badge: 'badge_13', min: 4500 },
  { name: 'Filo Komutanı', badge: 'badge_14', min: 5200 },
  { name: 'Kıdemli Filo Komutanı', badge: 'badge_15', min: 6000 },
  { name: 'Komodor', badge: 'badge_16', min: 6900 },
  { name: 'Kıdemli Komodor', badge: 'badge_17', min: 7900 },
  { name: 'Amiral', badge: 'badge_18', min: 9000 },
  { name: 'Kıdemli Amiral', badge: 'badge_19', min: 10200 },
  { name: 'Büyük Amiral', badge: 'badge_20', min: 11500 },
  { name: 'Filo Amiri', badge: 'badge_21', min: 13000 },
  { name: 'Denizlerin Efendisi', badge: 'badge_22', min: 14600 },
  { name: 'Korsan Kralı', badge: 'badge_23', min: 16300 },
  { name: 'Korsan İmparatoru', badge: 'badge_24', min: 18100 },
  { name: 'Denizlerin Hakimi', badge: 'badge_25', min: 20000 },
  { name: 'Efsanevi Kaptan', badge: 'badge_26', min: 22000 },
  { name: 'Gölgelerin Avcısı', badge: 'badge_27', min: 24200 },
  { name: 'Fırtına Süvarisi', badge: 'badge_28', min: 26500 },
  { name: 'Ejderha Avcısı', badge: 'badge_29', min: 29000 },
  { name: 'Leviathan Avcısı', badge: 'badge_30', min: 31700 },
  { name: 'Derinliklerin Gardiyanı', badge: 'badge_31', min: 34500 },
  { name: 'Poseidon\'un Seçilmişi', badge: 'badge_32', min: 37500 },
  { name: 'Kuzey Yıldızı', badge: 'badge_33', min: 40700 },
  { name: 'Tsunami Taşıyıcısı', badge: 'badge_34', min: 44100 },
  { name: 'Denizlerin Yargıcı', badge: 'badge_35', min: 47700 },
  { name: 'Kraken Fatihi', badge: 'badge_36', min: 51500 },
  { name: 'Hayalet Gemi Kaptanı', badge: 'badge_37', min: 55500 },
  { name: 'Ölümsüz Korsan', badge: 'badge_38', min: 59700 },
  { name: 'Kadim Denizci', badge: 'badge_39', min: 64100 },
  { name: 'Denizlerin Fatihi', badge: 'badge_40', min: 68700 },
  { name: 'Baron', badge: 'badge_51', min: 73500 },
  { name: 'Vizyoner Kaptan', badge: 'badge_52', min: 78500 },
  { name: 'Yükselmiş Amiral', badge: 'badge_53', min: 83700 },
  { name: 'Hükümdar', badge: 'badge_54', min: 89100 },
  { name: 'Okyanusların Efendisi', badge: 'badge_55', min: 94700 },
  { name: 'Kozmik Korsan', badge: 'badge_58', min: 100500 },
  { name: 'Ebedi Denizci', badge: 'badge_59', min: 106500 },
  { name: 'SeaPirate İlahı', badge: 'badge_60', min: 113000 }
];

function getPvPRank(points) {
  const p = parseInt(points || 0);
  if (p <= 0) {
    const firstRank = PVP_RANKS[0];
    return {
      name: null,
      badge: null,
      min: 0,
      max: firstRank.min,
      nextName: firstRank.name,
      nextBadge: firstRank.badge
    };
  }
  let activeRank = PVP_RANKS[0];
  let activeIdx = 0;
  for (let i = 1; i < PVP_RANKS.length; i++) {
    if (p >= PVP_RANKS[i].min) {
      activeRank = PVP_RANKS[i];
      activeIdx = i;
    } else {
      break;
    }
  }
  const nextRank = PVP_RANKS[activeIdx + 1];
  const max = nextRank ? nextRank.min : 9999999;
  return {
    name: activeRank.name,
    badge: activeRank.badge,
    rankKey: `pvp_rank_${activeRank.badge.replace('badge_', '')}`,
    min: activeRank.min,
    max,
    nextName: nextRank ? nextRank.name : 'Maksimum',
    nextRankKey: nextRank ? `pvp_rank_${nextRank.badge.replace('badge_', '')}` : 'pvp_max',
    nextBadge: nextRank ? nextRank.badge : activeRank.badge
  };
}

module.exports = { PVP_RANKS, getPvPRank };
