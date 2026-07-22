import { newId } from '../model/ids';
import type { Campaign, LogEntry } from '../model/schemas';

export function addLog(
  campaign: Campaign,
  entry: Omit<LogEntry, 'id' | 'day'> & { day?: number },
): void {
  campaign.log.push({
    id: newId('log'),
    day: entry.day ?? campaign.day,
    kind: entry.kind,
    text: entry.text,
    topicAreaId: entry.topicAreaId,
    candidateId: entry.candidateId,
  });
}
