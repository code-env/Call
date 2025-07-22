import RoomPage from "./room";

interface RoomPageProps {
  params: Promise<{
    id: string;
  }>;
}

const Page = async ({ params }: RoomPageProps) => {
  const { id } = await params;

  return <RoomPage id={id} />;
};

export default Page;
