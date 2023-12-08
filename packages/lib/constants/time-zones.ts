import { rawTimeZones, timeZonesNames } from '@vvo/tzdb';

export const TIME_ZONE_DATA = rawTimeZones;

export type TimeZone = {
  name: string;
  rawOffsetInMinutes: number;
};

export const minutesToHours = (minutes: number): string => {
  const hours = Math.abs(Math.floor(minutes / 60));
  const min = Math.abs(minutes % 60);
  const sign = minutes >= 0 ? '+' : '-';

  return `${sign}${String(hours).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

const getGMTOffsets = (timezones: TimeZone[]): string[] => {
  const gmtOffsets: string[] = [];

  for (const timezone of timezones) {
    const offsetValue = minutesToHours(timezone.rawOffsetInMinutes);
    const gmtText = `GMT ${offsetValue}`;

    gmtOffsets.push(`${timezone.name} ${gmtText}`);
  }

  return gmtOffsets;
};

export const TIME_ZONES_FULL = getGMTOffsets(TIME_ZONE_DATA);

export const TIME_ZONES = timeZonesNames;
