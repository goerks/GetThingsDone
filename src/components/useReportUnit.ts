import { useState } from 'react';

export type ReportUnit = 'points' | 'tickets';

const KEY = 'getitdone.reportUnit';

function read(): ReportUnit {
  try {
    return window.localStorage.getItem(KEY) === 'tickets' ? 'tickets' : 'points';
  } catch {
    return 'points';
  }
}

/** Whether the reports count points or tickets (stories). The choice is remembered and shared by all reports. */
export function useReportUnit(): [ReportUnit, (unit: ReportUnit) => void] {
  const [unit, setUnit] = useState<ReportUnit>(read);
  const choose = (next: ReportUnit): void => {
    setUnit(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // the choice just will not be remembered
    }
  };
  return [unit, choose];
}
