const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * Formats a date in Mac-style: "Fri Mar 20 2:08PM"
 * - 3-letter day, 3-letter month, unpadded day, 12-hour time with single-digit hour, uppercase AM/PM
 */
type FormatMessageTime = (date: Date) => string;

export const formatMessageTime: FormatMessageTime = (date) => {
  const day = DAYS[date.getDay()];
  const month = MONTHS[date.getMonth()];
  const dayOfMonth = date.getDate();
  const hours24 = date.getHours();
  const hours = hours24 % 12 || 12;
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours24 < 12 ? 'AM' : 'PM';

  return `${day} ${month} ${dayOfMonth} ${hours}:${minutes}${ampm}`;
};
