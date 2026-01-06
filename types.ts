
export interface Participant {
  name: string;
  pdvCode: string;
  opportunities: number;
}

export enum AppStatus {
  IDLE = 'IDLE',
  READY = 'READY',
  COUNTING = 'COUNTING',
  WINNER = 'WINNER'
}

export interface RaffleState {
  participants: Participant[];
  winner: Participant | null;
  status: AppStatus;
  backgroundImage: string;
}
