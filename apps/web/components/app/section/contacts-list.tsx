"use client";
import { useEffect, useState, useMemo } from "react";
import { Button } from "@call/ui/components/button";
import { Icons } from "@call/ui/components/icons";
import { Input } from "@call/ui/components/input";
import { iconvVariants, UserProfile } from "@call/ui/components/use-profile";
import { cn } from "@call/ui/lib/utils";
import { useSession } from "@/components/providers/session";

import {
  Trash2,
  User,
  Mail,
  Phone,
  X,
  Users,
  Loader2,
  UserPlus,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { useModal } from "@/hooks/use-modal";
import { CALLS_QUERY } from "@/lib/QUERIES";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@call/ui/components/dropdown-menu";
import SocialButton from "@/components/auth/social-button";

interface Contact {
  id: string;
  name?: string;
  email: string;
  image?: string;
}

interface ContactsListProps {
  onAddContact?: () => void;
}

export default function ContactsList({ onAddContact }: ContactsListProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingContact, setDeletingContact] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/contacts`,
        {
          credentials: "include",
        }
      );
      if (!res.ok) throw new Error("Failed to fetch contacts");
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (err) {
      setError("Could not load contacts.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = async (
    contactId: string,
    contactEmail: string
  ) => {
    if (!contactId) return;

    try {
      setDeletingContact(contactId);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/contacts/${contactId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete contact");
      }

      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      toast.success("Contact removed successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete contact"
      );
    } finally {
      setDeletingContact(null);
    }
  };

  // Memoized filtered contacts
  const filteredContacts = useMemo(() => {
    if (!contacts) return [];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      return contacts.filter((contact) => {
        const searchableFields = [contact.name, contact.email];

        return searchableFields.some((field) =>
          field?.toLowerCase().includes(query)
        );
      });
    }

    return contacts;
  }, [contacts, searchQuery]);

  const clearSearch = () => {
    setSearchQuery("");
  };

  const { user } = useSession();

  useEffect(() => {
    if (user.id === "guest") return;
    fetchContacts();
  }, [user.id]);

  if (user.id === "guest") {
    return (
      <div className="container mx-auto px-10 py-6">
        <NoContactsFound onAddContact={onAddContact} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto space-y-6 px-10 py-6">
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="text-primary h-6 w-6 animate-spin" />
            <p className="text-muted-foreground text-sm">Loading contacts...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto space-y-6 px-10 py-6">
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="rounded-full bg-red-50 p-3">
              <User className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-sm text-red-500">Failed to load contacts</p>
            <Button variant="outline" size="sm" onClick={fetchContacts}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const hasContacts = contacts && contacts.length > 0;
  const hasSearchResults = filteredContacts.length > 0;

  return (
    <div className="container mx-auto px-10 py-6">
      <div className="flex flex-col gap-6">
        {hasContacts ? (
          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-md">
              <Input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="focus:ring-primary/20 h-11 rounded-lg border py-2.5 pl-10 pr-10 text-sm focus:outline-none focus:ring-2"
              />
              <Icons.search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearSearch}
                  className="hover:bg-muted/50 absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 transform"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ) : null}

        {/* No results message */}
        {hasContacts && !hasSearchResults && (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="bg-muted/50 rounded-full p-4">
                <User className="text-muted-foreground h-8 w-8" />
              </div>
              <h3 className="text-lg font-medium">No contacts found</h3>
              <p className="text-muted-foreground max-w-sm">
                No contacts match your search criteria. Try adjusting your
                search terms.
              </p>
              {searchQuery && (
                <Button variant="outline" size="sm" onClick={clearSearch}>
                  Clear Search
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Contacts grid */}
        {hasSearchResults && (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredContacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onDeleteContact={handleDeleteContact}
                isDeleting={deletingContact === contact.id}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!hasContacts && <NoContactsFound onAddContact={onAddContact} />}
      </div>
    </div>
  );
}

interface ContactCardProps {
  contact: Contact;
  onDeleteContact: (contactId: string, contactEmail: string) => void;
  isDeleting: boolean;
}

const ContactCard = ({
  contact,
  onDeleteContact,
  isDeleting,
}: ContactCardProps) => {
  const { user } = useSession();
  const router = useRouter();
  const { mutate: createCall, isPending: isInitiatingCall } = useMutation({
    mutationFn: CALLS_QUERY.createCall,
    onSuccess: (data) => {
      toast.success(`Call invitation sent to ${contact.name || contact.email}`);
      router.push(`/app/call/${data.callId}`);
    },
    onError: () => {
      toast.error("Failed to create call");
    },
  });

  const handleCallContact = () => {
    const userName = user?.name || "User";

    createCall({
      name: `Call with ${contact.name || contact.email}`,
      members: [contact.email],
    });
  };

  return (
    <div className="bg-inset-accent flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium first-letter:uppercase">
          {contact.name || "No name"}
        </h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={isInitiatingCall}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={handleCallContact}
              disabled={isInitiatingCall}
            >
              {isInitiatingCall ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Phone className="mr-2 h-4 w-4" />
              )}
              {isInitiatingCall ? "Calling..." : "Call Contact"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDeleteContact(contact.id, contact.email)}
              variant="destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Contact
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        <Mail className="size-4" />
        <span className="text-muted-foreground truncate text-sm">
          {contact.email}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <User className="size-4" />
        <UserProfile
          name={contact.name || contact.email}
          url={contact.image}
          size="sm"
          className="border-inset-accent border"
        />
      </div>
    </div>
  );
};

const NoContactsFound = ({ onAddContact }: { onAddContact?: () => void }) => {
  const { user } = useSession();
  const isGuest = !user?.id || user.id === "guest";

  return (
    <div className="bg-inset-accent border-inset-accent-foreground col-span-full flex h-96 flex-col items-center justify-center gap-4 rounded-xl border p-4 text-center">
      <div className="flex flex-col items-center">
        <h1 className="text-lg font-medium">
          {isGuest
            ? "Sign in to manage contacts"
            : "You don\'t have any contacts yet."}
        </h1>
        <p className="text-muted-foreground">
          {isGuest
            ? "Access your contacts and connect with others."
            : "Add your first contact to start connecting with others."}
        </p>
      </div>
      {isGuest ? (
        <SocialButton />
      ) : (
        onAddContact && (
          <Button
            onClick={onAddContact}
            className="bg-muted-foreground hover:bg-muted-foreground/80"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        )
      )}
    </div>
  );
};
