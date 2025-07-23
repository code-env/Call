import { RoomProvider } from "@/components/providers/room";
import RoomPage from "./room";

interface RoomPageProps {
  params: Promise<{
    id: string;
  }>;
}

const Page = async () => {
  return (
    <RoomProvider>
      <RoomPage />
    </RoomProvider>
  );
};

export default Page;
