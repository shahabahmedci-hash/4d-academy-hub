import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook that checks if the teacher's profile is completed.
 * If not, redirects to /teacher/profile with a toast.
 */
export function useTeacherProfileGate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profileCompleted, setProfileCompleted] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("profile_completed")
          .eq("id", user.id)
          .single();

        if (!profile?.profile_completed) {
          toast({
            title: "Complete Your Profile",
            description: "Please complete your profile before accessing this page.",
          });
          navigate("/teacher/profile");
          return;
        }

        setProfileCompleted(true);
      } catch (error) {
        console.error("Teacher profile gate error:", error);
        navigate("/");
      } finally {
        setLoading(false);
      }
    };
    check();
  }, []);

  return { loading, profileCompleted };
}
