export interface IRoom {
  id: string;
  name: string;
  livekitRoomName: string;
  maxParticipants: number;
  emptyTimeout: number;
  metadata?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IParticipant {
  sid: string;
  identity: string;
  name?: string;
  state: string;
  joinedAt: number;
  metadata?: string;
}

export interface IRoomToken {
  token: string;
  roomName: string;
  identity: string;
}
