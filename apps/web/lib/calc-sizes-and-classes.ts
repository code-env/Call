type LayoutType = "grid" | "screen" | "focus";

const determineLayout = (
  isScreenShare: boolean,
  othersSharing: boolean,
  others: number
): LayoutType => {
  if (isScreenShare || othersSharing) return "screen";
  if (others <= 1) return "focus";
  return "grid";
};

const getGridColumns = (count: number) => {
  if (count === 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
};

export const calcSizesAndClasses = (
  isYou: boolean,
  isScreenShare: boolean,
  othersSharing: boolean,
  others: number
) => {
  const totalParticipants = others + (isYou ? 1 : 0);

  if (isScreenShare || othersSharing) {
    return {
      containerClasses: "grid grid-cols-1 gap-4 p-4 bg-red-500",
      playerClasses: "w-full h-full",
      screenShareClasses: "col-span-1 row-span-1 w-full h-[600px]",
      participantsClasses:
        "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 mt-4 ",
    };
  }

  switch (totalParticipants) {
    case 1:
      return {
        containerClasses: "flex items-center justify-center p-4 bg-green-500",
        playerClasses: "w-full max-w-2xl h-[400px] bg-yellow-500",
        screenShareClasses: "",
        participantsClasses: "",
      };

    case 2:
      return {
        containerClasses:
          "grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-red-500",
        playerClasses: "w-full h-[300px] md:h-[400px]",
        screenShareClasses: "",
        participantsClasses: "",
        you: "absolute bottom-24 right-24 bg-blue-500",
      };

    case 3:
    case 4:
      return {
        containerClasses: "grid grid-cols-2 gap-4 p-4",
        playerClasses: "w-full h-[250px] md:h-[300px] bg-blue-500",
        screenShareClasses: "",
        participantsClasses: "",
      };

    case 5:
    case 6:
      return {
        containerClasses: "grid grid-cols-2 md:grid-cols-3 gap-4 p-4",
        playerClasses: "w-full h-[200px] md:h-[250px]",
        screenShareClasses: "",
        participantsClasses: "",
      };

    case 7:
    case 8:
    case 9:
      return {
        containerClasses: "grid grid-cols-3 md:grid-cols-4 gap-3 p-4",
        playerClasses: "w-full h-[180px] md:h-[220px]",
        screenShareClasses: "",
        participantsClasses: "",
      };

    case 10:
    case 11:
    case 12:
      return {
        containerClasses:
          "grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4",
        playerClasses: "w-full h-[160px] md:h-[200px]",
        screenShareClasses: "",
        participantsClasses: "",
      };

    default:
      return {
        containerClasses:
          "grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 p-4",
        playerClasses: "w-full h-[140px] md:h-[180px]",
        screenShareClasses: "",
        participantsClasses: "",
      };
  }
};
