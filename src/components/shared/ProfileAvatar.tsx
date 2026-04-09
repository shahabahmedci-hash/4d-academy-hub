import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  avatarUrl?: string | null;
  fullName?: string;
  className?: string;
  fallbackClassName?: string;
}

export default function ProfileAvatar({
  avatarUrl,
  fullName,
  className = "h-10 w-10",
  fallbackClassName,
}: ProfileAvatarProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Avatar className={cn(className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName || "Avatar"} />}
      <AvatarFallback className={cn(fallbackClassName)}>
        {fullName ? getInitials(fullName) : <User className="h-4 w-4" />}
      </AvatarFallback>
    </Avatar>
  );
}
