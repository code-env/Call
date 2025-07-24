export type Params = Record<string, string | number | null | undefined>;

export interface CreateRequestOptions {
  path: string;
  pathParams?: Params;
  queryParams?: Params;
}

export interface UseRequestParams {
  request: (signal: AbortSignal) => Promise<Response>;
  triggers?: unknown[];
  manual?: boolean;
}

export interface UseRequestReturn<ResponseBody> {
  data: ResponseBody | null;
  error: Error | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export interface SideBarProps {
  section?: string;
  onSectionChange?: (section: string) => void;
}

export interface SendInvitationContactsProps {
  open: boolean;
  onClose: () => void;
}

export interface Contributor {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: string;
}

// Team types
export interface TeamMember {
  user_id: string;
  name: string;
  email: string;
}

export interface Team {
  id: string;
  name: string;
  creator_id: string;
  members: TeamMember[];
}

export interface CreateTeamRequest {
  name: string;
  members: string[];
}

type ParticipantType = "local" | "remote" | "screen";

export type Participant = {
  userId: string;
  name: string;
  stream: MediaStream;
  type: ParticipantType;
  micActive?: boolean;
  camActive?: boolean;
  isScreenSharing?: boolean;
  you?: boolean;
};
