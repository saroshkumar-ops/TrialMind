// src/hooks/useHITL.ts

import { useMutation } from "@tanstack/react-query";
import { hitlApi } from "@/lib/api/hitlApi";
import { HITLReviewRequest } from "@/types/hitl";

export function useHITLReview() {
  return useMutation({
    mutationFn: (payload: HITLReviewRequest) => hitlApi.submitReview(payload),
  });
}