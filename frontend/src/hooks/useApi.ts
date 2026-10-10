import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Account, Category } from "@/lib/types";

export const useGet = <T = any>(path: string, params?: Record<string, any>, enabled = true) =>
  useQuery<T>({ queryKey: [path, params ?? {}], queryFn: () => api.get<T>(path, params), enabled });

export const useAccounts = (includeArchived = false) => useGet<Account[]>("/accounts", includeArchived ? { include_archived: true } : undefined);
export const useCategories = () => useGet<Category[]>("/categories");

/** Mutación genérica que invalida TODO el caché (los datos financieros están interrelacionados). */
export function useSave<TBody = any, TRes = any>(fn: (b: TBody) => Promise<TRes>, onOk?: (r: TRes) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      qc.invalidateQueries();
      onOk?.(r);
    },
  });
}
export const useInvalidate = () => {
  const qc = useQueryClient();
  return (key?: QueryKey) => qc.invalidateQueries(key ? { queryKey: key } : undefined);
};
