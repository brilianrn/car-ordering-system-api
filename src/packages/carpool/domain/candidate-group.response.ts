export interface ICarpoolBooking {
  bookingId: number;
  requesterName: string;
  startDatetime: string; // ISO 8601 Asia/Jakarta
  paxCount: number;
  similarity: string; // e.g., "100%"
  from: string;
  to: string;
}

export interface ICarpoolCandidateGroupResponse {
  groupId: string;
  groupName: string;
  groupColorHex: string;
  bookings: ICarpoolBooking[];
}
