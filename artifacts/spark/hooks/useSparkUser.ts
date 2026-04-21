import { useEffect, useState, useCallback } from "react";
import { useGetUser, getGetUserQueryKey } from "@workspace/api-client-react";
import {
  getStoredUserId,
  setStoredUserId,
  clearStoredUser,
} from "@/lib/userStore";

export function useSparkUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getStoredUserId().then((id) => {
      setUserId(id);
      setLoaded(true);
    });
  }, []);

  const userQuery = useGetUser(userId ?? "", {
    query: { enabled: !!userId, queryKey: getGetUserQueryKey(userId ?? "") },
  });

  const setUser = useCallback(async (id: string) => {
    await setStoredUserId(id);
    setUserId(id);
  }, []);

  const reset = useCallback(async () => {
    await clearStoredUser();
    setUserId(null);
  }, []);

  return {
    userId,
    user: userQuery.data,
    loaded,
    isLoading: userQuery.isLoading,
    setUser,
    reset,
    refetch: userQuery.refetch,
  };
}
