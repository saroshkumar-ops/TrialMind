// src/lib/api/hitlApi.ts
// POST /hitl-review
import { apiClient } from "./client";
import { HITLReviewRequest, HITLReviewResponse } from "@/types/hitl";

export const hitlApi = {
  submitReview: async (payload: HITLReviewRequest): Promise<HITLReviewResponse> => {
    const { data } = await apiClient.post<HITLReviewResponse>("/hitl-review", payload);
    return data;
  },
};