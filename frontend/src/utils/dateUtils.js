/**
 * Centralized Date Utilities for ACFC Kitchen
 * All dates, weekdays, and current-day highlights are calculated using 'Europe/Madrid' timezone.
 */

// Get today's date string in YYYY-MM-DD in Europe/Madrid timezone
export function getMadridTodayStr() {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return dtf.format(now);
}

// Convert a year, month (0-indexed), and day to a YYYY-MM-DD string in Europe/Madrid timezone
export function getMadridDateISO(year, month, day) {
  const date = new Date(year, month, day);
  const dtf = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return dtf.format(date);
}

// Check if a date string in YYYY-MM-DD format is today in Madrid timezone
export function isTodayInMadrid(dateStr) {
  return dateStr === getMadridTodayStr();
}

// Get the Spanish weekday name index for a date in Madrid timezone.
// Spanish index: Mon=0, Tue=1, ..., Sun=6
export function getMadridWeekdayIndex(year, month, day) {
  const date = new Date(year, month, day);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    weekday: 'short'
  });
  const weekdayStr = dtf.format(date); // 'Mon', 'Tue', etc.
  const mapping = { 'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6 };
  return mapping[weekdayStr] ?? 0;
}

// Get the weekday index (0 = Monday, ..., 6 = Sunday) for any Date object in Europe/Madrid
export function getMadridWeekdayIndexForDate(date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    weekday: 'short'
  });
  const weekdayStr = dtf.format(date); // 'Mon', 'Tue', etc.
  const mapping = { 'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6 };
  return mapping[weekdayStr] ?? 0;
}

// Get the year, month (0-indexed), and day for "today" in Madrid
export function getMadridTodayParts() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year').value, 10);
  const month = parseInt(parts.find(p => p.type === 'month').value, 10) - 1; // Convert to 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day').value, 10);
  return { year, month, day };
}

// Get a Date object that aligns with Madrid's current year/month/day
export function getMadridTodayDateObject() {
  const { year, month, day } = getMadridTodayParts();
  return new Date(year, month, day);
}

// Get the current week days (Monday to Sunday) for Menu TV in Madrid timezone
export function getMadridWeekDays() {
  const todayParts = getMadridTodayParts();
  const todayDate = new Date(todayParts.year, todayParts.month, todayParts.day);
  const weekdayIndex = getMadridWeekdayIndexForDate(todayDate);
  
  // Calculate Monday of this week
  const monday = new Date(todayDate);
  monday.setDate(todayDate.getDate() - weekdayIndex);
  monday.setHours(0, 0, 0, 0);
  
  const dates = [];
  const weekdaysText = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    
    const dtf = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const dateStr = dtf.format(d);
    
    dates.push({
      dateStr: dateStr,
      dayNum: d.getDate(),
      dayLabel: weekdaysText[i]
    });
  }
  return { monday, dates };
}

// Get the week range label for Menu TV formatted using Europe/Madrid
export function getMadridWeekRangeLabel(monDate) {
  const sunDate = new Date(monDate);
  sunDate.setDate(monDate.getDate() + 6);
  
  const optionsMonth = { month: 'long', timeZone: 'Europe/Madrid' };
  const monMonth = monDate.toLocaleDateString('en-US', optionsMonth).toUpperCase();
  const sunMonth = sunDate.toLocaleDateString('en-US', optionsMonth).toUpperCase();
  
  return `${monMonth} ${monDate.getDate()} - ${sunMonth} ${sunDate.getDate()}, ${monDate.getFullYear()}`;
}
