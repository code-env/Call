"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@call/ui/components/form";
import { Input } from "@call/ui/components/input";
import { Button } from "@call/ui/components/button";
import { apiClient } from "@/lib/api-client";
import { useRouter } from "next/navigation";

const createRoomSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
});

interface CreateRoomForm {
  name: string;
}

const CreateRoom = () => {
  const router = useRouter();
  const form = useForm<CreateRoomForm>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      name: "",
    },
  });

  const onSubmit = async (data: CreateRoomForm) => {
    try {
      const response = await apiClient.post("/api/rooms/create", data);
      if (response.status === 200) {
        router.push(`/r/${response.data.room.id}`);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full max-w-sm space-y-8"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Room Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full">
            Create Room
          </Button>
        </form>
      </Form>
    </div>
  );
};

export default CreateRoom;
