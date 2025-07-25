import { useEffect, useState } from "react";
import { Card, CardHeader, CardContent } from "@call/ui/components/card";
import { Button } from "@call/ui/components/button";
import { Input } from "@call/ui/components/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@call/ui/components/tabs";
import { Separator } from "@call/ui/components/separator";
import { Avatar } from "@call/ui/components/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@call/ui/components/dropdown-menu";
import { formatDistanceToNow, formatDuration, intervalToDuration } from "date-fns";
import { FiPhone, FiSearch, FiX, FiUsers, FiUser, FiGrid, FiTrash2, FiMoreVertical } from "react-icons/fi";
import { useRouter } from "next/navigation";
import { useSession } from "../../../../hooks/useSession";
// import { es } from "date-fns/locale";

interface Participant {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

interface Call {
  id: string;
  name: string;
  creatorId: string;
  joinedAt: string;
  leftAt: string | null;
  participants: Participant[];
}

type FilterType = "all" | "my-calls" | "shared-with-me";

const formatCallDuration = (joinedAt: string, leftAt: string | null) => {
  const start = new Date(joinedAt);
  
  // If leftAt is null, the call hasn't ended properly - show as unknown duration
  if (!leftAt) {
    return 'Unknown duration';
  }
  
  const end = new Date(leftAt);
  
  const duration = intervalToDuration({ start, end });
  
  // Format duration in a human-readable way
  const parts = [];
  if (duration.hours && duration.hours > 0) parts.push(`${duration.hours}h`);
  if (duration.minutes && duration.minutes > 0) parts.push(`${duration.minutes}m`);
  if (duration.seconds && duration.seconds > 0) parts.push(`${duration.seconds}s`);
  
  return parts.length > 0 ? parts.join(' ') : '< 1s';
};

const ParticipantAvatars = ({ participants }: { participants: Participant[] }) => {
  const maxVisible = 4;
  const visibleParticipants = participants.slice(0, maxVisible);
  const remainingCount = participants.length - maxVisible;

  return (
    <div className="flex items-center justify-center gap-1">
      <span className="text-xs text-muted-foreground mr-2">Participants:</span>
      <div className="flex -space-x-2">
        {visibleParticipants.map((participant) => (
          <div key={participant.id} className="relative group">
            <Avatar className="h-8 w-8 border-2 border-white dark:border-gray-900">
              {participant.image ? (
                <img 
                  src={participant.image} 
                  alt={participant.name || participant.email}
                  className="h-full w-full object-cover rounded-full"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
                  {(participant.name || participant.email).charAt(0).toUpperCase()}
                </div>
              )}
            </Avatar>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
              {participant.name || participant.email}
            </div>
          </div>
        ))}
        {remainingCount > 0 && (
          <div className="h-8 w-8 bg-muted border-2 border-white dark:border-gray-900 rounded-full flex items-center justify-center">
            <span className="text-xs text-muted-foreground font-medium">
              +{remainingCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export function CallHistory() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isDeleting, setIsDeleting] = useState(false);
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    const fetchCalls = async () => {
      try {
        const res = await fetch("http://localhost:1284/api/calls/participated", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch calls");
        const data = await res.json();
        setCalls(data.calls);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading calls");
      } finally {
        setLoading(false);
      }
    };

    fetchCalls();
  }, []);

  // Filter calls based on search query and filter type
  const getFilteredCalls = () => {
    let filteredCalls = calls;

    // Apply category filter
    if (activeFilter === "my-calls") {
      filteredCalls = calls.filter(call => call.creatorId === session?.user?.id);
    } else if (activeFilter === "shared-with-me") {
      filteredCalls = calls.filter(call => call.creatorId !== session?.user?.id);
    }

    // Apply search filter
    if (searchQuery) {
      filteredCalls = filteredCalls.filter(call => 
        call.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filteredCalls;
  };

  const filteredCalls = getFilteredCalls();
  
  // Remove duplicate calls by id
  const uniqueCalls = Array.from(new Map(filteredCalls.map(call => [call.id, call])).values());

  const clearSearch = () => {
    setSearchQuery("");
  };

  const deleteHistory = async () => {
    if (!confirm("¿Estás seguro de que quieres borrar todo tu historial de llamadas? Esta acción no se puede deshacer.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch("http://localhost:1284/api/calls/participated", {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error("Failed to delete call history");
      }

      // Clear the calls from state
      setCalls([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting call history");
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteCallParticipation = async (callId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta llamada del historial?")) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:1284/api/calls/participated/${callId}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error("Failed to delete call participation");
      }

      // Remove the call from state
      setCalls(prev => prev.filter(call => call.id !== callId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting call participation");
    }
  };

  const getFilterCounts = () => {
    const myCalls = calls.filter(call => call.creatorId === session?.user?.id).length;
    const sharedWithMe = calls.filter(call => call.creatorId !== session?.user?.id).length;
    
    return {
      all: calls.length,
      myCalls,
      sharedWithMe
    };
  };

  const counts = getFilterCounts();

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="h-12 bg-muted"></CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <p>Error: {error}</p>
        <p className="mt-2">Please try again later</p>
      </div>
    );
  }

    return (
    <div className="space-y-6">
      {/* Header with Search Bar and Delete Button */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Call History</h2>
          {calls.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={deleteHistory}
              disabled={isDeleting}
              className="flex items-center gap-2"
            >
              <FiTrash2 className="h-4 w-4" />
              {isDeleting ? "Deleting..." : "Delete History"}
            </Button>
          )}
        </div>
        
        {/* Search Bar */}
        <div className="relative max-w-md mx-auto">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Search calls by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearSearch}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
              >
                <FiX className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs value={activeFilter} onValueChange={(value) => setActiveFilter(value as FilterType)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <FiGrid className="h-4 w-4" />
            All ({counts.all})
          </TabsTrigger>
          <TabsTrigger value="my-calls" className="flex items-center gap-2">
            <FiUser className="h-4 w-4" />
            My calls ({counts.myCalls})
          </TabsTrigger>
          <TabsTrigger value="shared-with-me" className="flex items-center gap-2">
            <FiUsers className="h-4 w-4" />
            Shared with me ({counts.sharedWithMe})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeFilter} className="mt-6">
          {/* Results */}
          {uniqueCalls.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              {searchQuery ? (
                <>
                  <p>No calls found for "{searchQuery}" in this category</p>
                  <Button 
                    variant="ghost" 
                    onClick={clearSearch}
                    className="mt-2"
                  >
                    Clear search
                  </Button>
                </>
              ) : (
                <p>
                  {activeFilter === "all" && "No call history yet"}
                  {activeFilter === "my-calls" && "You haven't created any calls yet"}
                  {activeFilter === "shared-with-me" && "No calls have been shared with you yet"}
                </p>
              )}
            </div>
          ) : (
            <>
              {searchQuery && (
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Found {uniqueCalls.length} call{uniqueCalls.length === 1 ? '' : 's'} for "{searchQuery}"
                </p>
              )}
              
              <div className="space-y-8 max-w-full mx-auto flex flex-wrap items-center">
      {uniqueCalls.map((call) => (
        <Card
          key={call.id}
          className="transition-shadow hover:shadow-lg border border-muted/60 bg-muted/40 px-8 py-7 mx-auto min-w-[340px] relative"
        >
          {/* Three dots menu */}
          <div className="absolute top-4 right-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-muted"
                >
                  <FiMoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => deleteCallParticipation(call.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <FiTrash2 className="h-4 w-4 mr-2" />
                  Eliminar del historial
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <CardHeader className="p-0 border-0 bg-transparent">
            <div className="flex flex-col items-center gap-4 w-full">
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-2">
                <FiPhone size={28} />
              </span>
              <h3 className="text-xl font-semibold leading-tight break-words text-center">{call.name}</h3>
              <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                <span className="font-mono">ID: {call.id}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="p-1 text-xs"
                  title="Copy Call ID"
                  onClick={() => navigator.clipboard.writeText(call.id)}
                >
                  📋
                </Button>
              </div>

              {/* Horizontal Separator */}
              <Separator className="w-full" />

              {/* Participants Avatars */}
              <ParticipantAvatars participants={call.participants} />

              {/* Call type indicator */}
              <div className="flex items-center gap-1 text-xs">
                {call.creatorId === session?.user?.id ? (
                  <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                    <FiUser className="h-3 w-3" />
                    Created by you
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    <FiUsers className="h-3 w-3" />
                    Shared with you
                  </span>
                )}
              </div>
              <div className="flex flex-col items-center gap-1">
                <time className="text-xs text-muted-foreground">
                  {call.leftAt 
                    ? formatDistanceToNow(new Date(call.leftAt), { addSuffix: true })
                    : "Call in progress"
                  }
                </time>
                <span className="text-xs font-medium text-primary">
                  Duration: {formatCallDuration(call.joinedAt, call.leftAt)}
                </span>
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 