import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

export function Navbar() {
  return (
    <div className="flex items-center p-4 border-b h-16 w-full justify-between bg-background">
      <div className="flex items-center flex-1">
        {/* Mobile sidebar toggle can go here if needed */}
      </div>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Bell className="h-5 w-5" />
        </Button>
        <Avatar className="h-8 w-8 cursor-pointer">
          <AvatarImage src="" />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            U
          </AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}
