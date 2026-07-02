function getCurrentWeekString() {
    const d = new Date();
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const year = d.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${year}-W${weekNo < 10 ? '0' + weekNo : weekNo}`;
}

function getLocalDateString(date) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' });
  return formatter.format(date || new Date());
}

module.exports = { getCurrentWeekString, getLocalDateString };
