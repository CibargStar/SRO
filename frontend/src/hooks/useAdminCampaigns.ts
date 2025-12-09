import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllCampaigns, cancelAnyCampaign } from '@/utils/campaign-admin-api';
import type { AdminCampaignsListResponse } from '@/types/campaign';
import type { ApiError } from '@/types';

export interface AdminCampaignsQuery {
  status?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

const adminCampaignsKeys = {
  list: (params: AdminCampaignsQuery) => ['adminCampaigns', params] as const,
};

export function useAdminCampaigns(params: AdminCampaignsQuery) {
  return useQuery<AdminCampaignsListResponse, ApiError>({
    queryKey: adminCampaignsKeys.list(params),
    queryFn: () => getAllCampaigns(params),
    keepPreviousData: true,
  });
}

export function useCancelAnyCampaign() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; message?: string },
    ApiError,
    { campaignId: string; params: AdminCampaignsQuery }
  >({
    mutationFn: ({ campaignId }) => cancelAnyCampaign(campaignId),
    onSuccess: (_res, { params }) => {
      queryClient.invalidateQueries({ queryKey: adminCampaignsKeys.list(params) });
    },
  });
}


