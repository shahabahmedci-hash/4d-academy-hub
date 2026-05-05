import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, User, Loader2, Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CameraCaptureDialog from "./CameraCaptureDialog";

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl: string | null;
  fullName: string;
  disabled?: boolean;
  canDelete?: boolean;
  onAvatarChange: (url: string | null) => void;
}

export default function AvatarUpload({
  userId,
  currentAvatarUrl,
  fullName,
  disabled = false,
  canDelete = false,
  onAvatarChange,
}: AvatarUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signedUrl = useSignedAvatarUrl(currentAvatarUrl);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Invalid file", description: "Please upload an image file (JPG, PNG, etc.)" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Please upload an image smaller than 2MB" });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const filePath = `${userId}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      // Store the file path (not public URL) since bucket is private
      const avatarUrl = filePath;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", userId);
      if (updateError) throw updateError;

      onAvatarChange(avatarUrl);
      toast({ title: "Success", description: "Profile picture updated successfully" });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to upload profile picture" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!currentAvatarUrl) return;
    if (!window.confirm("Are you sure you want to remove your profile picture?")) return;

    setDeleting(true);
    try {
      const { data: files } = await supabase.storage.from("avatars").list(userId);
      if (files && files.length > 0) {
        await supabase.storage.from("avatars").remove(files.map((f) => `${userId}/${f.name}`));
      }
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);
      if (updateError) throw updateError;

      onAvatarChange(null);
      toast({ title: "Success", description: "Profile picture removed" });
    } catch (error) {
      console.error("Error deleting avatar:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to remove profile picture" });
    } finally {
      setDeleting(false);
    }
  };

  const showDeleteOption = (canDelete || !disabled) && currentAvatarUrl;
  const showUploadOptions = !disabled;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <Avatar className="h-24 w-24 border-2 border-border">
          <AvatarImage src={signedUrl || undefined} alt={fullName} />
          <AvatarFallback className="text-2xl bg-primary/10 text-primary">
            {fullName ? getInitials(fullName) : <User className="h-10 w-10" />}
          </AvatarFallback>
        </Avatar>
        {(showUploadOptions || showDeleteOption) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-md"
                disabled={uploading || deleting}
              >
                {uploading || deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {showUploadOptions && (
                <>
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCameraOpen(true)}>
                    <Camera className="h-4 w-4 mr-2" />
                    Take Photo
                  </DropdownMenuItem>
                </>
              )}
              {showDeleteOption && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Photo
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
        disabled={disabled || uploading}
      />
      {showUploadOptions && (
        <p className="text-xs text-muted-foreground">Tap to upload or capture photo (max 2MB)</p>
      )}
      <CameraCaptureDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={processFile}
      />
    </div>
  );
}
